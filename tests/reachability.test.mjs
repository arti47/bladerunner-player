// reachability.test.mjs — LENS: reachability.
//
// The question: can someone who has read no documentation find every capability,
// and understand what they found?
//
// This drives the real app in a real browser against real localStorage, and
// reports EVERY finding in one run — never stop-on-first — so each run shrinks
// the list. A clean run prints what it covered AND what it deliberately does
// not, so "clean" stays a bounded claim.
//
//   R1  every capability has a control that reaches it (runtime + static)
//   R2  every control has an accessible name a stranger can read
//   R3  every dialog is labelled, leaveable, and closes on Escape
//   R4  every empty state names a control on that same screen
//   R5  no control throws or leaves the screen broken
//   R6  anything the app can write for you has a control that writes it
//   R7  a cold start reaches the primary outcome by clicking alone
//   R8  every surfaced panel or mode can explain what it is
//   R9  inside a dialog: controls named, choosers non-empty, one default action
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { ROOT, CHROME_PATHS, startServer, announceSkip } from "./harness.mjs";

// ---------------------------------------------------------------------------
// The lens's own configuration. Everything here is a deliberate boundary and is
// printed on a clean run.
// ---------------------------------------------------------------------------

// Surfaces = a route, plus the sub-panel state that route can be in. Panels are
// seeded through the same localStorage keys the app itself uses.
const SURFACES = [
  { id: "home", route: "home" },
  { id: "characters", route: "characters" },
  { id: "rules", route: "rules" },
  { id: "wizard", route: "wizard" },
  { id: "sheet", route: "sheet" },
  { id: "combat", route: "combat" },
  { id: "settings", route: "settings" },
  ...["case", "shift", "scene", "board", "leads", "wrap", "notes"].map((p) => ({ id: `solo/${p}`, route: "solo", seed: { "brp:solo": { panel: p } } })),
  ...["prep", "play", "fight", "wrap", "notes"].map((p) => ({ id: `gm/${p}`, route: "gm", seed: { "brp:gm": { panel: p } } })),
  ...["basics", "setup", "solo", "board", "table", "reference"].map((p) => ({ id: `tutorial/${p}`, route: "tutorial", seedRaw: { "brp:tutorial": p } })),
];

// A control whose whole accessible name is punctuation or symbols cannot be
// spoken or searched. These are the only names allowed to be glyph-only,
// because they are conventional and always sit in a labelled group.
const GLYPH_ALLOWLIST = [];

// Words a stranger cannot be expected to know before the tutorial explains them.
// A control may USE them, but not be named ONLY by them.
const JARGON_ONLY = ["push", "bane", "shift", "downtime", "resolve", "baseline", "cipher", "oracle", "clincher"];

// R6: things the data layer can generate. A surface offering a free-text field
// for one of these must also offer the control that fills it.
const GENERATABLE = [
  { field: /name/i, control: /🎲|roll|generate/i, surface: /wizard/ },
  { field: /appearance/i, control: /🎲|roll|generate/i, surface: /wizard/ },
  { field: /home/i, control: /🎲|roll|generate/i, surface: /wizard/ },
];

// Deliberately NOT covered by this lens — printed on every clean run.
const NOT_COVERED = [
  "Visual affordance: whether a control LOOKS clickable (colour, contrast, hit area).",
  "Screen-reader narration of CONTENT — reading order, live regions, table semantics.",
  "Wording quality beyond the jargon-only rule: a name can be readable and still be a poor name.",
  "Keyboard-only traversal order (tab sequence) outside dialogs.",
  "Anything behind Firebase sync — the harness runs local-only.",
  "Long pickers (>6 buttons) are checked for names and an exit, but not for scanability or a default choice.",
  "The GM screen's and wizard's deep multi-step flows are entered, but not walked to completion.",
  "Reachability of a capability that exists only in a data file with no module reading it — the static check covers modules, and a separate unit check covers data exports.",
];

// ---------------------------------------------------------------------------

const findings = [];
const add = (code, where, detail) => findings.push({ code, where, detail });
const of = (code) => findings.filter((f) => f.code === code);
const report = (code) => of(code).map((f) => `  · ${f.where}: ${f.detail}`).join("\n");

