// screens.js — top-level screen renderers (home / characters / rules / settings)
// + party banner. Wizard, sheet, combat, gm, solo mount from their own modules.
import { el, clear, titleCase } from "./core.js";
import * as D from "../data.js";
import { NPCS } from "../data-npcs.js";
import { Store, RollLog } from "./store.js";
import { Settings, TOGGLES, applyTheme } from "./settings.js";
import { showToast, promptModal, confirmModal, rollLogCard } from "./ui.js";
import { maxHealth, maxResolve } from "./derived.js";
import { navigate } from "./router.js";
import { Sync, linkGoogle, createCampaign, joinCampaign, leaveCampaign, accountLabel } from "./sync.js";
import { checkForUpdates, applyUpdate } from "./update.js";

function screen(title, ...blocks) {
  return el("section", { class: "screen" }, el("h1", { class: "screen__title" }, title), ...blocks);
}

// ---- HOME -----------------------------------------------------------------
export function renderHome(mount) {
  clear(mount);
  const chars = Store.list();
  const active = Store.getActive();
  const body = screen(
    "Blade Runner Player",
    el("p", { class: "muted" }, "A player companion for the Blade Runner RPG — create Blade Runners, track cases, and roll the dice."),
    renderPartyBanner(),
    active
      ? el("div", { class: "card card--active" },
          el("div", { class: "card__eyebrow" }, "Active character"),
          el("div", { class: "card__title" }, active.name),
          el("div", { class: "muted" }, `${titleCase(active.nature)} · ${archLabel(active.archetype)}`),
          vitalsPips(active),
          el("button", { class: "btn btn--primary", onClick: () => navigate("sheet") }, "Open sheet"))
      : el("div", { class: "card" },
          el("p", {}, "No active character yet."),
          el("button", { class: "btn btn--primary", onClick: () => navigate("wizard") }, "Create a Blade Runner")),
    el("div", { class: "home-grid" },
      tile("Characters", `${chars.length} saved`, () => navigate("characters")),
      tile("New Blade Runner", "Creation wizard", () => navigate("wizard")),
      tile("How to Play", "Solo & table tutorial", () => navigate("tutorial")),
      tile("Rules Library", "Searchable reference", () => navigate("rules")),
      tile("Combat Tracker", "Initiative & vitals", () => navigate("combat")),
      Settings.solo() ? tile("Solo Mode", "Play on your own", () => navigate("solo")) : null,
      Settings.gm() ? tile("GM Screen", "Run the table", () => navigate("gm")) : null,
      tile("Settings", "Theme & toggles", () => navigate("settings")),
    ),
  );
  const rolls = RollLog.list();
  if (rolls.length) {
    body.append(rollLogCard({
      open: false,
      entries: rolls.slice(0, 20).map((e) => (e.charName ? { ...e, label: `${e.charName} · ${e.label}` } : e)),
      onDelete: (e) => { RollLog.remove(e.id); renderHome(mount); },
      onClear: async () => { if (await confirmModal("Clear the entire roll log?", { title: "Clear roll log", danger: true })) { RollLog.clear(); renderHome(mount); } },
    }));
  }
  mount.append(body);
}
const archLabel = (key) => (key ? (D.ARCHETYPES.find((a) => a.key === key)?.name || titleCase(key)) : "No archetype");
function tile(title, sub, onClick) {
  return el("button", { class: "tile", onClick }, el("span", { class: "tile__title" }, title), el("span", { class: "tile__sub muted" }, sub));
}
function vitalsPips(ch) {
  return el("div", { class: "pips" },
    el("span", { class: "pip pip--health" }, `♥ ${ch.state.health}/${maxHealth(ch)}`),
    el("span", { class: "pip pip--resolve" }, `◈ ${ch.state.resolve}/${maxResolve(ch)}`),
    el("span", { class: "pip" }, `PP ${ch.state.promotionPoints}`),
    el("span", { class: "pip" }, `¥ ${ch.state.chinyenPoints}`),
  );
}

