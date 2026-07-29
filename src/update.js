// update.js — PWA update flow: notice a new deploy, offer it, apply it.
// Kept out of main.js so the Settings screen can import it without a cycle
// (main -> router -> screens -> update).
import { showToast } from "./ui.js";

let registration = null;      // the live ServiceWorkerRegistration
let reloading = false;        // guards against a reload loop on controllerchange
let updatePrompted = false;   // one toast per waiting worker
let updateRequested = false;  // only a user-pressed update may reload the page

function boot() {
  applyTheme();
  startRouter();
  registerServiceWorker();
  // Cloud sync boots asynchronously; the app is fully usable before/without it.
  initSync().catch(() => {});
}

export function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  // Skip SW on file:// (dev) — it requires http(s).
  if (location.protocol === "file:") return;

  // Reload into the new code when the worker we asked for takes over. The very
  // first install also fires controllerchange (clients.claim) — reloading there
  // would bounce every new visitor, so only a pressed "Update now" counts.
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!updateRequested || reloading) return;
    reloading = true;
    location.reload();
  });

  window.addEventListener("load", async () => {
    try {
      registration = await navigator.serviceWorker.register("./service-worker.js");

      // Already waiting from a previous visit (deploy landed while the app was shut).
      if (registration.waiting && navigator.serviceWorker.controller) promptUpdate();

      registration.addEventListener("updatefound", () => {
        const nw = registration.installing;
        nw?.addEventListener("statechange", () => {
          // controller == null means this is the FIRST install — nothing to update.
          if (nw.state === "installed" && navigator.serviceWorker.controller) promptUpdate();
        });
      });

      // Look for a new deploy on launch, and whenever the app comes back to the
      // foreground — an installed PWA can sit for days between launches.
      checkForUpdates();
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") checkForUpdates();
      });
    } catch { /* offline / dev — ignore */ }
  });
}

// Ask GitHub Pages whether service-worker.js changed. Returns false when there
// is nothing to do, so Settings can say "you're on the latest version".
export async function checkForUpdates() {
  if (!registration) return false;
  try { await registration.update(); } catch { return false; }
  return !!registration.waiting;
}

// The toast that actually applies it: tell the waiting worker to take over, and
// the controllerchange listener above reloads into the new code.
export function applyUpdate() {
  updateRequested = true;
  const waiting = registration?.waiting;
  if (!waiting) { location.reload(); return; }
  waiting.postMessage({ type: "SKIP_WAITING" });
}

function promptUpdate() {
  if (updatePrompted) return;
  updatePrompted = true;
  showToast("A new version is available.", {
    kind: "info",
    timeout: 0,                       // stays until pressed or dismissed
    action: { label: "Update now", onClick: applyUpdate },
  });
}
