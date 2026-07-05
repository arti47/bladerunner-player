// unit.test.mjs — pure-logic + data-integrity regression tests (no browser).
// Run: npm run test:unit   (or npm test for everything)
// Imports the ACTUAL app modules, so these guard the real data + rules layer.
import { test } from "node:test";
import assert from "node:assert/strict";

import * as D from "../data.js";
import { NPCS } from "../data-npcs.js";
import * as GM from "../data-gm.js";
import * as SO from "../data-solo.js";
import * as core from "../src/core.js";
import * as R from "../src/rules.js";
import { maxHealth, maxResolve, normalizeCharacter, reclampVitals, SCHEMA_VERSION } from "../src/derived.js";

const mkChar = (o = {}) => ({ nature: "human", attributes: { STR: "C", AGI: "C", INT: "C", EMP: "C" }, specialties: [], state: {}, ...o });

// ---------------------------------------------------------------------------
// Data integrity — core library (data.js)  [§3.2–3.13]
// ---------------------------------------------------------------------------
test("levels & dice mapping", () => {
  assert.deepEqual(D.LEVEL_DIE, { A: 12, B: 10, C: 8, D: 6 });
  assert.deepEqual(D.LEVELS, ["A", "B", "C", "D"]);
});

test("13 skills, each governed by a valid attribute", () => {
  assert.equal(D.SKILLS.length, 13);
  const attrs = new Set([...D.ATTRIBUTES.map((a) => a.key), "MANEUVER"]);
  for (const s of D.SKILLS) {
    assert.ok(s.key && s.name, `skill missing key/name: ${JSON.stringify(s)}`);
    assert.ok(attrs.has(s.attr), `skill ${s.key} has bad attr ${s.attr}`);
  }
  assert.equal(D.SKILLS.filter((s) => s.attr === "MANEUVER").length, 1); // Driving only
});

test("4 attributes", () => assert.equal(D.ATTRIBUTES.length, 4));

test("7 archetypes, legal keyAttr/keySkills/chinyen/nature/specialties", () => {
  assert.equal(D.ARCHETYPES.length, 7);
  const skillKeys = new Set(D.SKILLS.map((s) => s.key));
  const specKeys = new Set(D.SPECIALTIES.map((s) => s.key));
  const attrKeys = new Set(D.ATTRIBUTES.map((a) => a.key));
  for (const a of D.ARCHETYPES) {
    assert.ok(attrKeys.has(a.keyAttr), `${a.key} bad keyAttr`);
    assert.equal(a.keySkills.length, 3, `${a.key} should have 3 key skills`);
    for (const k of a.keySkills) assert.ok(skillKeys.has(k), `${a.key} bad key skill ${k}`);
    assert.ok([6, 8, 10, 12].includes(a.chinyenDie), `${a.key} bad chinyen die`);
    assert.ok(["any", "human", "replicant"].includes(a.nature), `${a.key} bad nature`);
    for (const k of a.specialtyOptions) assert.ok(specKeys.has(k), `${a.key} bad specialty option ${k}`);
  }
  // nature restrictions per §3.5
  assert.equal(D.ARCHETYPES.find((a) => a.key === "doxie").nature, "replicant");
  assert.equal(D.ARCHETYPES.find((a) => a.key === "cityspeaker").nature, "human");
  assert.equal(D.ARCHETYPES.find((a) => a.key === "skimmer").nature, "human");
});

test("Years on the Force table matches the book", () => {
  const by = Object.fromEntries(D.YEARS_ON_FORCE.map((y) => [y.key, y]));
  assert.deepEqual([by.rookie.attrIncreases, by.rookie.skillIncreases, by.rookie.specialties, by.rookie.startingPromotionDie, by.rookie.chinyenMod], [4, 8, 0, 3, -1]);
  assert.deepEqual([by.seasoned.attrIncreases, by.seasoned.skillIncreases, by.seasoned.specialties, by.seasoned.startingPromotionDie, by.seasoned.chinyenMod], [3, 10, 1, 6, 0]);
  assert.deepEqual([by.veteran.attrIncreases, by.veteran.skillIncreases, by.veteran.specialties, by.veteran.startingPromotionDie, by.veteran.chinyenMod], [2, 12, 2, 8, 1]);
  assert.deepEqual([by.oldtimer.attrIncreases, by.oldtimer.skillIncreases, by.oldtimer.specialties, by.oldtimer.startingPromotionDie, by.oldtimer.chinyenMod], [1, 14, 3, 10, 2]);
});