// ---- CHARACTERS -----------------------------------------------------------
export function renderCharacters(mount) {
  clear(mount);
  const chars = Store.list();
  const list = el("div", { class: "list" });
  if (!chars.length) list.append(el("p", { class: "muted" }, "No characters yet. Create your first Blade Runner."));
  for (const ch of chars) {
    list.append(el("button", { class: "list__row", onClick: () => { Store.setActiveId(ch.id); navigate("sheet"); } },
      el("span", { class: "list__main" }, ch.name),
      el("span", { class: "list__sub muted" }, `${titleCase(ch.nature)} · ${archLabel(ch.archetype)}`)));
  }
  mount.append(screen("Characters",
    el("button", { class: "btn btn--primary", onClick: () => navigate("wizard") }, "＋ New Blade Runner"),
    list));
}

// ---- RULES LIBRARY (searchable) -------------------------------------------
export function renderRules(mount) {
  clear(mount);
  const results = el("div", { class: "rules" });
  const search = el("input", { class: "input", type: "search", placeholder: "Search skills, specialties, gear, conditions…", "aria-label": "Search rules" });
  const index = buildRulesIndex();
  function run(q) {
    clear(results);
    const query = q.trim().toLowerCase();
    const hits = query ? index.filter((r) => r.text.toLowerCase().includes(query)) : index;
    const byCat = {};
    for (const h of hits) (byCat[h.cat] ||= []).push(h);
    if (!hits.length) { results.append(el("p", { class: "muted" }, "No matches.")); return; }
    for (const [cat, items] of Object.entries(byCat)) {
      const group = el("details", { class: "rules__group", open: query ? true : cat === "Skills" });
      group.append(el("summary", {}, `${cat} (${items.length})`));
      for (const it of items) {
        group.append(el("div", { class: "rules__item" },
          el("div", { class: "rules__name" }, it.name),
          el("div", { class: "rules__desc muted" }, it.desc)));
      }
      results.append(group);
    }
  }
  search.addEventListener("input", () => run(search.value));
  mount.append(screen("Rules Library", search, results));
  run("");
}

