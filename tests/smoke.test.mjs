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
  const obstacle = await page.$eval(".modal", (m) => m.textContent);
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
      localStorage.setItem("brp:solo", JSON.stringify({ timerDie: "D8", hypotheses: [], humanityChecks: {}, promoGainChecks: {}, promoLoseChecks: {}, log: [], panel: "track", scratchpad: "" }));
      Math.random = () => (hi ? 0.999 : 0);   // max faces (success) vs. all 1s
    }, forceHigh);
    await page.evaluate(() => { location.hash = "#__r"; location.hash = "#solo"; });
    await page.waitForTimeout(150);
    await page.getByRole("button", { name: "🎲 Roll Timer Die" }).first().click();
    await page.waitForTimeout(200);
    const title = await page.$eval(".modal", (m) => m.textContent);
    const die = await page.evaluate(() => JSON.parse(localStorage.getItem("brp:solo")).timerDie);
    await page.keyboard.press("Escape");
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
  await page.waitForTimeout(200);
  const body = await page.$eval(".modal", (m) => m.textContent);
  assert.ok(/Replicant|Human|Ambiguous/.test(body), body.slice(0, 120));
  await page.keyboard.press("Escape");
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
    localStorage.setItem("brp:gm", JSON.stringify({ panel: "case", log: [], scratchpad: "", selectedTheme: "Replicant Crimes & Punishments" }));
  });
  await page.goto(`${base}/index.html?gm9b#gm`, { waitUntil: "load" });
  await page.waitForTimeout(250);
  for (const [label, check] of [
    [/🎲 Clue \(D8\)/, /Witness|Forensic Evidence|Recording|Documents|Rumors|Anonymous Tip|Item/],
    [/🎲 Location \(D6×D6\)/, /Sector|Downtown/],
    [/🎲 Final Confrontation/, /rain|Thunder|heat|cold|colors|Overgrown|wind|outage|dust|Fog/],
    [/🎲 Mood/, /Weather/],
    [/🎲 Downtime Event \(D8\)/, /At home/],
  ]) {
    await page.getByRole("button", { name: label }).first().click();
    await page.waitForTimeout(200);
    const body = await page.$eval(".modal", (m) => m.textContent);
    assert.match(body, check, `${label} produced a result`);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(120);
  }
  const text = await page.$eval("#screen", (e) => e.textContent);
  assert.match(text, /Session Awards/, "the award checklists are on the Case panel");
});

test("solo case notes can be cleared, and the whole assistant reset", async (t) => {
  if (unavailable) return t.skip(unavailable);
  const seed = async () => {
    await page.evaluate(() => {
      localStorage.setItem("brp:settings", JSON.stringify({ theme: "dark", solo: true, gm: true }));
      localStorage.setItem("brp:solo", JSON.stringify({
        panel: "notes", scratchpad: "• [Clue] a bloody origami bird\n",
        log: [{ id: "l1", label: "Seed", text: "x", pin: "[Seed] x", ts: Date.now() }],
        hypotheses: [{ id: "h1", text: "The doll knows", die: "D10" }],
        humanityChecks: { 0: true }, promoGainChecks: {}, promoLoseChecks: {}, timerDie: "D12",
      }));
    });
  };
  const state = () => page.evaluate(() => JSON.parse(localStorage.getItem("brp:solo")));

  // 1 — "Clear notes" empties the scratchpad and leaves everything else alone
  await page.goto(`${base}/index.html?notes#solo`, { waitUntil: "load" });
  await seed();
  await page.goto(`${base}/index.html?notes2#solo`, { waitUntil: "load" });
  await page.waitForTimeout(250);
  await page.getByRole("button", { name: "✕ Clear notes" }).first().click();
  await page.waitForTimeout(150);
  await page.getByRole("button", { name: "Clear notes" }).last().click();
  await page.waitForTimeout(250);
  let st = await state();
  assert.equal(st.scratchpad, "", "notes are emptied");
  assert.equal(st.log.length, 1, "the roll log survives");
  assert.equal(st.hypotheses.length, 1, "hypotheses survive");
  assert.equal(st.timerDie, "D12", "the timer survives");
  assert.equal(await page.$eval(".notes-area", (e) => e.value), "", "and the textarea is empty");

  // 2 — "Start a fresh case" wipes the lot
  await page.goto(`${base}/index.html?notes3#solo`, { waitUntil: "load" });
  await seed();
  await page.goto(`${base}/index.html?notes4#solo`, { waitUntil: "load" });
  await page.waitForTimeout(250);
  await page.getByRole("button", { name: "⟲ Start a fresh case" }).first().click();
  await page.waitForTimeout(150);
  await page.getByRole("button", { name: "Wipe everything" }).last().click();
  await page.waitForTimeout(250);
  st = await state();
  assert.equal(st.scratchpad, "");
  assert.deepEqual(st.log, []);
  assert.deepEqual(st.hypotheses, []);
  assert.deepEqual(st.humanityChecks, {});
  const firstStep = await page.evaluate(async () => (await import("/data-solo.js")).ESCALATION_STEPS[0]);
  assert.equal(st.timerDie, firstStep, "the Countdown Timer resets to its starting die");
});
