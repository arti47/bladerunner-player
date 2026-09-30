// main.js — entry point / boot.
import { applyTheme, applyGuidance } from "./settings.js";
import { mountSprite } from "./icons.js";
import { startRouter } from "./router.js";
import { initSync } from "./sync.js";
import { registerServiceWorker } from "./update.js";

// iOS Safari ignores user-scalable=no, so its pinch gesture is cancelled here.
function lockZoom() {
  const stop = (e) => e.preventDefault();
  for (const t of ["gesturestart", "gesturechange", "gestureend"]) document.addEventListener(t, stop, { passive: false });
}

function boot() {
  lockZoom();
  mountSprite();
  applyTheme();
  applyGuidance();
  startRouter();
  registerServiceWorker();
  // Cloud sync boots asynchronously; the app is fully usable before/without it.
  initSync().catch(() => {});
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
else boot();