function buildRulesIndex() {
  const idx = [];
  for (const s of D.SKILLS) idx.push({ cat: "Skills", name: `${s.name} (${attrName(s.attr)})`, desc: s.blurb, text: `${s.name} ${s.blurb}` });
  for (const s of D.SPECIALTIES) idx.push({ cat: "Specialties", name: s.name, desc: s.text, text: `${s.name} ${s.text}` });
  for (const c of D.CONDITIONS) idx.push({ cat: "Conditions", name: c.name, desc: c.text, text: `${c.name} ${c.text}` });
  for (const w of [...D.WEAPONS_MELEE, ...D.WEAPONS_RANGED, ...D.EXPLOSIVES]) {
    const rng = w.minRange ? ` · ${titleCase(w.minRange)}–${titleCase(w.maxRange)}` : (w.maxRange ? ` · ≤${titleCase(w.maxRange)}` : "");
    const crit = w.critDie ? ` · Crit ${w.critDie === "STR" ? "STR" : "D" + w.critDie}` : "";
    const dmg = w.damage != null ? `Damage ${w.damage}` : (w.note || "Special");
    idx.push({ cat: "Weapons", name: w.name, desc: `${dmg}${crit}${w.type && w.damage != null ? " · " + titleCase(w.type) : ""}${rng}${w.fullAuto ? " · full auto" : ""} · ${w.avail} (cost ${w.cost})`, text: `${w.name} ${w.type || ""} weapon ${w.blastPower ? "explosive grenade" : ""}` });
  }
  for (const a of D.ARMOR) idx.push({ cat: "Armor & Gear", name: a.name, desc: `${a.rating ? "Armor " + a.rating + " · " : ""}${a.note || ""} ${a.avail} (cost ${a.cost})`.trim(), text: `${a.name} armor ${a.note || ""}` });
  for (const g of D.GEAR) idx.push({ cat: "Armor & Gear", name: g.name, desc: `${g.text} · ${g.avail} (cost ${g.cost})`, text: `${g.name} ${g.text} gear` });
  for (const g of D.AUGMENTATIONS) idx.push({ cat: "Augmentations", name: g.name, desc: `${g.text} · ${g.avail} (cost ${g.cost})`, text: `${g.name} ${g.text} implant augmentation` });
  for (const a of D.ARCHETYPES) idx.push({ cat: "Archetypes", name: a.name, desc: `Key ${attrName(a.keyAttr)} · ${a.keySkills.map((k) => D.SKILLS.find((s) => s.key === k)?.name).join(", ")} · Chinyen D${a.chinyenDie} · ${natLabel(a.nature)}`, text: `${a.name} archetype ${a.blurb}` });
  for (const n of NPCS) idx.push({ cat: "NPCs", name: n.name, desc: `STR ${n.attrs.STR} AGI ${n.attrs.AGI} INT ${n.attrs.INT} EMP ${n.attrs.EMP} · Health ${n.health} · ${n.gear.join(", ") || "—"}`, text: `${n.name} npc` });
  // Combat & movement reference
  for (const r of D.RANGES) idx.push({ cat: "Combat", name: `Range: ${r.name}`, desc: r.desc, text: `${r.name} range zone distance` });
  for (const a of D.COMBAT_ACTIONS) idx.push({ cat: "Combat", name: a.action, desc: `Requires ${a.prereq}${a.skill ? ` · rolls ${D.SKILLS.find((s) => s.key === a.skill)?.name}` : " · no roll"}`, text: `${a.action} combat action ${a.prereq}` });
  idx.push({ cat: "Combat", name: "Initiative", desc: `Draw once from ${D.INITIATIVE_CARDS} cards; act low→high; the order holds for the whole fight.`, text: "initiative cards order surprise ambush" });
  idx.push({ cat: "Combat", name: "Armor", desc: `When hit, roll ${D.ARMOR_DICE} dice of the armor's rating; each success stops ${D.ARMOR_DAMAGE_PER_SUCCESS} damage. Stop it all and the critical injury is negated too. One suit only.`, text: "armor rating damage reduction protection" });
  // Chases
  D.CHASE.procedure.forEach((p, i) => idx.push({ cat: "Chases", name: `Procedure ${i + 1}`, desc: p, text: `chase procedure ${p}` }));
  for (const m of D.CHASE.maneuvers) idx.push({ cat: "Chases", name: `Maneuver: ${m.name}`, desc: `${m.who === "both" ? "Either side" : m.who === "prey" ? "Prey only" : "Pursuer only"}${m.skill ? ` · ${D.SKILLS.find((s) => s.key === m.skill)?.name}` : ""}${m.vehicleSkill ? ` (vehicles: ${D.SKILLS.find((s) => s.key === m.vehicleSkill)?.name})` : ""} — ${m.text}`, text: `chase maneuver ${m.name} ${m.text}` });
  idx.push({ cat: "Chases", name: "Distance & outcome", desc: `${D.CHASE.distance} Caught: ${D.CHASE.caught} Escape: ${D.CHASE.escape}`, text: "chase distance escape caught range" });
  for (const [env, list] of Object.entries(D.CHASE.obstacles))
    list.forEach((o, i) => idx.push({ cat: "Chases", name: `${titleCase(env)} obstacle ${i + 1}`, desc: o, text: `chase obstacle ${env} ${o}` }));
  // Vehicles
  for (const v of D.VEHICLES) idx.push({ cat: "Vehicles", name: v.name, desc: `Maneuverability ${v.maneuverability} · Hull ${v.hull}${v.armor ? ` · Armor ${v.armor}` : ""} · ${v.passengers} seats · ${v.avail} (cost ${v.cost})${v.note ? ` — ${v.note}` : ""}`, text: `${v.name} vehicle spinner car` });
  for (const w of D.VEHICLE_WEAPONS) idx.push({ cat: "Vehicles", name: w.name, desc: `${w.damage != null ? `Damage ${w.damage}` : "Special"}${w.critDie ? ` · Crit D${w.critDie}` : ""}${w.minRange ? ` · ${titleCase(w.minRange)}–${titleCase(w.maxRange)}` : ""}${w.fullAuto ? " · full auto" : ""}${w.note ? ` — ${w.note}` : ""}`, text: `${w.name} vehicle weapon` });
  // Health, stress & recovery
  for (const t of ["crushing", "piercing"])
    for (const e of (t === "crushing" ? D.CRIT_CRUSHING : D.CRIT_PIERCING))
      idx.push({ cat: "Critical Injuries", name: `${titleCase(t)} ${e.roll}: ${e.injury}`, desc: `${e.effect} · heals ${e.healing}${e.instantKill ? " · INSTANT KILL" : e.lethal ? ` · lethal (${e.deathSave} death save)` : ""}`, text: `${e.injury} critical injury ${t}` });
  for (const s of D.STRESS_FACTORS) idx.push({ cat: "Stress", name: `Stress +${s.factor}`, desc: s.text, text: `stress factor ${s.text}` });
  for (const t of ["human", "replicant"])
    for (const e of (t === "human" ? D.CRITICAL_STRESS_HUMAN : D.CRITICAL_STRESS_REPLICANT))
      idx.push({ cat: "Stress", name: `${titleCase(t)} ${e.roll}: ${e.name}`, desc: e.text, text: `critical stress ${e.name} ${t}` });
  idx.push({ cat: "Recovery", name: "Downtime Shift", desc: `Humans heal ${D.RECOVERY.downtimeHealthPerShift.human} Health, Replicants ${D.RECOVERY.downtimeHealthPerShift.replicant}, plus ${D.RECOVERY.medicalCareBonusHealth} more with medical care; Resolve heals the same Shift.`, text: "downtime recovery heal rest shift" });
  idx.push({ cat: "Recovery", name: "Pace of the job", desc: `After ${D.RECOVERY.downtimeShiftsBeforeStress} investigation Shifts without Downtime you start taking stress (4 with Married to the Job).`, text: "downtime cadence shifts stress pace" });
  idx.push({ cat: "Recovery", name: "First Aid", desc: "MEDICAL AID on a Broken character heals Health equal to your successes; Glue gives advantage. Alone, a Broken character regains 1 Health per Shift.", text: "first aid broken medical revive" });
  // Advancement & the job
  for (const y of D.YEARS_ON_FORCE) idx.push({ cat: "Years on the Force", name: `${y.name} (${y.years} yrs)`, desc: `+${y.attrIncreases} attribute · +${y.skillIncreases} skill · ${y.specialties} specialties · Promotion D${y.startingPromotionDie} · Chinyen ${y.chinyenMod >= 0 ? "+" : ""}${y.chinyenMod}`, text: `${y.name} years on the force experience` });
  idx.push({ cat: "Advancement", name: "Learn a specialty", desc: `${D.SPECIALTY_LEARN_COST_PP} Promotion Points and one Shift at the Training Grounds (Downtime).`, text: "specialty cost promotion points training" });
  idx.push({ cat: "Advancement", name: "Raise a skill", desc: `${Object.entries(D.SKILL_INCREASE_COST_HP).map(([lv, c]) => `${lv}→next ${c}`).join(" · ")} Humanity Points. Downtime only; attributes never rise.`, text: "skill increase humanity cost advancement" });
  idx.push({ cat: "Advancement", name: "Humanity Points", desc: `Always earned for: ${D.HUMANITY_ALWAYS_TRIGGERS.join(" ")}`, text: "humanity points compassion key memory relationship" });
  idx.push({ cat: "Advancement", name: "Baseline Test", desc: `${D.SKILLS.find((s) => s.key === D.BASELINE_TEST.skill).name} roll. Pass: ${D.BASELINE_TEST.onSuccess} Fail: ${D.BASELINE_TEST.onFail} ${D.BASELINE_TEST.note}`, text: "baseline test replicant insight" });
  for (const t of [["Key relationship — who", D.RELATIONSHIP_WHO], ["Key relationship — what it's like", D.RELATIONSHIP_LIKE], ["Key relationship — what's going on", D.RELATIONSHIP_GOING_ON], ["Signature items", D.SIGNATURE_ITEMS]])
    idx.push({ cat: "Creation Tables", name: t[0], desc: `D12: ${t[1].join(" · ")}`, text: `${t[0]} ${t[1].join(" ")}` });
  idx.push({ cat: "Creation Tables", name: "Home", desc: D.HOME_TABLE.map((h) => `${h.range[0] === h.range[1] ? h.range[0] : h.range.join("–")}: ${h.text}`).join(" "), text: "home apartment sector 5 where you live" });
  idx.push({ cat: "Creation Tables", name: "Signature item effect", desc: `Interacting with it heals ${D.SIGNATURE_ITEM_HEAL.resolve} stress, once per ${D.SIGNATURE_ITEM_HEAL.period}.`, text: "signature item stress recover session" });
  idx.push({ cat: "Creation Tables", name: "Secret Replicant", desc: `The Game Runner may roll a D${D.SECRET_REPLICANT.secretRollDie} in secret for an apparently human character; on a ${D.SECRET_REPLICANT.secretRollHit} they are a Replicant who doesn't know it. ${D.SECRET_REPLICANT.note}`, text: "secret replicant reveal nexus" });
  idx.push({ cat: "Advancement", name: "Acquiring gear", desc: `Pay the Cost in Promotion Points (LAPD) or Chinyen Points (black market), then roll ${D.SKILLS.find((s) => s.key === D.ACQUISITION.skill).name}. Paying double gives advantage. ${D.ACQUISITION.failureNote}`, text: "acquire gear connections availability cost requisition" });
  for (const t of D.AVAILABILITY_TIERS)
    idx.push({ cat: "Advancement", name: `Availability: ${t.key}`, desc: `${t.time}${t.cost !== "—" ? ` · typical cost ${t.cost}` : ""} · ${t.skill ? "needs a " + D.SKILLS.find((s) => s.key === t.skill).name + " roll" : "no roll needed"}.`, text: `availability ${t.key} ${t.time} purchase` });
  idx.push({ cat: "Advancement", name: "Selling on the black market", desc: D.ACQUISITION.selling.note, text: "sell selling black market chinyen payout" });
  return idx;
}
const attrName = (k) => (k === "MANEUVER" ? "Maneuverability" : D.ATTRIBUTES.find((a) => a.key === k)?.name || k);
const natLabel = (n) => (n === "any" ? "Any" : n === "human" ? "Human only" : "Replicant only");

