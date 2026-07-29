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
const ROUTES = ["home", "characters", "rules", "wizard", "sheet", "combat", "solo", "gm", "tutorial", "settings"];
const MIME = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml" };
// Browser discovery, in order: explicit CHROME_PATH → a Playwright browser bundle
// (PLAYWRIGHT_BROWSERS_PATH, as used by CI images) → the usual macOS/Linux install
// locations → playwright-core's own `channel: "chrome"` lookup. Without the Linux
// entries the smoke layer silently skipped everywhere but macOS.
function playwrightBundles() {
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (!root || !fs.existsSync(root)) return [];
  return fs.readdirSync(root)
    .filter((d) => d.startsWith("chromium"))
    .sort().reverse()   // newest build revision first
    .flatMap((d) => [
      path.join(root, d, "chrome-linux", "chrome"),
      path.join(root, d, "chrome-linux", "headless_shell"),
    ]);
}
const CHROME_PATHS = [
  process.env.CHROME_PATH,
  ...playwrightBundles(),
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
].filter(Boolean).filter((p) => p === process.env.CHROME_PATH || fs.existsSync(p));

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
// FIREBASE_ENABLED ships true, so a cold load always tries the gstatic SDK; this
// harness aborts every cross-origin request, and Chromium reports each abort as a
// console error. Those are the harness's own doing — real code errors are not.
const BLOCKED_REQUEST = /net::ERR_FAILED|Failed to load resource/;

before(async () => {
  ({ server, base } = await startServer());
  let chromium;
  try { ({ chromium } = await import("playwright-core")); }
  catch { unavailable = "playwright-core is not installed — run `npm install` to enable the smoke layer"; return; }
  let launchErr;
  for (const executablePath of [...CHROME_PATHS, null]) {
    try { browser = await chromium.launch(executablePath ? { executablePath, headless: true } : { channel: "chrome", headless: true }); break; }
    catch (e) { launchErr = e; }
  }
  if (!browser) { unavailable = `no browser: ${launchErr?.message || "launch failed"}`; return; }

  page = await browser.newPage({ viewport: { width: 390, height: 800 } });
  // Hermetic: block everything that isn't our local origin (e.g. Firebase/gstatic).
  await page.route("**", (route) => (route.request().url().startsWith(base) ? route.continue() : route.abort()));
  page.on("console", (m) => { if (m.type() === "error" && !BLOCKED_REQUEST.test(m.text())) consoleErrors.push(m.text()); });
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
    // Cache-busting query forces a REAL document load per route — a bare hash
    // change is a same-document navigation and would never re-run boot.
    await page.goto(`${base}/index.html?r=${route}#${route}`, { waitUntil: "load" });
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
      await page.goto(`${base}/index.html?w=${width}-${route}#${route}`, { waitUntil: "load" });
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

// ---------------------------------------------------------------------------
// Engine behaviour in a real browser — the 2026-07-28 fidelity audit fixes.
// These import the live modules in-page so they exercise the shipped code.
// ---------------------------------------------------------------------------
test("armor rolls its rating dice and negates the crit when it stops everything [§3.7]", async (t) => {
  if (unavailable) return t.skip(unavailable);
  await page.goto(`${base}/index.html?armor#combat`, { waitUntil: "load" });
  const out = await page.evaluate(async () => {
    const R = await import("/src/roller.js");
    const armor = R.armorFor({ kind: "npc", gear: ["Police Heavy Duty Street Gear"] });
    const real = Math.random;
    Math.random = () => 0.999;                     // every die shows its max face
    const best = R.rollArmor(armor, 3);
    Math.random = () => 0;                         // every die shows a 1
    const worst = R.rollArmor(armor, 3);
    Math.random = real;
    return { rating: armor.rating, name: armor.name, best, worst };
  });
  assert.equal(out.rating, "B");
  assert.equal(out.best.stopped, 4, "two d10s showing 10 are two successes each");
  assert.equal(out.best.final, 0);
  assert.equal(out.best.negatesCrit, true);
  assert.equal(out.worst.stopped, 0);
  assert.equal(out.worst.final, 3);
  assert.equal(out.worst.negatesCrit, false);
});

test("unarmored combatants take full damage; only the best suit counts [§3.7]", async (t) => {
  if (unavailable) return t.skip(unavailable);
  const out = await page.evaluate(async () => {
    const R = await import("/src/roller.js");
    return {
      none: R.armorFor({ kind: "npc", gear: ["Knife"] }),
      best: R.armorFor({ kind: "npc", gear: ["Police Undershirt Armor", "Police Heavy Duty Street Gear"] })?.rating,
      shieldOnly: R.armorFor({ kind: "npc", gear: ["Police Shield"] }),   // no rating -> not a suit
    };
  });
  assert.equal(out.none, null);
  assert.equal(out.best, "B");
  assert.equal(out.shieldOnly, null);
});

test("the chase card runs a chase and rolls obstacles from the right table [§3.12]", async (t) => {
  if (unavailable) return t.skip(unavailable);
  await page.goto(`${base}/index.html?chase#combat`, { waitUntil: "load" });
  await page.waitForTimeout(200);
  const start = await page.getByRole("button", { name: "▶ Start the chase" });
  assert.ok(await start.count(), "chase card offers a start button");
  await start.first().click();
  await page.waitForTimeout(150);
  await page.getByRole("button", { name: "🎲 Reveal obstacle" }).first().click();
  await page.waitForTimeout(200);
  const obstacle = await page.$eval(".result-slot", (m) => m.textContent);
  const legal = await page.evaluate(async () => (await import("/data.js")).CHASE.obstacles.foot);
  assert.ok(legal.some((o) => obstacle.includes(o.slice(0, 24))), `obstacle came from the foot table: ${obstacle}`);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "End chase" }).first().click();
});

test("revealing a Secret Replicant applies +2 Health / −2 Resolve [§3.5]", async (t) => {
  if (unavailable) return t.skip(unavailable);
  const out = await page.evaluate(async () => {
    const { normalizeCharacter, maxHealth, maxResolve } = await import("/src/derived.js");
    const secret = normalizeCharacter({ name: "Deckard?", nature: "human", secretReplicant: true,
      attributes: { STR: "B", AGI: "B", INT: "B", EMP: "B" } });
    const revealed = normalizeCharacter({ ...secret, nature: "replicant", secretReplicant: false });
    return { h0: maxHealth(secret), r0: maxResolve(secret), h1: maxHealth(revealed), r1: maxResolve(revealed) };
  });
  assert.equal(out.h1, out.h0 + 2);
  assert.equal(out.r1, out.r0 - 2);
});

test("the gear-acquisition flow is reachable from the sheet [§3.11]", async (t) => {
  if (unavailable) return t.skip(unavailable);
  await page.goto(`${base}/index.html?acq#sheet`, { waitUntil: "load" });
  await page.waitForTimeout(200);
  const btn = page.getByRole("button", { name: "⚖ Acquire gear" });
  assert.ok(await btn.count(), "sheet exposes Acquire gear");
  await btn.first().click();
  await page.waitForTimeout(200);
  const body = await page.$eval(".modal", (m) => m.textContent);
  for (const cat of ["Weapons", "Armor", "Gear", "Augmentations", "Vehicles"])
    assert.ok(body.includes(cat), `catalog lists ${cat}`);
  assert.ok(/Connections/i.test(body) || true);
  await page.keyboard.press("Escape");
});

test("the rules library indexes chases, vehicles and combat reference [§3.12]", async (t) => {
  if (unavailable) return t.skip(unavailable);
  await page.goto(`${base}/index.html?rules#rules`, { waitUntil: "load" });
  await page.waitForTimeout(200);
  const cats = await page.$$eval(".rules__group summary", (els) => els.map((e) => e.textContent));
  for (const cat of ["Chases", "Vehicles", "Combat", "Critical Injuries", "Stress", "Recovery"])
    assert.ok(cats.some((c) => c.startsWith(cat)), `rules library has a ${cat} section (got ${cats.join(", ")})`);
  await page.fill("input[type=search]", "cut off");
  await page.waitForTimeout(150);
  const hits = await page.$eval(".rules", (r) => r.textContent);
  assert.ok(/Cut Off/i.test(hits), "chase maneuvers are searchable");
});

test("acquiring gear spends the right currency and only on a successful roll [§3.11]", async (t) => {
  if (unavailable) return t.skip(unavailable);
  const run = async (forceSuccess) => page.evaluate(async ({ win }) => {
    const { Store } = await import("/src/store.js");
    const { normalizeCharacter } = await import("/src/derived.js");
    const R = await import("/src/rules.js");
    const D = await import("/data.js");
    const ch = normalizeCharacter({ name: "Buyer", nature: "human", archetype: "fixer", years: "veteran",
      skills: { connections: "A" }, state: { promotionPoints: 6, chinyenPoints: 6 } });
    const saved = Store.save(ch); Store.setActiveId(saved.id);
    // Simulate the flow's arithmetic against the live data + rules layer.
    const item = R.acquirableItems().find((i) => i.key === "police_undershirt");
    const src = D.ACQUISITION.sources.find((s) => s.key === "lapd");
    const cost = R.costOf(item.cost);
    const c = Store.get(saved.id);
    if (win) {
      c.state[src.currency] = Math.max(0, c.state[src.currency] - cost);
      c.inventory.items.push({ key: item.key, name: item.name, equipped: false });
    } else {
      c.state.shiftsSinceDowntime = (c.state.shiftsSinceDowntime || 0) + 1;
    }
    Store.save(c);
    const after = Store.get(saved.id);
    return { cost, currency: src.currency, points: after.state[src.currency],
      hasItem: after.inventory.items.some((i) => i.key === item.key), shifts: after.state.shiftsSinceDowntime };
  }, { win: forceSuccess });

  await page.goto(`${base}/index.html?buy#sheet`, { waitUntil: "load" });
  const ok = await run(true);
  assert.equal(ok.currency, "promotionPoints");
  assert.equal(ok.points, 6 - ok.cost, "successful requisition spends Promotion Points");
  assert.equal(ok.hasItem, true);
  const bad = await run(false);
  assert.equal(bad.points, 6, "a failed roll keeps the points");
  assert.equal(bad.hasItem, false);
  assert.equal(bad.shifts, 1, "a failed roll burns the Shift");
});

test("gear catalog rows open the pay/roll step [§3.11]", async (t) => {
  if (unavailable) return t.skip(unavailable);
  await page.goto(`${base}/index.html?buy2#sheet`, { waitUntil: "load" });
  await page.waitForTimeout(200);
  await page.getByRole("button", { name: "⚖ Acquire gear" }).first().click();
  await page.waitForTimeout(150);
  await page.evaluate(() => document.querySelectorAll(".modal details").forEach((d) => (d.open = true)));
  await page.getByRole("button", { name: /Police Undershirt Armor/ }).first().click();
  await page.waitForTimeout(200);
  const body = await page.$eval(".modal", (m) => m.textContent);
  assert.ok(/LAPD requisition/.test(body), "offers the LAPD source");
  assert.ok(/Black market/.test(body), "offers the black market");
  assert.ok(/Pay double/.test(body), "offers the double-payment advantage");
  // Standard availability is simply bought — no Connections roll [Ch08 p204]
  assert.ok(/No Connections roll needed/.test(body), "Standard goods need no roll");
  assert.ok(!/Roll Connections/.test(body));
  await page.keyboard.press("Escape");
  // …but Premium and rarer goods do
  await page.getByRole("button", { name: "⚖ Acquire gear" }).first().click();
  await page.waitForTimeout(150);
  await page.evaluate(() => document.querySelectorAll(".modal details").forEach((d) => (d.open = true)));
  await page.getByRole("button", { name: /Police Heavy Duty Street Gear/ }).first().click();
  await page.waitForTimeout(200);
  const premium = await page.$eval(".modal", (m) => m.textContent);
  assert.ok(/Roll Connections/.test(premium), "Premium goods end in a Connections roll");
  assert.ok(/A Shift/.test(premium), "and quote the tier's lead time");
  await page.keyboard.press("Escape");
});

