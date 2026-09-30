// screens.js — top-level screen renderers (home / characters / rules / settings)
// + party banner. Wizard, sheet, combat, gm, solo mount from their own modules.
import { el, clear, icon, titleCase } from "./core.js";
import { emblem, natureMark, portraitPlaceholder, ringGauge } from "./art.js";
import * as D from "../data.js";
import * as S from "../data-solo.js";
import { NPCS, NPC_BUILD } from "../data-npcs.js";
import { Store, RollLog } from "./store.js";
import { Settings, TOGGLES, THEMES, TEXT_SIZES } from "./settings.js";
import { showToast, promptModal, confirmModal, rollLogCard, openShortcuts } from "./ui.js";
import { maxHealth, maxResolve } from "./derived.js";
import { navigate } from "./router.js";
import { Sync, linkGoogle, createCampaign, joinCampaign, leaveCampaign, accountLabel, retrySync } from "./sync.js";
import { checkForUpdates, applyUpdate } from "./update.js";

function screen(title, ...blocks) {
  return el("section", { class: "screen" }, el("h1", { class: "screen__title" }, title), ...blocks);
}

// ---- HOME -----------------------------------------------------------------
export function renderHome(mount) {
  clear(mount);
  const chars = Store.list();
  const active = Store.getActive();
  const rerender = () => renderHome(mount);
  // The app bar already names the app, so Home's heading is for screen readers
  // and the one-line description sits under it quietly.
  const body = el("section", { class: "screen" },
    el("h1", { class: "visually-hidden" }, "Blade Runner Player"),
    el("p", { class: "muted small home-tagline" }, "A player companion for the Blade Runner RPG — create Blade Runners, track cases, and roll the dice."),
    renderPartyBanner(),
    startHereCard(chars, rerender),
    active ? heroCard(active) : el("div", { class: "card" },
          el("p", {}, "No active character yet."),
          el("button", { class: "btn btn--primary", onClick: () => navigate("wizard") }, "Create a Blade Runner")),
    el("div", { class: "home-grid" },
      tile("Characters", `${chars.length} saved`, () => navigate("characters"), "people"),
      tile("New Blade Runner", "Creation wizard", () => navigate("wizard"), "pen"),
      tile("How to Play", "Solo & table tutorial", () => navigate("tutorial"), "book"),
      tile("Rules Library", "Searchable reference", () => navigate("rules"), "library"),
      tile("Combat Tracker", "Initiative & vitals", () => navigate("combat"), "attack"),
      Settings.solo() ? tile("Play", "Guided solo — one question at a time", () => navigate("solo"), "play") : null,
      Settings.gm() ? tile("GM Screen", "Run the table", () => navigate("gm"), "gm") : null,
      tile("Settings", "Theme & toggles", () => navigate("settings"), "settings"),
    ),
  );
  const rolls = RollLog.list();
  if (rolls.length) {
    body.append(rollLogCard({ emptyHint: "Open sheet and roll something.",
      open: false,
      entries: rolls.slice(0, 20).map((e) => (e.charName ? { ...e, label: `${e.charName} · ${e.label}` } : e)),
      onDelete: (e) => { RollLog.remove(e.id); renderHome(mount); },
      onClear: async () => { if (await confirmModal("Clear the entire roll log?", { title: "Clear roll log", danger: true })) { RollLog.clear(); renderHome(mount); } },
    }));
  }
  mount.append(body);
}
// First-run guidance. A newcomer lands on a screen of equal-looking tiles with
// no idea that Solo Mode is a toggle, or which order to do things in — so until
// they have a character (or dismiss it) the path is spelled out.
const ONBOARD_KEY = "brp:onboarded";
const dismissed = () => { try { return localStorage.getItem(ONBOARD_KEY) === "1"; } catch { return false; } };
function startHereCard(chars, rerender) {
  if (chars.length || dismissed()) return null;
  const solo = Settings.solo();
  const step = (n, title, text, label, onClick, done) => el("li", { class: "start__step" + (done ? " start__step--done" : "") },
    el("span", { class: "start__n" }, done ? "✓" : String(n)),
    el("span", { class: "start__body" },
      el("span", { class: "start__title" }, title),
      el("span", { class: "start__text muted" }, text),
      label ? el("button", { class: "btn btn--sm" + (done ? " btn--ghost" : " btn--primary"), onClick }, label) : null));
  return el("div", { class: "card card--active start" },
    el("div", { class: "card__eyebrow" }, "New here?"),
    el("div", { class: "card__title" }, "Start here"),
    el("p", { class: "muted" }, "You don't need the rulebook, and you don't need to have played one of these before. One button: the app turns on what it needs, rolls you a detective if you have none, and then asks you one question at a time."),
    el("div", { class: "btn-row" },
      el("button", { class: "btn btn--primary", onClick: () => {
        // The whole cold start, in one press: solo on, a detective, then play.
        if (!solo) Settings.set("solo", true);
        if (!Store.getActive()) { showToast("Roll a detective — then press ▶ Play in the Solo tab."); navigate("wizard"); return; }
        try { const st = JSON.parse(localStorage.getItem("brp:solo") || "{}"); st.panel = "play"; localStorage.setItem("brp:solo", JSON.stringify(st)); } catch {}
        navigate("solo");
      } }, "▶ Just start playing")),
    el("p", { class: "muted small" }, "It walks you through a whole case — where to go, what to do there, what you found, and how it ends. Nothing to read first."),
    el("details", { class: "rules__group" },
      el("summary", {}, "I'd rather set it up myself"),
      el("ol", { class: "start__list" },
        step(1, "Read the walkthrough", "How to Play explains the whole loop — what to press, and when.", "Open How to Play", () => navigate("tutorial")),
        step(2, "Playing on your own? Turn on Solo Mode", "It adds a Solo tab that takes the Game Runner's job: dice answer your questions.",
          solo ? "Solo Mode is on" : "Turn on Solo Mode",
          // navigate() re-renders through the router, so the Solo tab appears in
          // the bottom nav immediately — a local rerender would only redraw Home.
          () => { Settings.set("solo", !solo); showToast(solo ? "Solo Mode off." : "Solo Mode on — see the Solo tab."); navigate("home"); }, solo),
        step(3, "Create a Blade Runner", "The wizard walks it; every step can be rolled for you if you'd rather not choose.", "Create a Blade Runner", () => navigate("wizard")))),
    el("button", { class: "btn btn--ghost btn--sm", onClick: () => { try { localStorage.setItem(ONBOARD_KEY, "1"); } catch {} rerender(); } }, "Hide this"));
}
const archLabel = (key) => (key ? (D.ARCHETYPES.find((a) => a.key === key)?.name || titleCase(key)) : "No archetype");
function tile(title, sub, onClick, iconName) {
  return el("button", { class: "tile", onClick },
    iconName ? el("span", { class: "tile__icon" }, icon(iconName)) : null,
    el("span", { class: "tile__title" }, title), el("span", { class: "tile__sub muted" }, sub));
}
// The active character, front and centre: face, name, vitals, and the two
// places you are most likely going next.
function heroCard(ch) {
  const face = ch.identity?.portraitUrl
    ? el("img", { class: "hero__portrait", src: ch.identity.portraitUrl, alt: "" })
    : portraitPlaceholder(ch.name, "hero__portrait");
  let caseOpen = null;
  try { caseOpen = JSON.parse(localStorage.getItem("brp:solo") || "{}").caseOpen || null; } catch { /* storage best-effort */ }
  return el("div", { class: "card card--hero hero" },
    el("div", { class: "hero__row" }, face,
      el("div", { class: "hero__id" },
        el("div", { class: "card__eyebrow" }, "Active character"),
        el("div", { class: "card__title" }, ch.name),
        el("div", { class: "muted hero__kind" }, natureMark(ch.nature), emblem(ch.archetype), `${titleCase(ch.nature)} · ${archLabel(ch.archetype)}`))),
    el("div", { class: "hero__gauges" },
      ringGauge(ch.state.health, maxHealth(ch), "health", "Health"),
      ringGauge(ch.state.resolve, maxResolve(ch), "resolve", "Resolve"),
      el("span", { class: "hero__pts" },
        el("span", { class: "pip" }, icon("badge"), `PP ${ch.state.promotionPoints}`),
        el("span", { class: "pip" }, icon("coin"), `¥ ${ch.state.chinyenPoints}`))),
    el("div", { class: "btn-row hero__actions" },
      el("button", { class: "btn btn--primary", onClick: () => navigate("sheet") }, "Open sheet"),
      Settings.solo() && caseOpen && !ch.state?.dead
        ? el("button", { class: "btn btn--roll", onClick: () => navigate("solo") }, `▶ Pick up case #${caseOpen.no}`)
        : null));
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
  if (!chars.length) list.append(el("p", { class: "muted empty empty--people" }, "No characters yet. Create your first Blade Runner."));
  const activeId = Store.getActiveId();
  for (const ch of chars) {
    const face = ch.identity?.portraitUrl
      ? el("img", { class: "char-row__face", src: ch.identity.portraitUrl, alt: "" })
      : portraitPlaceholder(ch.name, "char-row__face");
    list.append(el("button", { class: "list__row char-row" + (ch.id === activeId ? " char-row--active" : ""), "aria-current": ch.id === activeId ? "true" : null,
      onClick: () => { Store.setActiveId(ch.id); navigate("sheet"); } },
      face,
      el("span", { class: "char-row__body" },
        el("span", { class: "list__main" }, ch.name, ch.state?.dead ? el("span", { class: "badge badge--danger char-row__badge" }, "☠ Deceased") : null,
          ch.id === activeId ? el("span", { class: "tag tag--sm char-row__badge" }, "Active") : null),
        el("span", { class: "list__sub muted char-row__kind" }, natureMark(ch.nature), emblem(ch.archetype), `${titleCase(ch.nature)} · ${archLabel(ch.archetype)}${ch.state?.dead ? " · deceased" : ""}`),
        ch.state && !ch.state.dead ? vitalsPips(ch) : null)));
  }
  mount.append(screen("Characters",
    el("button", { class: "btn btn--primary", onClick: () => navigate("wizard") }, "＋ New Blade Runner"),
    list));
}

