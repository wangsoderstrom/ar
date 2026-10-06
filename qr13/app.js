import * as THREE from "three";
import { MindARThree } from "./libs/mindar/mindar-image-three.prod.js";
const { CONFIG } = await import("./config.js?v=" + (window.__v || Date.now()));

const $ = (id) => document.getElementById(id);
// Lägg till versionsnummer så att nya filer syns direkt (ingen gammal cache)
const V = window.__v || Date.now();
const bust = (u) => (u ? u + (u.includes("?") ? "&" : "?") + "v=" + V : u);
const T = CONFIG.text;
const ALPHA = CONFIG.alphaMode || "none"; // "none" | "packed" | "separate" | "chroma"

// Fyll i texter från config
document.querySelectorAll("[data-t]").forEach((el) => { el.textContent = T[el.dataset.t] ?? ""; });
document.title = T.title;

// Baggrundsbillede på startsiden
if (CONFIG.startBackground) {
  const st = $("start");
  st.style.backgroundImage = `url("${bust(CONFIG.startBackground)}")`;
  if (CONFIG.startBackgroundColor) {
    st.style.backgroundColor = CONFIG.startBackgroundColor;
    document.body.style.backgroundColor = CONFIG.startBackgroundColor;
  }
  st.classList.add("has-bg");

  // Centrera texten i den lediga ytan ovanför bilden (räknas om för varje skärm)
  const img = new Image();
  img.onload = () => {
    const ratio = img.naturalHeight / img.naturalWidth;
    const layout = () => {
      const share = innerHeight <= 740 ? 0.8 : 1;          // samma som i style.css
      const w = Math.min(innerWidth * share, 560);
      const h = w * ratio;
      st.style.paddingBottom = Math.round(h * 0.95) + "px";  // lite överlapp mot bildens överkant
      st.style.setProperty("--text-offset", (CONFIG.startTextOffset || 0) + "vh");
    };
    layout();
    addEventListener("resize", layout);
  };
  img.src = bust(CONFIG.startBackground);
}

// Sikthjälp (blek bild av verket i sökramen)
if (CONFIG.guideImage) {
  const g = $("guide");
  g.onload = () => {
    g.hidden = false;
    g.parentElement.classList.add("has-guide");
    const o = String(CONFIG.guideOpacity ?? 0.35);
    g.style.opacity = o;
    document.documentElement.style.setProperty("--guide-opacity", o);
  };
  g.src = bust(CONFIG.guideImage);
}

// ---------- Videokällor ----------
const video = $("ar-video");
video.src = bust(CONFIG.video);
video.loop = CONFIG.loop;
video.muted = true;

