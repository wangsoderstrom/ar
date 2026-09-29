import * as THREE from "three";
import { MindARThree } from "./libs/mindar/mindar-image-three.prod.js";
import { CONFIG } from "./config.js";

const $ = (id) => document.getElementById(id);
const T = CONFIG.text;

// Fyll i texter från config
document.querySelectorAll("[data-t]").forEach((el) => { el.textContent = T[el.dataset.t] ?? ""; });
document.title = T.title;

const video = $("ar-video");
video.src = CONFIG.video;
video.loop = CONFIG.loop;
video.muted = true;

let mindar = null;
let muted = !CONFIG.soundOnStart;
let targetVisible = false;

function show(id, on = true) { $(id).hidden = !on; }

function updateSoundButton() {
  $("btn-sound").textContent = muted ? T.soundOn : T.soundOff;
  $("btn-sound").setAttribute("aria-pressed", String(!muted));
}

// ---------- AR-läge ----------
async function startAR() {
  show("error", false);
  show("start", false);
  show("loading");

  // Låser upp uppspelning (och ljud) på iOS – måste ske direkt i klick-händelsen.
  video.muted = muted;
  try { await video.play(); video.pause(); video.currentTime = 0; } catch (_) { /* ok */ }

  mindar = new MindARThree({
    container: $("ar"),
    imageTargetSrc: CONFIG.target,
    uiLoading: "no", uiScanning: "no", uiError: "no",
    filterMinCF: CONFIG.filterMinCF,
    filterBeta: CONFIG.filterBeta,
  });
  const { renderer, scene, camera } = mindar;

  // Videoplan som ligger på verket. MindAR: 1 enhet = verkets bredd.
  const texture = new THREE.VideoTexture(video);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, opacity: 0 });
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(1, CONFIG.videoAspect), material);
  plane.scale.setScalar(CONFIG.scale);
  plane.position.set(CONFIG.offsetX, CONFIG.offsetY, 0.001);

  const anchor = mindar.addAnchor(0);
  anchor.group.add(plane);

  anchor.onTargetFound = () => {
    targetVisible = true;
    show("scan", false);
    video.muted = muted;
    video.play().catch(() => { video.muted = true; muted = true; updateSoundButton(); video.play(); });
  };
  anchor.onTargetLost = () => {
    targetVisible = false;
    video.pause();
    show("scan");
  };

  try {
    await mindar.start();
  } catch (e) {
    console.warn(e);
    stopAR();
    show("loading", false);
    show("start");
    $("error").textContent = T.cameraError;
    show("error");
    return;
  }

  show("loading", false);
  show("scan");
  show("controls");
  updateSoundButton();

  // Mjuk in-/uttoning
  const clock = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    const dt = clock.getDelta();
    const goal = targetVisible ? 1 : 0;
    const step = CONFIG.fade > 0 ? dt / CONFIG.fade : 1;
    material.opacity += Math.max(-step, Math.min(step, goal - material.opacity));
    renderer.render(scene, camera);
  });
}

function stopAR() {
  if (!mindar) return;
  try { mindar.renderer.setAnimationLoop(null); mindar.stop(); } catch (_) {}
  video.pause();
}

// ---------- Reservläge utan kamera ----------
function startFallback() {
  stopAR();
  show("start", false);
  const v = $("fallback-video");
  v.src = CONFIG.video;
  v.poster = CONFIG.poster;
  v.loop = CONFIG.loop;
  show("fallback");
  v.play().catch(() => {});
}

// ---------- Knappar ----------
$("btn-start").addEventListener("click", startAR);
$("btn-nocam").addEventListener("click", startFallback);
$("btn-close").addEventListener("click", () => {
  $("fallback-video").pause();
  show("fallback", false);
  show("start");
});
$("btn-sound").addEventListener("click", () => {
  muted = !muted;
  video.muted = muted;
  if (targetVisible) video.play().catch(() => {});
  updateSoundButton();
});

// Pausa när fliken göms, frigör kameran när sidan lämnas
document.addEventListener("visibilitychange", () => {
  if (document.hidden) video.pause();
  else if (targetVisible) video.play().catch(() => {});
});
window.addEventListener("pagehide", stopAR);

// Direktlänk till reservläget: index.html#utan-kamera
if (location.hash === "#utan-kamera") startFallback();