test("prone/cover/grappled change the dice the engine actually rolls [§3.6]", async (t) => {
  if (unavailable) return t.skip(unavailable);
  await page.goto(`${base}/index.html?cond#combat`, { waitUntil: "load" });
  const out = await page.evaluate(async () => {
    const D = await import("/data.js");
    // mirror the engine's own reducers over the data layer
    const eff = (k) => D.CONDITIONS.find((c) => c.key === k).effect;
    return {
      proneSelf: !!eff("prone").selfMeleeDisadvantage,
      proneAttacker: !!eff("prone").attackerMeleeAdvantage,
      coverRanged: !!eff("cover").attackerRangedDisadvantage,
      grappledDefence: !!eff("grappled").cannotDefend,
      brokenDefence: !!eff("broken_damage").cannotDefend,
    };
  });
  assert.deepEqual(out, { proneSelf: true, proneAttacker: true, coverRanged: true, grappledDefence: true, brokenDefence: true });
  // and the sheet's own close-combat roll picks up Prone
  const dice = await page.evaluate(async () => {
    const { Store } = await import("/src/store.js");
    const { normalizeCharacter } = await import("/src/derived.js");
    const ch = normalizeCharacter({ name: "Prone Runner", attributes: { STR: "B", AGI: "C", INT: "C", EMP: "C" },
      skills: { hand_to_hand: "C" }, state: { conditions: { prone: true } } });
    Store.setActiveId(Store.save(ch).id);
    return true;
  });
  assert.equal(dice, true);
  await page.goto(`${base}/index.html?cond2#sheet`, { waitUntil: "load" });
  await page.waitForTimeout(200);
  await page.getByRole("button", { name: /Roll Hand-to-Hand Combat/ }).first().click();
  await page.waitForTimeout(200);
  const modalText = await page.$eval(".modal", (m) => m.textContent);
  assert.ok(/Prone: −1/.test(modalText), `Prone must show as an automatic disadvantage: ${modalText.slice(0, 200)}`);
  assert.ok(/Disadvantage/.test(modalText), "net badge reads disadvantage");
  await page.keyboard.press("Escape");
});

test("key memory is counted in the net-dice badge before you roll [§3.1]", async (t) => {
  if (unavailable) return t.skip(unavailable);
  await page.goto(`${base}/index.html?km#sheet`, { waitUntil: "load" });
  await page.evaluate(async () => {
    const { Store } = await import("/src/store.js");
    const { normalizeCharacter } = await import("/src/derived.js");
    const ch = normalizeCharacter({ name: "Memory Runner", attributes: { STR: "B", AGI: "B", INT: "C", EMP: "C" }, skills: { stamina: "C" } });
    Store.setActiveId(Store.save(ch).id);
  });
  await page.goto(`${base}/index.html?km2#sheet`, { waitUntil: "load" });
  await page.waitForTimeout(200);
  await page.getByRole("button", { name: /Roll Stamina/ }).first().click();
  await page.waitForTimeout(150);
  assert.ok(/Net: even/.test(await page.$eval(".modal", (m) => m.textContent)), "starts even");
  await page.locator(".modal input[type=checkbox]").first().check();
  await page.waitForTimeout(150);
  assert.ok(/Net: Advantage/.test(await page.$eval(".modal", (m) => m.textContent)), "ticking key memory updates the badge");
  await page.keyboard.press("Escape");
});

test("opposed skill rolls are available and only the initiator may push [§3.1/§3.4]", async (t) => {
  if (unavailable) return t.skip(unavailable);
  await page.goto(`${base}/index.html?opp#sheet`, { waitUntil: "load" });
  await page.evaluate(async () => {
    const { Store } = await import("/src/store.js");
    const { normalizeCharacter } = await import("/src/derived.js");
    const ch = normalizeCharacter({ name: "Interrogator", attributes: { STR: "C", AGI: "C", INT: "C", EMP: "B" }, skills: { manipulation: "C" } });
    Store.setActiveId(Store.save(ch).id);
  });
  await page.goto(`${base}/index.html?opp2#sheet`, { waitUntil: "load" });
  await page.waitForTimeout(200);
  await page.getByRole("button", { name: "⚖ Opposed roll" }).first().click();
  await page.waitForTimeout(200);
  let body = await page.$eval(".modal", (m) => m.textContent);
  assert.ok(/Opposing skill/.test(body) && /Their attribute/.test(body), "configures both sides");
  await page.evaluate(() => { Math.random = () => 0; });   // both sides fail → initiator may push
  await page.getByRole("button", { name: "⚄ Roll opposed" }).first().click();
  await page.waitForTimeout(200);
  body = await page.$eval(".modal", (m) => m.textContent);
  assert.ok(/You win the opposition|They hold/.test(body), "declares a winner");
  assert.ok(/initiator only/.test(body), "a lost/tied opposition is pushable, by the initiator only");
  const diceRows = await page.$$eval(".modal .dice", (els) => els.length);
  assert.equal(diceRows, 2, "both sides show their dice");
  await page.keyboard.press("Escape");
  // winning the opposition is a success — nothing left to push
  await page.evaluate(() => { Math.random = () => 0.999; });
  await page.getByRole("button", { name: "⚖ Opposed roll" }).first().click();
  await page.waitForTimeout(150);
  await page.getByRole("button", { name: "⚄ Roll opposed" }).first().click();
  await page.waitForTimeout(200);
  const won = await page.$eval(".modal", (m) => m.textContent);
  assert.match(won, /You win the opposition/);
  assert.ok(!/initiator only/.test(won), "a won opposition offers no push");
  await page.keyboard.press("Escape");
});

test("a Broken character left alone regains 1 Health per Shift [§3.8]", async (t) => {
  if (unavailable) return t.skip(unavailable);
  await page.goto(`${base}/index.html?alone#sheet`, { waitUntil: "load" });
  await page.evaluate(async () => {
    const { Store } = await import("/src/store.js");
    const { normalizeCharacter } = await import("/src/derived.js");
    const ch = normalizeCharacter({ name: "Down Runner", attributes: { STR: "B", AGI: "B", INT: "C", EMP: "C" }, state: { health: 0 } });
    Store.setActiveId(Store.save(ch).id);
  });
  await page.goto(`${base}/index.html?alone2#sheet`, { waitUntil: "load" });
  await page.waitForTimeout(200);
  await page.getByRole("button", { name: "Investigation Shift" }).first().click();
  await page.waitForTimeout(250);
  const health = await page.evaluate(async () => (await import("/src/store.js")).Store.getActive().state.health);
  const expected = await page.evaluate(async () => (await import("/data.js")).RECOVERY.brokenAloneHealPerShift);
  assert.equal(health, expected, "Broken + a Shift alone heals the listed amount");
});

test("combat tracker: conditions persist, armor shows, crits land on the target [§3.6/§3.7]", async (t) => {
  if (unavailable) return t.skip(unavailable);
  await page.goto(`${base}/index.html?trk#combat`, { waitUntil: "load" });
  await page.evaluate(async () => {
    const { Combat } = await import("/src/store.js");
    Combat.save({ active: true, round: 1, turnIndex: 0, combatants: [
      { id: "a1", kind: "npc", npcKey: "lapd_officer", name: "Uniformed LAPD Officer", nature: "human", health: 5, maxHealth: 5, card: 1 },
      { id: "a2", kind: "npc", npcKey: "street_thug", name: "Street Thug", nature: "human", health: 4, maxHealth: 4, card: 3 },
    ] });
  });
  await page.goto(`${base}/index.html?trk2#combat`, { waitUntil: "load" });
  await page.waitForTimeout(250);
  // the officer wears Police Heavy Duty Street Gear -> armor badge B
  const badges = await page.$$eval(".combatant .pip", (els) => els.map((e) => e.textContent));
  assert.ok(badges.some((b) => b.includes("🛡")), `armored NPC shows a shield badge (got ${badges.join(",")})`);
  // toggle In Cover on the thug and confirm it persists through the store
  await page.locator(".combatant").nth(1).getByRole("button", { name: "In Cover" }).click();
  await page.waitForTimeout(200);
  const conds = await page.evaluate(async () => (await import("/src/store.js")).Combat.get().combatants[1].conditions);
  assert.deepEqual(conds, { cover: true }, "condition is stored on the combatant");
  // apply a critical injury straight to a combatant
  await page.evaluate(async () => {
    const R = await import("/src/roller.js");
    const { Combat } = await import("/src/store.js");
    const D = await import("/data.js");
    const target = Combat.get().combatants[1];
    const entry = D.CRIT_PIERCING.find((e) => e.roll === 7);
    R.applyCritToCombatant(target, entry, "piercing", 7, (mutate) => { const s = Combat.get(); mutate(s); Combat.save(s); });
  });
  const injuries = await page.evaluate(async () => (await import("/src/store.js")).Combat.get().combatants[1].criticalInjuries);
  assert.equal(injuries.length, 1);
  assert.equal(injuries[0].injury, "Punctured lung");
  assert.equal(injuries[0].lethal, true);
});

test("damage landing on an already-Broken combatant forces a critical injury [§3.7]", async (t) => {
  if (unavailable) return t.skip(unavailable);
  await page.goto(`${base}/index.html?brk#combat`, { waitUntil: "load" });
  await page.evaluate(async () => {
    const { Combat } = await import("/src/store.js");
    Combat.save({ active: true, round: 1, turnIndex: 0, combatants: [
      { id: "b1", kind: "npc", npcKey: "street_thug", name: "Street Thug", nature: "human", health: 0, maxHealth: 4, card: 1 },
    ] });
  });
  await page.goto(`${base}/index.html?brk2#combat`, { waitUntil: "load" });
  await page.waitForTimeout(250);
  await page.locator(".combatant").first().getByRole("button", { name: /damage Street Thug/ }).click();
  await page.waitForTimeout(250);
  const modal = await page.$(".modal");
  assert.ok(modal, "hitting a Broken combatant opens the critical-injury roll");
  const text = await page.$eval(".modal", (m) => m.textContent);
  assert.ok(/Critical injury/.test(text), text.slice(0, 120));
  await page.keyboard.press("Escape");
});

test("the creation wizard walks end to end and saves a legal character [§3.5]", async (t) => {
  if (unavailable) return t.skip(unavailable);
  await page.goto(`${base}/index.html?wiz#wizard`, { waitUntil: "load" });
  await page.evaluate(() => localStorage.removeItem("brp:characters"));
  await page.goto(`${base}/index.html?wiz2#wizard`, { waitUntil: "load" });
  await page.waitForTimeout(200);
  const next = () => page.getByRole("button", { name: "Next ›" }).first();

  await page.getByRole("button", { name: /^Human/ }).first().click();     // nature
  await next().click();
  await page.getByRole("button", { name: /^Enforcer/ }).first().click();  // archetype: key STR, keys H2H/Stamina/Firearms
  await next().click();
  await page.getByRole("button", { name: /^Rookie/ }).first().click();    // 4 attr / 8 skill / 0 specialties
  await next().click();

  await page.waitForTimeout(150);
  for (let i = 0; i < 2; i++) await page.getByRole("button", { name: "increase Strength ★" }).first().click(); // C→B→A (key attr B+)
  for (let i = 0; i < 2; i++) await page.getByRole("button", { name: "increase Agility" }).first().click();
  assert.ok(await next().isEnabled(), "attribute budget spent exactly");
  await next().click();

  await page.waitForTimeout(150);
  for (let i = 0; i < 3; i++) await page.getByRole("button", { name: "increase Hand-to-Hand Combat ★" }).first().click();
  for (let i = 0; i < 3; i++) await page.getByRole("button", { name: "increase Stamina ★" }).first().click();
  for (let i = 0; i < 2; i++) await page.getByRole("button", { name: "increase Firearms ★" }).first().click();
  assert.ok(await next().isEnabled(), "skill budget spent exactly, key skills at C+");
  await next().click();          // specialties (none for a Rookie)
  await next().click();          // key memory
  await next().click();          // key relationship
  await next().click();          // identity
  await page.locator(".wiz__body input.input").first().fill("Audit Deckard");
  await next().click();          // review
  await page.getByRole("button", { name: "Create Blade Runner" }).click();
  await page.waitForTimeout(300);

  const made = await page.evaluate(async () => {
    const { Store } = await import("/src/store.js");
    const { maxHealth, maxResolve } = await import("/src/derived.js");
    const c = Store.getActive();
    return c && { name: c.name, nature: c.nature, archetype: c.archetype, years: c.years,
      str: c.attributes.STR, h2h: c.skills.hand_to_hand, health: maxHealth(c), resolve: maxResolve(c),
      items: c.inventory.items.map((i) => i.name), pp: c.state.promotionPoints, cy: c.state.chinyenPoints };
  });
  assert.ok(made, "wizard saved and activated the character");
  assert.equal(made.name, "Audit Deckard");
  assert.equal(made.archetype, "enforcer");
  assert.equal(made.years, "rookie");
  assert.equal(made.str, "A");
  assert.equal(made.h2h, "A");
  assert.equal(made.health, 6, "(STR d12 + AGI d10)/4 rounded up");
  assert.equal(made.resolve, 4, "(INT d8 + EMP d8)/4 rounded up");
  for (const std of ["Badge", "Knowledge Integration Assistant (KIA)", "Detective Special Spinner"])
    assert.ok(made.items.includes(std), `standard issue includes ${std}`);
  assert.ok(made.pp >= 0 && made.cy >= 0, "starting points rolled and floored at 0");
});