// Separat alfa-video (bara i läget "separate"). Alltid tyst.
let mask = null;
if (ALPHA === "separate") {
  mask = document.createElement("video");
  Object.assign(mask, { src: bust(CONFIG.alphaVideo), loop: CONFIG.loop, muted: true, playsInline: true, preload: "auto", crossOrigin: "anonymous" });
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
  const ck = CONFIG.chromaKey || {};
  const hex = String(ck.color || "#00ff00").replace("#", "");
  const key = { r: parseInt(hex.slice(0, 2), 16) / 255, g: parseInt(hex.slice(2, 4), 16) / 255, b: parseInt(hex.slice(4, 6), 16) / 255 };
  const MODE = { packed: 1, separate: 2, chroma: 3 }[ALPHA] || 2;
  const m = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uColor: { value: colorTex },
      uAlpha: { value: alphaTex },
      uOpacity: { value: 0 },
      uMode: { value: MODE },
      uKey: { value: new THREE.Vector3(key.r, key.g, key.b) },
      uSimilarity: { value: ck.similarity ?? 0.4 },
      uSmoothness: { value: ck.smoothness ?? 0.08 },
      uSpill: { value: ck.spill ?? 0.1 },
    },
    vertexShader: /* glsl */`
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,
    fragmentShader: /* glsl */`
      uniform sampler2D uColor;
      uniform sampler2D uAlpha;
      uniform float uOpacity;
      uniform int uMode;
      uniform vec3 uKey;
      uniform float uSimilarity, uSmoothness, uSpill;
      varying vec2 vUv;

      // Färgton utan ljushet (samma metod som OBS chroma key)
      vec2 toUV(vec3 c) {
        return vec2(c.r * -0.169 + c.g * -0.331 + c.b * 0.5 + 0.5,
                    c.r * 0.5   + c.g * -0.419 + c.b * -0.081 + 0.5);
      }

      void main() {
        vec3 rgb; float a;
        if (uMode == 1) {
          // Vänster halva = färg, höger halva = alfa (vitt = synligt)
          float x = clamp(vUv.x, 0.002, 0.998) * 0.5;
          rgb = texture2D(uColor, vec2(x, vUv.y)).rgb;
          a   = texture2D(uColor, vec2(x + 0.5, vUv.y)).r;
        } else if (uMode == 3) {
          // Greenscreen: allt som liknar nyckelfärgen blir genomskinligt
          rgb = texture2D(uColor, vUv).rgb;
          float d = distance(toUV(rgb), toUV(uKey)) - uSimilarity;
          a = pow(clamp(d / max(uSmoothness, 0.0001), 0.0, 1.0), 1.5);
          // Ta bort grönt skimmer i kanterna
          float spill = pow(clamp(d / max(uSpill, 0.0001), 0.0, 1.0), 1.5);
          float grey = dot(rgb, vec3(0.2126, 0.7152, 0.0722));
          rgb = mix(vec3(grey), rgb, spill);
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

  // Högre kameraupplösning ger bättre igenkänning av fina linjer.
  patchCameraResolution();

  mindar = new MindARThree({
    container: $("ar"),
    imageTargetSrc: bust(CONFIG.target),
    uiLoading: "no", uiScanning: "no", uiError: "no",
    filterMinCF: CONFIG.filterMinCF,
    filterBeta: CONFIG.filterBeta,
    warmupTolerance: CONFIG.warmupTolerance ?? 3,
    missTolerance: CONFIG.missTolerance ?? 30,
  });
  const { renderer, scene, camera } = mindar;

  // Videoplan. Den ligger i en egen "hållare" som följer verket – när spårningen
  // tappas stannar hållaren kvar på senaste position en stund i stället för att försvinna.
  const mat = makeMaterial();
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(1, CONFIG.videoAspect), mat.material);
  plane.scale.setScalar(CONFIG.scale);
  plane.position.set(CONFIG.offsetX, CONFIG.offsetY, 0.001);
  const holder = new THREE.Group();
  holder.matrixAutoUpdate = false;
  holder.visible = false;
  holder.add(plane);
  scene.add(holder);

  const anchor = mindar.addAnchor(0);
  const GRACE = Math.max(0, CONFIG.lostGrace ?? 3) * 1000;
  let tracking = false;
  let lostAt = 0;

  anchor.onTargetFound = () => {
    tracking = true;
    lostAt = 0;
    if (!targetVisible) {
      targetVisible = true;
      show("scan", false);
      video.muted = muted;
      playAll().catch(() => { video.muted = true; muted = true; updateSoundButtons(); playAll(); });
    }
  };
  anchor.onTargetLost = () => {
    tracking = false;
    lostAt = performance.now();
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

  const clock = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    const dt = clock.getDelta();

    // Följ verket så länge det spåras
    if (tracking && anchor.group.visible) {
      holder.matrix.copy(anchor.group.matrix);
      holder.matrixWorldNeedsUpdate = true;
      holder.visible = true;
    }

    // Tappat för länge? Tona ut, pausa och visa sikthjälpen igen.
    if (!tracking && targetVisible && performance.now() - lostAt > GRACE) {
      targetVisible = false;
      pauseAll();
      show("scan");
    }

    // Mjuk in-/uttoning
    const goal = targetVisible ? 1 : 0;
    const step = CONFIG.fade > 0 ? dt / CONFIG.fade : 1;
    const o = mat.getOpacity();
    const n = o + Math.max(-step, Math.min(step, goal - o));
    mat.setOpacity(n);
    if (n <= 0 && !targetVisible) holder.visible = false;

    renderer.render(scene, camera);
  });
}

// Be om högre kameraupplösning (MindAR frågar annars inte, och många telefoner ger då 640×480)
let cameraPatched = false;
function patchCameraResolution() {
  const w = CONFIG.cameraWidth ?? 1280;
  if (cameraPatched || !w || !navigator.mediaDevices?.getUserMedia) return;
  cameraPatched = true;
  const orig = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
  navigator.mediaDevices.getUserMedia = async (c) => {
    if (c && c.video && typeof c.video === "object") {
      const hi = { ...c, video: { ...c.video, width: { ideal: w }, height: { ideal: Math.round(w * 9 / 16) } } };
      try { return await orig(hi); } catch (_) { /* faller tillbaka nedan */ }
    }
    return orig(c);
  };
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
    v.src = bust(CONFIG.video);
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
