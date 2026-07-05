// derived.js — character-derived calculations + data normalization/migration.
// All formulas cite the Core Rulebook and live ONLY here (never inline in UI).
import * as D from "../data.js";
import { dieSizeForLevel } from "./rules.js";

// Health = (STR die + AGI die) / 4, round up; Replicant +2.  [Ch02]
export function maxHealth(character) {
  const base = Math.ceil((dieSizeForLevel(character.attributes.STR) + dieSizeForLevel(character.attributes.AGI)) / 4);
  const repl = character.nature === "replicant" ? D.NATURES.replicant.healthMod : 0;
  const tough = countSpecialty(character, "tough"); // +1 max Health each (x3)
  return base + repl + tough;
}
// Resolve = (INT die + EMP die) / 4, round up; Replicant -2; minus any permanent
// loss accrued from being Broken by stress (Ch04 p079).  [Ch02]
export function maxResolve(character) {
  const base = Math.ceil((dieSizeForLevel(character.attributes.INT) + dieSizeForLevel(character.attributes.EMP)) / 4);
  const repl = character.nature === "replicant" ? D.NATURES.replicant.resolveMod : 0;
  const hardened = countSpecialty(character, "hardened"); // +1 max Resolve each (x3)
  const permLoss = character.state?.permanentResolveLoss || 0;
  return Math.max(0, base + repl + hardened - permLoss);
}

export function countSpecialty(character, key) {
  return (character.specialties || []).filter((s) => s === key || s?.key === key).length;
}

// ---- Normalization / migration --------------------------------------------
// Never crash on old/partial data — back-fill defaults. Bump SCHEMA_VERSION and
// add a migration branch whenever the schema grows (CLAUDE.md §7).
export const SCHEMA_VERSION = 3; // v3: per-character journal[] (roll log is a separate global store)

export function normalizeCharacter(c = {}) {
  const attributes = { STR: "C", AGI: "C", INT: "C", EMP: "C", ...(c.attributes || {}) };
  const skills = {};
  for (const s of D.SKILLS) skills[s.key] = (c.skills && c.skills[s.key]) || D.SKILL_START_LEVEL;
  const ch = {
    schemaVersion: SCHEMA_VERSION,
    id: c.id || undefined,
    name: c.name || "Unnamed Blade Runner",
    nature: c.nature === "replicant" ? "replicant" : "human",
    archetype: c.archetype || null,
    years: c.years || "rookie",
    attributes,
    skills,
    specialties: Array.isArray(c.specialties) ? c.specialties : [],
    identity: {
      keyMemory: "", keyRelationship: "", appearance: "", home: "", signatureItem: "",
      portraitUrl: "", ...(c.identity || {}),
    },
    state: {
      health: null, resolve: null,      // filled below to max if null
      conditions: {}, criticalInjuries: [], criticalStress: null,
      promotionPoints: 0, chinyenPoints: 0, humanityPoints: 0,
      baselineFails: 0, shiftsSinceDowntime: 0, shiftUses: {},
      permanentResolveLoss: 0, dead: false,   // v2
      ...(c.state || {}),
    },
    inventory: { items: [], ...(c.inventory || {}) },
    notes: c.notes || "",
    journal: Array.isArray(c.journal) ? c.journal : [],   // v3: timestamped journal entries
    advancementLog: Array.isArray(c.advancementLog) ? c.advancementLog : [],
    campaignId: c.campaignId || null,
    owner: c.owner || null,
  };
  if (ch.state.health == null) ch.state.health = maxHealth(ch);
  if (ch.state.resolve == null) ch.state.resolve = maxResolve(ch);
  // Back-fill stable ids for critical injuries (needed by the death-save UI).
  ch.state.criticalInjuries = (ch.state.criticalInjuries || []).map((inj, i) => ({ id: inj.id || `inj-${i}-${inj.roll ?? "x"}`, stabilized: false, ...inj }));
  // Back-fill item keys and upgrade legacy standard-issue names from earlier Phase 1 creations.
  ch.inventory.items = (ch.inventory.items || []).map((it) => {
    if (it.name === "PK-D Blaster (or .357 Subcompact)" || it.name === "PK-D Blaster") {
      return { ...it, key: "pkd_44", name: "PK-D 5223 Blaster (.44 Special)", equipped: it.equipped !== undefined ? it.equipped : true };
    }
    if (it.name === "Badge" && !it.key) return { ...it, key: "badge", equipped: it.equipped !== undefined ? it.equipped : true };
    if (it.name === "Knowledge Integration Assistant (KIA)" && !it.key) return { ...it, key: "kia" };
    if (it.name === "Detective Special Spinner" && !it.key) return { ...it, key: "spinner" };
    return it;
  });
  return ch;
}

// Clamp vitals to current maxima (call after any attribute/specialty change).
export function reclampVitals(ch) {
  ch.state.health = Math.max(0, Math.min(ch.state.health, maxHealth(ch)));
  ch.state.resolve = Math.max(0, Math.min(ch.state.resolve, maxResolve(ch)));
  return ch;
}

export const isBrokenByDamage = (ch) => ch.state.health <= 0;
export const isBrokenByStress = (ch) => ch.state.resolve <= 0;
