// wizard.js — character creation wizard (15-step flow, CLAUDE.md §3.5).
// Honest generation + legality validation at every step. No pregens (§3.14).
import { el, clear, titleCase, rollDie } from "./core.js";
import * as D from "../data.js";
import * as R from "./rules.js";
import { maxHealth, maxResolve, normalizeCharacter } from "./derived.js";
import { Store } from "./store.js";
import { showToast } from "./ui.js";
import { Settings } from "./settings.js";
import { SOLO_NO_ARCHETYPE } from "../data-solo.js";
import { navigate } from "./router.js";

const d3 = () => Math.ceil(rollDie(6) / 2);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// Fresh creation draft.
function newDraft() {
  const attributes = { STR: "C", AGI: "C", INT: "C", EMP: "C" };
  const skills = {}; for (const s of D.SKILLS) skills[s.key] = "D";
  return {
    step: 0,
    nature: null, secretReplicant: false, archetype: null, years: null,
    attributes, skills, specialties: [],
    identity: { name: "", appearance: "", home: "", signatureItem: "", keyMemory: "", keyRelationship: "" },
    memory: { when: null, where: null, who: null, what: null, feel: null },
    relationship: { who: null, like: null, going: null },
  };
}

let draft = newDraft();

const STEPS = [
  { key: "nature", title: "Human or Replicant", render: stepNature },
  { key: "archetype", title: "Archetype", render: stepArchetype },
  { key: "years", title: "Years on the Force", render: stepYears },
  { key: "attributes", title: "Attributes", render: stepAttributes, validate: R.validateAttributes },
  { key: "skills", title: "Skills", render: stepSkills, validate: R.validateSkills },
  { key: "specialties", title: "Specialties", render: stepSpecialties, validate: validateSpecialties },
  { key: "memory", title: "Key Memory", render: stepMemory },
  { key: "relationship", title: "Key Relationship", render: stepRelationship },
  { key: "identity", title: "Identity", render: stepIdentity },
  { key: "review", title: "Review", render: stepReview },
];

export function renderWizard(mount, { restart = false } = {}) {
  if (restart || !draft) draft = newDraft();
  paint(mount);
}

function paint(mount) {
  clear(mount);
  const step = STEPS[draft.step];
  const wrap = el("section", { class: "screen wizard" });
  // progress
  wrap.append(el("div", { class: "wiz__progress" },
    el("div", { class: "wiz__count muted" }, `Step ${draft.step + 1} of ${STEPS.length}`),
    el("div", { class: "wiz__bar" }, el("div", { class: "wiz__bar-fill", style: `width:${((draft.step + 1) / STEPS.length) * 100}%` }))));
  wrap.append(el("h1", { class: "screen__title" }, step.title));
  const body = el("div", { class: "wiz__body" });
  step.render(body, () => paint(mount));
  wrap.append(body);

  // nav buttons
  const canNext = stepReady(step);
  const nav = el("div", { class: "wiz__nav" },
    el("button", { class: "btn btn--ghost", onClick: () => back(mount) }, draft.step === 0 ? "Cancel" : "‹ Back"),
    draft.step < STEPS.length - 1
      ? el("button", { class: "btn btn--primary", disabled: !canNext || null, onClick: () => next(mount) }, "Next ›")
      : el("button", { class: "btn btn--primary", onClick: () => finish() }, "Create Blade Runner"));
  wrap.append(nav);
  mount.append(wrap);
}

function stepReady(step) {
  if (step.validate) return step.validate(draft).ok;
  switch (step.key) {
    case "nature": return !!draft.nature;
    case "archetype": return !!draft.archetype;
    case "years": return !!draft.years;
    default: return true;
  }
}
function next(mount) { if (draft.step < STEPS.length - 1) { draft.step++; onEnter(); paint(mount); } }
function back(mount) { if (draft.step === 0) { navigate("home"); return; } draft.step--; paint(mount); }

// Side-effects when entering a step (e.g. force Replicant to Rookie).
function onEnter() {
  if (STEPS[draft.step].key === "years" && draft.nature === "replicant") draft.years = "rookie";
}

