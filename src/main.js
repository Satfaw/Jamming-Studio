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

// ===== RTC kamu (tetap) =====
const initRtc = async () => {
  rtcClient = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });

  //rtcClient.on('user-joined', handleUserJoined)
  rtcClient.on("user-published", handleUserPublished);
  rtcClient.on("user-left", handleUserLeft);

  localUid = await rtcClient.join(appid, roomId, token, null);
  audioTracks.localAudioTrack = await AgoraRTC.createMicrophoneAudioTrack({
  encoderConfig: "music_high_quality_stereo"
});

// Mic default OFF
audioTracks.localAudioTrack.setMuted(true);

// WAJIB publish sekali saja
await rtcClient.publish(audioTracks.localAudioTrack);

//mengaktifkan volume indicator
rtcClient.enableAudioVolumeIndicator();

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

  rtcClient.on("volume-indicator", (volumes) => {
    volumes.forEach((volume) => {
      const userElement = document.getElementById(String(volume.uid));
      if(!userElement) return;

      if (volume.level > 5 ) {
        userElement.style.border = "3 px solid #00ff00";
      }else {
        userElement.style.border = "1 px solid #ccc";
      }
    })
  })
};

let handleUserPublished = async (user, mediaType) => {
  await rtcClient.subscribe(user, mediaType);

  if (mediaType == "audio") {
    audioTracks.remoteAudioTracks[user.uid] = [user.audioTrack];
    user.audioTrack.play(document.body);

    if (!document.getElementById(String(user.uid))) {
      const html = `<div class="speaker user-rtc-${user.uid}" id="${user.uid}">
        <p>${user.uid}</p>
      </div>`;
      document.getElementById("members").insertAdjacentHTML("beforeend", html);
    }
  }
};

let handleUserLeft = async (user) => {
  delete audioTracks.remoteAudioTracks[user.uid];
  //document.getElementById(user.uid).remove()
};

// ===== UI mic kamu (tetap) =====
const toggleMic = async (e) => {
  console.log("MIC CLICKED", micMuted)

  if (micMuted){
    e.target.src = 'icons/mic.svg'
    e.target.style.backgroundColor = 'ivory'
    micMuted = false
  } else {
    e.target.src = 'icons/mic-off.svg'
    e.target.style.backgroundColor = 'indianred'
    micMuted = true
  }

  audioTracks.localAudioTrack.setMuted(micMuted)
  console.log("Muted sekarang:", micMuted)
  console.log("Track enabled:", audioTracks.localAudioTrack.enabled)
}

document.getElementById('mic-icon').addEventListener('click', toggleMic)

let lobbyForm = document.getElementById("form");

const enterRoom = async (e) => {
  e.preventDefault();

  let displayname = e.target.displayname.value;

  // [UBAH] penting: await biar urut & gampang debug
  await initRtc();

  lobbyForm.style.display = "none";
  document.getElementById("room-header").style.display = "flex";

  const addUserBox = (uid) => {
    if (document.getElementById(String(uid))) return; // anti dobel
    const html = `<div class="speaker user-rtc-${uid}" id="${uid}"><p>${uid}</p></div>`;
    document.getElementById("members").insertAdjacentHTML("beforeend", html);
  };

  // setelah join, render diri sendiri
  addUserBox(localUid);

};


let leaveRoom = async () => {
  audioTracks.localAudioTrack.stop();
  audioTracks.localAudioTrack.close();
  rtcClient.unpublish();
  rtcClient.leave();

  document.getElementById("form").style.display = "block";
  document.getElementById("room-header").style.display = "none";
  document.getElementById("members").innerHTML = "";
};

lobbyForm.addEventListener("submit", enterRoom);
document.getElementById("leave-icon").addEventListener("click", leaveRoom);
document.getElementById("mic-icon").addEventListener("click", toggleMic);
