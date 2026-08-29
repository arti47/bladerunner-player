// rules.js — pure rules lookups over the data libraries. No UI, no state.
import * as D from "../data.js";
import { SOLO_NO_ARCHETYPE } from "../data-solo.js";
import { rollDie } from "./core.js";

export const dieSizeForLevel = (level) => D.LEVEL_DIE[level];    // alias (die size == max face)
export const skill = (key) => D.SKILLS.find((s) => s.key === key);
export const skillName = (key) => skill(key)?.name ?? key;
export const attribute = (key) => D.ATTRIBUTES.find((a) => a.key === key);
// The solo option (Solo Mode p.002) is an archetype-shaped record with no key
// attribute or key skills, so every archetype consumer keeps working.
export const FREEFORM_ARCHETYPE = {
  key: SOLO_NO_ARCHETYPE.key, name: SOLO_NO_ARCHETYPE.name, nature: "any",
  keyAttr: null, keySkills: [], chinyenDie: SOLO_NO_ARCHETYPE.chinyenDie,
  specialtyOptions: [], blurb: SOLO_NO_ARCHETYPE.text, names: [], appearance: [],
};
export const archetype = (key) =>
  D.ARCHETYPES.find((a) => a.key === key) || (key === FREEFORM_ARCHETYPE.key ? FREEFORM_ARCHETYPE : undefined);
export const specialty = (key) => D.SPECIALTIES.find((s) => s.key === key);
export const weapon = (key) => [...D.WEAPONS_MELEE, ...D.WEAPONS_RANGED].find((w) => w.key === key);
export const armor = (key) => D.ARMOR.find((a) => a.key === key);
export const years = (key) => D.YEARS_ON_FORCE.find((y) => y.key === key);
export const nature = (key) => D.NATURES[key];

// Archetypes legal for a given nature.
export function archetypesForNature(natureKey) {
  return D.ARCHETYPES.filter((a) => a.nature === "any" || a.nature === natureKey);
}

// Step a level up/down within A..D (A is best). dir=+1 improves, -1 worsens.
export function stepLevel(level, dir) {
  const order = D.LEVELS; // ["A","B","C","D"]
  const i = order.indexOf(level);
  if (i < 0) return level;
  const next = i - dir; // improving = toward index 0
  return order[Math.max(0, Math.min(order.length - 1, next))];
}

// Crit table by damage type.
export const critTable = (type) => (type === "piercing" ? D.CRIT_PIERCING : D.CRIT_CRUSHING);
export const critEntry = (type, roll) => critTable(type).find((e) => e.roll === roll);

// Roll a value on a simple array table (1-indexed), or a min/max-range table.
export function lookupRange(table, roll) {
  return table.find((r) => {
    const min = r.min !== undefined ? r.min : (r.range ? r.range[0] : -Infinity);
    const max = r.max !== undefined ? r.max : (r.range ? r.range[1] : Infinity);
    return roll >= min && roll <= max;
  });
}

// ---- Two-tier oracle rolls  [Solo Mode] -----------------------------------
// The Solo book's big tables are rolled in two stages: a D6 picks the block,
// then a second die scopes the entry within it. Used by the Solo assistant and
// by anything else that fills content from those tables.
// Cipher/Location are flat arrays of three equal blocks of 12 (D6 1–2/3–4/5–6).
export function rollColumn(flat) {
  const d6 = rollDie(6);
  const bi = d6 <= 2 ? 0 : d6 <= 4 ? 1 : 2;
  const d = rollDie(12);
  return { d6, d, entry: flat[bi * 12 + (d - 1)] };
}
// Grouped tables carry their own { secondDie, blockRanges, blocks }.
export function rollGrouped(tbl) {
  const d6 = rollDie(6);
  const bi = Math.max(0, tbl.blockRanges.findIndex(([lo, hi]) => d6 >= lo && d6 <= hi));
  const block = tbl.blocks[bi];
  const d = rollDie(tbl.secondDie);
  return { d6, d, secondDie: tbl.secondDie, entry: block[Math.min(d, block.length) - 1] };
}

// ---- Acquiring gear  [Ch08 / §3.11] ---------------------------------------
// Everything with an Availability tier and a Cost can be requisitioned (LAPD,
// Promotion Points) or bought (black market, Chinyen Points).
export function acquirableItems() {
  const out = [];
  const add = (cat, list, extra = () => ({})) => {
    for (const it of list) {
      if (!it.avail || it.avail === "—") continue;
      out.push({ key: it.key, name: it.name, cat, avail: it.avail, cost: it.cost, ...extra(it) });
    }
  };
  add("Weapons", [...D.WEAPONS_MELEE, ...D.WEAPONS_RANGED, ...D.EXPLOSIVES]);
  add("Armor", D.ARMOR);
  add("Gear", D.GEAR);
  add("Augmentations", D.AUGMENTATIONS);
  add("Vehicles", D.VEHICLES);
  return out;
}
// The Purchases table row for an availability tier  [Ch08 p204].
export const availabilityTier = (avail) =>
  D.AVAILABILITY_TIERS.find((t) => t.key === String(avail || "").replace(/ .*/, "")) || null;