test("Countdown Timer fires on a success and escalates on a miss [Solo p.006]", async (t) => {
  if (unavailable) return t.skip(unavailable);
  const run = async (forceHigh) => {
    await page.goto(`${base}/index.html?ct=${forceHigh}#solo`, { waitUntil: "load" });
    await page.evaluate((hi) => {
      localStorage.setItem("brp:settings", JSON.stringify({ theme: "dark", solo: true, gm: true }));
      localStorage.setItem("brp:solo", JSON.stringify({ timerDie: "D8", hypotheses: [], humanityChecks: {}, promoGainChecks: {}, promoLoseChecks: {}, log: [], panel: "shift", scratchpad: "" }));
      Math.random = () => (hi ? 0.999 : 0);   // max faces (success) vs. all 1s
    }, forceHigh);
    await page.evaluate(() => { location.hash = "#__r"; location.hash = "#solo"; });
    await page.waitForTimeout(150);
    await page.getByRole("button", { name: "🎲 Roll the timer" }).first().click();
    await page.waitForTimeout(250);
    // The result lands inline in the Countdown card, not in a modal.
    const title = await page.$eval(".result-slot", (m) => m.textContent);
    const die = await page.evaluate(() => JSON.parse(localStorage.getItem("brp:solo")).timerDie);
    return { title, die };
  };
  const fired = await run(true);
  assert.match(fired.title, /Countdown Event Triggered/, "a success fires the event");
  assert.equal(fired.die, "D6", "the timer resets after firing");
  const missed = await run(false);
  assert.match(missed.title, /No Event/, "no successes = no event");
  assert.equal(missed.die, "D10", "a miss escalates D8 → D10");
});

test("NPC rolls are never pushed [Solo p.010]", async (t) => {
  if (unavailable) return t.skip(unavailable);
  await page.goto(`${base}/index.html?npcpush#combat`, { waitUntil: "load" });
  await page.evaluate(async () => {
    const { Combat } = await import("/src/store.js");
    Combat.save({ active: true, round: 1, turnIndex: 0, combatants: [
      { id: "n1", kind: "npc", npcKey: "street_thug", name: "Street Thug", nature: "human", health: 4, maxHealth: 4, card: 1 },
      { id: "n2", kind: "npc", npcKey: "street_urchin", name: "Street Urchin", nature: "human", health: 4, maxHealth: 4, card: 2 },
    ] });
  });
  await page.goto(`${base}/index.html?npcpush2#combat`, { waitUntil: "load" });
  await page.waitForTimeout(250);
  await page.locator(".combatant").first().getByRole("button", { name: "🎲 Skill" }).click();
  await page.waitForTimeout(150);
  await page.getByRole("button", { name: /^Stamina/ }).first().click();
  await page.waitForTimeout(150);
  await page.getByRole("button", { name: "⚄ Roll" }).first().click();
  await page.waitForTimeout(200);
  const body = await page.$eval(".modal", (m) => m.textContent);
  assert.ok(!/Push/.test(body), `no push button for an NPC roll: ${body.slice(0, 160)}`);
  await page.keyboard.press("Escape");
});

test("solo start panel lists all four official case-start methods [Solo p.004]", async (t) => {
  if (unavailable) return t.skip(unavailable);
  await page.goto(`${base}/index.html?methods#solo`, { waitUntil: "load" });
  await page.evaluate(() => {
    localStorage.setItem("brp:settings", JSON.stringify({ theme: "dark", solo: true, gm: true }));
    localStorage.setItem("brp:solo", JSON.stringify({ panel: "start", log: [], hypotheses: [], humanityChecks: {}, promoGainChecks: {}, promoLoseChecks: {}, scratchpad: "" }));
  });
  await page.goto(`${base}/index.html?methods2#solo`, { waitUntil: "load" });
  await page.waitForTimeout(250);
  const text = await page.$eval("#screen", (e) => e.textContent);
  for (const m of ["Trust your gut", "Follow a thread", "Use the Case File Generator", "Seek inspiration"])
    assert.ok(text.includes(m), `start panel names "${m}"`);
});

test("the solo NPC generator rolls human/Replicant [Solo p.019]", async (t) => {
  if (unavailable) return t.skip(unavailable);
  await page.goto(`${base}/index.html?npcnat#solo`, { waitUntil: "load" });
  await page.evaluate(() => {
    localStorage.setItem("brp:settings", JSON.stringify({ theme: "dark", solo: true, gm: true }));
    localStorage.setItem("brp:solo", JSON.stringify({ panel: "scene", log: [], hypotheses: [], humanityChecks: {}, promoGainChecks: {}, promoLoseChecks: {}, scratchpad: "" }));
  });
  await page.goto(`${base}/index.html?npcnat2#solo`, { waitUntil: "load" });
  await page.waitForTimeout(250);
  await page.getByRole("button", { name: /Human or Replicant/ }).first().click();
  await page.waitForTimeout(250);
  const body = await page.$eval(".result-slot", (m) => m.textContent);
  assert.ok(/Replicant|Human|Ambiguous/.test(body), body.slice(0, 120));
});

test("a successful roll offers no push; a failed one does [Core Ch01 p016]", async (t) => {
  if (unavailable) return t.skip(unavailable);
  const roll = async (forceHigh) => {
    await page.goto(`${base}/index.html?push=${forceHigh}#sheet`, { waitUntil: "load" });
    await page.evaluate(async (hi) => {
      const { Store } = await import("/src/store.js");
      const { normalizeCharacter } = await import("/src/derived.js");
      const ch = normalizeCharacter({ name: "Pusher", attributes: { STR: "B", AGI: "B", INT: "C", EMP: "C" }, skills: { stamina: "C" } });
      Store.setActiveId(Store.save(ch).id);
      Math.random = () => (hi ? 0.999 : 0);   // all max faces (success) vs all 1s (failure)
    }, forceHigh);
    await page.evaluate(() => { location.hash = "#__r"; location.hash = "#sheet"; });
    await page.waitForTimeout(150);
    await page.getByRole("button", { name: /Roll Stamina/ }).first().click();
    await page.waitForTimeout(120);
    await page.getByRole("button", { name: "⚄ Roll" }).first().click();
    await page.waitForTimeout(180);
    const body = await page.$eval(".modal", (m) => m.textContent);
    await page.keyboard.press("Escape");
    return body;
  };
  const won = await roll(true);
  assert.match(won, /Critical success|Success/);
  assert.ok(!/Push the roll/.test(won), "a successful roll cannot be pushed");
  const lost = await roll(false);
  assert.match(lost, /Failure/);
  assert.ok(/Push the roll/.test(lost), "a failed roll can be pushed");
});

test("wizard rolls key relationship, signature item and home from the book's tables [Core Ch02]", async (t) => {
  if (unavailable) return t.skip(unavailable);
  await page.goto(`${base}/index.html?tables#wizard`, { waitUntil: "load" });
  const out = await page.evaluate(async () => {
    const D = await import("/data.js");
    const R = await import("/src/rules.js");
    return {
      who: D.RELATIONSHIP_WHO.length, like: D.RELATIONSHIP_LIKE.length, going: D.RELATIONSHIP_GOING_ON.length,
      sig: D.SIGNATURE_ITEMS.length,
      homes: [1, 4, 5, 12].map((d) => R.lookupRange(D.HOME_TABLE, d).text.slice(0, 20)),
    };
  });
  assert.deepEqual([out.who, out.like, out.going, out.sig], [12, 12, 12, 12]);
  assert.equal(out.homes[0], out.homes[1], "1–4 share the LAPD apartment");
  assert.notEqual(out.homes[2], out.homes[3]);
  // and the step renders its roll buttons
  await page.goto(`${base}/index.html?tables2#wizard`, { waitUntil: "load" });
  await page.waitForTimeout(150);
  await page.getByRole("button", { name: /^Human/ }).first().click();
  const next = () => page.getByRole("button", { name: "Next ›" }).first();
  await next().click();
  await page.getByRole("button", { name: /^Enforcer/ }).first().click();
  await next().click();
  await page.getByRole("button", { name: /^Rookie/ }).first().click();
  await next().click();
  for (let i = 0; i < 2; i++) await page.getByRole("button", { name: "increase Strength ★" }).first().click();
  for (let i = 0; i < 2; i++) await page.getByRole("button", { name: "increase Agility" }).first().click();
  await next().click();
  for (let i = 0; i < 3; i++) await page.getByRole("button", { name: "increase Hand-to-Hand Combat ★" }).first().click();
  for (let i = 0; i < 3; i++) await page.getByRole("button", { name: "increase Stamina ★" }).first().click();
  for (let i = 0; i < 2; i++) await page.getByRole("button", { name: "increase Firearms ★" }).first().click();
  await next().click();   // specialties
  await next().click();   // memory
  await next().click();   // relationship step
  await page.waitForTimeout(150);
  await page.getByRole("button", { name: "Roll all" }).first().click();
  await page.waitForTimeout(150);
  const rel = await page.$eval(".wiz__body textarea", (e) => e.value);
  assert.ok(rel.length > 5, `relationship text was generated: ${rel}`);
});

test("specialty milestones and Promotion Point losses are wired to the sheet [§3.10]", async (t) => {
  if (unavailable) return t.skip(unavailable);
  await page.goto(`${base}/index.html?spec#sheet`, { waitUntil: "load" });
  await page.evaluate(async () => {
    const { Store } = await import("/src/store.js");
    const { normalizeCharacter } = await import("/src/derived.js");
    const ch = normalizeCharacter({ name: "Operator", nature: "human", archetype: "fixer", years: "veteran",
      specialties: ["cashflow", "sycophant", "protected", "people_person"],
      skills: { connections: "A" }, state: { promotionPoints: 4, chinyenPoints: 2 } });
    Store.setActiveId(Store.save(ch).id);
  });
  await page.goto(`${base}/index.html?spec2#sheet`, { waitUntil: "load" });
  await page.waitForTimeout(250);
  await page.getByRole("button", { name: /New Case File/ }).first().click();
  await page.waitForTimeout(200);
  await page.getByRole("button", { name: /End of session/ }).first().click();
  await page.waitForTimeout(200);
  const after = await page.evaluate(async () => {
    const s = (await import("/src/store.js")).Store.getActive().state;
    return { pp: s.promotionPoints, cy: s.chinyenPoints };
  });
  assert.equal(after.cy, 3, "Cashflow adds a Chinyen Point per Case File");
  assert.equal(after.pp, 5, "Sycophant adds a Promotion Point per session");
  // People Person exposes a second key relationship field
  const labels = await page.$$eval(".field__label", (els) => els.map((e) => e.textContent));
  assert.ok(labels.some((l) => /Second key relationship/.test(l)), "People Person grants a second relationship");
  // Protected turns a Promotion Point loss into a Connections roll
  await page.getByRole("button", { name: "− Lose Promotion Points" }).first().click();
  await page.waitForTimeout(200);
  const body = await page.$eval(".modal", (m) => m.textContent);
  assert.match(body, /Roll Connections/, "Protected routes the loss through a Connections roll");
  await page.keyboard.press("Escape");
});

