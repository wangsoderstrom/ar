import * as THREE from "three";
import { MindARThree } from "./libs/mindar/mindar-image-three.prod.js";
import { CONFIG } from "./config.js";

const $ = (id) => document.getElementById(id);
const T = CONFIG.text;
const ALPHA = CONFIG.alphaMode || "none"; // "none" | "packed" | "separate"

// Fyll i texter från config
document.querySelectorAll("[data-t]").forEach((el) => { el.textContent = T[el.dataset.t] ?? ""; });
document.title = T.title;

// ---------- Videokällor ----------
const video = $("ar-video");
video.src = CONFIG.video;
video.loop = CONFIG.loop;
video.muted = true;

// Separat alfa-video (bara i läget "separate"). Alltid tyst.
let mask = null;
if (ALPHA === "separate") {
  mask = document.createElement("video");
  Object.assign(mask, { src: CONFIG.alphaVideo, loop: CONFIG.loop, muted: true, playsInline: true, preload: "auto", crossOrigin: "anonymous" });
  mask.setAttribute("playsinline", "");
  mask.setAttribute("webkit-playsinline", "");
}

function playAll() {
  const p = video.play();
  if (mask) { mask.currentTime = video.currentTime; mask.play().catch(() => {}); }
  return p;
}
function pauseAll() { video.pause(); if (mask) mask.pause(); }

// Håll alfa-videon i synk med färgvideon
if (mask) {
  const sync = () => {
    if (video.paused) return;
    const d = Math.abs(mask.currentTime - video.currentTime);
    if (d > 0.08 && d < video.duration - 0.2) mask.currentTime = video.currentTime;
    if (mask.paused) mask.play().catch(() => {});
  };
  video.addEventListener("timeupdate", sync);
  video.addEventListener("seeked", () => { mask.currentTime = video.currentTime; });
}

