import "./style.css";
import AgoraRTC from "agora-rtc-sdk-ng";
import AgoraRTM from "agora-rtm-sdk";
import appid from "./appid.js";

const token = null;
const rtcUid = Math.floor(Math.random() * 2032);
const rtmUid = String(Math.floor(Math.random() * 2032));

let roomId = "main";

let audioTracks = {
  localAudioTrack: null,
  remoteAudioTracks: {},
};

let micMuted = true;

let rtcClient;
let rtmClient;
// let channel; // [UBAH] RTM v2 tidak pakai channel object gaya v1

// ===== RTM v2 =====
let initRtm = async (name) => {
  // [UBAH] RTM v2: buat client pakai class RTM
  rtmClient = new AgoraRTM.RTM(appid, rtmUid, { token: token ?? "" });

  // [UBAH] login
  await rtmClient.login();

  // [UBAH] subscribe ke "roomId" (channel messaging)
  await rtmClient.subscribe(roomId);

  rtmClient.addOrUpdateLocalUserAttributes({'key1':'value', 'key2':'value'})

  // [TAMBAH] contoh publish pesan (test)
  // await rtmClient.publish(roomId, "Hello from RTM v2", { channelType: "MESSAGE" });

  window.addEventListener("beforeunload", leaveRtmChannel);

  // [UBAH] RTM v2 TIDAK ADA:
  // channel.on('MemberJoined', ...)
  // channel.on('MemberLeft', ...)
  // getChannelMembers() via channel.getMembers()
};

// ===== RTC kamu (tetap) =====
const initRtc = async () => {
  rtcClient = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });

  //rtcClient.on('user-joined', handleUserJoined)
  rtcClient.on("user-published", handleUserPublished);
  rtcClient.on("user-left", handleUserLeft);

  await rtcClient.join(appid, roomId, token, rtcUid);
  audioTracks.localAudioTrack = await AgoraRTC.createMicrophoneAudioTrack();
  audioTracks.localAudioTrack.setMuted(micMuted);
  await rtcClient.publish(audioTracks.localAudioTrack);

  //initVolumeIndicator()
};

let handleUserPublished = async (user, mediaType) => {
  await rtcClient.subscribe(user, mediaType);

  if (mediaType == "audio") {
    audioTracks.remoteAudioTracks[user.uid] = [user.audioTrack];
    user.audioTrack.play();
  }
};

let handleUserLeft = async (user) => {
  delete audioTracks.remoteAudioTracks[user.uid];
  //document.getElementById(user.uid).remove()
};

// ===== UI mic kamu (tetap) =====
const toggleMic = async (e) => {
  if (micMuted) {
    e.target.src = "icons/mic.svg";
    e.target.style.backgroundColor = "ivory";
    micMuted = false;
  } else {
    e.target.src = "icons/mic-off.svg";
    e.target.style.backgroundColor = "indianred";
    micMuted = true;
  }
  audioTracks.localAudioTrack.setMuted(micMuted);
};

let lobbyForm = document.getElementById("form");

const enterRoom = async (e) => {
  e.preventDefault();

  let displayName = e.target.displayName.value;

  // [UBAH] penting: await biar urut & gampang debug
  await initRtc();
  await initRtm(displayName);

  lobbyForm.style.display = "none";
  document.getElementById("room-header").style.display = "flex";

  const addUserBox = (uid) => {
    if (document.getElementById(String(uid))) return; // anti dobel
    const html = `<div class="speaker user-rtc-${uid}" id="${uid}"><p>${uid}</p></div>`;
    document.getElementById("members").insertAdjacentHTML("beforeend", html);
  };

  // setelah join, render diri sendiri
  addUserBox(rtcUid);

  // kalau ada user lain join
  rtcClient.on("user-joined", (user) => addUserBox(user.uid));

  // kalau ada user publish (biasanya ini yang pasti kejadian pas dia aktif audio)
  rtcClient.on("user-published", async (user, mediaType) => {
    addUserBox(user.uid);
    await rtcClient.subscribe(user, mediaType);
    if (mediaType === "audio") user.audioTrack.play();
  });

  // kalau user keluar
  rtcClient.on("user-left", (user) => {
    document.getElementById(String(user.uid))?.remove();
  });
};

let leaveRtmChannel = async () => {
  // [UBAH] RTM v2: tidak ada channel.leave()
  try {
    await rtmClient?.logout();
  } catch (e) {
    console.log(e);
  }
};

let leaveRoom = async () => {
  audioTracks.localAudioTrack.stop();
  audioTracks.localAudioTrack.close();
  rtcClient.unpublish();
  rtcClient.leave();

  await leaveRtmChannel();

  document.getElementById("form").style.display = "block";
  document.getElementById("room-header").style.display = "none";
  document.getElementById("members").innerHTML = "";
};

lobbyForm.addEventListener("submit", enterRoom);
document.getElementById("leave-icon").addEventListener("click", leaveRoom);
document.getElementById("mic-icon").addEventListener("click", toggleMic);