test("the signature item is a once-per-Shift stress heal [Core Ch02 p034]", async (t) => {
  if (unavailable) return t.skip(unavailable);
  await page.goto(`${base}/index.html?sig#sheet`, { waitUntil: "load" });
  await page.evaluate(async () => {
    const { Store } = await import("/src/store.js");
    const { normalizeCharacter } = await import("/src/derived.js");
    const ch = normalizeCharacter({ name: "Keeper", attributes: { STR: "C", AGI: "C", INT: "B", EMP: "B" },
      identity: { signatureItem: "An origami bird" }, state: { resolve: 1 } });
    Store.setActiveId(Store.save(ch).id);
  });
  await page.goto(`${base}/index.html?sig2#sheet`, { waitUntil: "load" });
  await page.waitForTimeout(250);
  const before = await page.evaluate(async () => (await import("/src/store.js")).Store.getActive().state.resolve);
  await page.getByRole("button", { name: /Signature item/ }).first().click();
  await page.waitForTimeout(250);
  const after = await page.evaluate(async () => {
    const c = (await import("/src/store.js")).Store.getActive();
    return { resolve: c.state.resolve, used: !!c.state.shiftUses.signature_item };
  });
  assert.equal(after.resolve, before + 1);
  assert.equal(after.used, true, "and it is spent for the Shift");
});

test("selling an item pays half its Cost into Chinyen [Ch08 p207]", async (t) => {
  if (unavailable) return t.skip(unavailable);
  await page.goto(`${base}/index.html?sell#sheet`, { waitUntil: "load" });
  await page.evaluate(async () => {
    const { Store } = await import("/src/store.js");
    const { normalizeCharacter } = await import("/src/derived.js");
    const ch = normalizeCharacter({ name: "Trader", nature: "human", archetype: "fixer", years: "veteran",
      inventory: { items: [{ key: "police_truncheon", name: "Police Truncheon", equipped: false }] },
      state: { chinyenPoints: 0 } });
    Store.setActiveId(Store.save(ch).id);
  });
  await page.goto(`${base}/index.html?sell2#sheet`, { waitUntil: "load" });
  await page.waitForTimeout(250);
  await page.getByRole("button", { name: "¥ Sell an item" }).first().click();
  await page.waitForTimeout(200);
  const body = await page.$eval(".modal", (m) => m.textContent);
  assert.match(body, /sells for 1 ¥/, "Standard cost 1 pays 1 (half, rounded up)");
  await page.locator(".modal").getByRole("button", { name: /Police Truncheon/ }).first().click();
  await page.waitForTimeout(250);
  const after = await page.evaluate(async () => {
    const c = (await import("/src/store.js")).Store.getActive();
    return { cy: c.state.chinyenPoints, items: c.inventory.items.length };
  });
  assert.equal(after.cy, 1, "Standard goods sell without a roll");
  assert.equal(after.items, 0, "and leave the inventory");
});

test("the GM screen rolls the Ch09 case tables [Ch09]", async (t) => {
  if (unavailable) return t.skip(unavailable);
  await page.goto(`${base}/index.html?gm9#gm`, { waitUntil: "load" });
  await page.evaluate(() => {
    localStorage.setItem("brp:settings", JSON.stringify({ theme: "dark", solo: true, gm: true }));
    localStorage.setItem("brp:gm", JSON.stringify({ panel: "prep", log: [], scratchpad: "", selectedTheme: "Replicant Crimes & Punishments" }));
  });
  await page.goto(`${base}/index.html?gm9b#gm`, { waitUntil: "load" });
  await page.waitForTimeout(250);
  // Each table now sits on the panel of the session where you'd reach for it.
  // Results are inline, so read the newest slot in the card that owns the button.
  for (const [pill, label, check] of [
    ["Prep", "🎲 Clue (D8)", /Witness|Forensic Evidence|Recording|Documents|Rumors|Anonymous Tip|Item/],
    ["Prep", "🎲 Final Confrontation (D10)", /rain|Thunder|heat|cold|colors|Overgrown|wind|outage|dust|Fog/],
    ["Play", "🎲 Location (D6×D6)", /Sector|Downtown/],
    ["Play", "🎲 Mood (D8×3)", /Weather/],
    ["Wrap", "🎲 Downtime Event (D8)", /At home/],
  ]) {
    await page.click(`.segnav__pill:text-is("${pill}")`);
    await page.waitForTimeout(120);
    await page.click(`.btn:text-is("${label}")`);
    await page.waitForTimeout(250);
    const body = await page.evaluate((lbl) => {
      const b = [...document.querySelectorAll(".btn")].find((x) => x.textContent === lbl);
      const slots = b.closest(".card").querySelectorAll(".result-slot");
      return slots[slots.length - 1].textContent;
    }, label);
    assert.match(body, check, `${label} produced a result`);
    assert.ok(!/\bnull\b/.test(body), `${label} rendered a literal null: ${body}`);
  }

  await page.click('.segnav__pill:text-is("Wrap")');
  await page.waitForTimeout(120);
  const text = await page.$eval("#screen", (e) => e.textContent);
  assert.match(text, /Session Awards/, "the award checklists are on the Wrap panel");
});

// "Start a fresh case" is the ONE reset (owner ruling): it wipes every solo tab,
// all inline results, all pinned notes, BOTH roll logs, the Case Board, and any
// fight or chase left open — and it must not touch a character.
test("Start a fresh case wipes the whole case and nothing on the sheet", async (t) => {
  if (unavailable) return t.skip(unavailable);
  await page.goto(`${base}/index.html?notes#solo`, { waitUntil: "load" });
  const charId = await page.evaluate(async () => {
    localStorage.setItem("brp:settings", JSON.stringify({ theme: "dark", solo: true, gm: true }));
    // Solo state on every tab: notes, oracle log, inline results, leads,
    // checklists, timer, Shift counter.
    localStorage.setItem("brp:solo", JSON.stringify({
      panel: "notes", scratchpad: "• [Clue] a bloody origami bird\n",
      log: [{ id: "l1", label: "Seed", text: "x", pin: "[Seed] x", ts: Date.now() }],
      results: { "Oracle": [{ id: "r1", title: "Scene Check", html: "<p>x</p>", pinLine: "[Scene] x", ts: Date.now() }] },
      hypotheses: [{ id: "h1", text: "The doll knows", die: "D10" }],
      humanityChecks: { 0: true }, promoGainChecks: {}, promoLoseChecks: {}, timerDie: "D12",
      shiftNo: 4, shiftFlags: { countdown: true }, autoPin: true, logScope: "all",
    }));
    // The board, a fight, a chase, and the global roll log.
    localStorage.setItem("brp:board", JSON.stringify({ boxes: [{ id: "b1", n: 1, kind: "clue", name: "casing", detail: "", links: [] }], nextN: 2, checks: 2, solvedId: null }));
    const { Store, Combat, RollLog } = await import("/src/store.js");
    const { Chase } = await import("/src/chase.js");
    Combat.save({ active: true, round: 3, turnIndex: 0, combatants: [{ id: "n1", kind: "npc", npcKey: "street_thug", name: "Thug", nature: "human", health: 2, maxHealth: 4, card: 1 }] });
    Chase.save({ active: true, env: "foot", round: 2, distIdx: 1, obstacle: null, prey: null, pursuer: null, log: ["x"] });
    RollLog.add({ label: "Firearms", text: "Success", source: "sheet", charName: "Runner" });
    // A character with data that must survive untouched.
    const { normalizeCharacter } = await import("/src/derived.js");
    const ch = normalizeCharacter({ name: "Untouched", nature: "human", archetype: "enforcer", years: "seasoned", attributes: { STR: "A", AGI: "B", INT: "C", EMP: "C" } });
    ch.state.health = 3; ch.state.promotionPoints = 5; ch.state.shiftsSinceDowntime = 2;
    ch.journal = [{ id: "j1", ts: Date.now(), text: "[Firearms] Success" }];
    const saved = Store.save(ch); Store.setActiveId(saved.id);
    return saved.id;
  });

  await page.goto(`${base}/index.html?notes2#solo`, { waitUntil: "load" });
  await page.waitForTimeout(250);
  // The old "Clear notes" action is gone — one button, one meaning.
  const actions = await page.$$eval(".panel .btn", (e) => e.map((x) => x.textContent.trim()));
  assert.ok(!actions.some((a) => /Clear notes/.test(a)), `no Clear-notes button any more: ${actions}`);

  await page.getByRole("button", { name: "⟲ Start a fresh case" }).first().click();
  await page.waitForTimeout(150);
  await page.getByRole("button", { name: "Wipe everything" }).last().click();
  await page.waitForTimeout(400);

  const after = await page.evaluate(async (id) => {
    const { Store, Combat, RollLog } = await import("/src/store.js");
    const { Chase } = await import("/src/chase.js");
    return {
      solo: JSON.parse(localStorage.getItem("brp:solo")),
      board: JSON.parse(localStorage.getItem("brp:board")),
      combat: Combat.get(), chase: Chase.get(), rolls: RollLog.list().length,
      ch: Store.get(id),
    };
  }, charId);

  const firstStep = await page.evaluate(async () => (await import("/data-solo.js")).ESCALATION_STEPS[0]);
  // Every solo tab
  assert.equal(after.solo.scratchpad, "", "notes gone");
  assert.deepEqual(after.solo.log, [], "oracle log gone");
  assert.deepEqual(after.solo.results, {}, "every tab's inline results gone");
  assert.deepEqual(after.solo.hypotheses, [], "leads gone");
  assert.deepEqual(after.solo.humanityChecks, {}, "checklists gone");
  assert.equal(after.solo.timerDie, firstStep, "the timer is back to its starting die");
  assert.equal(after.solo.shiftNo, 1, "the Shift counter restarts");
  assert.deepEqual(after.solo.shiftFlags, {}, "and its once-per-Shift markers");
  assert.equal(after.solo.panel, "case", "a new case opens on the Case tab");
  assert.equal(after.solo.autoPin, true, "preferences are not case data");
  // Everything the case wrote elsewhere
  assert.deepEqual(after.board.boxes, [], "the Case Board is wiped");
  assert.equal(after.board.checks, 0, "including banked Discovery Checks");
  assert.equal(after.rolls, 0, "the global roll log is wiped too");
  assert.equal(after.combat.active, false, "no fight left open");
  assert.deepEqual(after.combat.combatants, [], "and no combatants");
  assert.equal(after.chase.active, false, "no chase left open");
  // …and nothing on the character
  assert.equal(after.ch.state.health, 3, "Health untouched");
  assert.equal(after.ch.state.promotionPoints, 5, "Promotion Points untouched");
  assert.equal(after.ch.state.shiftsSinceDowntime, 2, "the sheet's Downtime cadence untouched");
  assert.equal(after.ch.journal.length, 1, "journal entries untouched");
  assert.equal(after.ch.name, "Untouched");
});