// ---------- Material: vanlig video eller video med alfa ----------
function makeMaterial() {
  if (ALPHA === "none") {
    const tex = new THREE.VideoTexture(video);
    tex.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0 });
    return { material: m, setOpacity: (o) => { m.opacity = o; }, getOpacity: () => m.opacity };
  }

  // Råa sRGB-värden in, råa ut → färgerna blir exakt som i videofilen.
  const colorTex = new THREE.VideoTexture(video);
  const alphaTex = mask ? new THREE.VideoTexture(mask) : colorTex;
  const m = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uColor: { value: colorTex },
      uAlpha: { value: alphaTex },
      uOpacity: { value: 0 },
      uPacked: { value: ALPHA === "packed" ? 1 : 0 },
    },
    vertexShader: /* glsl */`
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,
    fragmentShader: /* glsl */`
      uniform sampler2D uColor;
      uniform sampler2D uAlpha;
      uniform float uOpacity;
      uniform int uPacked;
      varying vec2 vUv;
      void main() {
        vec3 rgb; float a;
        if (uPacked == 1) {
          // Vänster halva = färg, höger halva = alfa (vitt = synligt)
          float x = clamp(vUv.x, 0.002, 0.998) * 0.5;
          rgb = texture2D(uColor, vec2(x, vUv.y)).rgb;
          a   = texture2D(uColor, vec2(x + 0.5, vUv.y)).r;
        } else {
          rgb = texture2D(uColor, vUv).rgb;
          a   = texture2D(uAlpha, vUv).r;
        }
        gl_FragColor = vec4(rgb, a * uOpacity);
      }
    `,
  });
  return { material: m, setOpacity: (o) => { m.uniforms.uOpacity.value = o; }, getOpacity: () => m.uniforms.uOpacity.value };
}

let mindar = null;
let muted = !CONFIG.soundOnStart;
let targetVisible = false;

function show(id, on = true) { $(id).hidden = !on; }

function updateSoundButtons() {
  for (const id of ["btn-sound", "btn-fb-sound"]) {
    const b = $(id); if (!b) continue;
    b.textContent = muted ? T.soundOn : T.soundOff;
    b.setAttribute("aria-pressed", String(!muted));
  }
}

async function unlockPlayback() {
  // iOS: uppspelning (och ljud) måste låsas upp direkt i klick-händelsen.
  video.muted = muted;
  const tries = [video.play().then(() => { video.pause(); video.currentTime = 0; })];
  if (mask) tries.push(mask.play().then(() => { mask.pause(); mask.currentTime = 0; }));
  await Promise.allSettled(tries);
}

// ---------- AR-läge ----------
async function startAR() {
  show("error", false);
  show("start", false);
  show("loading");

  await unlockPlayback();

  mindar = new MindARThree({
    container: $("ar"),
    imageTargetSrc: CONFIG.target,
    uiLoading: "no", uiScanning: "no", uiError: "no",
    filterMinCF: CONFIG.filterMinCF,
    filterBeta: CONFIG.filterBeta,
  });
  const { renderer, scene, camera } = mindar;

  // Videoplan som ligger på verket. MindAR: 1 enhet = verkets bredd.
  const mat = makeMaterial();
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(1, CONFIG.videoAspect), mat.material);
  plane.scale.setScalar(CONFIG.scale);
  plane.position.set(CONFIG.offsetX, CONFIG.offsetY, 0.001);

  const anchor = mindar.addAnchor(0);
  anchor.group.add(plane);

  anchor.onTargetFound = () => {
    targetVisible = true;
    show("scan", false);
    video.muted = muted;
    playAll().catch(() => { video.muted = true; muted = true; updateSoundButtons(); playAll(); });
  };
  anchor.onTargetLost = () => {
    targetVisible = false;
    pauseAll();
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
  updateSoundButtons();

  // Mjuk in-/uttoning
  const clock = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    const dt = clock.getDelta();
    const goal = targetVisible ? 1 : 0;
    const step = CONFIG.fade > 0 ? dt / CONFIG.fade : 1;
    const o = mat.getOpacity();
    mat.setOpacity(o + Math.max(-step, Math.min(step, goal - o)));
    renderer.render(scene, camera);
  });
}

function stopAR() {
  if (!mindar) return;
  try { mindar.renderer.setAnimationLoop(null); mindar.stop(); } catch (_) {}
  pauseAll();
}

// ---------- Reservläge utan kamera ----------
let fbRenderer = null;

function startFallback() {
  stopAR();
  show("start", false);
  show("fallback");

  if (ALPHA === "none") {
    const v = $("fallback-video");
    v.src = CONFIG.video;
    v.poster = CONFIG.poster;
    v.loop = CONFIG.loop;
    v.hidden = false;
    v.play().catch(() => {});
    return;
  }

  // Video med alfa: rita den med samma shader på en mörk bakgrund.
  $("fallback-video").hidden = true;
  const canvas = $("fallback-canvas");
  canvas.hidden = false;
  show("btn-fb-sound");
  updateSoundButtons();

  if (!fbRenderer) {
    fbRenderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    fbRenderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    const scene = new THREE.Scene();
    const cam = new THREE.OrthographicCamera(-0.5, 0.5, CONFIG.videoAspect / 2, -CONFIG.videoAspect / 2, -1, 1);
    const mat = makeMaterial();
    mat.setOpacity(1);
    scene.add(new THREE.Mesh(new THREE.PlaneGeometry(1, CONFIG.videoAspect), mat.material));
    const resize = () => {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      fbRenderer.setSize(w, h, false);
      const s = Math.max(1 / w, CONFIG.videoAspect / h); // passa in hela videon
      cam.left = -w * s / 2; cam.right = w * s / 2; cam.top = h * s / 2; cam.bottom = -h * s / 2;
      cam.updateProjectionMatrix();
    };
    resize();
    addEventListener("resize", resize);
    fbRenderer.setAnimationLoop(() => fbRenderer.render(scene, cam));
  }
  video.muted = muted;
  playAll().catch(() => { video.muted = true; muted = true; updateSoundButtons(); playAll(); });
}

// ---------- Knappar ----------
$("btn-start").addEventListener("click", startAR);
$("btn-nocam").addEventListener("click", startFallback);
$("btn-close").addEventListener("click", () => {
  $("fallback-video").pause();
  pauseAll();
  show("fallback", false);
  show("start");
});
function toggleSound() {
  muted = !muted;
  video.muted = muted;
  if (targetVisible || !$("fallback").hidden) video.play().catch(() => {});
  updateSoundButtons();
}
$("btn-sound").addEventListener("click", toggleSound);
$("btn-fb-sound").addEventListener("click", toggleSound);

// Pausa när fliken göms, frigör kameran när sidan lämnas
document.addEventListener("visibilitychange", () => {
  if (document.hidden) pauseAll();
  else if (targetVisible) playAll().catch(() => {});
});
window.addEventListener("pagehide", stopAR);

// Direktlänk till reservläget: index.html#utan-kamera
if (location.hash === "#utan-kamera") startFallback();
