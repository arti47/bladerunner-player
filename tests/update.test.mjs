// update.test.mjs — the PWA update flow, driven for real: install the service
// worker, ship a "new deploy" (a changed CACHE_VERSION), and assert the app
// offers an actionable toast that swaps the code and reloads.
//
// This runs in its own browser context and its own server because it needs the
// service worker ALIVE — the smoke harness deliberately blocks and ignores it.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml" };

let deployed = false;   // flip to serve a service-worker.js with a new version
function startServer() {
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split("?")[0]).replace(/^\/+/, "");
    const file = path.join(ROOT, rel || "index.html");
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end("nf"); return; }
    let body = fs.readFileSync(file);
    // The "new deploy": same files, bumped cache version (CLAUDE.md §10.6).
    if (deployed && rel === "service-worker.js") body = Buffer.from(String(body).replace(/brp-v\d+/, "brp-vNEXT"));
    res.writeHead(200, { "content-type": MIME[path.extname(file)] || "application/octet-stream", "cache-control": "no-store" });
    res.end(body);
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve({ server, base: `http://127.0.0.1:${server.address().port}` })));
}

function browserPaths() {
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH;
  const bundles = root && fs.existsSync(root)
    ? fs.readdirSync(root).filter((d) => d.startsWith("chromium")).sort().reverse()
      .flatMap((d) => [path.join(root, d, "chrome-linux", "chrome"), path.join(root, d, "chrome-linux", "headless_shell")])
    : [];
  return [process.env.CHROME_PATH, ...bundles,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser",
  ].filter(Boolean).filter((p) => p === process.env.CHROME_PATH || fs.existsSync(p));
}

let server, base, browser, unavailable = null;

before(async () => {
  ({ server, base } = await startServer());
  let chromium;
  try { ({ chromium } = await import("playwright-core")); }
  catch { unavailable = "playwright-core is not installed"; return; }
  for (const executablePath of [...browserPaths(), null]) {
    try { browser = await chromium.launch(executablePath ? { executablePath, headless: true } : { channel: "chrome", headless: true }); break; }
    catch { /* try the next candidate */ }
  }
  if (!browser) unavailable = "no browser available";
});

after(async () => { if (browser) await browser.close(); if (server) server.close(); });

test("a new deploy offers an Update button that swaps the app and reloads", async (t) => {
  if (unavailable) return t.skip(unavailable);
  deployed = false;
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));

  await page.goto(`${base}/index.html`, { waitUntil: "load" });
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, { timeout: 20000 });

  // First install must NOT prompt (and must not bounce the page).
  assert.equal((await page.$$(".toast--action")).length, 0, "a first install is not an update");
  assert.ok(await page.$eval("#screen", (e) => e.children.length > 0), "the app rendered");

  // Ship a new version and check for it the way the app does.
  deployed = true;
  await page.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); await r.update(); });
  await page.waitForSelector(".toast--action", { timeout: 20000 });
  const toast = await page.$eval(".toast--action", (n) => n.textContent);
  assert.match(toast, /new version/i, toast);
  assert.match(toast, /Update now/, "the toast carries the action button");

  // The waiting worker is real, and the old code is still in charge until pressed.
  const before = await page.evaluate(async () => {
    const r = await navigator.serviceWorker.getRegistration();
    return { waiting: !!r.waiting, caches: (await caches.keys()).sort() };
  });
  assert.ok(before.waiting, "the new worker is installed and waiting");
  assert.ok(before.caches.includes("brp-vNEXT") && before.caches.length === 2, `both versions cached: ${before.caches}`);

  // Press it: the new worker takes over, the stale cache is dropped, page reloads.
  // The reload is the point of the feature, so wait for it explicitly — asserting
  // against the old execution context races the navigation away.
  const reloaded = page.waitForNavigation({ waitUntil: "load", timeout: 20000 }).catch(() => null);
  await page.click(".toast__btn");
  await page.waitForFunction(async () => (await caches.keys()).join() === "brp-vNEXT", { timeout: 20000 });
  await reloaded;
  await page.waitForFunction(() => document.readyState === "complete" && !!document.querySelector("#screen"), { timeout: 20000 });
  assert.equal((await page.$$(".toast--action")).length, 0, "the toast is gone after updating");
  assert.ok(await page.$eval("#screen", (e) => e.children.length > 0), "the app still renders after the swap");
  assert.deepEqual(errors, [], errors.join("\n"));
  await ctx.close();
});

test("the toast's button is clickable — the toast region must not eat the press", async (t) => {
  if (unavailable) return t.skip(unavailable);
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.goto(`${base}/index.html`, { waitUntil: "load" });
  await page.waitForTimeout(300);
  const clicked = await page.evaluate(async () => {
    const { showToast } = await import("/src/ui.js");
    let hit = false;
    showToast("test", { timeout: 0, action: { label: "Press me", onClick: () => { hit = true; } } });
    await new Promise((r) => requestAnimationFrame(r));
    const btn = document.querySelector(".toast__btn");
    const box = btn.getBoundingClientRect();
    // What is actually on top at the button's centre?
    const top = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
    btn.click();
    return { hit, onTop: top === btn || btn.contains(top) };
  });
  assert.ok(clicked.onTop, "the button is the top element at its own centre (pointer-events)");
  assert.ok(clicked.hit, "clicking the toast button runs its action");
  await ctx.close();
});