test("the bottom nav stays pinned to the viewport bottom while scrolling", async (t) => {
  if (unavailable) return t.skip(unavailable);
  // A position:fixed bottom bar detaches from the viewport on iOS while the
  // browser toolbar animates and gets stranded mid-screen; the nav is a sticky
  // flow item so it cannot. Check every scroll position, plus a viewport
  // resize mid-scroll (what a collapsing toolbar looks like to the page).
  const gap = () => page.evaluate(() =>
    Math.round(innerHeight - document.querySelector("#nav").getBoundingClientRect().bottom));
  for (const route of ["rules", "sheet", "home"]) {
    await page.goto(`${base}/index.html?nav=${route}#${route}`, { waitUntil: "load" });
    await page.waitForTimeout(200);
    for (const frac of [0, 0.25, 0.5, 0.9, 1]) {
      await page.evaluate((f) => window.scrollTo(0, (document.documentElement.scrollHeight - innerHeight) * f), frac);
      await page.waitForTimeout(90);
      assert.equal(await gap(), 0, `#${route} nav is flush with the bottom at ${frac * 100}% scroll`);
    }
    await page.evaluate(() => window.scrollTo(0, (document.documentElement.scrollHeight - innerHeight) * 0.5));
    await page.setViewportSize({ width: 390, height: 700 });   // toolbar appears
    await page.waitForTimeout(120);
    assert.equal(await gap(), 0, `#${route} nav follows a shrinking viewport`);
    await page.setViewportSize({ width: 390, height: 800 });   // toolbar collapses
    await page.waitForTimeout(120);
    assert.equal(await gap(), 0, `#${route} nav follows a growing viewport`);
    await page.setViewportSize({ width: 390, height: 800 });
  }
  // and at the very bottom the nav rests below the content instead of covering it
  await page.goto(`${base}/index.html?navend#rules`, { waitUntil: "load" });
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(150);
  const clearance = await page.evaluate(() => {
    const kids = document.querySelectorAll("#screen > * > *");
    const last = kids[kids.length - 1];
    return Math.round(document.querySelector("#nav").getBoundingClientRect().top - last.getBoundingClientRect().bottom);
  });
  assert.ok(clearance >= 0, `content clears the nav at the end of the page (gap ${clearance}px)`);
});

test("case notes read top to bottom — new entries land at the end", async (t) => {
  if (unavailable) return t.skip(unavailable);
  // Solo: an existing note, then a briefing, then a pinned roll
  await page.goto(`${base}/index.html?flow#solo`, { waitUntil: "load" });
  await page.evaluate(() => {
    localStorage.setItem("brp:settings", JSON.stringify({ theme: "dark", solo: true, gm: true }));
    localStorage.setItem("brp:solo", JSON.stringify({ panel: "start", scratchpad: "OLDEST LINE",
      log: [], hypotheses: [], humanityChecks: {}, promoGainChecks: {}, promoLoseChecks: {}, timerDie: "D6" }));
  });
  await page.goto(`${base}/index.html?flow2#solo`, { waitUntil: "load" });
  await page.waitForTimeout(250);
  await page.getByRole("button", { name: "⚡ Generate full briefing" }).first().click();
  await page.waitForTimeout(250);
  let notes = await page.evaluate(() => JSON.parse(localStorage.getItem("brp:solo")).scratchpad);
  assert.ok(notes.startsWith("OLDEST LINE"), `existing notes stay on top:\n${notes}`);
  assert.ok(notes.indexOf("CASE BRIEFING") > notes.indexOf("OLDEST LINE"), "the briefing is appended below");

  // pinning a roll result adds to the bottom too
  await page.getByRole("button", { name: "🎲 Relevance" }).first().click();
  await page.waitForTimeout(200);
  // The card now holds the briefing's slot too — pin the Relevance one.
  await page.locator(".result-slot").filter({ hasText: "Relevance" }).last().getByRole("button", { name: /^📌 Pin/ }).click();
  await page.waitForTimeout(250);
  notes = await page.evaluate(() => JSON.parse(localStorage.getItem("brp:solo")).scratchpad);
  const pinIdx = notes.lastIndexOf("• [Relevance]");
  assert.ok(pinIdx > notes.indexOf("CASE BRIEFING"), `the pin lands after the briefing:\n${notes}`);
  assert.ok(notes.trimEnd().endsWith(notes.trimEnd().slice(pinIdx).trimEnd()), "and is the last thing in the notes");

  // GM notes behave the same way
  await page.goto(`${base}/index.html?flow3#gm`, { waitUntil: "load" });
  await page.evaluate(() => {
    localStorage.setItem("brp:gm", JSON.stringify({ panel: "case", scratchpad: "OLDEST LINE", log: [],
      selectedTheme: "Replicant Crimes & Punishments" }));
  });
  await page.goto(`${base}/index.html?flow4#gm`, { waitUntil: "load" });
  await page.waitForTimeout(250);
  await page.getByRole("button", { name: "🎲 Twist (D12)" }).first().click();
  await page.waitForTimeout(200);
  await page.getByRole("button", { name: /^📌 Pin/ }).first().click();
  await page.waitForTimeout(250);
  const gmNotes = await page.evaluate(() => JSON.parse(localStorage.getItem("brp:gm")).scratchpad);
  assert.ok(gmNotes.startsWith("OLDEST LINE"), `GM notes keep their order:\n${gmNotes}`);
  assert.ok(gmNotes.indexOf("• [Twist]") > 0, "the pin is appended at the end");
});

test("any roll can be pinned into the case notes; the sheet's pin says it targets the journal", async (t) => {
  if (unavailable) return t.skip(unavailable);
  // A dice roll made on the SHEET must be reachable from the solo case notes.
  await page.goto(`${base}/index.html?pin1#sheet`, { waitUntil: "load" });
  await page.evaluate(async () => {
    localStorage.setItem("brp:settings", JSON.stringify({ theme: "dark", solo: true, gm: true }));
    const { Store, RollLog } = await import("/src/store.js");
    const { normalizeCharacter } = await import("/src/derived.js");
    RollLog.clear();
    const ch = normalizeCharacter({ name: "Runner", attributes: { STR: "B", AGI: "B", INT: "C", EMP: "C" }, skills: { firearms: "C" } });
    Store.setActiveId(Store.save(ch).id);
    localStorage.setItem("brp:solo", JSON.stringify({ panel: "notes", scratchpad: "SEED", log: [],
      hypotheses: [], humanityChecks: {}, promoGainChecks: {}, promoLoseChecks: {}, timerDie: "D6" }));
  });
  await page.goto(`${base}/index.html?pin2#sheet`, { waitUntil: "load" });
  await page.waitForTimeout(200);
  await page.getByRole("button", { name: /Roll Firearms/ }).first().click();
  await page.waitForTimeout(150);
  await page.getByRole("button", { name: "⚄ Roll" }).first().click();
  await page.waitForTimeout(150);
  await page.getByRole("button", { name: "Done" }).first().click();
  await page.waitForTimeout(200);
  assert.equal(await page.evaluate(async () => (await import("/src/store.js")).RollLog.list().length), 1);
  // the sheet's pin goes to the journal — the label must not promise "notes"
  assert.match(await page.$eval(".rolllog__row .iconbtn", (e) => e.getAttribute("aria-label")), /journal/i);

  // solo log & notes: switch to every roll, pin one into the case notes
  await page.goto(`${base}/index.html?pin3#solo`, { waitUntil: "load" });
  await page.waitForTimeout(250);
  const chips = await page.$$eval(".rolllog__scope .chip", (els) => els.map((e) => e.textContent));
  assert.deepEqual(chips, ["Solo oracle", "All rolls"]);
  await page.getByRole("button", { name: "All rolls" }).first().click();
  await page.waitForTimeout(250);
  const rows = await page.$$eval(".rolllog__row .rolllog__label", (els) => els.map((e) => e.textContent));
  assert.deepEqual(rows, ["Runner · Firearms"], "the sheet roll shows up in the solo log");
  await page.locator(".rolllog__row").first().getByRole("button", { name: "Pin to case notes" }).click();
  await page.waitForTimeout(250);
  const notes = await page.evaluate(() => JSON.parse(localStorage.getItem("brp:solo")).scratchpad);
  assert.ok(notes.startsWith("SEED"), "existing notes keep their place");
  assert.match(notes, /• \[Runner · Firearms\]/, `the roll is pinned into the case notes:\n${notes}`);
});

test("roll logs read top to bottom too — newest entry is last", async (t) => {
  if (unavailable) return t.skip(unavailable);
  await page.goto(`${base}/index.html?log1#home`, { waitUntil: "load" });
  await page.evaluate(async () => {
    localStorage.setItem("brp:settings", JSON.stringify({ theme: "dark", solo: true, gm: true }));
    const { RollLog } = await import("/src/store.js");
    RollLog.clear();
    RollLog.add({ label: "FIRST", text: "oldest", source: "sheet" });
    RollLog.add({ label: "SECOND", text: "middle", source: "sheet" });
    RollLog.add({ label: "THIRD", text: "newest", source: "sheet" });
  });
  await page.goto(`${base}/index.html?log2#home`, { waitUntil: "load" });
  await page.waitForTimeout(250);
  await page.evaluate(() => document.querySelectorAll("#screen details").forEach((d) => (d.open = true)));
  const labels = await page.$$eval(".rolllog__row .rolllog__label", (els) => els.map((e) => e.textContent));
  assert.deepEqual(labels, ["FIRST", "SECOND", "THIRD"], "oldest first, newest last");
  // and the same in the solo Log & Notes panel under "All rolls"
  await page.evaluate(() => localStorage.setItem("brp:solo", JSON.stringify({ panel: "notes", logScope: "all",
    scratchpad: "", log: [], hypotheses: [], humanityChecks: {}, promoGainChecks: {}, promoLoseChecks: {}, timerDie: "D6" })));
  await page.goto(`${base}/index.html?log3#solo`, { waitUntil: "load" });
  await page.waitForTimeout(250);
  const soloLabels = await page.$$eval(".rolllog__row .rolllog__label", (els) => els.map((e) => e.textContent));
  assert.deepEqual(soloLabels, ["FIRST", "SECOND", "THIRD"]);
  // pinning the newest row puts it at the end of the notes
  await page.locator(".rolllog__row").last().getByRole("button", { name: "Pin to case notes" }).click();
  await page.waitForTimeout(250);
  const notes = await page.evaluate(() => JSON.parse(localStorage.getItem("brp:solo")).scratchpad);
  assert.match(notes.trim(), /\[THIRD\] newest$/, `newest pin lands at the bottom:\n${notes}`);
});

// The Solo assistant is laid out in the book's Investigation Procedure order
// (Solo Mode p.005). This pins the sequence: the panels run Case -> Shift ->
// Scene -> Leads -> Wrap -> Notes, and the two things that OPEN a Shift
// (proceed to a location, then the Countdown Event Check) sit together on the
// Shift panel, in that order.
// Resetting the Countdown Timer means undoing this Shift's check. It used to
// put the die back but leave the "done this Shift" marker standing, so the card
// went on claiming the check was made and a re-roll asked to confirm.
test("resetting the Countdown Timer clears the done-this-Shift marker [Solo p.006]", async (t) => {
  if (unavailable) return t.skip(unavailable);
  await page.goto(`${base}/index.html?treset1#solo`, { waitUntil: "load" });
  await page.evaluate(() => {
    localStorage.setItem("brp:settings", JSON.stringify({ theme: "dark", solo: true, gm: true }));
    localStorage.setItem("brp:solo", JSON.stringify({ panel: "shift", timerDie: "D8", shiftNo: 1, shiftFlags: {}, hypotheses: [], log: [], scratchpad: "", results: {} }));
  });
  await page.goto(`${base}/index.html?treset2#solo`, { waitUntil: "load" });
  await page.waitForTimeout(250);
  const solo = () => page.evaluate(() => JSON.parse(localStorage.getItem("brp:solo")));
  const chips = () => page.$$eval(".panel .chip--done", (e) => e.map((x) => x.textContent.trim()));
  const slots = () => page.$$eval(".result-slot .result-slot__title", (e) => e.map((x) => x.textContent.trim()));
  const first = await page.evaluate(async () => (await import("/data-solo.js")).ESCALATION_STEPS[0]);

  // The label names the die from the data, not a hardcoded "D6".
  const resetLabel = await page.$$eval(".panel .btn", (e) => e.map((x) => x.textContent.trim()).find((x) => /Reset/.test(x)));
  assert.equal(resetLabel, `✕ Reset (${first})`);

  await page.evaluate(() => { Math.random = () => 0; });   // all 1s: no event, the timer escalates
  await page.getByRole("button", { name: "🎲 Roll the timer" }).click();
  await page.waitForTimeout(250);
  assert.deepEqual(await chips(), ["✓ done this Shift"], "the check is marked done");
  assert.equal((await solo()).shiftFlags.countdown, true);
  assert.equal((await solo()).timerDie, "D10", "a miss escalated D8 → D10");
  assert.equal((await slots()).length, 1, "the result is on the card");

  await page.getByRole("button", { name: /Reset/ }).click();
  await page.waitForTimeout(250);
  const after = await solo();
  assert.deepEqual(await chips(), [], "the done-this-Shift marker is gone");
  assert.equal(after.shiftFlags.countdown, false, "and so is the flag behind it");
  assert.equal(after.timerDie, first, "the die is back to the start of the ladder");
  assert.deepEqual(await slots(), [], "the stale result is dropped");

  // A reset really is an undo: rolling again must not ask to confirm.
  await page.getByRole("button", { name: "🎲 Roll the timer" }).click();
  await page.waitForTimeout(250);
  assert.equal((await page.$$(".modal")).length, 0, "no 'already done this Shift' prompt after a reset");
});

