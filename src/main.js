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
// Mapping UID -> Username
let userNames = {};
// let activeUsers = new Set();

// UPDATE JUMLAH MEMBER REALTIME
const updateMemberCount = () => {
  const membersContainer = document.getElementById("members");

  if (!membersContainer) return;

  // Hitung jumlah elemen anak di dalam div members
  const totalMembers = membersContainer.children.length;

  const maxCapacity = 5; // bisa kamu sesuaikan nanti dari database

  const counterElement = document.getElementById("member-count");
  if (!counterElement) return;

  if (counterElement) {
    counterElement.innerText = `${totalMembers} / ${maxCapacity} Musisi Online`;
  }

  if (totalMembers >= maxCapacity) {
    counterElement.style.color = "red";
  } else {
    counterElement.style.color = "white";
  }

};

// INIT RTC 
const initRtc = async (displayname) => {
  try{
      rtcClient = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });

      localUid = await rtcClient.join(appid, roomId, token, displayname);

      localUsername = displayname;
      const maxCapacity = 5;

      if(rtcClient.remoteUsers.length >= maxCapacity - 1) {
        alert("Room sudah penuh! Coba lagi nanti.")
        await rtcClient.leave();
        return false;
      }
    } catch (error) {
      if(error.code === "UID_CONFLICT") {
        alert("Usernam sudah dipakai ganti username Anda!")
      } else {
        alert("Gagal masuk room:" + error.message)
      }
      throw error;
    }
    
  userNames[localUsername] = displayname;

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
      updateMemberCount();
    }
  });


  // BUAT MICROPHONE TRACK
  audioTracks.localAudioTrack =
    await AgoraRTC.createMicrophoneAudioTrack({
      encoderConfig: "music_standart",
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

    return true;  
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

  const remoteTrack = user.audioTrack;

  if (!remoteTrack) {
    console.warn("Remote track belum siap:", user.uid);
    return;
  }

  audioTracks.remoteAudioTracks[user.uid] = remoteTrack;
  remoteTrack.play();

    if (!document.getElementById(String(user.uid))) {

      const username = user.uid;

      const html = `
        <div class="speaker user-rtc-${user.uid}" id="${user.uid}">
          <p>${username}</p>
        </div>
      `;
      document
        .getElementById("members")
        .insertAdjacentHTML("beforeend", html);
        
      updateMemberCount(); //update realtime
    }
  }
};

let handleUserLeft = (user) => {
  delete audioTracks.remoteAudioTracks[user.uid];

  const userElement = document.getElementById(String(user.uid));
  if (userElement) userElement.remove();

  updateMemberCount(); //update saat user keluar
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

  let joined;

  try {
    joined = await initRtc(displayname);
  } catch {
    return;
  }

  if (!joined) return;

  const usernameRegex = /^[a-zA-Z0-9_]+$/;
  if (!usernameRegex.test(displayname)) {
    alert("Username hanya boleh huruf, angka, dan underscore(_)");
    return;
  }

  

  lobbyForm.style.display = "none";
  document.getElementById("room-header").style.display = "flex";

  const html = `
    <div class="speaker user-rtc-${localUid}" id="${localUid}">
      <p>${localUsername}</p>
    </div>
  `;
  document.getElementById("members").insertAdjacentHTML("beforeend", html);
  updateMemberCount();
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
  updateMemberCount(); // reset 0
};

document.getElementById("leave-icon").addEventListener("click", leaveRoom);