// ---- RULES LIBRARY (searchable) -------------------------------------------
export function renderRules(mount) {
  clear(mount);
  const results = el("div", { class: "rules" });
  const detail = el("aside", { class: "rules__detail", "aria-live": "polite" });
  const search = el("input", { class: "input", type: "search", placeholder: "Search skills, specialties, gear, conditions…", "aria-label": "Search rules" });
  const count = el("span", { class: "rules__count muted" });
  const index = buildRulesIndex();
  const cats = [...new Set(index.map((r) => r.cat))];
  let cat = null;          // a category chip narrows the list; null = all
  let selected = null;     // wide screens: the entry shown in the detail pane
  const chipRow = el("div", { class: "chips rules__cats", role: "group", "aria-label": "Categories" });
  const paintChips = () => {
    chipRow.replaceChildren(...[null, ...cats].map((c) => el("button", {
      class: "chip chip--sm" + (cat === c ? " chip--on" : ""), "aria-pressed": cat === c ? "true" : "false",
      onClick: () => { cat = c; paintChips(); run(search.value); } }, c || "All")));
  };
  // Mark every occurrence of the query inside a label, as text nodes + <mark>.
  const marked = (text, q) => {
    if (!q) return [text];
    const out = []; const low = text.toLowerCase(); let i = 0, j;
    while ((j = low.indexOf(q, i)) !== -1) { out.push(text.slice(i, j), el("mark", {}, text.slice(j, j + q.length))); i = j + q.length; }
    out.push(text.slice(i));
    return out;
  };
  const body = (it, q) => it.stats
    ? el("dl", { class: "stat-lines" }, ...it.stats.flatMap(([k, v]) => [el("dt", {}, k), el("dd", {}, ...marked(String(v), q))]))
    : marked(it.desc, q);
  const paintDetail = (it) => {
    detail.replaceChildren(it
      ? el("div", { class: "card" }, el("div", { class: "card__eyebrow" }, it.cat), el("h2", { class: "card__title" }, it.name),
          el("div", { class: "rules__desc" }, ...[body(it, "")].flat()))
      : el("p", { class: "muted" }, "Pick an entry to read it here."));
  };
  function run(q) {
    clear(results);
    const query = q.trim().toLowerCase();
    const hits = index.filter((r) => (!cat || r.cat === cat) && (!query || r.text.toLowerCase().includes(query)));
    count.textContent = query || cat ? `${hits.length} result${hits.length === 1 ? "" : "s"}` : "";
    const byCat = {};
    for (const h of hits) (byCat[h.cat] ||= []).push(h);
    if (!hits.length) { results.append(el("p", { class: "muted" }, "No matches.")); return; }
    for (const [c, items] of Object.entries(byCat)) {
      const group = el("details", { class: "rules__group", open: query || cat ? true : c === "Glossary" });
      group.append(el("summary", {}, `${c} (${items.length})`));
      for (const it of items) {
        const row = el("div", { class: "rules__item" + (selected === it ? " rules__item--on" : ""), tabindex: "0",
          onClick: () => { selected = it; paintDetail(it); results.querySelectorAll(".rules__item--on").forEach((n) => n.classList.remove("rules__item--on")); row.classList.add("rules__item--on"); } },
          el("div", { class: "rules__name" }, ...marked(it.name, query)),
          el("div", { class: "rules__desc muted" }, ...[body(it, query)].flat()));
        row.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); row.click(); } });
        group.append(row);
      }
      results.append(group);
    }
  }
  search.addEventListener("input", () => run(search.value));
  paintChips();
  paintDetail(null);
  mount.append(screen("Rules Library",
    el("p", { class: "muted" }, "Everything the app knows, searchable. New to the game? Open Glossary first — it explains the words the rest of the app uses."),
    el("div", { class: "rules__bar" }, el("div", { class: "rules__search" }, search, count), chipRow),
    el("div", { class: "rules-layout" }, results, detail)));
  run("");
}