// ---- Quick build: roll a whole legal Blade Runner --------------------------
// A newcomer has no basis for choosing an archetype or spending an attribute
// budget. This fills every step the way the book says to roll it, keeps the
// result legal by construction (key attribute B+, key skills C+, exact budgets),
// and drops you on the Review step so nothing is saved behind your back.
function quickBuild() {
  draft = newDraft();

  // ① nature ② archetype ③ years — all straight off the book's tables.
  draft.nature = R.lookupRange(D.NATURE_TABLE, rollDie(6)).nature;
  draft.archetype = R.lookupRange(D.ARCHETYPE_TABLE[draft.nature], rollDie(12)).key;
  draft.years = draft.nature === "replicant"
    ? "rookie"
    : R.lookupRange(D.YEARS_ON_FORCE.map((y) => ({ min: y.d12[0], max: y.d12[1], key: y.key })), rollDie(12)).key;

  const arch = R.archetype(draft.archetype);

  // ④ attributes: the key attribute has to reach B; a Replicant's bonus step has
  // to go into Strength or Agility. Everything left over goes to the attributes
  // this archetype actually rolls, best first.
  const attrOrder = [arch.keyAttr,
    ...(draft.nature === "replicant" ? ["STR", "AGI"] : []),
    ...arch.keySkills.map((k) => R.skill(k)?.attr).filter((a) => a && a !== "MANEUVER"),
    ...D.ATTRIBUTES.map((a) => a.key)];
  let attrLeft = R.attrBudget(draft.years, draft.nature);
  // The mandatory step first, then spread — never below C, never past A.
  const raiseAttr = (key) => {
    if (attrLeft <= 0 || R.levelValue(draft.attributes[key]) >= R.levelValue("A")) return false;
    draft.attributes[key] = R.stepLevel(draft.attributes[key], +1); attrLeft--; return true;
  };
  raiseAttr(arch.keyAttr);
  if (draft.nature === "replicant" && R.levelValue(draft.attributes.STR) === R.levelValue("C") && R.levelValue(draft.attributes.AGI) === R.levelValue("C")) raiseAttr("STR");
  for (const key of attrOrder) { while (raiseAttr(key)) if (attrLeft <= 0) break; if (attrLeft <= 0) break; }

  // ⑤ skills: every key skill to C first, then deepen the key skills, then the rest.
  let skillLeft = R.skillBudget(draft.years);
  const raiseSkill = (key) => {
    if (skillLeft <= 0 || !draft.skills[key] || R.levelValue(draft.skills[key]) >= R.levelValue("A")) return false;
    draft.skills[key] = R.stepLevel(draft.skills[key], +1); skillLeft--; return true;
  };
  for (const k of arch.keySkills) raiseSkill(k);                       // D → C, the legal floor
  for (const k of arch.keySkills) { raiseSkill(k); raiseSkill(k); }    // deepen what you are for
  for (const s of D.SKILLS) while (raiseSkill(s.key)) if (skillLeft <= 0) break;

  // ⑥ specialties: as many as the years give, archetype suggestions first.
  const need = R.years(draft.years)?.specialties ?? 0;
  const pool = [...(arch.specialtyOptions || []), ...D.SPECIALTIES.map((sp) => sp.key)];
  for (const k of pool) { if (draft.specialties.length >= need) break; if (!draft.specialties.includes(k)) draft.specialties.push(k); }

  // ⑦–⑨ memory, relationship, identity — the flavor tables, rolled.
  draft.memory = { when: D.MEMORY_WHEN[rollDie(6) - 1], where: D.MEMORY_WHERE[rollDie(12) - 1],
    who: D.MEMORY_WHO[rollDie(12) - 1], what: D.MEMORY_WHAT[rollDie(12) - 1], feel: D.MEMORY_FEEL[rollDie(12) - 1] };
  syncMemory();
  draft.relationship = { who: D.RELATIONSHIP_WHO[rollDie(12) - 1], like: D.RELATIONSHIP_LIKE[rollDie(12) - 1], going: D.RELATIONSHIP_GOING_ON[rollDie(12) - 1] };
  syncRelationship();
  const names = (arch.names || []).filter(Boolean);
  draft.identity.name = names.length ? pick(names) : "Unnamed Blade Runner";
  if (arch.appearance?.length) draft.identity.appearance = arch.appearance[d3() - 1];
  draft.identity.signatureItem = D.SIGNATURE_ITEMS[rollDie(12) - 1];
  draft.identity.home = R.lookupRange(D.HOME_TABLE, rollDie(12)).text;

  draft.step = STEPS.length - 1;   // land on Review — you still press Finish
}