test("critical injury tables: 12 rows each, instant-kills exactly where the book says", () => {
  for (const [name, tbl] of [["crushing", D.CRIT_CRUSHING], ["piercing", D.CRIT_PIERCING]]) {
    assert.equal(tbl.length, 12, `${name} table length`);
    assert.deepEqual(tbl.map((e) => e.roll), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], `${name} rolls 1..12`);
  }
  const kills = (tbl) => tbl.filter((e) => e.instantKill).map((e) => e.roll);
  assert.deepEqual(kills(D.CRIT_CRUSHING), [12]);
  assert.deepEqual(kills(D.CRIT_PIERCING), [8, 10, 12]);
  // every lethal row has a death-save interval unless it's an instant kill
  for (const tbl of [D.CRIT_CRUSHING, D.CRIT_PIERCING])
    for (const e of tbl) if (e.lethal && !e.instantKill) assert.ok(["round", "shift"].includes(e.deathSave), `lethal row ${e.injury} needs an interval`);
});

test("advancement costs", () => {
  assert.deepEqual(D.SKILL_INCREASE_COST_HP, { D: 5, C: 10, B: 15 });
  assert.equal(D.SPECIALTY_LEARN_COST_PP, 5);
});

test("24 general specialties, each well-formed; repeatable ones capped at 3", () => {
  assert.equal(D.SPECIALTIES.length, 24);
  for (const s of D.SPECIALTIES) assert.ok(s.key && s.name && s.text, `bad specialty ${JSON.stringify(s)}`);
  for (const k of ["tough", "hardened"]) assert.equal(D.SPECIALTIES.find((s) => s.key === k).maxTimes, 3);
});

test("weapons well-formed (damage + crit die/type)", () => {
  for (const w of [...D.WEAPONS_MELEE, ...D.WEAPONS_RANGED]) {
    assert.ok(w.key && w.name, `weapon missing key/name`);
    assert.equal(typeof w.damage, "number", `${w.name} damage`);
    if (w.critDie !== null) assert.ok(w.critDie === "STR" || [6, 8, 10, 12].includes(w.critDie), `${w.name} bad crit die ${w.critDie}`);
    if (w.type) assert.ok(["piercing", "crushing"].includes(w.type), `${w.name} bad type`);
  }
});

// ---------------------------------------------------------------------------
// NPC + GM + Solo data
// ---------------------------------------------------------------------------
test("14 typical NPCs, each with 4 attributes and a numeric Health", () => {
  assert.equal(NPCS.length, 14);
  for (const n of NPCS) {
    assert.equal(Object.keys(n.attrs).length, 4, `${n.name} attrs`);
    assert.equal(typeof n.health, "number", `${n.name} health`);
  }
});

test("GM Case Table 3 (Main NPCs): 8 types, every sub-table exactly 6", () => {
  assert.equal(GM.CASE_MAIN_NPCS.length, 8);
  for (const t of GM.CASE_MAIN_NPCS)
    for (const key of ["occupation", "quirk", "firstName", "lastName"])
      assert.equal(t[key].length, 6, `${t.type}.${key} should have 6 entries`);
});

test("GM generator tables sized right", () => {
  assert.equal(GM.CASE_TWIST.length, 12);
  assert.equal(GM.DISCIPLINARY_ACTIONS.length, 6);
  assert.ok(GM.CASE_THEME.length >= 6);
  for (const t of GM.CASE_THEME) assert.ok(Array.isArray(GM.CASE_ASSIGNMENT[t.theme]) && GM.CASE_ASSIGNMENT[t.theme].length, `assignment list missing for ${t.theme}`);
});

test("Solo oracle tables sized right", () => {
  assert.equal(SO.CIPHER_METHOD.length, 36);
  assert.equal(SO.CIPHER_FOCUS.length, 36);
  assert.equal(SO.LOCATION_ENVIRONMENT.length, 36);
  assert.equal(SO.LOCATION_PLACE.length, 36);
  assert.equal(SO.SCENE_CATEGORIES.length, 12);
  assert.equal(SO.CASE_BRIEFING.assignment.length, 20); // D6×D10
  for (const k of ["relevance", "complication", "hook"]) assert.equal(SO.CASE_BRIEFING[k].length, 12, `briefing ${k}`);
});

test("Cipher/Location word lists are 3 blocks of 12 (D6→D12)", () => {
  for (const arr of [SO.CIPHER_METHOD, SO.CIPHER_FOCUS, SO.LOCATION_ENVIRONMENT, SO.LOCATION_PLACE])
    assert.equal(arr.length, 36); // 3 blocks × 12; the roll picks a block by D6 then a D12
});