let server, base, browser, page, unavailable = null;
const pageErrors = [];
const BLOCKED = /net::ERR_FAILED|Failed to load resource/;

const SETTINGS = JSON.stringify({ theme: "dark", solo: true, gm: true, advanced: false });

async function seedFor(surface) {
  await page.evaluate(({ settings, seed, seedRaw }) => {
    localStorage.setItem("brp:settings", settings);
    for (const [k, v] of Object.entries(seed || {})) {
      const cur = (() => { try { return JSON.parse(localStorage.getItem(k) || "{}"); } catch { return {}; } })();
      localStorage.setItem(k, JSON.stringify({ ...cur, ...v }));
    }
    for (const [k, v] of Object.entries(seedRaw || {})) localStorage.setItem(k, v);
  }, { settings: SETTINGS, seed: surface.seed, seedRaw: surface.seedRaw });
}

let nav = 0;
async function open(surface) {
  await page.goto(`${base}/index.html?rx${++nav}#${surface.route}`, { waitUntil: "load" });
  await page.waitForTimeout(60);
  await seedFor(surface);
  await page.goto(`${base}/index.html?rx${++nav}#${surface.route}`, { waitUntil: "load" });
  await page.waitForTimeout(220);
}

// Everything localStorage holds, so a destructive control can be probed safely.
const snapshot = () => page.evaluate(() => JSON.stringify(localStorage));
const restore = (snap) => page.evaluate((s) => { localStorage.clear(); for (const [k, v] of Object.entries(JSON.parse(s))) localStorage.setItem(k, v); }, snap);

// The accessible name of a control, the way a screen reader would build it.
const CONTROL_SELECTOR = "#screen button, #screen a[href], #screen select, #screen input, #screen textarea, #screen [role='button']";
const nameScript = `(el) => {
  const aria = el.getAttribute("aria-label");
  if (aria && aria.trim()) return aria.trim();
  const labelledBy = el.getAttribute("aria-labelledby");
  if (labelledBy) { const t = document.getElementById(labelledBy); if (t && t.textContent.trim()) return t.textContent.trim(); }
  if (el.id) { const l = document.querySelector('label[for="' + el.id + '"]'); if (l && l.textContent.trim()) return l.textContent.trim(); }
  const wrap = el.closest("label");
  if (wrap && wrap.textContent.trim()) return wrap.textContent.trim();
  const title = el.getAttribute("title");
  if (title && title.trim()) return title.trim();
  const text = (el.textContent || "").trim();
  if (text) return text;
  const ph = el.getAttribute("placeholder");
  return ph ? ph.trim() : "";
}`;

const controlsOn = (scope = "#screen") => page.$$eval(
  scope === "#screen" ? CONTROL_SELECTOR : `${scope} button, ${scope} a[href], ${scope} select, ${scope} input, ${scope} textarea`,
  (els, script) => {
    const name = eval(script);
    return els.map((el, i) => ({
      i, tag: el.tagName.toLowerCase(), type: el.getAttribute("type") || "",
      name: name(el), disabled: !!el.disabled, hidden: !el.offsetParent && el.tagName !== "OPTION",
      cls: el.className || "",
    }));
  }, nameScript);

const hasLetters = (s) => /\p{L}/u.test(s);