// ---- Step 1: Nature -------------------------------------------------------
function stepNature(body, rerender) {
  // The escape hatch for anyone who does not yet know what any of this means.
  body.append(el("div", { class: "card quickbuild" },
    el("div", { class: "card__title" }, "Never played before?"),
    el("p", { class: "muted" }, "Let the dice make every choice. You land on the review screen and can still change anything, or start over."),
    el("button", { class: "btn btn--primary", onClick: () => { quickBuild(); showToast("Rolled a complete Blade Runner — check it over and press Finish."); rerender(); } }, "⚄ Roll me a whole Blade Runner")));
  body.append(el("p", { class: "muted" }, "Replicants are stronger and tougher (+2 Health) but less stable (−2 Resolve), all rookies, and start with fewer points. Humans are the baseline."));
  for (const key of ["human", "replicant"]) {
    const n = D.NATURES[key];
    const on = draft.nature === key && !draft.secretReplicant;
    body.append(choice(n.name, key === "replicant" ? "+2 Health, −2 Resolve · +1 STR/AGI increase · always Rookie" : "Baseline capabilities and standing", on, () => { draft.nature = key; draft.secretReplicant = false; if (key === "replicant") draft.years = "rookie"; rerender(); }));
  }
  // Secret Replicant  [§3.5] — built and played as a human until the reveal.
  body.append(choice("Secret Replicant", "Build as a human; the sheet carries a reveal button that applies the Replicant rules later.",
    !!draft.secretReplicant, () => { draft.nature = "human"; draft.secretReplicant = true; rerender(); }, D.SECRET_REPLICANT.note));
  body.append(rollBtn("Roll (D6)", () => { const r = rollDie(6); draft.nature = R.lookupRange(D.NATURE_TABLE, r).nature; draft.secretReplicant = false; if (draft.nature === "replicant") draft.years = "rookie"; showToast(`D6=${r} → ${titleCase(draft.nature)}`); rerender(); }));
  // The book's own secret roll: a human character rolls D6 in secret — a 6 means
  // they are a Replicant and don't know it. [Ch02 p028]
  body.append(rollBtn(`Secret check (D${D.SECRET_REPLICANT.secretRollDie}) — human build`, () => {
    const r = rollDie(D.SECRET_REPLICANT.secretRollDie);
    draft.nature = "human";
    draft.secretReplicant = r === D.SECRET_REPLICANT.secretRollHit;
    showToast(draft.secretReplicant
      ? "Rolled in secret — your Blade Runner is a Replicant and doesn't know it."
      : "Rolled in secret — nothing to see here.", { timeout: 4200 });
    rerender();
  }));
}

// ---- Step 2: Archetype ----------------------------------------------------
function stepArchetype(body, rerender) {
  const legal = R.archetypesForNature(draft.nature);
  body.append(el("p", { class: "muted" }, `Sets your key attribute (must end B+), key skills (must end C+), specialty options, and starting Chinyen die. ${draft.nature === "human" ? "Cityspeaker & Skimmer are human-only." : "Doxie is Replicant-only."}`));
  for (const a of legal) {
    const sub = `Key ${R.attrDisplay(a.keyAttr)} · ${a.keySkills.map(R.skillName).join(", ")} · Chinyen D${a.chinyenDie}`;
    body.append(choice(a.name, sub, draft.archetype === a.key, () => { draft.archetype = a.key; rerender(); }, a.blurb));
  }
  // Solo option: no archetype at all — free key attribute/skills, D8 Chinyen.
  if (Settings.solo()) {
    body.append(choice(SOLO_NO_ARCHETYPE.name, `Free key attribute & skills · Chinyen D${SOLO_NO_ARCHETYPE.chinyenDie}`,
      draft.archetype === SOLO_NO_ARCHETYPE.key, () => { draft.archetype = SOLO_NO_ARCHETYPE.key; rerender(); },
      SOLO_NO_ARCHETYPE.advice));
  }
  body.append(rollBtn("Roll (D12)", () => {
    const r = rollDie(12); const row = R.lookupRange(D.ARCHETYPE_TABLE[draft.nature], r);
    draft.archetype = row.key; showToast(`D12=${r} → ${R.archetype(row.key).name}`); rerender();
  }));
}

