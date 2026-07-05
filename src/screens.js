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
function partyList() {
  const wrap = el("div", { class: "party" });
  Sync.onParty((members) => {
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
