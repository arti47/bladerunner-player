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

test("NPC Tactics + Chase Maneuvers cover a full D8 (Solo Combat & Chases)", () => {
  const cover = (tbl) => { for (let r = 1; r <= 8; r++) assert.ok(R.lookupRange(tbl, r), `no row for D8=${r}`); };
  cover(SO.NPC_TACTICS); cover(SO.NPC_CHASE_MANEUVERS);
  assert.equal(R.lookupRange(SO.NPC_TACTICS, 1).name, "Reckless");
  assert.equal(R.lookupRange(SO.NPC_TACTICS, 8).name, "Cowardly");
  assert.equal(R.lookupRange(SO.NPC_CHASE_MANEUVERS, 3).pursuer, "Pursue");
  assert.equal(R.lookupRange(SO.NPC_CHASE_MANEUVERS, 3).prey, "Flee");
});

// ---------------------------------------------------------------------------
// Dice engine primitives (core.js)  [§3.1]
// ---------------------------------------------------------------------------
test("successesFor: 6+ = 1 success, 10+ = 2", () => {
  for (let f = 1; f <= 12; f++) assert.equal(core.successesFor(f), f >= 10 ? 2 : f >= 6 ? 1 : 0, `face ${f}`);
});

test("outcomeSummary spelling + pluralization (roll-log text)", () => {
  assert.equal(core.outcomeSummary(0, 0), "Failure · 0 successes");
  assert.equal(core.outcomeSummary(1, 0), "Success · 1 success");
  assert.equal(core.outcomeSummary(2, 0), "Critical success · 2 successes");
  assert.equal(core.outcomeSummary(0, 2), "Failure · 0 successes · 2 banes");
  assert.equal(core.outcomeSummary(3, 1), "Critical success · 3 successes · 1 bane");
  for (const n of [0, 1, 2, 3]) assert.ok(!core.outcomeSummary(n, 0).includes("succes "), "no 'succes' typo");
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

test("v4 schema: journal[] + secretReplicant back-filled, preserved, never crashes on legacy data", () => {
  assert.equal(SCHEMA_VERSION, 4);
  assert.deepEqual(normalizeCharacter({}).journal, []);            // default
  assert.deepEqual(normalizeCharacter({ journal: undefined }).journal, []); // legacy (pre-v3)
  const entry = { id: "j1", ts: 123, text: "found a clue" };
  assert.deepEqual(normalizeCharacter({ journal: [entry] }).journal, [entry]); // preserved
  assert.equal(normalizeCharacter({}).secretReplicant, false);      // v4 default
  assert.equal(normalizeCharacter({ secretReplicant: true }).secretReplicant, true);
  assert.equal(normalizeCharacter({ nature: "human" }).nature, "human"); // reveal flips this to replicant
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

// ---------------------------------------------------------------------------
// Fidelity audit (2026-07-28) — every gap closed in that pass gets a guard here.
// ---------------------------------------------------------------------------
test("armor: rating dice + damage reduction constants exist and are sane [§3.7]", () => {
  assert.equal(D.ARMOR_DICE, 2);
  assert.equal(D.ARMOR_DAMAGE_PER_SUCCESS, 1);
  const rated = D.ARMOR.filter((a) => a.rating);
  assert.ok(rated.length >= 3, "expected rated armor suits");
  for (const a of rated) assert.ok(D.LEVEL_DIE[a.rating], `${a.key} has a legal rating`);
  // every rated suit lists the skills it hampers
  for (const a of rated) assert.ok(Array.isArray(a.disadvantage), `${a.key} lists disadvantaged skills`);
});

test("conditions carry the machine-readable effects the engine reads [§3.6]", () => {
  const by = (k) => D.CONDITIONS.find((c) => c.key === k);
  assert.equal(by("prone").effect.selfMeleeDisadvantage, true);
  assert.equal(by("prone").effect.attackerMeleeAdvantage, true);
  assert.equal(by("cover").effect.attackerRangedDisadvantage, true);
  assert.equal(by("grappled").effect.cannotDefend, true);
  assert.equal(by("broken_damage").effect.cannotDefend, true);
  assert.deepEqual(by("aiming").effect.advantage, ["firearms"]);
});

test("acquisition: sources, currencies and the Connections roll [§3.11]", () => {
  assert.equal(D.ACQUISITION.skill, "connections");
  assert.equal(D.ACQUISITION.doublePaymentAdvantage, true);
  const keys = D.ACQUISITION.sources.map((s) => s.key);
  assert.deepEqual(keys, ["lapd", "market"]);
  assert.deepEqual(D.ACQUISITION.sources.map((s) => s.currency), ["promotionPoints", "chinyenPoints"]);
  const cat = R.acquirableItems();
  assert.ok(cat.length > 40, `catalog should span the gear tables (got ${cat.length})`);
  assert.ok(cat.some((i) => i.cat === "Weapons") && cat.some((i) => i.cat === "Armor")
    && cat.some((i) => i.cat === "Gear") && cat.some((i) => i.cat === "Augmentations")
    && cat.some((i) => i.cat === "Vehicles"));
  assert.equal(R.costOf(3), 3);
  assert.equal(R.costOf("4–10"), 4);      // ranged costs read as their minimum
  assert.equal(R.costOf("Special"), null); // Game Runner's call
});

test("secret replicant option is defined and normalizes [§3.5]", () => {
  assert.ok(D.SECRET_REPLICANT.note.length > 10);
  const c = normalizeCharacter({ nature: "human", secretReplicant: true });
  assert.equal(c.nature, "human");
  assert.equal(c.secretReplicant, true);
  // on reveal the derived formulas must swing by exactly +2 / −2
  const before = { health: maxHealth(c), resolve: maxResolve(c) };
  const revealed = normalizeCharacter({ ...c, nature: "replicant", secretReplicant: false });
  assert.equal(maxHealth(revealed), before.health + 2);
  assert.equal(maxResolve(revealed), Math.max(0, before.resolve - 2));
});

test("chase data is complete: procedure, maneuvers, 3 D12 obstacle tables [§3.12]", () => {
  assert.ok(D.CHASE.procedure.length >= 4);
  assert.ok(D.CHASE.distance && D.CHASE.escape && D.CHASE.caught);
  const names = D.CHASE.maneuvers.map((m) => m.name);
  for (const n of ["Pursue / Flee", "Hide", "Block", "Cut Off", "Stand and Shoot"]) assert.ok(names.includes(n), `${n} maneuver`);
  for (const m of D.CHASE.maneuvers) assert.ok(["both", "prey", "pursuer"].includes(m.who), `${m.name} has a side`);
  for (const env of ["foot", "ground", "aerial"]) {
    assert.equal(D.CHASE.obstacles[env].length, 12, `${env} obstacle table is a D12`);
    for (const o of D.CHASE.obstacles[env]) assert.ok(typeof o === "string" && o.length > 10);
  }
});

test("extra-initiative-card effects are machine-readable [§3.12]", () => {
  const fast = D.SPECIALTIES.find((s) => s.key === "fast_reflexes");
  assert.equal(fast.effect.extraInitiativeCards, 1);
  const synaptic = D.AUGMENTATIONS.find((a) => a.key === "synaptic_implants");
  assert.ok(/initiative card/i.test(synaptic.text), "synaptic implants also grant a card");
});

test("GM case generator: D3+3 main NPCs [§3.16]", () => {
  assert.equal(GM.CASE_MAIN_NPC_COUNT.die, 3);
  assert.equal(GM.CASE_MAIN_NPC_COUNT.bonus, 3);
  assert.equal(GM.CASE_MAIN_NPCS.length, 8);
});

test("die sizes are sourced from the data layer, not the UI [§10.2]", () => {
  assert.deepEqual(D.DIE_SIZES, [6, 8, 10, 12]);
  assert.deepEqual(D.DIE_SIZES, Object.values(D.LEVEL_DIE).sort((a, b) => a - b));
});

test("weapon damage is numeric wherever the engine adds successes to it [§3.7]", () => {
  // the attack maths does weapon.damage + extra successes — a string would concatenate
  for (const w of [...D.WEAPONS_MELEE, ...D.WEAPONS_RANGED])
    assert.equal(typeof w.damage, "number", `${w.key} damage must be numeric`);
  // explosives may carry ranged values, so the engine must treat them as special
  const charge = D.EXPLOSIVES.find((e) => e.key === "explosive");
  assert.equal(typeof charge.damage, "string");
  assert.equal(charge.thrown, false, "the non-numeric charge is never offered in the thrown picker");
});

// ---------------------------------------------------------------------------
// Solo Mode verified against the printing (Solo Mode PDF, 2026-07-28 pass).
// ---------------------------------------------------------------------------
test("Countdown Event: any success FIRES the event; no successes escalates [Solo p.006]", () => {
  assert.match(SO.COUNTDOWN_TIMER.onTrigger, /success fires the event/i);
  assert.match(SO.COUNTDOWN_TIMER.onNoTrigger, /No successes = no event/i);
  assert.match(SO.COUNTDOWN_TIMER.note, /ANY success triggers/i);
  assert.equal(SO.ESCALATION_STEPS[0], "D6");
  assert.equal(SO.ESCALATION_STEPS.at(-1), "D12/D12");
  assert.deepEqual(SO.ESCALATION_STEPS, ["D6", "D8", "D10", "D12", "D12/D6", "D12/D8", "D12/D10", "D12/D12"]);
});

test("NPC nature table: D10 1 Replicant / 2–9 human / 10 ambiguous [Solo p.019]", () => {
  assert.equal(SO.NPC_NATURE.length, 3);
  assert.deepEqual(SO.NPC_NATURE.map((r) => r.range), [[1, 1], [2, 9], [10, 10]]);
  assert.deepEqual(SO.NPC_NATURE.map((r) => r.result), ["Replicant", "Human", "Ambiguous"]);
  for (let d = 1; d <= 10; d++) assert.ok(R.lookupRange(SO.NPC_NATURE, d), `D10=${d} resolves`);
});

test("four official ways to open a case [Solo p.004]", () => {
  assert.deepEqual(SO.CASE_START_METHODS.map((m) => m.key), ["gut", "thread", "generator", "inspiration"]);
  for (const m of SO.CASE_START_METHODS) assert.ok(m.name && m.text.length > 20);
});

test("solo archetype-free creation: free keys, D8 Chinyen [Solo p.002]", () => {
  assert.equal(SO.SOLO_NO_ARCHETYPE.chinyenDie, 8);
  const arch = R.archetype(SO.SOLO_NO_ARCHETYPE.key);
  assert.ok(arch, "resolves through the normal archetype lookup");
  assert.equal(arch.keyAttr, null);
  assert.deepEqual(arch.keySkills, []);
  assert.equal(arch.chinyenDie, 8);
  // with no key attribute/skills, only the budgets gate the build
  const draft = { nature: "human", years: "rookie", archetype: SO.SOLO_NO_ARCHETYPE.key,
    attributes: { STR: "C", AGI: "C", INT: "A", EMP: "A" }, skills: {} };
  for (const s of D.SKILLS) draft.skills[s.key] = "D";
  draft.skills.observation = "B"; draft.skills.connections = "B"; draft.skills.insight = "B"; draft.skills.manipulation = "C";
  assert.equal(R.attrStepsUsed(draft.attributes), 4);
  assert.equal(R.validateAttributes(draft).ok, true, R.validateAttributes(draft).errors.join("; "));
  assert.equal(R.skillStepsUsed(draft.skills), 7);
  assert.equal(R.validateSkills(draft).ok, false, "still enforces the skill budget");
});

test("solo tables match the printing exactly [Solo Mode PDF]", () => {
  // spot-checks across every table verified in the 2026-07-28 source pass
  assert.equal(SO.CIPHER_METHOD[0], "Abandon");
  assert.equal(SO.CIPHER_METHOD[35], "Threaten");
  assert.equal(SO.CIPHER_FOCUS[0], "Authority");
  assert.equal(SO.CIPHER_FOCUS[35], "Violence");
  assert.equal(SO.LOCATION_ENVIRONMENT[0], "Abandoned");
  assert.equal(SO.LOCATION_PLACE[35], "Warehouse");
  assert.deepEqual(SO.CHARACTER_SPHERE.blockRanges, [[1, 3], [4, 6]]);
  assert.equal(SO.CHARACTER_SPHERE.secondDie, 8);
  assert.deepEqual(SO.CHARACTER_TRAIT.blockRanges, [[1, 2], [3, 4], [5, 6]]);
  assert.equal(SO.CHARACTER_TRAIT.secondDie, 12);
  assert.deepEqual(SO.CLUE_EVIDENCE_DESCRIPTOR.blockRanges, [[1, 3], [4, 6]]);
  assert.equal(SO.CLUE_EVIDENCE_DESCRIPTOR.secondDie, 10);
  assert.deepEqual(SO.CLUE_EVIDENCE_TYPE.blockRanges, [[1, 3], [4, 6]]);
  assert.equal(SO.CLUE_EVIDENCE_TYPE.secondDie, 12);
  assert.equal(SO.CASE_BRIEFING.assignment.length, 20);
  assert.equal(SO.CASE_BRIEFING.assignment[0], "Assault");
  assert.equal(SO.CASE_BRIEFING.assignment[19], "Vigilantism");
  assert.equal(SO.HUMANITY_CHECKLIST.length, 11);
  assert.equal(SO.PROMOTION_GAIN.length, 8);
  assert.equal(SO.PROMOTION_LOSE.length, 9);
  assert.deepEqual(SO.HYPOTHESIS_CHECK.crit.pp, 5);
  assert.deepEqual(SO.HYPOTHESIS_CHECK.success.pp, 3);
  assert.deepEqual(SO.HYPOTHESIS_CHECK.failure.pp, -3);
});

// ---------------------------------------------------------------------------
// Core rulebook pass (2026-07-28, user-supplied rules reference).
// ---------------------------------------------------------------------------
test("pushing is only ever offered on a FAILED roll [Core Ch01 p016]", () => {
  assert.equal(D.PUSH_FAILED_ROLLS_ONLY, true);
  assert.equal(D.PUSH_BANE_FACE, 1);
});

test("key relationship: three D12 tables [Core Ch02 p032]", () => {
  for (const t of [D.RELATIONSHIP_WHO, D.RELATIONSHIP_LIKE, D.RELATIONSHIP_GOING_ON]) {
    assert.equal(t.length, 12);
    for (const e of t) assert.ok(typeof e === "string" && e.length > 2);
  }
  assert.equal(D.RELATIONSHIP_WHO[0], "Parent");
  assert.equal(D.RELATIONSHIP_WHO[11], "DiJi");
  assert.equal(D.RELATIONSHIP_LIKE[11], "Only in your head");
  assert.match(D.RELATIONSHIP_GOING_ON[1], /gone missing/);
});

test("signature item: D12 table + once-per-session stress heal [Core Ch02 p034]", () => {
  assert.equal(D.SIGNATURE_ITEMS.length, 12);
  assert.equal(D.SIGNATURE_ITEMS[0], "A photograph");
  assert.equal(D.SIGNATURE_ITEMS[11], "A tombstone");
  assert.equal(D.SIGNATURE_ITEM_HEAL.resolve, 1);
  assert.equal(D.SIGNATURE_ITEM_HEAL.period, "session");
});

test("home table covers a full D12, 1–4 being the LAPD apartment [Core Ch02 p034]", () => {
  const covered = new Set();
  for (let d = 1; d <= 12; d++) {
    const row = R.lookupRange(D.HOME_TABLE, d);
    assert.ok(row, `D12=${d} has a home`);
    covered.add(row.text);
  }
  assert.match(R.lookupRange(D.HOME_TABLE, 1).text, /LAPD housing apartment in Sector 5/);
  assert.equal(R.lookupRange(D.HOME_TABLE, 4).text, R.lookupRange(D.HOME_TABLE, 1).text);
  assert.notEqual(R.lookupRange(D.HOME_TABLE, 5).text, R.lookupRange(D.HOME_TABLE, 4).text);
  assert.equal(covered.size, 9);
});

test("secret Replicant is a secret D6, a 6 means you are one [Core Ch02 p028]", () => {
  assert.equal(D.SECRET_REPLICANT.secretRollDie, 6);
  assert.equal(D.SECRET_REPLICANT.secretRollHit, 6);
});

test("creation tables verified against the Core reference", () => {
  // archetype D12 tables, both natures
  assert.equal(R.lookupRange(D.ARCHETYPE_TABLE.human, 1).key, "analyst");
  assert.equal(R.lookupRange(D.ARCHETYPE_TABLE.human, 3).key, "cityspeaker");
  assert.equal(R.lookupRange(D.ARCHETYPE_TABLE.human, 10).key, "inspector");
  assert.equal(R.lookupRange(D.ARCHETYPE_TABLE.human, 12).key, "skimmer");
  assert.equal(R.lookupRange(D.ARCHETYPE_TABLE.replicant, 3).key, "analyst");
  assert.equal(R.lookupRange(D.ARCHETYPE_TABLE.replicant, 6).key, "doxie");
  assert.equal(R.lookupRange(D.ARCHETYPE_TABLE.replicant, 9).key, "fixer");
  assert.equal(R.lookupRange(D.ARCHETYPE_TABLE.replicant, 12).key, "inspector");
  // archetype key attribute / skills / chinyen die
  const by = (k) => D.ARCHETYPES.find((a) => a.key === k);
  assert.equal(by("analyst").keyAttr, "INT"); assert.equal(by("analyst").chinyenDie, 8);
  assert.equal(by("cityspeaker").keyAttr, "EMP"); assert.equal(by("doxie").keyAttr, "AGI");
  assert.equal(by("enforcer").keyAttr, "STR"); assert.equal(by("enforcer").chinyenDie, 6);
  assert.equal(by("fixer").chinyenDie, 10); assert.equal(by("inspector").chinyenDie, 6);
  assert.equal(by("skimmer").chinyenDie, 12);
  assert.deepEqual(by("doxie").keySkills, ["hand_to_hand", "mobility", "manipulation"]);
  assert.deepEqual(by("skimmer").keySkills, ["firearms", "connections", "manipulation"]);
  // memory tables
  assert.equal(D.MEMORY_WHEN.length, 6);
  for (const t of [D.MEMORY_WHERE, D.MEMORY_WHO, D.MEMORY_WHAT, D.MEMORY_FEEL]) assert.equal(t.length, 12);
  assert.equal(D.MEMORY_FEEL[0], "Hopeful");
  assert.equal(D.MEMORY_WHO[11], "No one but you");
  // combat actions carry the book's prerequisites
  assert.equal(D.COMBAT_ACTIONS.find((a) => a.action === "Unarmed attack").prereq, "Unarmed");
  assert.equal(D.COMBAT_ACTIONS.find((a) => a.action === "Crawl").prereq, "Prone");
});

// ---------------------------------------------------------------------------
// Security rules + specialty-effect wiring (2026-07-28 "fix everything" pass).
// ---------------------------------------------------------------------------
import { readFileSync } from "node:fs";
const RULES = JSON.parse(readFileSync(new URL("../database.rules.json", import.meta.url), "utf8"));

test("RTDB rules: a character cannot be seized by claiming ownership", () => {
  const w = RULES.rules.characters.$chid[".write"];
  // creation must set yourself as owner; updates need existing ownership or the campaign GM
  assert.match(w, /!data\.exists\(\) && newData\.child\('owner'\)\.val\(\) === auth\.uid/);
  assert.ok(!/\|\| newData\.child\('owner'\)\.val\(\) === auth\.uid/.test(w),
    "a bare newData.owner check would let anyone overwrite any character");
  assert.ok(RULES.rules.characters.$chid.owner[".validate"].includes("data.val() === newData.val()"),
    "owner is immutable except to a GM");
});

test("RTDB rules: a member cannot promote themselves to GM", () => {
  const v = RULES.rules.campaigns.$cid.members.$uid.role[".validate"];
  assert.match(v, /newData\.val\(\) === 'player'/);
  assert.match(v, /ownerUid/, "only the campaign creator or an existing GM may set the gm role");
  assert.match(v, /\$uid !== auth\.uid/);
});

test("RTDB rules: join codes cannot be enumerated", () => {
  assert.equal(RULES.rules.joinCodes[".read"], undefined, "no readable list of every campaign code");
  assert.equal(RULES.rules.joinCodes.$code[".read"], "auth != null", "a known code is still resolvable");
});

test("Storage rules exist, are scoped to portraits, and cap the upload", () => {
  const rules = readFileSync(new URL("../storage.rules", import.meta.url), "utf8");
  assert.match(rules, /match \/portraits\/\{characterId\}/);
  assert.match(rules, /request\.auth != null/);
  assert.match(rules, /request\.resource\.size < 1 \* 1024 \* 1024/);
  assert.match(rules, /contentType\.matches\('image\/\.\*'\)/);
  assert.match(rules, /allow read, write: if false/, "everything outside portraits is denied");
});

test("every machine-readable specialty effect has a consumer", () => {
  const withEffect = D.SPECIALTIES.filter((s) => s.effect).map((s) => s.key);
  assert.deepEqual(withEffect.sort(), ["cashflow", "fast_reflexes", "hardened", "killer",
    "married_to_the_job", "people_person", "sycophant", "tough"].sort());
  const src = ["src/sheet.js", "src/roller.js", "src/combat.js", "src/derived.js"]
    .map((f) => readFileSync(new URL("../" + f, import.meta.url), "utf8")).join("\n");
  for (const sp of D.SPECIALTIES.filter((x) => x.effect)) {
    const fields = Object.keys(sp.effect);
    const wired = src.includes(sp.key) || fields.some((f) => src.includes(f));
    assert.ok(wired, `${sp.key} (${fields.join(",")}) is read by the engine`);
  }
  // the once-per-Shift / once-per-session heals are wired too
  for (const key of ["hip_flask", "origami", "smokes", "counselor", "protected"])
    assert.ok(src.includes(key), `${key} is read by the engine`);
});