// ---- Step 3: Years on the Force -------------------------------------------
function stepYears(body, rerender) {
  if (draft.nature === "replicant") {
    body.append(el("div", { class: "notice" }, "All Replicants are Rookies (only one year since the N-9 models were approved)."));
  }
  body.append(el("p", { class: "muted" }, "More experience means higher skills, more specialties and points — but fewer attribute increases."));
  for (const y of D.YEARS_ON_FORCE) {
    const disabled = draft.nature === "replicant" && y.key !== "rookie";
    const sub = `+${y.attrIncreases} attr · +${y.skillIncreases} skill · ${y.specialties} spec · Promotion D${y.startingPromotionDie} · Chinyen ${y.chinyenMod >= 0 ? "+" + y.chinyenMod : y.chinyenMod}`;
    const c = choice(`${y.name} (${y.years} yrs)`, sub, draft.years === y.key, () => { if (!disabled) { draft.years = y.key; rerender(); } });
    if (disabled) { c.classList.add("choice--disabled"); c.disabled = true; }
    body.append(c);
  }
  if (draft.nature !== "replicant")
    body.append(rollBtn("Roll (D12)", () => { const r = rollDie(12); draft.years = R.lookupRange(D.YEARS_ON_FORCE.map((y) => ({ min: y.d12[0], max: y.d12[1], key: y.key })), r).key; showToast(`D12=${r} → ${R.years(draft.years).name}`); rerender(); }));
}

// ---- Step 4: Attributes ---------------------------------------------------
function stepAttributes(body, rerender) {
  const budget = R.attrBudget(draft.years, draft.nature);
  const used = R.attrStepsUsed(draft.attributes);
  const arch = R.archetype(draft.archetype);
  body.append(el("p", { class: "muted" }, `Start at C. Spend exactly ${budget} increase${budget === 1 ? "" : "s"} (one step each). Lower one attribute to D to gain an extra.` + (arch.keyAttr ? ` Key: ${R.attrDisplay(arch.keyAttr)} must be B+.` : " No archetype — choose your own focus.")));
  body.append(el("div", { class: "budget" + (used === budget ? " budget--ok" : "") }, `Increases used: ${used} / ${budget}`));
  for (const a of D.ATTRIBUTES) {
    body.append(stepper(a.name + (a.key === arch.keyAttr ? " ★" : ""), draft.attributes[a.key],
      (dir) => { draft.attributes[a.key] = R.stepLevel(draft.attributes[a.key], dir); rerender(); }, `d${D.LEVEL_DIE[draft.attributes[a.key]]}`));
  }
  const tmp = normalizeCharacter({ ...draft, id: "tmp" });
  body.append(el("div", { class: "derived" },
    el("span", { class: "pip pip--health" }, `Health ${maxHealth(tmp)}`),
    el("span", { class: "pip pip--resolve" }, `Resolve ${maxResolve(tmp)}`)));
  errorsFor(body, R.validateAttributes(draft));
}

// ---- Step 5: Skills -------------------------------------------------------
function stepSkills(body, rerender) {
  const budget = R.skillBudget(draft.years);
  const used = R.skillStepsUsed(draft.skills);
  const arch = R.archetype(draft.archetype);
  body.append(el("p", { class: "muted" }, `Start at D. Spend exactly ${budget} increases.` + (arch.keySkills.length ? " Key skills (★) must end C+." : " No archetype — spend them where you like.")));
  body.append(el("div", { class: "budget" + (used === budget ? " budget--ok" : "") }, `Increases used: ${used} / ${budget}`));
  for (const s of D.SKILLS) {
    if (s.key === "driving") continue; // Driving uses vehicle Maneuverability; still trainable
    const isKey = arch.keySkills.includes(s.key);
    body.append(stepper(s.name + (isKey ? " ★" : ""), draft.skills[s.key],
      (dir) => { draft.skills[s.key] = R.stepLevel(draft.skills[s.key], dir); rerender(); }, `d${D.LEVEL_DIE[draft.skills[s.key]]}`, `${R.attrDisplay(s.attr)}`));
  }
  // Driving separately (still a skill you can raise)
  body.append(stepper("Driving" + (arch.keySkills.includes("driving") ? " ★" : ""), draft.skills.driving,
    (dir) => { draft.skills.driving = R.stepLevel(draft.skills.driving, dir); rerender(); }, `d${D.LEVEL_DIE[draft.skills.driving]}`, "Maneuverability"));
  errorsFor(body, R.validateSkills(draft));
}