before(async () => {
  ({ server, base } = await startServer());
  let chromium;
  try { ({ chromium } = await import("playwright-core")); }
  catch { unavailable = "playwright-core is not installed"; }
  if (!unavailable) {
    for (const executablePath of CHROME_PATHS) {
      try { browser = await chromium.launch({ executablePath }); break; } catch {}
    }
    if (!browser) { try { browser = await chromium.launch({ channel: "chrome" }); } catch {} }
    if (!browser) unavailable = "no Chrome/Chromium binary found";
  }
  if (unavailable) { announceSkip("reachability lens", unavailable, 9); return; }

  page = await browser.newPage({ viewport: { width: 390, height: 800 } });
  await page.route("**", (r) => (r.request().url().startsWith(base) ? r.continue() : r.abort()));
  page.on("pageerror", (e) => pageErrors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error" && !BLOCKED.test(m.text())) pageErrors.push(m.text()); });

  // Seed a character so surfaces that need one are real, not empty states.
  await page.goto(`${base}/index.html`, { waitUntil: "load" });
  await page.evaluate(async (settings) => {
    localStorage.setItem("brp:settings", settings);
    const { Store } = await import("/src/store.js");
    const { normalizeCharacter } = await import("/src/derived.js");
    const ch = normalizeCharacter({ name: "Probe", nature: "human", archetype: "enforcer", years: "seasoned", attributes: { STR: "A", AGI: "B", INT: "C", EMP: "C" } });
    Store.setActiveId(Store.save(ch).id);
  }, SETTINGS);

  await crawl();
  await coldStart();
  staticReachability();
});

after(async () => { if (browser) await browser.close(); if (server) server.close(); });

// ---------------------------------------------------------------------------
// The crawl: every surface, every control.
// ---------------------------------------------------------------------------
async function crawl() {
  for (const surface of SURFACES) {
    await open(surface);
    pageErrors.length = 0;

    // R8 — the surface explains itself.
    const explains = await page.$$eval("#screen .muted, #screen .how__line, #screen .card__title + p", (e) => e.map((x) => x.textContent.trim()).filter(Boolean).length);
    if (!explains) add("R8", surface.id, "renders no explanatory text — nothing says what this panel is for");

    // R2 — every control is named and readable. A control inside a collapsed
    // <details> is still on the screen: it needs a name, and an empty state may
    // legitimately point at it. Only the click probe cares about visibility.
    const controls = await controlsOn();
    const controlsOnCache = controls;
    if (!controls.length) add("R1", surface.id, "surface has no controls at all");
    for (const c of controls) {
      const label = c.name;
      if (!label) { add("R2", surface.id, `<${c.tag}${c.type ? " type=" + c.type : ""} class="${c.cls}"> has no accessible name`); continue; }
      if (!hasLetters(label) && !GLYPH_ALLOWLIST.includes(label)) add("R2", surface.id, `control named only by symbols: "${label}"`);
      const words = label.toLowerCase().replace(/[^a-z ]/g, " ").split(/\s+/).filter(Boolean);
      if (words.length === 1 && JARGON_ONLY.includes(words[0])) add("R2", surface.id, `control named by bare jargon: "${label}"`);
    }

    // R4 — empty states point at a control on the same screen.
    const screenLabels = controlsOnCache.map((c) => c.name.toLowerCase()).filter(Boolean);
    const empties = await page.$$eval("#screen .card", (cards) => cards.map((card) => {
      // An empty state is a short card with nothing IN it — not a table of
      // outcomes, a glossary, or a walkthrough that happens to say "No ...".
      if (card.querySelector("li, dl, tr, .board__box, .list__row, .check-row, .hyp-row, .combatant")) return null;
      const txt = (card.textContent || "").replace(/\s+/g, " ").trim();
      if (txt.length > 320) return null;
      if (!/(?:No|Nothing|None|Empty) [a-z]/.test(txt)) return null;
      return { text: txt };   // the whole card: the control may be named in the next sentence
    }).filter(Boolean));
    const spoken = (s) => s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
    // A control's label may carry a parenthetical cost or die ("Learn specialty
    // (5 PP)"); prose that names the control will not repeat it.
    const asName = (s) => spoken(String(s).replace(/\([^)]*\)/g, " "));
    for (const e of empties) {
      const text = spoken(e.text);
      // "Names a control" means the sentence contains that control's label.
      const named = screenLabels.map(asName).some((l) => l.length > 3 && text.includes(l));
      if (!named) add("R4", surface.id, `empty state "${e.text.slice(0, 60)}" names no control on this screen`);
    }

    // R6 — the app writes what it can write.
    for (const g of GENERATABLE) {
      if (!g.surface.test(surface.id)) continue;
      const fields = await page.$$eval("#screen input[type='text'], #screen textarea", (els, script) => {
        const name = eval(script);
        return els.map((el) => ({ name: name(el), card: (el.closest(".card")?.textContent || "") }));
      }, nameScript);
      for (const f of fields) {
        if (!g.field.test(f.name)) continue;
        if (!g.control.test(f.card)) add("R6", surface.id, `free-text "${f.name}" has no control to generate it, though the data layer can`);
      }
    }

    // R5/R3/R9 — probe every control.
    await probeControls(surface);
  }
}

