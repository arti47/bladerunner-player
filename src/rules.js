// rules.js — pure rules lookups over the data libraries. No UI, no state.
import * as D from "../data.js";

export const dieForLevel = (level) => D.LEVEL_DIE[level];        // "B" -> 10
export const dieSizeForLevel = (level) => D.LEVEL_DIE[level];    // alias (die size == max face)
export const skill = (key) => D.SKILLS.find((s) => s.key === key);
export const skillName = (key) => skill(key)?.name ?? key;
export const attribute = (key) => D.ATTRIBUTES.find((a) => a.key === key);
export const archetype = (key) => D.ARCHETYPES.find((a) => a.key === key);
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
export const isBetterOrEqual = (level, floor) => D.LEVELS.indexOf(level) <= D.LEVELS.indexOf(floor);

// Crit table by damage type.
export const critTable = (type) => (type === "piercing" ? D.CRIT_PIERCING : D.CRIT_CRUSHING);
export const critEntry = (type, roll) => critTable(type).find((e) => e.roll === roll);

// Roll a value on a simple array table (1-indexed), or a min/max-range table.
export function rollOnArray(arr, face) { return arr[(face - 1) % arr.length]; }
export function lookupRange(table, roll) {
  return table.find((r) => {
    const min = r.min !== undefined ? r.min : (r.range ? r.range[0] : -Infinity);
    const max = r.max !== undefined ? r.max : (r.range ? r.range[1] : Infinity);
    return roll >= min && roll <= max;
  });
}

// HP cost to raise a skill from its current level (null if already A).
export function skillIncreaseCost(currentLevel) {
  return D.SKILL_INCREASE_COST_HP[currentLevel] ?? null;
}

// ---- Creation legality helpers  [Ch02] ------------------------------------
// Numeric level: D=0, C=1, B=2, A=3 (higher = better).
export const levelValue = (level) => 3 - D.LEVELS.indexOf(level); // A(idx0)=3 … D(idx3)=0
export const valueLevel = (v) => D.LEVELS[3 - v];
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
  if (arch && levelValue(draft.attributes[arch.keyAttr]) < levelValue("B"))
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