// ---- Step 6: Specialties --------------------------------------------------
function validateSpecialties(d) {
  const need = D.YEARS_ON_FORCE.find((y) => y.key === d.years)?.specialties ?? 0;
  return { ok: d.specialties.length === need, errors: d.specialties.length === need ? [] : [`Choose exactly ${need} specialt${need === 1 ? "y" : "ies"} (${d.specialties.length} chosen).`] };
}
function stepSpecialties(body, rerender) {
  const need = D.YEARS_ON_FORCE.find((y) => y.key === draft.years).specialties;
  const arch = R.archetype(draft.archetype);
  if (need === 0) { body.append(el("div", { class: "notice" }, "Rookies start with no specialties — you'll learn them in play.")); return; }
  body.append(el("p", { class: "muted" }, arch.specialtyOptions.length
    ? `Choose ${need}. Your archetype suggests: ${arch.specialtyOptions.map((k) => R.specialty(k).name).join(", ")} — but you may pick any.`
    : `Choose ${need} from the full list.`));
  if (arch.specialtyOptions.length) body.append(rollBtn(`Roll archetype specialty (D3)`, () => {
    const r = d3(); const k = arch.specialtyOptions[r - 1];
    if (!draft.specialties.includes(k) && draft.specialties.length < need) draft.specialties.push(k);
    showToast(`D3=${r} → ${R.specialty(k).name}`); rerender();
  }));
  const chosen = el("div", { class: "chips" });
  for (const k of draft.specialties) chosen.append(el("button", { class: "chip chip--on", onClick: () => { draft.specialties = draft.specialties.filter((x) => x !== k); rerender(); } }, R.specialty(k).name + " ✕"));
  body.append(chosen);
  const list = el("details", { class: "rules__group" }, el("summary", {}, "All specialties"));
  for (const sp of D.SPECIALTIES) {
    const on = draft.specialties.includes(sp.key);
    list.append(el("label", { class: "picker__row" },
      el("input", { type: "checkbox", checked: on || null, disabled: (!on && draft.specialties.length >= need) || null, onChange: () => { if (on) draft.specialties = draft.specialties.filter((x) => x !== sp.key); else if (draft.specialties.length < need) draft.specialties.push(sp.key); rerender(); } }),
      el("span", {}, el("strong", {}, sp.name), " — ", el("span", { class: "muted" }, sp.text))));
  }
  body.append(list);
}

// ---- Step 7: Key Memory ---------------------------------------------------
function stepMemory(body, rerender) {
  body.append(el("p", { class: "muted" }, "Roll each fragment (or write your own below). Once per session you can invoke your key memory for an advantage."));
  const tables = [["when", "When", D.MEMORY_WHEN, 6], ["where", "Where", D.MEMORY_WHERE, 12], ["who", "Who", D.MEMORY_WHO, 12], ["what", "What", D.MEMORY_WHAT, 12], ["feel", "Feeling", D.MEMORY_FEEL, 12]];
  for (const [k, label, arr, die] of tables) {
    body.append(el("div", { class: "mem__row" },
      el("button", { class: "btn btn--ghost btn--sm", onClick: () => { const r = rollDie(die); draft.memory[k] = arr[(r - 1) % arr.length]; syncMemory(); rerender(); } }, `${label} ⚄`),
      el("span", { class: "mem__val" + (draft.memory[k] ? "" : " muted") }, draft.memory[k] || "—")));
  }
  body.append(rollBtn("Roll all", () => { for (const [k, , arr, die] of tables) draft.memory[k] = arr[(rollDie(die) - 1) % arr.length]; syncMemory(); rerender(); }));
  body.append(textArea("Key memory (editable)", draft.identity.keyMemory, (v) => { draft.identity.keyMemory = v; }));
}
function syncMemory() {
  const m = draft.memory;
  if (m.when || m.where || m.who || m.what || m.feel)
    draft.identity.keyMemory = `${m.what || "Something happened"} — ${m.where || "somewhere"}, ${m.when || "once"}. Present: ${m.who || "someone"}. It left you feeling ${(m.feel || "changed").toLowerCase()}.`;
}