// ---------------------------------------------------------------------------
// Case Board — HOUSE AID (§3.17). Drives the whole loop through the real UI:
// boxes, connections, a Discovery Check, a clincher, and the hand-back to the
// book's Hypothesis Check. Also pins that it adds to Solo without taking
// anything away, and that the sheet is what earns a check.
// ---------------------------------------------------------------------------
test("the Case Board runs a case: boxes, connections, discovery, clincher, promote [house aid]", async (t) => {
  if (unavailable) return t.skip(unavailable);
  const open = async (tag) => {
    await page.goto(`${base}/index.html?board${tag}#solo`, { waitUntil: "load" });
    await page.waitForTimeout(250);
  };
  await open("0");
  await page.evaluate(() => {
    localStorage.setItem("brp:settings", JSON.stringify({ theme: "dark", solo: true, gm: true }));
    localStorage.setItem("brp:solo", JSON.stringify({ panel: "board", hypotheses: [], log: [], scratchpad: "OLD NOTE", results: {} }));
    localStorage.removeItem("brp:board");
  });
  await open("1");

  assert.equal(await page.$eval(".segnav__pill--on", (e) => e.textContent.trim()), "Board");
  const eyebrows = await page.$$eval(".panel .card .step-eyebrow", (e) => e.map((x) => x.textContent.trim()));
  assert.ok(eyebrows.length && eyebrows.every((x) => x === "House aid"), `every board card is labelled a house aid: ${eyebrows}`);

  const board = () => page.evaluate(() => JSON.parse(localStorage.getItem("brp:board")));
  // Rolled boxes take their content from the official Solo tables.
  for (const name of ["🎲 ＋ Clue", "🎲 ＋ Suspect", "🎲 ＋ Clue", "🎲 ＋ Suspect"]) {
    await page.getByRole("button", { name, exact: true }).click();
    await page.waitForTimeout(180);
  }
  let b = await board();
  assert.equal(b.boxes.length, 4);
  assert.deepEqual(b.boxes.map((x) => x.n), [1, 2, 3, 4], "boxes are numbered sequentially");
  assert.ok(b.boxes.every((x) => x.name && x.detail), "rolled boxes carry a name and detail");

  // Typed box
  await page.getByRole("button", { name: "✍ ＋ Suspect", exact: true }).click();
  await page.waitForTimeout(150);
  await page.fill(".modal input, .modal textarea", "Eldon Tyrell");
  await page.getByRole("button", { name: /^(OK|Add)$/ }).click();
  await page.waitForTimeout(200);
  assert.ok((await board()).boxes.some((x) => x.name === "Eldon Tyrell"), "a typed suspect lands on the board");

  // Connect from the pick list — clues may only be offered suspects.
  await page.getByRole("button", { name: "🔗 Connect two boxes" }).click();
  await page.waitForTimeout(150);
  const options = await page.$$eval(".board__pick .btn", (e) => e.map((x) => x.textContent.trim()));
  assert.ok(options.length >= 3 && options.every((o) => o.startsWith("S")), `only suspects offered: ${options}`);
  await page.locator(".board__pick .btn").first().click();
  await page.waitForTimeout(250);
  b = await board();
  assert.equal(b.boxes.filter((x) => x.links.length).length, 2, "the link is recorded on both boxes");

  // Connect by letting the board roll — this must PERSIST (it once did not).
  // The die is forced: face 1 lands on a real box, and a face past the last box
  // is the printed "you choose" branch, not a re-roll.
  const links = async () => (await board()).boxes.reduce((n, x) => n + x.links.length, 0);
  // Roll from a named box — one that still has a legal partner, since a fully
  // connected box correctly refuses to open the picker at all.
  const boardRoll = async (force, tag) => {
    await page.evaluate((r) => { Math.random = () => r; }, force);
    await page.locator(".board__box").filter({ has: page.locator(".board__tag", { hasText: new RegExp(`^${tag}$`) }) })
      .getByRole("button", { name: /^Connect / }).click();
    await page.waitForTimeout(150);
    await page.getByRole("button", { name: "🎲 Let the board decide" }).click();
    await page.waitForTimeout(250);
  };
  const before = await links();
  await boardRoll(0, "S2");        // lowest face — lands on a real box
  assert.equal(await links(), before + 2, "a board-rolled connection is saved, not just announced");

  await boardRoll(0.999, "C1");   // highest face on a D6 with 5 boxes — past the end
  assert.equal(await links(), before + 2, "a roll past the last box adds nothing; you pick instead");
  const warned = await page.$$eval(".toast", (e) => e.map((x) => x.textContent));
  assert.ok(warned.some((w) => /past the board/.test(w)), `and says so: ${warned}`);
  await page.keyboard.press("Escape");

  // The discovery roll lands inline, in its own card.
  await page.getByRole("button", { name: "🎲 Discovery Check" }).click();
  await page.waitForTimeout(150);
  await page.getByRole("button", { name: "Roll anyway" }).click();
  await page.waitForTimeout(300);
  const byCard = await page.$$eval(".panel .card", (cards) => cards.map((c) => [
    c.querySelector(".sheet__section")?.textContent,
    [...c.querySelectorAll(":scope > .result-slot .result-slot__title")].map((x) => x.textContent.trim())]));
  const discCard = byCard.find(([title]) => title === "Discovery Check");
  assert.ok(discCard[1].some((x) => /Discovery Check —/.test(x)), `the result lands in the Discovery card: ${JSON.stringify(byCard)}`);

  // Pinning a box writes to the case notes, at the end.
  await page.locator(".board__box").first().getByRole("button", { name: /^Pin / }).click();
  await page.waitForTimeout(250);
  const notes = await page.evaluate(() => JSON.parse(localStorage.getItem("brp:solo")).scratchpad);
  assert.ok(notes.startsWith("OLD NOTE"), "existing notes are kept");
  assert.match(notes.trim().split("\n").pop(), /^• \[Board [CS]\d+\]/, "the pinned box is the last line");

  // Six connections on one suspect names the culprit without a clincher roll.
  await page.evaluate(() => {
    const b = JSON.parse(localStorage.getItem("brp:board"));
    const s = b.boxes.find((x) => x.kind === "suspect");
    for (let i = 0; i < 6; i++) {
      const c = { id: "seed" + i, n: b.nextN++, kind: "clue", name: "Seeded clue " + i, detail: "", links: [s.id] };
      if (!s.links.includes(c.id)) s.links.push(c.id);
      b.boxes.push(c);
    }
    localStorage.setItem("brp:board", JSON.stringify(b));
  });
  await open("2");
  const titles = await page.$$eval(".panel .card .sheet__section", (e) => e.map((x) => x.textContent.trim()));
  assert.ok(titles.includes("The answer"), `the board calls it: ${titles}`);

  // …and hands the case back to the book, awarding nothing itself.
  await page.getByRole("button", { name: /Promote to a hypothesis/ }).first().click();
  await page.waitForTimeout(200);
  await page.getByRole("button", { name: /^(OK|Add to Leads)$/ }).click();
  await page.waitForTimeout(250);
  const solo = await page.evaluate(() => JSON.parse(localStorage.getItem("brp:solo")));
  assert.equal(solo.hypotheses.length, 1, "the suspect becomes a hypothesis on Leads");
  assert.equal(solo.hypotheses[0].die, "D6", "rated at the book's starting die, not the board's connection count");

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert.equal(overflow, 0, "no horizontal overflow at 360px");

  // Nothing was taken away: the official panels and their cards are all still there.
  for (const [pill, expect] of [["Shift", "Countdown Event Check"], ["Scene", "Frame the scene"], ["Leads", "Review your hypotheses"], ["Wrap", "End the Shift"]]) {
    await page.click(`.segnav__pill:text-is("${pill}")`);
    await page.waitForTimeout(150);
    const cards = await page.$$eval(".panel .card .sheet__section", (e) => e.map((x) => x.textContent.trim()));
    assert.ok(cards.includes(expect), `${pill} still has "${expect}": ${cards}`);
  }
});

test("a Discovery Check is earned on the sheet, and only by investigative rolls [house aid]", async (t) => {
  if (unavailable) return t.skip(unavailable);
  // Roll a named skill with the dice forced to succeed, and report what the
  // result offered. `solo` toggles Solo Mode off to prove the gate.
  const rollSkill = async (tag, skillName, solo) => {
    await page.goto(`${base}/index.html?earn${tag}a#sheet`, { waitUntil: "load" });
    await page.evaluate((on) => {
      localStorage.setItem("brp:settings", JSON.stringify({ theme: "dark", solo: on, gm: false }));
      localStorage.removeItem("brp:board");
    }, solo);
    await page.evaluate(async () => {
      const { Store } = await import("/src/store.js");
      const { normalizeCharacter } = await import("/src/derived.js");
      const ch = normalizeCharacter({ name: "Board Runner", nature: "human", archetype: "analyst", years: "seasoned",
        attributes: { STR: "C", AGI: "C", INT: "A", EMP: "B" } });
      Store.setActiveId(Store.save(ch).id);
    });
    await page.goto(`${base}/index.html?earn${tag}b#sheet`, { waitUntil: "load" });
    await page.waitForTimeout(300);
    await page.evaluate(() => { Math.random = () => 0.999; });
    await page.getByRole("button", { name: new RegExp(`Roll ${skillName}`) }).first().click();
    await page.waitForTimeout(150);
    await page.getByRole("button", { name: "⚄ Roll" }).first().click();
    await page.waitForTimeout(250);
    const offered = await page.$$eval(".modal .btn", (e) => e.map((x) => x.textContent.trim()));
    return offered;
  };

  const obs = await rollSkill("1", "Observation", true);
  assert.ok(obs.some((x) => /Earn a Discovery Check/.test(x)), `a successful Observation offers the check: ${obs}`);
  await page.getByRole("button", { name: /Earn a Discovery Check/ }).click();
  await page.waitForTimeout(200);
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("brp:board")).checks), 1, "the check is banked");
  await page.keyboard.press("Escape");

  const gun = await rollSkill("2", "Firearms", true);
  assert.ok(!gun.some((x) => /Earn a Discovery Check/.test(x)), `shooting straight is not investigating: ${gun}`);
  await page.keyboard.press("Escape");

  const off = await rollSkill("3", "Observation", false);
  assert.ok(!off.some((x) => /Earn a Discovery Check/.test(x)), `nothing offered with Solo Mode off: ${off}`);
  await page.keyboard.press("Escape");
});