// ---- SETTINGS -------------------------------------------------------------
export function renderSettings(mount) {
  clear(mount);
  const rows = el("div", { class: "settings" });
  rows.append(toggleRow("Dark theme", "Neo-noir dark, or switch to light.", Settings.theme() === "dark",
    (on) => { Settings.set("theme", on ? "dark" : "light"); applyTheme(); }));
  for (const t of TOGGLES) {
    rows.append(toggleRow(t.label, t.desc, !!Settings.get(t.key), (on) => { Settings.set(t.key, on); showToast(`${t.label} ${on ? "on" : "off"}`); navigate(location.hash.slice(1) || "settings"); }));
  }
  bindSyncRerender();
  mount.append(screen("Settings & About",
    accountSection(),
    rows,
    el("div", { class: "card" },
      el("div", { class: "card__title" }, "App version"),
      el("p", { class: "muted" }, "The app updates itself from GitHub when a new version is deployed — you get a toast with an Update button. Check by hand here."),
      el("button", { class: "btn btn--ghost", onClick: async (e) => {
        const b = e.currentTarget;
        b.disabled = true; b.textContent = "Checking…";
        const waiting = await checkForUpdates();
        b.disabled = false; b.textContent = "Check for updates";
        if (waiting) showToast("A new version is ready.", { timeout: 0, action: { label: "Update now", onClick: applyUpdate } });
        else showToast("You're on the latest version.");
      } }, "Check for updates")),
    el("div", { class: "card" },
      el("div", { class: "card__title" }, "How to Play"),
      el("p", { class: "muted" }, "Step-by-step walkthroughs for running a case solo or at a table, plus a cheat sheet."),
      el("button", { class: "btn btn--ghost", onClick: () => navigate("tutorial") }, "Open the tutorial →")),
    el("div", { class: "about muted" },
      el("p", {}, `${D.META.game} · ${D.META.scope}`),
      el("p", {}, "A personal play aid built from your own rulebooks. Numbers and mechanics are extracted; flavor text is paraphrased. Not affiliated with or endorsed by the publisher or rights-holders."))));
}
function toggleRow(label, desc, checked, onChange) {
  const input = el("input", { type: "checkbox", class: "switch__input", checked: checked || null });
  input.addEventListener("change", () => onChange(input.checked));
  return el("label", { class: "settings__row" },
    el("span", { class: "settings__text" }, el("span", { class: "settings__label" }, label), el("span", { class: "settings__desc muted" }, desc)),
    el("span", { class: "switch" }, input, el("span", { class: "switch__track" })));
}