async function probeControls(surface) {
  const total = (await controlsOn()).filter((c) => !c.hidden && !c.disabled && c.tag === "button").length;
  for (let i = 0; i < total; i++) {
    const snap = await snapshot();
    pageErrors.length = 0;
    const target = page.locator(CONTROL_SELECTOR).nth(0);   // re-queried below
    const buttons = page.locator("#screen button:not([disabled])");
    if ((await buttons.count()) <= i) break;
    const btn = buttons.nth(i);
    const label = (await btn.getAttribute("aria-label")) || (await btn.textContent()) || `#${i}`;
    if (!(await btn.isVisible())) continue;
    try { await btn.click({ timeout: 2500 }); } catch { await restore(snap); continue; }
    await page.waitForTimeout(180);

    if (pageErrors.length) add("R5", surface.id, `"${label.trim()}" threw: ${pageErrors[0].slice(0, 120)}`);

    const dialog = await page.$(".modal");
    if (dialog) await auditDialog(surface, label.trim());

    const alive = await page.$eval("#screen", (e) => e.children.length > 0).catch(() => false);
    if (!alive) add("R5", surface.id, `"${label.trim()}" left the screen empty`);

    await restore(snap);
    await open(surface);
  }
}

async function auditDialog(surface, opener) {
  // R3 — labelled, leaveable, closes on Escape.
  const info = await page.evaluate(() => {
    const d = document.querySelector(".modal");
    return {
      label: (d.getAttribute("aria-label") || "").trim(),
      modal: d.getAttribute("aria-modal"),
      buttons: [...d.querySelectorAll("button")].map((b) => (b.getAttribute("aria-label") || b.textContent || "").trim()),
      selects: [...d.querySelectorAll("select")].map((s) => s.options.length),
      primaries: d.querySelectorAll(".btn--primary, .btn--danger").length,
    };
  });
  if (!info.label) add("R3", surface.id, `dialog from "${opener}" has no accessible label`);
  if (info.modal !== "true") add("R3", surface.id, `dialog from "${opener}" is not marked aria-modal`);
  if (!info.buttons.length) add("R3", surface.id, `dialog from "${opener}" has no button to leave by`);

  // R9 — contents.
  for (const [n, b] of info.buttons.entries()) if (!b) add("R9", surface.id, `dialog from "${opener}": button ${n} has no name`);
  for (const [n, count] of info.selects.entries()) if (!count) add("R9", surface.id, `dialog from "${opener}": chooser ${n} has no options`);
  const DECISION_DIALOG_MAX = 6;   // more buttons than this is a picker, not a question
  if (info.buttons.length >= 2 && info.buttons.length <= DECISION_DIALOG_MAX && !info.primaries)
    add("R9", surface.id, `dialog from "${opener}" asks a question but highlights no default among ${info.buttons.length} buttons`);

  await page.keyboard.press("Escape");
  await page.waitForTimeout(160);
  if (await page.$(".modal")) {
    add("R3", surface.id, `dialog from "${opener}" does not close on Escape`);
    await page.evaluate(() => document.querySelectorAll(".modal-overlay").forEach((n) => n.remove()));
  }
}