// ---- Step 8: Key Relationship ---------------------------------------------
function stepRelationship(body, rerender) {
  body.append(el("p", { class: "muted" }, "An NPC who plays a big role in your life (not another PC). Interacting with them earns Humanity Points. Roll the three tables or write your own."));
  const tables = [["who", "Who is it", D.RELATIONSHIP_WHO], ["like", "What it's like", D.RELATIONSHIP_LIKE], ["going", "What's going on", D.RELATIONSHIP_GOING_ON]];
  for (const [k, label, arr] of tables) {
    body.append(el("div", { class: "mem__row" },
      el("button", { class: "btn btn--ghost btn--sm", onClick: () => { const r = rollDie(12); draft.relationship[k] = arr[r - 1]; syncRelationship(); rerender(); } }, `${label} ⚄`),
      el("span", { class: "mem__val" + (draft.relationship[k] ? "" : " muted") }, draft.relationship[k] || "—")));
  }
  body.append(rollBtn("Roll all", () => { for (const [k, , arr] of tables) draft.relationship[k] = arr[rollDie(12) - 1]; syncRelationship(); rerender(); }));
  body.append(textArea("Key relationship (editable)", draft.identity.keyRelationship, (v) => { draft.identity.keyRelationship = v; }, "e.g. Mara — your handler and the closest thing you have to family."));
}
function syncRelationship() {
  const r = draft.relationship;
  if (r.who || r.like || r.going)
    draft.identity.keyRelationship = `${r.who || "Someone"} — ${(r.like || "complicated").toLowerCase()}. ${r.going || ""}`.trim();
}

// ---- Step 9: Identity -----------------------------------------------------
function stepIdentity(body, rerender) {
  const arch = R.archetype(draft.archetype);
  body.append(field("Name", draft.identity.name, (v) => { draft.identity.name = v; },
    arch.names.some(Boolean) ? () => { draft.identity.name = pick(arch.names.filter(Boolean)); rerender(); } : null));
  body.append(field("Appearance", draft.identity.appearance, (v) => { draft.identity.appearance = v; },
    arch.appearance.length ? () => { const r = d3(); draft.identity.appearance = arch.appearance[r - 1]; rerender(); } : null, true));
  body.append(field("Signature item", draft.identity.signatureItem, (v) => { draft.identity.signatureItem = v; },
    () => { const r = rollDie(12); draft.identity.signatureItem = D.SIGNATURE_ITEMS[r - 1]; rerender(); }));
  body.append(el("p", { class: "muted sheet__note" }, `Once per session, interacting with your signature item heals ${D.SIGNATURE_ITEM_HEAL.resolve} stress.`));
  body.append(field("Home", draft.identity.home, (v) => { draft.identity.home = v; },
    () => { const r = rollDie(12); draft.identity.home = R.lookupRange(D.HOME_TABLE, r).text; rerender(); }, true,
    "LAPD apartment in Sector 5 by default — describe or relocate it."));
  body.append(el("div", { class: "notice" }, `Standard issue: ${D.STANDARD_ISSUE.join(", ")}.`));
}

// ---- Step 10: Review ------------------------------------------------------
function stepReview(body) {
  const arch = R.archetype(draft.archetype), y = R.years(draft.years);
  const tmp = normalizeCharacter({ ...draft, id: "tmp" });
  body.append(el("div", { class: "card" },
    el("div", { class: "card__title" }, draft.identity.name || "Unnamed Blade Runner"),
    el("div", { class: "muted" }, `${titleCase(draft.nature)} · ${arch.name} · ${y.name}`),
    el("div", { class: "pips" },
      el("span", { class: "pip pip--health" }, `Health ${maxHealth(tmp)}`),
      el("span", { class: "pip pip--resolve" }, `Resolve ${maxResolve(tmp)}`)),
    el("div", { class: "review__grid" },
      ...D.ATTRIBUTES.map((a) => el("span", { class: "pip" }, `${a.key} ${draft.attributes[a.key]}`))),
    el("div", { class: "muted", style: "margin-top:.5rem" }, "Trained skills: " +
      (D.SKILLS.filter((s) => draft.skills[s.key] !== "D").map((s) => `${s.name} ${draft.skills[s.key]}`).join(", ") || "none")),
    draft.specialties.length ? el("div", { class: "muted" }, "Specialties: " + draft.specialties.map((k) => R.specialty(k).name).join(", ")) : null,
  ));
  body.append(el("p", { class: "muted" }, "Starting Promotion & Chinyen Points are rolled when you create the character."));
}

