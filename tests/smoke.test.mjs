// smoke.test.mjs — headless boot smoke via the system Chrome (playwright-core).
// Serves the app from a tiny static server, blocks all cross-origin (Firebase)
// requests, then asserts every screen renders with ZERO console errors, no
// horizontal overflow at 360/390px, and basic a11y. Skips gracefully if no
// browser is available so `npm test` still runs the unit layer everywhere.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ROUTES = ["home", "characters", "rules", "wizard", "sheet", "combat", "solo", "gm", "settings"];
const MIME = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml" };
const CHROME_PATHS = [
  process.env.CHROME_PATH,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
].filter(Boolean);

function startServer() {
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split("?")[0]).replace(/^\/+/, "");
    const file = path.join(ROOT, rel || "index.html");
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end("nf"); return; }
    res.writeHead(200, { "content-type": MIME[path.extname(file)] || "application/octet-stream", "cache-control": "no-store" });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve({ server, base: `http://127.0.0.1:${server.address().port}` })));
}

let server, base, browser, page, unavailable = null;
const consoleErrors = [];

before(async () => {
  ({ server, base } = await startServer());
  const { chromium } = await import("playwright-core");
  let launchErr;
  for (const executablePath of [...CHROME_PATHS, null]) {
    try { browser = await chromium.launch(executablePath ? { executablePath, headless: true } : { channel: "chrome", headless: true }); break; }
    catch (e) { launchErr = e; }
  }
  if (!browser) { unavailable = `no browser: ${launchErr?.message || "launch failed"}`; return; }

  page = await browser.newPage({ viewport: { width: 390, height: 800 } });
  // Hermetic: block everything that isn't our local origin (e.g. Firebase/gstatic).
  await page.route("**", (route) => (route.request().url().startsWith(base) ? route.continue() : route.abort()));
  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
  page.on("pageerror", (e) => consoleErrors.push("pageerror: " + e.message));

  // First load: enable gated tabs + seed an active character so the sheet renders fully.
  await page.goto(base + "/index.html", { waitUntil: "load" });
  await page.evaluate(async () => {
    localStorage.setItem("brp:settings", JSON.stringify({ theme: "dark", solo: true, gm: true, advanced: false }));
    const { Store } = await import("/src/store.js");
    const { normalizeCharacter } = await import("/src/derived.js");
    const ch = normalizeCharacter({ name: "Test Runner", nature: "human", archetype: "enforcer", years: "seasoned", attributes: { STR: "A", AGI: "B", INT: "C", EMP: "C" } });
    Store.setActiveId(Store.save(ch).id);
  });
});

after(async () => { if (browser) await browser.close(); if (server) server.close(); });

for (const route of ROUTES) {
  test(`#${route} renders with zero console errors`, async (t) => {
    if (unavailable) return t.skip(unavailable);
    consoleErrors.length = 0;
    await page.goto(base + "/index.html#" + route, { waitUntil: "load" });
    await page.waitForTimeout(250);
    const childCount = await page.$eval("#screen", (el) => el.children.length);
    assert.ok(childCount > 0, `#${route} rendered nothing into #screen`);
    assert.deepEqual(consoleErrors, [], `#${route} produced console errors:\n${consoleErrors.join("\n")}`);
  });
}

test("no horizontal overflow at 360px and 390px on every screen", async (t) => {
  if (unavailable) return t.skip(unavailable);
  for (const width of [360, 390]) {
    await page.setViewportSize({ width, height: 800 });
    for (const route of ROUTES) {
      await page.goto(base + "/index.html#" + route, { waitUntil: "load" });
      await page.waitForTimeout(120);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
      assert.equal(overflow, false, `horizontal overflow at ${width}px on #${route}`);
    }
  }
  await page.setViewportSize({ width: 390, height: 800 });
});

test("a11y basics: labeled nav, main landmark with aria-live", async (t) => {
  if (unavailable) return t.skip(unavailable);
  await page.goto(base + "/index.html#home", { waitUntil: "load" });
  await page.waitForTimeout(150);
  const navLabels = await page.$$eval("#nav .nav__btn", (els) => els.map((e) => e.getAttribute("aria-label")));
  assert.ok(navLabels.length >= 4, "expected at least 4 nav tabs");
  assert.ok(navLabels.every(Boolean), "every nav button needs an aria-label");
  assert.equal(await page.$eval("main#screen", (el) => el.getAttribute("aria-live")), "polite");
  // icon-only nav still has a text label node for screen readers
  const active = await page.$eval("#nav .nav__btn--active", (el) => el.getAttribute("aria-current"));
  assert.equal(active, "page");
});