// R7 — cold start: empty storage to the app's primary outcome, clicks only.
async function coldStart() {
  await page.goto(`${base}/index.html?cold#home`, { waitUntil: "load" });
  await page.evaluate(() => localStorage.clear());
  await page.goto(`${base}/index.html?cold2#home`, { waitUntil: "load" });
  await page.waitForTimeout(260);
  const trail = [];
  const clickByText = async (re) => {
    const b = page.locator("#screen button, #screen a", { hasText: re }).first();
    if (!(await b.count())) return false;
    trail.push((await b.textContent()).trim().slice(0, 30));
    await b.click(); await page.waitForTimeout(320);
    return true;
  };
  // Home must offer a way to make a character without typing a URL.
  if (!(await clickByText(/create|new blade runner|start here|wizard/i))) {
    add("R7", "cold start", "Home offers no control that leads to creating a character");
    return;
  }
  if (!(await clickByText(/roll me a whole|quick|random/i))) {
    add("R7", "cold start", "the wizard offers no one-click build for someone with no rules knowledge");
  }
  const finish = page.locator("#screen .btn--primary").last();
  if (!(await finish.count())) {
    add("R7", "cold start", `the wizard's final step offers no primary action; trail: ${trail.join(" → ")}`);
    return;
  }
  trail.push((await finish.textContent()).trim().slice(0, 30));
  await finish.click();
  await page.waitForTimeout(400);
  const onSheet = await page.evaluate(() => location.hash === "#sheet" && !!document.querySelector(".sheet"));
  if (!onSheet) add("R7", "cold start", `clicking through did not land on a character sheet; trail: ${trail.join(" → ")}`);
}

// R1 (static) — a crawler cannot find a capability that was never wired to a
// control, so check the source too: every named export must be referenced by
// something other than its own definition.
function staticReachability() {
  const files = [
    ...fs.readdirSync(path.join(ROOT, "src")).filter((f) => f.endsWith(".js")).map((f) => path.join("src", f)),
  ];
  const sources = new Map(files.map((f) => [f, fs.readFileSync(path.join(ROOT, f), "utf8")]));
  const all = [...sources.values()].join("\n");
  for (const [file, src] of sources) {
    const names = [
      ...src.matchAll(/^export\s+(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/gm),
      ...src.matchAll(/^export\s+(?:const|let)\s+([A-Za-z_$][\w$]*)/gm),
    ].map((m) => m[1]);
    for (const name of names) {
      // References anywhere outside this file's own definition line. Word
      // boundaries cannot see `$`/`$$`, which are legal identifiers, so bound
      // on the identifier character class instead.
      const esc = name.replace(/[$]/g, "\\$&");
      const others = [...all.matchAll(new RegExp(`(?<![\\w$])${esc}(?![\\w$])`, "g"))].length;
      const own = [...src.matchAll(new RegExp(`^export\\s+(?:async\\s+)?(?:function|const|let)\\s+${esc}(?![\\w$])`, "gm"))].length;
      if (others - own <= 0) add("R1", file, `exports ${name}(), which nothing references — implemented and wired to nothing`);
    }
  }
}

// ---------------------------------------------------------------------------
// One test per check, so a failure names the lens it broke. Every finding is
// already collected — nothing here stops at the first.
// ---------------------------------------------------------------------------
const CHECKS = [
  ["R1", "every capability has a control that reaches it"],
  ["R2", "every control has a readable accessible name"],
  ["R3", "every dialog is labelled, leaveable, and closes on Escape"],
  ["R4", "every empty state names a control on that screen"],
  ["R5", "no control throws or leaves the screen broken"],
  ["R6", "anything the app can write for you has a control that writes it"],
  ["R7", "a cold start reaches a character sheet by clicking alone"],
  ["R8", "every surfaced panel can explain what it is"],
  ["R9", "dialog contents: named controls, filled choosers, one default action"],
];
for (const [code, what] of CHECKS) {
  test(`${code} — ${what}`, async (t) => {
    if (unavailable) return t.skip(unavailable);
    assert.equal(of(code).length, 0, `${of(code).length} finding(s):\n${report(code)}`);
  });
}

test("reachability lens: coverage boundary", async (t) => {
  if (unavailable) return t.skip(unavailable);
  const lines = [
    `# reachability lens — clean.`,
    `# covered: ${SURFACES.length} surfaces (${SURFACES.map((s) => s.id).join(", ")});`,
    `#          every visible button on each, clicked with storage snapshot/restore;`,
    `#          every dialog those clicks opened; ${CHECKS.length} checks R1–R9;`,
    `#          every named export in src/*.js checked for a reference.`,
    `# NOT covered:`,
    ...NOT_COVERED.map((n) => `#   - ${n}`),
  ];
  console.log(lines.join("\n"));
  assert.ok(true);
});
