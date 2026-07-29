// main.js — entry point / boot.
import { applyTheme } from "./settings.js";
import { startRouter } from "./router.js";
import { initSync } from "./sync.js";
import { registerServiceWorker } from "./update.js";

function boot() {
  applyTheme();
  startRouter();
  registerServiceWorker();
  // Cloud sync boots asynchronously; the app is fully usable before/without it.
  initSync().catch(() => {});
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
else boot();
