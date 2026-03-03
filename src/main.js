import "./style.css";
import AgoraRTC from "agora-rtc-sdk-ng";
import appid from "./appid.js";

const token = null;
let roomId = "main";

let audioTracks = {
  localAudioTrack: null,
  remoteAudioTracks: {},
};

let micMuted = true;

let rtcClient;
let localUid;
let localUsername;

// INIT RTC 
const initRtc = async (displayname) => {

  rtcClient = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });

  const uid = String(Date.now());
  localUid = await rtcClient.join(appid, roomId, token, uid);

  localUsername = displayname;

  // semua event dipindah ke dalam initRtc
  rtcClient.on("user-published", handleUserPublished);
  rtcClient.on("user-left", handleUserLeft);

  rtcClient.on("user-joined", (user) => {
    if (!document.getElementById(String(user.uid))) {
      const html = `
        <div class="speaker user-rtc-${user.uid}" id="${user.uid}">
          <p>${user.uid}</p>
        </div>
      `;
      document.getElementById("members").insertAdjacentHTML("beforeend", html);
    }
  });


  // BUAT MICROPHONE TRACK
  audioTracks.localAudioTrack =
    await AgoraRTC.createMicrophoneAudioTrack({
      encoderConfig: "music_high_quality_stereo",
      AEC: false,
      ANS: false,
      AGC: false
    });

  // Mic default OFF
  audioTracks.localAudioTrack.setMuted(true);

  // Publish sekali saja
  await rtcClient.publish(audioTracks.localAudioTrack);

  rtcClient.enableAudioVolumeIndicator();

  
  rtcClient.on("volume-indicator", (volumes) => {
    volumes.forEach((volume) => {
      const userElement = document.getElementById(String(volume.uid));
      if (!userElement) return;

      if (volume.level > 5) {
        userElement.style.border = "3px solid #00ff00";
        clearTimeout(userElement._volumeTimeout);

        userElement._volumeTimeout = setTimeout(() => {
          userElement.style.border = "1px solid #ccc";
        }, 300);
      }
    });
  });

  // RTT Monitoring
  setInterval(() => {
    const stats = rtcClient.getRTCStats();
    console.log("RTT:", stats.RTT, "ms");
  }, 1000);
};


// HANDLE REMOTE USER
let handleUserPublished = async (user, mediaType) => {
  try {
    await rtcClient.subscribe(user, mediaType);
  } catch (err) {
    console.warn("Gagal Subscribe:", err.message);
    return;
  }

  if (mediaType === "audio") {
    audioTracks.remoteAudioTracks[user.uid] = user.audioTrack;
    user.audioTrack.play();

    if (!document.getElementById(String(user.uid))) {
      const html = `
        <div class="speaker user-rtc-${user.uid}" id="${user.uid}">
          <p>${user.uid}</p>
        </div>
      `;
      document.getElementById("members").insertAdjacentHTML("beforeend", html);
    }
  }
};

let handleUserLeft = (user) => {
  delete audioTracks.remoteAudioTracks[user.uid];

  const userElement = document.getElementById(String(user.uid));
  if (userElement) userElement.remove();
};


// TOGGLE MIC (AMAN)
const toggleMic = async (e) => {

  if (!audioTracks.localAudioTrack) {
    console.warn("Track belum siap!");
    return;
  }

  micMuted = !micMuted;

  if (!micMuted) {
    e.target.src = "icons/mic.svg";
    e.target.style.backgroundColor = "ivory";
  } else {
    e.target.src = "icons/mic-off.svg";
    e.target.style.backgroundColor = "indianred";
  }

  audioTracks.localAudioTrack.setMuted(micMuted);
};

document.getElementById("mic-icon").addEventListener("click", toggleMic);


// MASUK KE ROOM
let lobbyForm = document.getElementById("form");

const enterRoom = async (e) => {
  e.preventDefault();

  let displayname = e.target.displayname.value.trim();

  if (displayname === "") {
    alert("Username Tidak Boleh Kosong!");
    return;
  }

  if (displayname.length < 3) {
    alert("Username Minimal 3 Huruf!");
    return;
  }

  const usernameRegex = /^[a-zA-Z0-9_]+$/;
  if (!usernameRegex.test(displayname)) {
    alert("Username hanya boleh huruf, angka, dan underscore(_)");
    return;
  }

  await initRtc(displayname);

  lobbyForm.style.display = "none";
  document.getElementById("room-header").style.display = "flex";

  const html = `
    <div class="speaker user-rtc-${localUid}" id="${localUid}">
      <p>${localUsername}</p>
    </div>
  `;
  document.getElementById("members").insertAdjacentHTML("beforeend", html);
};

lobbyForm.addEventListener("submit", enterRoom);


// KELUAR DARI ROOM
let leaveRoom = async () => {
  if (audioTracks.localAudioTrack) {
    audioTracks.localAudioTrack.stop();
    audioTracks.localAudioTrack.close();
  }

  await rtcClient.leave();

  document.getElementById("form").style.display = "block";
  document.getElementById("room-header").style.display = "none";
  document.getElementById("members").innerHTML = "";
};

document.getElementById("leave-icon").addEventListener("click", leaveRoom);