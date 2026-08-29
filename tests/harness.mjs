// harness.mjs — shared plumbing for the browser-driven audits.
// Browser discovery and a static file server, in one place so a new lens does
// not re-derive them. Existing suites keep their own copies deliberately.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MIME = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml" };

function playwrightBundles() {
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (!root || !fs.existsSync(root)) return [];
  return fs.readdirSync(root)
    .filter((d) => d.startsWith("chromium"))
    .sort().reverse()
    .flatMap((d) => [path.join(root, d, "chrome-linux", "chrome"), path.join(root, d, "chrome-linux", "headless_shell")]);
}
export const CHROME_PATHS = [
  process.env.CHROME_PATH,
  ...playwrightBundles(),
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
].filter(Boolean).filter((p) => p === process.env.CHROME_PATH || fs.existsSync(p));

export function startServer() {
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split("?")[0]).replace(/^\/+/, "");
    const file = path.join(ROOT, rel || "index.html");
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end("nf"); return; }
    res.writeHead(200, { "content-type": MIME[path.extname(file)] || "application/octet-stream", "cache-control": "no-store" });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve({ server, base: `http://127.0.0.1:${server.address().port}` })));
}

// A skipped browser layer reads exactly like a pass in TAP output, so say it
// loudly. Called by every browser-driven suite when it cannot start.
export function announceSkip(suite, reason, checkCount) {
  const line = `#\n# !! ${suite}: NOT RUN — ${reason}\n# !! ${checkCount} checks did not execute. This run proves nothing about them.\n# !! Install the dev dependency (npm install) or set CHROME_PATH.\n#`;
  console.log(line);
}