// ---- Finish: roll points, build & save ------------------------------------
function finish() {
  const y = R.years(draft.years), arch = R.archetype(draft.archetype);
  const replMod = draft.nature === "replicant" ? -1 : 0;
  const promotion = Math.max(0, rollDie(y.startingPromotionDie) + replMod);
  const chinyen = Math.max(0, rollDie(arch.chinyenDie) + y.chinyenMod + replMod);
  const items = [
    { key: "badge", name: "Badge", equipped: true },
    { key: "pkd_44", name: "PK-D 5223 Blaster (.44 Special)", equipped: true },
    { key: "kia", name: "Knowledge Integration Assistant (KIA)", equipped: false },
    { key: "spinner", name: "Detective Special Spinner", equipped: false },
  ];
  if (draft.identity.signatureItem) items.push({ name: draft.identity.signatureItem, signature: true });

  const character = normalizeCharacter({
    name: draft.identity.name || "Unnamed Blade Runner",
    nature: draft.nature, secretReplicant: !!draft.secretReplicant, archetype: draft.archetype, years: draft.years,
    attributes: draft.attributes, skills: draft.skills, specialties: draft.specialties.slice(),
    identity: { ...draft.identity },
    inventory: { items },
    state: { promotionPoints: promotion, chinyenPoints: chinyen },
  });
  const saved = Store.save(character);
  Store.setActiveId(saved.id);
  draft = newDraft();
  showToast(`${saved.name} created — Promotion ${promotion}, Chinyen ${chinyen}.`, { kind: "info", timeout: 4200 });
  navigate("home");
}

// ---- shared UI bits -------------------------------------------------------
function choice(title, sub, active, onClick, blurb) {
  return el("button", { class: "choice" + (active ? " choice--on" : ""), onClick },
    el("span", { class: "choice__title" }, title),
    sub ? el("span", { class: "choice__sub muted" }, sub) : null,
    blurb ? el("span", { class: "choice__blurb muted" }, blurb) : null);
}
function stepper(label, level, onStep, dieLabel, meta) {
  return el("div", { class: "stepper" },
    el("span", { class: "stepper__label" }, label, meta ? el("span", { class: "stepper__meta muted" }, " " + meta) : null),
    el("span", { class: "stepper__ctrl" },
      el("button", { class: "btn btn--sm", "aria-label": "decrease " + label, onClick: () => onStep(-1) }, "−"),
      el("span", { class: "stepper__val" }, level, el("span", { class: "muted stepper__die" }, " " + dieLabel)),
      el("button", { class: "btn btn--sm", "aria-label": "increase " + label, onClick: () => onStep(+1) }, "+")));
}
function rollBtn(label, onClick) { return el("button", { class: "btn btn--roll", onClick }, "⚄ " + label); }
function field(label, value, onInput, onRoll, wide, placeholder) {
  const input = el(wide ? "textarea" : "input", { class: "input", value: wide ? null : value, placeholder: placeholder || "", rows: wide ? 2 : null });
  if (wide) input.value = value || "";
  input.addEventListener("input", () => onInput(input.value));
  return el("div", { class: "field" },
    el("div", { class: "field__head" }, el("label", { class: "field__label" }, label), onRoll ? el("button", { class: "btn btn--sm btn--roll", onClick: onRoll }, "⚄") : null),
    input);
}
const textArea = (label, value, onInput, ph) => field(label, value, onInput, null, true, ph);
function errorsFor(body, res) {
  if (res.ok) return;
  body.append(el("ul", { class: "errors" }, ...res.errors.map((e) => el("li", {}, e))));
}