// ---- ACCOUNT & CAMPAIGN (Phase 5 sync) ------------------------------------
let syncReRenderBound = false;
function bindSyncRerender() {
  if (syncReRenderBound || !Sync.enabled) return;
  syncReRenderBound = true;
  const refresh = () => { const r = location.hash.slice(1) || "home"; if (r === "settings" || r === "home") navigate(r); };
  Sync.onStatus(refresh); Sync.onParty(refresh);
}

function accountSection() {
  const card = el("div", { class: "card" }, el("h2", { class: "sheet__section" }, "Account & Campaign"));
  if (!Sync.enabled) {
    card.append(el("p", { class: "muted" }, "Cloud sync is off — everything is stored locally on this device. To play with a shared party and combat tracker, add your Firebase keys to firebase-config.js and set FIREBASE_ENABLED = true (see README)."));
    return card;
  }
  if (!Sync.ready) { card.append(el("p", { class: "muted" }, "Connecting to cloud sync…")); return card; }

  card.append(el("div", { class: "muted sheet__note" }, `Signed in: ${accountLabel()}`));
  if (accountLabel().startsWith("Anonymous"))
    card.append(el("button", { class: "btn btn--sm", onClick: async () => { const r = await linkGoogle(); showToast(r.ok ? "Google account linked." : `Link failed: ${r.error}`, { kind: r.ok ? "info" : "error" }); } }, "Link Google account (cross-device backup)"));

  if (Sync.inCampaign) {
    card.append(el("div", { class: "muted sheet__note" }, `Role: ${Sync.role === "gm" ? "Game Runner" : "Player"}`));
    if (Sync.joinCode) card.append(el("div", { class: "joincode" }, "Join code: ", el("strong", {}, Sync.joinCode)));
    card.append(partyList());
    const active = Store.getActive();
    if (active && active.campaignId !== Sync.campaignId)
      card.append(el("button", { class: "btn btn--sm", onClick: () => { const c = { ...active, campaignId: Sync.campaignId, owner: Sync.uid }; Store.save(c); showToast(`${active.name} shared with the party.`); navigate("settings"); } }, `Share “${active.name}” with the party`));
    card.append(el("button", { class: "btn btn--sm btn--ghost", onClick: async () => { if (await confirmModal("Leave this campaign?", { title: "Leave campaign", okLabel: "Leave" })) { await leaveCampaign(); showToast("Left the campaign."); navigate("settings"); } } }, "Leave campaign"));
  } else {
    const actions = el("div", { class: "rec-actions" },
      el("button", { class: "btn btn--sm", onClick: async () => { const name = await promptModal("Campaign name", { title: "New campaign", okLabel: "Create" }); if (name == null) return; const r = await createCampaign(name); showToast(r.ok ? `Campaign created — join code ${r.code}` : `Failed: ${r.error}`, { kind: r.ok ? "info" : "error", timeout: 6000 }); navigate("settings"); } }, "Create a campaign"),
      el("button", { class: "btn btn--sm", onClick: async () => { const code = await promptModal("Enter the three-word join code", { title: "Join campaign", okLabel: "Join", placeholder: "neon-owl-sector" }); if (!code) return; const r = await joinCampaign(code); showToast(r.ok ? "Joined the campaign." : `Failed: ${r.error}`, { kind: r.ok ? "info" : "error" }); navigate("settings"); } }, "Join with a code"));
    card.append(actions);
  }
  return card;
}
let partyOff = null;   // one live party listener at a time (re-rendering Settings must not stack them)
function partyList() {
  const wrap = el("div", { class: "party" });
  if (partyOff) { partyOff(); partyOff = null; }
  partyOff = Sync.onParty((members) => {
    if (!wrap.isConnected) { partyOff?.(); partyOff = null; return; }
    clear(wrap);
    if (!members.length) { wrap.append(el("span", { class: "muted" }, "No members yet.")); return; }
    for (const m of members) wrap.append(el("span", { class: "pip" }, `${m.displayName || "Blade Runner"}${m.role === "gm" ? " · GM" : ""}`));
  });
  wrap.append(el("span", { class: "muted" }, "Loading party…"));
  return wrap;
}

// ---- PARTY BANNER ---------------------------------------------------------
// Shows the current campaign on the Home screen (null in local-only mode).
export function renderPartyBanner() {
  if (!Sync.enabled || !Sync.inCampaign) return null;
  return el("div", { class: "card card--active" },
    el("div", { class: "card__eyebrow" }, "Campaign"),
    el("div", { class: "muted" }, `${Sync.role === "gm" ? "Running" : "Playing"} · join code ${Sync.joinCode || "—"}`));
}