test("Imagining Clues tables well-formed (Solo p.18)", () => {
  assert.equal(SO.CLUE_MEANING.length, 8);                 // D8 flat
  assert.deepEqual(SO.CLUE_EVIDENCE_DESCRIPTOR.blockRanges, [[1, 3], [4, 6]]);
  assert.equal(SO.CLUE_EVIDENCE_DESCRIPTOR.secondDie, 10);
  assert.equal(SO.CLUE_EVIDENCE_DESCRIPTOR.blocks.length, 2);
  for (const blk of SO.CLUE_EVIDENCE_DESCRIPTOR.blocks) {
    assert.equal(blk.length, 10);
    for (const e of blk) assert.ok(e.result && e.detail, `descriptor entry needs result+detail`);
  }
  assert.equal(SO.CLUE_EVIDENCE_TYPE.secondDie, 12);
  for (const blk of SO.CLUE_EVIDENCE_TYPE.blocks) assert.equal(blk.length, 12);
});

test("Character generator tables well-formed (Solo p.19)", () => {
  assert.equal(SO.CHARACTER_SPHERE.secondDie, 8);
  assert.deepEqual(SO.CHARACTER_SPHERE.blockRanges, [[1, 3], [4, 6]]);
  for (const blk of SO.CHARACTER_SPHERE.blocks) assert.equal(blk.length, 8);
  assert.equal(SO.CHARACTER_TRAIT.secondDie, 12);
  assert.deepEqual(SO.CHARACTER_TRAIT.blockRanges, [[1, 2], [3, 4], [5, 6]]);
  assert.equal(SO.CHARACTER_TRAIT.blocks.length, 3);
  for (const blk of SO.CHARACTER_TRAIT.blocks) assert.equal(blk.length, 12);
});

test("Hypothesis Check rewards (Solo)", () => {
  assert.equal(SO.HYPOTHESIS_CHECK.crit.pp, 5);
  assert.equal(SO.HYPOTHESIS_CHECK.success.pp, 3);
  assert.equal(SO.HYPOTHESIS_CHECK.failure.pp, -3);
});

// ---------------------------------------------------------------------------
// Dice engine primitives (core.js)  [§3.1]
// ---------------------------------------------------------------------------
test("successesFor: 6+ = 1 success, 10+ = 2", () => {
  for (let f = 1; f <= 12; f++) assert.equal(core.successesFor(f), f >= 10 ? 2 : f >= 6 ? 1 : 0, `face ${f}`);
});

test("rollDie stays within range; rollDice reports successes + banes", () => {
  for (const size of core.DIE_SIZES)
    for (let i = 0; i < 500; i++) { const f = core.rollDie(size); assert.ok(f >= 1 && f <= size, `d${size} rolled ${f}`); }
  // deterministic dice via successesFor over a synthetic pool
  const dice = [{ size: 12, face: 10, successes: core.successesFor(10), isBane: false }, { size: 6, face: 1, successes: 0, isBane: true }];
  assert.equal(core.totalSuccesses(dice), 2);
  assert.equal(core.totalBanes(dice), 1);
});

// ---------------------------------------------------------------------------
// Derived stats (derived.js)  [§3.3 — exact formulas]
// ---------------------------------------------------------------------------
test("Health = (STR die + AGI die)/4 round up; Replicant +2; Tough +1", () => {
  assert.equal(maxHealth(mkChar()), 4);                                             // C+C = 16/4
  assert.equal(maxHealth(mkChar({ attributes: { STR: "A", AGI: "A", INT: "C", EMP: "C" } })), 6); // 24/4
  assert.equal(maxHealth(mkChar({ attributes: { STR: "B", AGI: "C", INT: "C", EMP: "C" } })), 5); // 18/4 → 5
  assert.equal(maxHealth(mkChar({ nature: "replicant" })), 6);                      // 4 + 2
  assert.equal(maxHealth(mkChar({ specialties: ["tough"] })), 5);                   // 4 + 1
  assert.equal(maxHealth(mkChar({ specialties: ["tough", "tough"] })), 6);          // 4 + 2
});

test("Resolve = (INT die + EMP die)/4 round up; Replicant −2; Hardened +1", () => {
  assert.equal(maxResolve(mkChar()), 4);
  assert.equal(maxResolve(mkChar({ attributes: { STR: "C", AGI: "C", INT: "B", EMP: "D" } })), 4); // (10+6)/4
  assert.equal(maxResolve(mkChar({ nature: "replicant" })), 2);                     // 4 − 2
  assert.equal(maxResolve(mkChar({ specialties: ["hardened"] })), 5);               // 4 + 1
  assert.equal(maxResolve(mkChar({ nature: "replicant" })) >= 0, true);
});

