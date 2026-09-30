// main.js — entry point / boot.
import { applyTheme, applyGuidance, applyRain } from "./settings.js";
import { skyline } from "./art.js";
import { mountSprite } from "./icons.js";
import { startRouter } from "./router.js";
import { initSync } from "./sync.js";
import { registerServiceWorker } from "./update.js";

// iOS Safari ignores user-scalable=no, so its pinch gesture is cancelled here.
function lockZoom() {
  const stop = (e) => e.preventDefault();
  for (const t of ["gesturestart", "gesturechange", "gestureend"]) document.addEventListener(t, stop, { passive: false });
}

// The boot splash (index.html) fades once the first screen has rendered. It
// never takes pointer events, so it cannot swallow an early tap.
function dismissSplash() {
  const s = document.getElementById("splash");
  if (!s) return;
  requestAnimationFrame(() => { s.classList.add("splash--out"); setTimeout(() => s.remove(), 500); });
}

function boot() {
  lockZoom();
  mountSprite();
  applyTheme();
  applyGuidance();
  applyRain();
  // Atmosphere: a rain layer behind everything, a skyline in the app bar.
  if (!document.getElementById("rain")) document.body.prepend(Object.assign(document.createElement("div"), { id: "rain", ariaHidden: "true" }));
  document.querySelector(".appbar")?.append(skyline("appbar__skyline"));
  startRouter();
  dismissSplash();
  registerServiceWorker();
  // Cloud sync boots asynchronously; the app is fully usable before/without it.
  initSync().catch(() => {});
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
else boot();