// Premium and rarer goods need a CONNECTIONS roll; Incidental/Standard do not.
export function needsConnectionsRoll(avail) {
  const tier = availabilityTier(avail);
  return !!tier?.skill;
}
// Black-market payout: half the Cost, rounded up  [Ch08 p207].
export function sellPrice(cost) {
  const n = costOf(cost);
  if (n == null) return null;
  const { payoutFraction, roundUp } = D.ACQUISITION.selling;
  const raw = n * payoutFraction;
  return roundUp ? Math.ceil(raw) : Math.floor(raw);
}
// Costs are usually numbers; a few read "4–10" or "Special". Returns the number
// or null when the table leaves it to the Game Runner.
export function costOf(cost) {
  if (typeof cost === "number") return cost;
  const m = String(cost ?? "").match(/\d+/);
  return m ? parseInt(m[0], 10) : null;
}

// HP cost to raise a skill from its current level (null if already A).
export function skillIncreaseCost(currentLevel) {
  return D.SKILL_INCREASE_COST_HP[currentLevel] ?? null;
}

// ---- Creation legality helpers  [Ch02] ------------------------------------
// Numeric level: D=0, C=1, B=2, A=3 (higher = better).
export const levelValue = (level) => 3 - D.LEVELS.indexOf(level); // A(idx0)=3 … D(idx3)=0
const STR_C = levelValue(D.ATTR_START_LEVEL); // C = 1
const SKL_D = levelValue(D.SKILL_START_LEVEL); // D = 0

// Attribute increases: steps above C cost, steps below C (to D) refund one.
export function attrStepsUsed(attributes) {
  return Object.values(attributes).reduce((n, lv) => n + (levelValue(lv) - STR_C), 0);
}
export function attrBudget(years, natureKey) {
  const y = D.YEARS_ON_FORCE.find((x) => x.key === years);
  return (y?.attrIncreases ?? 0) + (natureKey === "replicant" ? D.NATURES.replicant.bonusAttrIncreases : 0);
}
export function skillStepsUsed(skills) {
  return Object.values(skills).reduce((n, lv) => n + (levelValue(lv) - SKL_D), 0);
}
export function skillBudget(years) {
  return D.YEARS_ON_FORCE.find((x) => x.key === years)?.skillIncreases ?? 0;
}

// Validate an in-progress attribute allocation; returns { ok, errors[] }.
export function validateAttributes(draft) {
  const errors = [];
  const budget = attrBudget(draft.years, draft.nature);
  const used = attrStepsUsed(draft.attributes);
  if (used !== budget) errors.push(`Use exactly ${budget} attribute increase${budget === 1 ? "" : "s"} (currently ${used}). Lower one to D for an extra.`);
  const arch = archetype(draft.archetype);
  if (arch?.keyAttr && levelValue(draft.attributes[arch.keyAttr]) < levelValue("B"))
    errors.push(`Key attribute (${attrDisplay(arch.keyAttr)}) must be B or higher.`);
  // You may lower ONE attribute C→D for one extra increase — no more than one. [Ch02]
  const loweredToD = Object.values(draft.attributes).filter((lv) => levelValue(lv) < STR_C).length;
  if (loweredToD > 1) errors.push("You may lower only one attribute to D (for one extra increase).");
  if (draft.nature === "replicant") {
    const physUp = Math.max(0, levelValue(draft.attributes.STR) - STR_C) + Math.max(0, levelValue(draft.attributes.AGI) - STR_C);
    if (physUp < 1) errors.push("Replicant bonus increase must raise Strength or Agility.");
  }
  return { ok: errors.length === 0, errors };
}
export function validateSkills(draft) {
  const errors = [];
  const budget = skillBudget(draft.years);
  const used = skillStepsUsed(draft.skills);
  if (used !== budget) errors.push(`Use exactly ${budget} skill increases (currently ${used}).`);
  const arch = archetype(draft.archetype);
  if (arch) for (const ks of arch.keySkills)
    if (levelValue(draft.skills[ks]) < levelValue("C")) errors.push(`Key skill ${skillName(ks)} must be C or higher.`);
  return { ok: errors.length === 0, errors };
}
export const attrDisplay = (k) => (k === "MANEUVER" ? "Maneuverability" : attribute(k)?.name || k);