test("normalizeCharacter back-fills defaults and never crashes on empty input", () => {
  const c = normalizeCharacter({});
  assert.equal(c.schemaVersion, SCHEMA_VERSION);
  assert.equal(Object.keys(c.skills).length, 13);
  assert.equal(c.nature, "human");
  assert.ok(c.state && typeof c.state.promotionPoints === "number");
  assert.ok(c.state.health <= maxHealth(c) && c.state.health >= 0);
});

test("v3 schema: journal[] back-filled, preserved, and never crashes on legacy data", () => {
  assert.equal(SCHEMA_VERSION, 3);
  assert.deepEqual(normalizeCharacter({}).journal, []);            // default
  assert.deepEqual(normalizeCharacter({ journal: undefined }).journal, []); // legacy (pre-v3)
  const entry = { id: "j1", ts: 123, text: "found a clue" };
  assert.deepEqual(normalizeCharacter({ journal: [entry] }).journal, [entry]); // preserved
});

test("reclampVitals clamps to current maxima", () => {
  const c = normalizeCharacter(mkChar({ state: { health: 99, resolve: 99 } }));
  reclampVitals(c);
  assert.equal(c.state.health, maxHealth(c));
  assert.equal(c.state.resolve, maxResolve(c));
});

// ---------------------------------------------------------------------------
// Creation legality (rules.js)  [§3.2, §3.4, §3.5]
// ---------------------------------------------------------------------------
test("level helpers round-trip", () => {
  for (const lv of D.LEVELS) assert.equal(R.valueLevel(R.levelValue(lv)), lv);
  assert.equal(R.dieForLevel("B"), 10);
  assert.equal(R.stepLevel("C", +1), "B");   // improve
  assert.equal(R.stepLevel("C", -1), "D");   // worsen
  assert.equal(R.stepLevel("A", +1), "A");   // capped
  assert.equal(R.stepLevel("D", -1), "D");   // floored
});

test("attribute/skill budgets by tier (+ Replicant bonus)", () => {
  assert.equal(R.attrBudget("rookie", "human"), 4);
  assert.equal(R.attrBudget("rookie", "replicant"), 5);  // +1
  assert.equal(R.attrBudget("oldtimer", "human"), 1);
  assert.equal(R.skillBudget("rookie"), 8);
  assert.equal(R.skillBudget("oldtimer"), 14);
});

test("validateAttributes enforces budget, key-attr B+, and Replicant STR/AGI bonus", () => {
  // Legal: Human Seasoned Enforcer (key STR must be B+), spend exactly 3
  const legal = { years: "seasoned", nature: "human", archetype: "enforcer", attributes: { STR: "A", AGI: "B", INT: "C", EMP: "C" } };
  assert.equal(R.validateAttributes(legal).ok, true);
  // Under budget (only 2 used)
  assert.equal(R.validateAttributes({ ...legal, attributes: { STR: "A", AGI: "C", INT: "C", EMP: "C" } }).ok, false);
  // Key attribute below B
  assert.equal(R.validateAttributes({ ...legal, attributes: { STR: "C", AGI: "A", INT: "B", EMP: "C" } }).ok, false);
  // Replicant Doxie (key AGI) must put a bonus into STR/AGI
  const replLegal = { years: "rookie", nature: "replicant", archetype: "doxie", attributes: { STR: "A", AGI: "A", INT: "B", EMP: "C" } };
  assert.equal(R.validateAttributes(replLegal).ok, true);
  const replNoPhys = { years: "rookie", nature: "replicant", archetype: "doxie", attributes: { STR: "C", AGI: "C", INT: "A", EMP: "A" } }; // +4 only, no phys, also under budget
  assert.equal(R.validateAttributes(replNoPhys).ok, false);
});

test("validateSkills enforces budget and key-skill C+", () => {
  // Enforcer key skills: hand_to_hand, stamina, firearms — must end C+. Rookie budget 8.
  const skills = Object.fromEntries(D.SKILLS.map((s) => [s.key, "D"]));
  skills.hand_to_hand = "B"; skills.stamina = "C"; skills.firearms = "C"; skills.mobility = "C"; skills.stealth = "C"; // 2+1+1+1+1 = 6
  skills.observation = "C"; skills.force = "C"; // +2 → 8
  const draft = { years: "rookie", archetype: "enforcer", skills };
  assert.equal(R.validateSkills(draft).ok, true);
  // Drop a key skill below C → fail
  const bad = { ...draft, skills: { ...skills, firearms: "D", observation: "B" } };
  assert.equal(R.validateSkills(bad).ok, false);
});

test("skillIncreaseCost + crit lookup", () => {
  assert.equal(R.skillIncreaseCost("D"), 5);
  assert.equal(R.skillIncreaseCost("A"), null);
  assert.equal(R.critEntry("piercing", 12).instantKill, true);
  assert.equal(R.critEntry("crushing", 1).lethal, false);
});