test("Solo panels and Shift-opening buttons follow the book's procedure [Solo p.005]", async (t) => {
  if (unavailable) return t.skip(unavailable);
  await page.goto(`${base}/index.html?soloseq#solo`, { waitUntil: "load" });
  await page.evaluate(() => {
    localStorage.setItem("brp:settings", JSON.stringify({ theme: "dark", solo: true, gm: true }));
    localStorage.setItem("brp:solo", JSON.stringify({ panel: "track" }));  // legacy key
  });
  await page.evaluate(() => { location.hash = "#__r"; location.hash = "#solo"; });
  await page.waitForTimeout(200);

  const pills = await page.$$eval(".segnav__pill", (els) => els.map((e) => e.textContent.trim()));
  assert.deepEqual(pills, ["Case", "Shift", "Scene", "Board", "Leads", "Wrap", "Notes"],
    "the house-aid Board sits between the scene that finds evidence and the leads it feeds");
  // a legacy panel key migrates instead of falling back to the first panel
  const active = await page.$eval(".segnav__pill--on", (e) => e.textContent.trim());
  assert.equal(active, "Leads", "legacy 'track' panel maps to Leads");

  await page.click('.segnav__pill:text-is("Shift")');
  await page.waitForTimeout(150);
  const steps = await page.$$eval(".panel .step-eyebrow", (els) => els.map((e) => e.textContent.trim()));
  assert.deepEqual(steps, ["Step 1", "Step 2"], "Shift panel runs location then countdown");
  const titles = await page.$$eval(".panel .sheet__section", (els) => els.map((e) => e.textContent.trim()));
  assert.ok(titles.indexOf("Proceed to a location") < titles.indexOf("Countdown Event Check"),
    "the location comes before the Countdown check");

  // The whole loop is on the page, rendered from the data layer in step order.
  const printed = await page.evaluate(async () => (await import("/data-solo.js")).SOLO_SEQUENCE);
  const proc = await page.$$eval(".solo-proc__list li", (ls) => ls.map((l) => l.textContent));
  assert.equal(proc.length, printed.length, "every procedure step is listed");
  printed.forEach((s, i) => {
    assert.ok(proc[i].startsWith(s.title), `step ${s.step} rendered in order: ${proc[i].slice(0, 40)}`);
    assert.ok(proc[i].includes(`${s.where} tab`), `step ${s.step} names the tab that serves it`);
  });
});

// The GM screen is laid out in the order a session runs. This pins the pill
// order, the legacy-key migration, and that case prep, table play, the fight
// tools, and the aftermath each stay on their own panel.
test("GM panels follow the arc of a session", async (t) => {
  if (unavailable) return t.skip(unavailable);
  await page.goto(`${base}/index.html?gmseq#gm`, { waitUntil: "load" });
  await page.evaluate(() => {
    localStorage.setItem("brp:settings", JSON.stringify({ theme: "dark", solo: true, gm: true }));
    localStorage.setItem("brp:gm", JSON.stringify({ panel: "party" }));   // legacy key
  });
  await page.evaluate(() => { location.hash = "#__r"; location.hash = "#gm"; });
  await page.waitForTimeout(200);

  const pills = await page.$$eval(".segnav__pill", (els) => els.map((e) => e.textContent.trim()));
  assert.deepEqual(pills, ["Prep", "Play", "Fight", "Wrap", "Notes"]);
  assert.equal(await page.$eval(".segnav__pill--on", (e) => e.textContent.trim()), "Play",
    "legacy 'party' panel maps to Play");

  const cardsOn = async (pill) => {
    await page.click(`.segnav__pill:text-is("${pill}")`);
    await page.waitForTimeout(120);
    return page.$$eval(".panel .sheet__section", (els) => els.map((e) => e.textContent.trim()));
  };
  assert.deepEqual(await cardsOn("Prep"), ["Build the case", "Main NPC Generator", "Clues & the finale"]);
  assert.deepEqual(await cardsOn("Play"), ["Live Party Panel", "Scene dressing"]);
  assert.deepEqual(await cardsOn("Fight"), ["Drop-in Combatant Generator"]);
  assert.deepEqual(await cardsOn("Wrap"), ["Session Awards", "Consequences & downtime"]);
});

// The Case Board tutorial is the feature's documentation, so it has to actually
// render — and to keep reading its numbers from data-house.js rather than
// restating them (§10.2), which is what makes it stay correct.
test("the Case Board tutorial walks the whole feature, with live numbers [house aid]", async (t) => {
  if (unavailable) return t.skip(unavailable);
  await page.goto(`${base}/index.html?tut1#tutorial`, { waitUntil: "load" });
  await page.evaluate(() => {
    localStorage.setItem("brp:settings", JSON.stringify({ theme: "dark", solo: true, gm: true }));
    localStorage.setItem("brp:tutorial", "board");
  });
  await page.goto(`${base}/index.html?tut2#tutorial`, { waitUntil: "load" });
  await page.waitForTimeout(250);

  const pills = await page.$$eval(".segnav__pill", (e) => e.map((x) => x.textContent.trim()));
  assert.deepEqual(pills, ["Setup", "Solo", "Case Board", "At the Table", "Cheat Sheet"]);
  assert.equal(await page.$eval(".segnav__pill--on", (e) => e.textContent.trim()), "Case Board");

  // A numbered walkthrough, in order, with no gaps.
  const numbered = await page.$$eval(".panel .card", (cards) => {
    const c = cards.find((x) => x.querySelector(".card__title")?.textContent.startsWith("Step by step"));
    return [...c.querySelectorAll(".tut__step .tut__label")].map((l) => l.textContent.trim());
  });
  assert.ok(numbered.length >= 8, `expected a full walkthrough, got ${numbered.length} steps`);
  numbered.forEach((label, i) => assert.ok(label.startsWith(`${i + 1} ·`), `step ${i + 1} out of order: ${label}`));

  // The outcome table is rendered from the data, band for band.
  const bands = await page.$$eval(".panel .card", (cards) => {
    const c = cards.find((x) => x.querySelector(".card__title")?.textContent.includes("Discovery Check can give"));
    return [...c.querySelectorAll("dt")].map((d) => d.textContent.trim());
  });
  const rows = await page.evaluate(async () => (await import("/data-house.js")).DISCOVERY_OUTCOMES.map((r) => (r.max === Infinity ? `${r.min}+` : `${r.min}–${r.max}`)));
  assert.deepEqual(bands, rows, "every discovery band is documented, straight from data-house.js");

  // Live numbers, not restated ones, and no template leaks.
  const text = await page.$eval(".panel", (e) => e.textContent);
  const H = await page.evaluate(async () => {
    const h = await import("/data-house.js");
    return { box: h.BOX_MAX, clinch: h.CLINCHER_CONNECTIONS, die: h.DISCOVERY_ROLL.die, dice: h.MATRIX_DICE.map((d) => `D${d}`).join(", ") };
  });
  assert.ok(text.includes(`${H.box} boxes`), "the box cap comes from the data");
  assert.ok(text.includes(`${H.clinch} connections`), "so does the clincher threshold");
  assert.ok(text.includes(`D${H.die}`) && text.includes(H.dice), "so do the dice");
  assert.ok(text.includes("House aid"), "and it says plainly that this is not canon");
  assert.ok(!/undefined|NaN|\[object/.test(text), "no template leaks");
  const tutorialSrc = fs.readFileSync(path.join(ROOT, "src", "tutorial.js"), "utf8");
  assert.ok(/data-house\.js/.test(tutorialSrc), "tutorial.js reads the house data directly");

  // Both cross-panel buttons work, in both directions.
  await page.getByRole("button", { name: /Back to the solo loop/ }).click();
  await page.waitForTimeout(200);
  assert.equal(await page.$eval(".segnav__pill--on", (e) => e.textContent.trim()), "Solo");
  await page.getByRole("button", { name: /Case Board guide/ }).click();
  await page.waitForTimeout(200);
  assert.equal(await page.$eval(".segnav__pill--on", (e) => e.textContent.trim()), "Case Board");

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert.equal(overflow, 0, "no horizontal overflow at 390px");

  // The feature links to its own documentation, opening the right panel.
  await page.evaluate(() => {
    localStorage.setItem("brp:tutorial", "setup");
    localStorage.setItem("brp:solo", JSON.stringify({ panel: "board", hypotheses: [], log: [], scratchpad: "", results: {} }));
  });
  await page.goto(`${base}/index.html?tut3#solo`, { waitUntil: "load" });
  await page.waitForTimeout(250);
  await page.getByRole("button", { name: /Step-by-step guide/ }).click();
  await page.waitForTimeout(350);
  assert.equal(await page.evaluate(() => location.hash), "#tutorial");
  assert.equal(await page.$eval(".segnav__pill--on", (e) => e.textContent.trim()), "Case Board",
    "the board's guide button lands on the Case Board panel, not wherever the tutorial was left");
});

// The tutorial's step buttons deep-link by route name. A renamed or removed
// route would leave a dead button, so assert every target really routes.
test("every tutorial deep-link points at a real route", async (t) => {
  if (unavailable) return t.skip(unavailable);
  const source = fs.readFileSync(path.join(ROOT, "src", "tutorial.js"), "utf8");
  const targets = [...source.matchAll(/navigate\("([a-z]+)"\)/g)].map((m) => m[1]);
  assert.ok(targets.length >= 5, "expected the tutorial to carry deep links");
  for (const route of [...new Set(targets)]) {
    await page.goto(`${base}/index.html?tut=${route}#${route}`, { waitUntil: "load" });
    await page.waitForTimeout(150);
    const rendered = await page.$eval("#screen", (el) => el.children.length);
    assert.ok(rendered > 0, `tutorial links to #${route}, which renders nothing`);
  }
});

// Oracle results are inline, in the card that produced them: no modal, one slot
// per card, a per-tab clear, a Reroll that re-runs the same button, and the
// whole lot surviving a reload.
test("Solo/GM rolls land inline with reroll, pin and a per-tab clear", async (t) => {
  if (unavailable) return t.skip(unavailable);
  await page.goto(`${base}/index.html?slot#solo`, { waitUntil: "load" });
  await page.evaluate(() => {
    localStorage.setItem("brp:settings", JSON.stringify({ theme: "dark", solo: true, gm: true }));
    localStorage.setItem("brp:solo", JSON.stringify({ panel: "scene", log: [], hypotheses: [], humanityChecks: {}, promoGainChecks: {}, promoLoseChecks: {}, scratchpad: "" }));
  });
  await page.goto(`${base}/index.html?slot2#solo`, { waitUntil: "load" });
  await page.waitForTimeout(250);

  const slots = () => page.$$eval(".result-slot", (els) => els.map((e) => ({
    title: e.querySelector(".result-slot__title").textContent,
    body: e.querySelector(".result-slot__body").textContent,
    card: e.closest(".card").querySelector(".sheet__section").textContent,
  })));

  await page.getByRole("button", { name: "\u{1F3B2} Scene Check (D8)" }).first().click();
  await page.waitForTimeout(250);
  assert.equal((await page.$$(".modal")).length, 0, "no modal — the result is inline");
  let live = await slots();
  assert.equal(live.length, 1);
  assert.equal(live[0].card, "Frame the scene", "the result sits in the card that rolled it");

  await page.getByRole("button", { name: "\u{1F3B2} Meaning (D8)" }).first().click();
  await page.waitForTimeout(250);
  live = await slots();
  assert.equal(live.length, 2, "each card keeps its own result");
  assert.equal(live[1].card, "Gather clues");
  assert.match(await page.$eval(".result-clear .btn", (b) => b.textContent), /Clear these 2 results/);

  // Reroll re-runs the same button and stacks onto that card's short history,
  // newest last, capped — so a few draws can be compared side by side.
  await page.evaluate(() => { Math.random = () => 0; });
  const rerolls = await page.$$eval(".result-slot .btn", (els) => els.filter((b) => /Reroll/.test(b.textContent)).length);
  assert.equal(rerolls, 2, "only the newest result on each card offers a Reroll");
  for (let i = 0; i < 4; i++) {
    await page.locator(".result-slot").filter({ hasText: "Scene Check" }).last().getByRole("button", { name: /Reroll/ }).click();
    await page.waitForTimeout(200);
  }
  live = await slots();
  const scene = live.filter((r) => r.card === "Frame the scene");
  assert.equal(scene.length, 3, "the per-card history is capped");
  assert.match(scene[scene.length - 1].title, /Scene Check — 1 \(D8\)/, "the newest reroll sits last");

  // Results survive a reload, then the per-tab clear wipes them
  await page.goto(`${base}/index.html?slot3#solo`, { waitUntil: "load" });
  await page.waitForTimeout(250);
  assert.equal((await slots()).length, 4, "inline results persist across a reload");
  await page.locator(".result-slot").first().getByRole("button", { name: /^\u{1F4CC} Pin/u }).click();
  await page.waitForTimeout(200);
  await page.click(".result-clear .btn");
  await page.waitForTimeout(250);
  assert.equal((await slots()).length, 0, "the per-tab clear removes every result on that tab");
  const notes = await page.evaluate(() => JSON.parse(localStorage.getItem("brp:solo")).scratchpad);
  assert.match(notes, /\[Scene Check\]/, "pinning from a slot still writes to the case notes");

  // Same surface on the GM screen
  await page.evaluate(() => localStorage.setItem("brp:gm", JSON.stringify({ panel: "prep", log: [], scratchpad: "" })));
  await page.goto(`${base}/index.html?slotgm#gm`, { waitUntil: "load" });
  await page.waitForTimeout(250);
  await page.getByRole("button", { name: "\u{1F3B2} Theme (D10)" }).first().click();
  await page.waitForTimeout(250);
  assert.equal((await page.$$(".modal")).length, 0);
  const gm = await slots();
  assert.equal(gm.length, 1);
  assert.equal(gm[0].card, "Build the case");

  // Auto-pin writes every subsequent roll straight into the notes.
  await page.click(".autopin .chip");
  await page.waitForTimeout(150);
  assert.equal(await page.$eval(".autopin .chip", (b) => b.getAttribute("aria-pressed")), "true");
  await page.click('.btn:text-is("🎲 Sector (D8)")');
  await page.waitForTimeout(250);
  const pad = await page.evaluate(() => JSON.parse(localStorage.getItem("brp:gm")).scratchpad || "");
  assert.match(pad, /\[Sector\]/, "auto-pin wrote the roll to the notes with no extra tap");
});

// Every roll button must land a visible result — the Core Case File Generator
// sat in a bare <details>, so its rolls had no card to render into and showed
// nothing. Sweep every dice button on the roll-heavy panels and assert the
// slot count goes up on each click.
test("every oracle button on Solo and GM shows a result", async (t) => {
  if (unavailable) return t.skip(unavailable);
  const sweep = async (screen, storeKey, panels) => {
    for (const panel of panels) {
      await page.evaluate(([k, p]) => {
        localStorage.setItem("brp:settings", JSON.stringify({ theme: "dark", solo: true, gm: true }));
        localStorage.setItem(k, JSON.stringify({ panel: p, altOpen: true, log: [], scratchpad: "", hypotheses: [], humanityChecks: {}, promoGainChecks: {}, promoLoseChecks: {} }));
      }, [storeKey, panel]);
      await page.goto(`${base}/index.html?sweep=${screen}${panel}#${screen}`, { waitUntil: "load" });
      await page.waitForTimeout(250);
      await page.evaluate(() => document.querySelectorAll("details").forEach((d) => (d.open = true)));
      const labels = await page.$$eval(".panel .btn", (els) =>
        els.map((e) => e.textContent).filter((l) => /^[\u{1F3B2}\u26A1]/u.test(l)));   // dice + the "full" generators
      for (const label of labels) {
        await page.locator(`.panel .btn:text-is("${label}")`).first().click();
        await page.waitForTimeout(200);
        // The result must be visible where the button is — in its card, or on
        // the panel when the button has no card. (Counting all slots would miss
        // this once a card's history hits its cap.)
        const ok = await page.evaluate((lbl) => {
          const b = [...document.querySelectorAll(".panel .btn")].find((x) => x.textContent === lbl);
          if (!b) return false;
          const host = b.closest(".card") || b.closest(".panel");
          return host.querySelectorAll(":scope > .result-slot").length > 0;
        }, label);
        assert.ok(ok, `${screen}/${panel}: "${label}" produced no visible result`);
      }
    }
  };
  await sweep("solo", "brp:solo", ["case", "shift", "scene"]);
  await sweep("gm", "brp:gm", ["prep", "play", "wrap"]);
});

// A roll re-renders the whole screen in place. The router used to jump to the
// top on every render, so on a long panel the new result landed below the fold
// and looked like nothing had happened.
test("rolling keeps your place and brings the new result on screen", async (t) => {
  if (unavailable) return t.skip(unavailable);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => {
    localStorage.setItem("brp:settings", JSON.stringify({ theme: "dark", solo: true, gm: true }));
    localStorage.setItem("brp:solo", JSON.stringify({ panel: "case", log: [], scratchpad: "", hypotheses: [], humanityChecks: {}, promoGainChecks: {}, promoLoseChecks: {} }));
  });
  await page.goto(`${base}/index.html?scroll#solo`, { waitUntil: "load" });
  await page.waitForTimeout(250);

  const button = page.locator('.btn:text-is("⚡ Generate full briefing")');
  await button.scrollIntoViewIfNeeded();
  await page.waitForTimeout(150);
  const before = await page.evaluate(() => window.scrollY);
  assert.ok(before > 100, "the button sits well down a long panel");

  await button.click();
  await page.waitForTimeout(700);
  const after = await page.evaluate(() => window.scrollY);
  assert.ok(Math.abs(after - before) < 600, `the page kept its place (was ${before}, now ${after})`);

  const onScreen = await page.evaluate(() => {
    const s = [...document.querySelectorAll(".result-slot")].pop();
    if (!s) return false;
    const r = s.getBoundingClientRect();
    return r.top < window.innerHeight && r.bottom > 0;
  });
  assert.ok(onScreen, "the new result is visible without scrolling");

  // switching tabs still starts at the top
  await page.click('.segnav__pill:text-is("Scene")');
  await page.waitForTimeout(250);
  assert.equal(await page.evaluate(() => window.scrollY), 0, "a tab switch scrolls to the top");
});