function buildRulesIndex() {
  const idx = [];
  // Plain-language vocabulary first: a newcomer searching "push" or "Shift"
  // should land on an explanation, not on a weapon stat line.
  for (const g of D.GLOSSARY) idx.push({ cat: "Glossary", name: g.term, desc: g.text, text: `${g.term} ${g.text}` });
  for (const s of D.SKILLS) idx.push({ cat: "Skills", name: `${s.name} (${attrName(s.attr)})`, desc: s.blurb, text: `${s.name} ${s.blurb}` });
  for (const s of D.SPECIALTIES) idx.push({ cat: "Specialties", name: s.name, desc: s.text, text: `${s.name} ${s.text}` });
  for (const c of D.CONDITIONS) idx.push({ cat: "Conditions", name: c.name, desc: c.text, text: `${c.name} ${c.text}` });
  for (const w of [...D.WEAPONS_MELEE, ...D.WEAPONS_RANGED, ...D.EXPLOSIVES]) {
    const rng = w.minRange ? ` · ${titleCase(w.minRange)}–${titleCase(w.maxRange)}` : (w.maxRange ? ` · ≤${titleCase(w.maxRange)}` : "");
    const crit = w.critDie ? ` · Crit ${w.critDie === "STR" ? "STR" : "D" + w.critDie}` : "";
    const dmg = w.damage != null ? `Damage ${w.damage}` : (w.note || "Special");
    // The same facts as a key/value grid, so a stat line can be scanned column by column.
    const stats = [["Dmg", w.damage != null ? w.damage : (w.note || "Special")], ...(w.critDie ? [["Crit", w.critDie === "STR" ? "STR" : "D" + w.critDie]] : []),
      ...(w.type && w.damage != null ? [["Type", titleCase(w.type)]] : []), ...(rng ? [["Range", rng.replace(/^ · /, "")]] : []),
      ...(w.fullAuto ? [["Auto", "Full auto"]] : []), ["Avail", w.avail], ["Cost", w.cost]];
    idx.push({ cat: "Weapons", name: w.name, stats, desc: `${dmg}${crit}${w.type && w.damage != null ? " · " + titleCase(w.type) : ""}${rng}${w.fullAuto ? " · full auto" : ""} · ${w.avail} (cost ${w.cost})`, text: `${w.name} ${w.type || ""} weapon ${w.blastPower ? "explosive grenade" : ""}` });
  }
  for (const a of D.ARMOR) idx.push({ cat: "Armor & Gear", name: a.name, desc: `${a.rating ? "Armor " + a.rating + " · " : ""}${a.note || ""} ${a.avail} (cost ${a.cost})`.trim(), text: `${a.name} armor ${a.note || ""}` });
  for (const g of D.GEAR) idx.push({ cat: "Armor & Gear", name: g.name, desc: `${g.text} · ${g.avail} (cost ${g.cost})`, text: `${g.name} ${g.text} gear` });
  for (const g of D.AUGMENTATIONS) idx.push({ cat: "Augmentations", name: g.name, desc: `${g.text} · ${g.avail} (cost ${g.cost})`, text: `${g.name} ${g.text} implant augmentation` });
  for (const a of D.ARCHETYPES) idx.push({ cat: "Archetypes", name: a.name, desc: `Key ${attrName(a.keyAttr)} · ${a.keySkills.map((k) => D.SKILLS.find((s) => s.key === k)?.name).join(", ")} · Chinyen D${a.chinyenDie} · ${natLabel(a.nature)}`, text: `${a.name} archetype ${a.blurb}` });
  for (const [label, text] of [["Average human", NPC_BUILD.averageHuman], ["Typical Replicant", NPC_BUILD.typicalReplicant], ["Replicant NPCs", NPC_BUILD.replicantNpcRule]])
    idx.push({ cat: "NPCs", name: `Building an NPC: ${label}`, desc: text, text: `building an npc stat block ${label} ${text}` });
  for (const n of NPCS) idx.push({ cat: "NPCs", name: n.name, desc: `STR ${n.attrs.STR} AGI ${n.attrs.AGI} INT ${n.attrs.INT} EMP ${n.attrs.EMP} · Health ${n.health} · ${n.gear.join(", ") || "—"}`, text: `${n.name} npc` });
  // Combat & movement reference
  for (const r of D.RANGES) idx.push({ cat: "Combat", name: `Range: ${r.name}`, desc: r.desc, text: `${r.name} range zone distance` });
  for (const a of D.COMBAT_ACTIONS) idx.push({ cat: "Combat", name: a.action, desc: `Requires ${a.prereq}${a.skill ? ` · rolls ${D.SKILLS.find((s) => s.key === a.skill)?.name}` : " · no roll"}`, text: `${a.action} combat action ${a.prereq}` });
  for (const [rating, v] of Object.entries(D.BLAST_POWER))
    idx.push({ cat: "Combat", name: `Blast Power ${rating}`, desc: `Damage ${v.damage} · Crit D${v.critDie}. Explosives and vehicle weapons are rated by Blast Power.`, text: `blast power ${rating} explosive grenade charge damage` });
  for (const [unit, text] of Object.entries(D.TIME_UNITS))
    idx.push({ cat: "Combat", name: `Time: one ${unit}`, desc: text, text: `time one ${unit} scale duration how long ${text}` });
  idx.push({ cat: "Combat", name: "Initiative", desc: `Draw once from ${D.INITIATIVE_CARDS} cards; act low→high; the order holds for the whole fight.`, text: "initiative cards order surprise ambush" });
  idx.push({ cat: "Combat", name: "Armor", desc: `When hit, roll ${D.ARMOR_DICE} dice of the armor's rating; each success stops ${D.ARMOR_DAMAGE_PER_SUCCESS} damage. Stop it all and the critical injury is negated too. One suit only.`, text: "armor rating damage reduction protection" });
  // Solo Mode oracles — reachable from the Solo tab, but a player looking up
  // "Scene Check" in the library should find the table, not just the glossary.
  const band = (r) => { const [lo, hi] = r.range || [r.min, r.max]; return lo === hi ? `${lo}` : `${lo}–${hi}`; };
  for (const r of S.SCENE_CHECK) idx.push({ cat: "Solo Mode", name: `Scene Check ${band(r)}`, desc: `${r.result}${r.detail ? ` — ${r.detail}` : ""}`, text: `scene check solo ${band(r)} ${r.result} ${r.detail || ""}` });
  for (const r of S.QUESTION_CHECK) idx.push({ cat: "Solo Mode", name: `Question Check ${band(r)}`, desc: r.result, text: `question check solo yes no ${band(r)} ${r.result}` });
  S.CRITICAL_SUCCESS.forEach((c, i) => idx.push({ cat: "Solo Mode", name: `Critical Success ${i + 1}: ${c.name}`, desc: `${c.text} ${c.bonus}`, text: `critical success solo ${c.name} ${c.text}` }));
  S.SCENE_CATEGORIES.forEach((c, i) => idx.push({ cat: "Solo Mode", name: `Scene ${i + 1}: ${c.name}`, desc: `${c.detail} · ${c.skills.join(", ")}`, text: `scene category solo ${c.name} ${c.detail}` }));
  for (const r of S.NPC_SKILL_LEVEL) idx.push({ cat: "Solo Mode", name: `NPC skill ${band(r)}`, desc: `${r.name} — ${r.dice}`, text: `npc skill level solo ${band(r)} ${r.name}` });
  for (const r of S.NPC_TACTICS) idx.push({ cat: "Solo Mode", name: `NPC tactics: ${r.name}`, desc: r.behavior, text: `npc tactics solo ${r.name} ${r.behavior}` });
  idx.push({ cat: "Solo Mode", name: "Countdown Event Timer", desc: D.GLOSSARY.find((g) => g.term === "Countdown Event Check")?.text || S.COUNTDOWN_TIMER.note, text: "countdown event timer solo escalate" });
  idx.push({ cat: "Solo Mode", name: "Hypothesis Check", desc: `${S.HYPOTHESIS_CHECK.crit.name} ${S.HYPOTHESIS_CHECK.crit.pp} PP · ${S.HYPOTHESIS_CHECK.success.name} +${S.HYPOTHESIS_CHECK.success.pp} PP · ${S.HYPOTHESIS_CHECK.failure.name} ${S.HYPOTHESIS_CHECK.failure.pp} PP. Cannot be pushed.`, text: "hypothesis check solo promotion points" });
  for (const m of S.CASE_START_METHODS) idx.push({ cat: "Solo Mode", name: `Opening a case: ${m.name}`, desc: m.text, text: `start case solo ${m.name} ${m.text}` });

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
  const modes = el("div", { class: "settings" });
  for (const t of TOGGLES) {
    modes.append(toggleRow(t.label, t.desc, !!Settings.get(t.key), (on) => { Settings.set(t.key, on); showToast(`${t.label} ${on ? "on" : "off"}`); navigate(location.hash.slice(1) || "settings"); }));
  }
  bindSyncRerender();
  mount.append(screen("Settings & About",
    group("Play modes", modes),
    group("Appearance", themeControl(), textSizeControl()),
    group("Account & campaign", accountSection()),
    group("App",
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
        el("button", { class: "btn btn--ghost", onClick: () => navigate("tutorial") }, "Open the tutorial →"),
        el("button", { class: "btn btn--ghost only-fine-pointer", onClick: openShortcuts }, "Keyboard shortcuts (?)")),
      el("div", { class: "about muted" },
        el("p", {}, `${D.META.game} · ${D.META.scope}`),
        el("p", {}, "A personal play aid built from your own rulebooks. Numbers and mechanics are extracted; flavor text is paraphrased. Not affiliated with or endorsed by the publisher or rights-holders.")))));
}
// An inset group: eyebrow heading over a stack of rows/cards.
function group(title, ...blocks) {
  return el("section", { class: "settings-group", "aria-label": title },
    el("h2", { class: "eyebrow settings-group__title" }, title), ...blocks);
}
const THEME_LABELS = { dark: "Dark", light: "Light", system: "System" };
function themeControl() {
  const current = Settings.theme();
  const seg = el("div", { class: "segmented", role: "group", "aria-label": "Theme" });
  for (const t of THEMES) {
    seg.append(el("button", {
      class: "segmented__opt" + (t === current ? " segmented__opt--on" : ""),
      "aria-pressed": t === current ? "true" : "false",
      onClick: () => { Settings.setTheme(t); renderSettings(mount()); },
    }, THEME_LABELS[t]));
  }
  return el("div", { class: "settings__row settings__row--static" },
    el("span", { class: "settings__text" },
      el("span", { class: "settings__label" }, "Theme"),
      el("span", { class: "settings__desc muted" }, "Neo-noir dark, noir-by-day light, or follow your device.")),
    seg);
}
function textSizeControl() {
  const current = Settings.textSize();
  const seg = el("div", { class: "segmented", role: "group", "aria-label": "Text size" });
  for (const t of TEXT_SIZES) {
    seg.append(el("button", {
      class: "segmented__opt" + (t === current ? " segmented__opt--on" : ""),
      "aria-pressed": t === current ? "true" : "false",
      "aria-label": `Text size ${t}%`,
      onClick: () => { Settings.set("textSize", t); renderSettings(mount()); },
    }, el("span", { class: `textsize-a textsize-a--${t}`, "aria-hidden": "true" }, "A"), ` ${t}%`));
  }
  return el("div", { class: "settings__row settings__row--static" },
    el("span", { class: "settings__text" },
      el("span", { class: "settings__label" }, "Text size"),
      el("span", { class: "settings__desc muted" }, "Makes every word and control larger. The layout reflows to fit.")),
    seg);
}
const mount = () => document.getElementById("screen");
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
  if (!Sync.ready) {
    if (Sync.failed) {
      // The raw reason goes in the tooltip: some of them are long unbroken URLs,
      // which is a horizontal-overflow hazard at 360px.
      card.append(el("p", { class: "muted", title: Sync.error || "" },
        "Cloud sync could not connect — you are offline, or the connection is blocked. The app works fully on this device: characters, cases and rolls are all stored locally."));
      card.append(el("button", { class: "btn btn--sm", onClick: async () => {
        showToast("Trying to reach cloud sync…");
        const ok = await retrySync();
        showToast(ok ? "Cloud sync connected." : "Still no connection — carrying on locally.", { kind: ok ? "info" : "warn" });
        navigate("settings");
      } }, "Try again"));
    } else card.append(el("p", { class: "muted" }, "Connecting to cloud sync…"));
    return card;
  }

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
