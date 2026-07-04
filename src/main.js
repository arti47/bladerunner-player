// main.js — entry point / boot.
import { applyTheme } from "./settings.js";
import { startRouter } from "./router.js";
import { showToast } from "./ui.js";
import { initSync } from "./sync.js";

function boot() {
  applyTheme();
  startRouter();
  registerServiceWorker();
  // Cloud sync boots asynchronously; the app is fully usable before/without it.
  initSync().catch(() => {});
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  // Skip SW on file:// (dev) — it requires http(s).
  if (location.protocol === "file:") return;
  window.addEventListener("load", async () => {
    try {
      const reg = await navigator.serviceWorker.register("./service-worker.js");
      reg.addEventListener("updatefound", () => {
        const nw = reg.installing;
        nw?.addEventListener("statechange", () => {
          if (nw.state === "installed" && navigator.serviceWorker.controller) {
            showToast("Update available — reload to refresh.", { kind: "info", timeout: 6000 });
          }
        });
      });
    } catch { /* offline / dev — ignore */ }
  });
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
else boot();