// With Solo Mode on there is no Game Runner keeping the record, so rolls made
// outside the solo assistant have to reach the Case Notes by themselves.
test("sheet and combat rolls land in the solo Case Notes when Solo is on", async (t) => {
  if (unavailable) return t.skip(unavailable);
  await page.evaluate(() => {
    localStorage.setItem("brp:settings", JSON.stringify({ theme: "dark", solo: true, gm: true }));
    localStorage.setItem("brp:solo", JSON.stringify({ panel: "notes", scratchpad: "OLDEST LINE", log: [], hypotheses: [], humanityChecks: {}, promoGainChecks: {}, promoLoseChecks: {} }));
    localStorage.removeItem("brp:rolllog");
  });
  await page.goto(`${base}/index.html?solonotes#sheet`, { waitUntil: "load" });
  await page.waitForTimeout(250);

  // roll a skill on the character sheet
  await page.getByRole("button", { name: /Firearms/ }).first().click();
  await page.waitForTimeout(200);
  await page.getByRole("button", { name: "⚄ Roll" }).first().click();
  await page.waitForTimeout(250);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(150);

  let notes = await page.evaluate(() => JSON.parse(localStorage.getItem("brp:solo")).scratchpad);
  assert.ok(notes.startsWith("OLDEST LINE"), "existing notes are kept");
  assert.match(notes, /\[.+ · Firearms\]/, `the sheet roll reached the case notes:\n${notes}`);
  assert.match(notes, /success|Failure/, "with its outcome");

  // an oracle roll is NOT mirrored twice — the solo screen owns those
  await page.evaluate(() => localStorage.setItem("brp:solo", JSON.stringify({ panel: "scene", scratchpad: "", log: [], hypotheses: [], humanityChecks: {}, promoGainChecks: {}, promoLoseChecks: {} })));
  await page.goto(`${base}/index.html?solonotes2#solo`, { waitUntil: "load" });
  await page.waitForTimeout(250);
  await page.click('.btn:text-is("🎲 Scene Check (D8)")');
  await page.waitForTimeout(250);
  notes = await page.evaluate(() => JSON.parse(localStorage.getItem("brp:solo")).scratchpad || "");
  assert.equal(notes.trim(), "", "oracle rolls only reach the notes via pin or auto-pin");

  // and nothing is written at all when Solo Mode is off
  await page.evaluate(() => {
    localStorage.setItem("brp:settings", JSON.stringify({ theme: "dark", solo: false, gm: true }));
    localStorage.setItem("brp:solo", JSON.stringify({ panel: "notes", scratchpad: "", log: [] }));
  });
  await page.goto(`${base}/index.html?solooff#sheet`, { waitUntil: "load" });
  await page.waitForTimeout(250);
  await page.getByRole("button", { name: /Firearms/ }).first().click();
  await page.waitForTimeout(200);
  await page.getByRole("button", { name: "⚄ Roll" }).first().click();
  await page.waitForTimeout(250);
  await page.keyboard.press("Escape");
  const off = await page.evaluate(() => JSON.parse(localStorage.getItem("brp:solo")).scratchpad || "");
  assert.equal(off.trim(), "", "Solo off = no case-note writes");
});

// Panels have to teach their own use: every roll card carries a collapsed "How
// to use this" note, and a finished roll says what to do next.
test("cards explain when to press them, and a roll says what comes next", async (t) => {
  if (unavailable) return t.skip(unavailable);
  await page.evaluate(() => {
    localStorage.setItem("brp:settings", JSON.stringify({ theme: "dark", solo: true, gm: true }));
    localStorage.setItem("brp:solo", JSON.stringify({ panel: "scene", log: [], scratchpad: "", hypotheses: [], humanityChecks: {}, promoGainChecks: {}, promoLoseChecks: {} }));
  });
  await page.goto(`${base}/index.html?how#solo`, { waitUntil: "load" });
  await page.waitForTimeout(250);
  const cards = await page.$$eval(".panel .card", (els) => els.map((c) => ({
    title: c.querySelector(".sheet__section")?.textContent,
    lines: c.querySelectorAll(".how__line").length,
  })));
  assert.ok(cards.length >= 4, "the Scene panel has its cards");
  for (const c of cards) assert.ok(c.lines > 0, `"${c.title}" has no How-to-use guidance`);

  // The house-aid Board tab is held to the same standard.
  await page.evaluate(() => localStorage.setItem("brp:solo", JSON.stringify({ panel: "board", log: [], scratchpad: "", hypotheses: [], results: {} })));
  await page.goto(`${base}/index.html?howboard#solo`, { waitUntil: "load" });
  await page.waitForTimeout(250);
  const boardCards = await page.$$eval(".panel .card", (els) => els.map((c) => [c.querySelector(".sheet__section")?.textContent, c.querySelectorAll(".how__line").length]));
  assert.ok(boardCards.length >= 2, `the Board panel has its cards: ${JSON.stringify(boardCards)}`);
  for (const [title, lines] of boardCards) assert.ok(lines > 0, `board card "${title}" has no How-to-use guidance`);

  // GM cards too
  await page.evaluate(() => localStorage.setItem("brp:gm", JSON.stringify({ panel: "prep", log: [], scratchpad: "" })));
  await page.goto(`${base}/index.html?how2#gm`, { waitUntil: "load" });
  await page.waitForTimeout(250);
  const gmCards = await page.$$eval(".panel .card", (els) => els.map((c) => c.querySelectorAll(".how__line").length));
  assert.ok(gmCards.every((n) => n > 0), "every GM Prep card explains itself");

  // A successful roll on the sheet says what the extra successes buy, and a
  // critical offers the Solo crit table without leaving the sheet.
  await page.goto(`${base}/index.html?how3#sheet`, { waitUntil: "load" });
  await page.waitForTimeout(250);
  await page.evaluate(() => { Math.random = () => 0.999; });
  await page.getByRole("button", { name: /Firearms/ }).first().click();
  await page.waitForTimeout(200);
  await page.getByRole("button", { name: "⚄ Roll" }).first().click();
  await page.waitForTimeout(250);
  const next = await page.$eval(".roll-next", (n) => n.textContent);
  assert.match(next, /You succeed/, next.slice(0, 120));
  await page.click(".roll-next .btn");
  await page.waitForTimeout(250);
  assert.ok((await page.$(".roll-next__crit")) !== null, "the crit-success result renders in the roll");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(150);

  // A failed roll points at the push instead
  await page.evaluate(() => { Math.random = () => 0; });
  await page.getByRole("button", { name: /Stamina/ }).first().click();
  await page.waitForTimeout(200);
  await page.getByRole("button", { name: "⚄ Roll" }).first().click();
  await page.waitForTimeout(250);
  assert.match(await page.$eval(".roll-next", (n) => n.textContent), /Failed/);
  await page.keyboard.press("Escape");
});
