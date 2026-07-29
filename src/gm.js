// gm.js — GM Screen, organized by phase of play  [Phase 6]
// Gated by Settings.gm(); mounted at route #gm. State in brp:gm.
// Segmented sub-nav, in the order a session runs (remembers last panel):
//   Prep (build the case) · Play (party + scene dressing) · Fight · Wrap · Notes.
// Oracle/generator rolls drop their result INLINE in the card that made it (with
// Reroll / Pin / dismiss, plus a per-tab clear) and record a labeled Roll Log
// entry; results pin (📌) to the GM Scratchpad.

import * as GM from "../data-gm.js";
import * as D from "../data.js";
import { NPCS } from "../data-npcs.js";
import { Store, Combat, RollLog } from "./store.js";
import { maxHealth, maxResolve, reclampVitals } from "./derived.js";
import { archetype } from "./rules.js";
import { el, sectionTitle, segmentNav, resultSlot, renderToHtml, rollLogCard, modal, showToast, confirmModal, appendToNotes } from "./ui.js";
import { rollDie, uid, titleCase, clear } from "./core.js";
import { lookupRange } from "./rules.js";
import { navigate } from "./router.js";

const GM_KEY = "brp:gm";
const LOG_CAP = 50;
const RESULT_HISTORY = 3;   // results kept per card, so draws can be compared
const LOOSE = "__panel";    // bucket for rolls fired outside any card
const MANUAL_CONDITIONS = D.CONDITIONS.filter((c) => !c.key.startsWith("broken"));
// Panels follow the arc of a session: prep the case, run it, fight, wrap up.
const SEGMENTS = [
  { key: "prep", label: "Prep" },
  { key: "play", label: "Play" },
  { key: "fight", label: "Fight" },
  { key: "wrap", label: "Wrap" },
  { key: "notes", label: "Notes" },
];
// Panel keys renamed when the screen was re-ordered to the session flow.
const LEGACY_PANELS = { party: "play", case: "prep", combat: "fight" };

function readGmState() {
  const base = { scratchpad: "", selectedTheme: "Replicant Crimes & Punishments", log: [], panel: "prep" };
  try {
    const raw = localStorage.getItem(GM_KEY);
    if (raw) {
      const st = { ...base, ...JSON.parse(raw) };
      st.panel = LEGACY_PANELS[st.panel] || st.panel;
      if (!SEGMENTS.some((s) => s.key === st.panel)) st.panel = "prep";
      return st;
    }
  } catch (e) {}
  return base;
}
function writeGmState(st) { try { localStorage.setItem(GM_KEY, JSON.stringify(st)); } catch (e) {} }
// Set by btn() on every click so show() knows which card to drop the result in.
let activeBtn = null;
const cardTitleOf = (node) => node?.closest(".card")?.querySelector(".sheet__section")?.textContent || null;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const archName = (c) => (c.archetype ? (archetype(c.archetype)?.name || c.archetype) : "No archetype");

export function renderGm(mount, rerender) {
  clear(mount);
  const st = readGmState();
  const chars = Store.list();

  const record = (label, text, pin) => {
    st.log = st.log || [];
    st.log.unshift({ id: uid(), label, text, pin: pin || `[${label}] ${text}`, ts: Date.now() });
    if (st.log.length > LOG_CAP) st.log.length = LOG_CAP;
    writeGmState(st);
    try { RollLog.add({ label, text, source: "gm" }); } catch {}
    rerender();
  };
  // Notes read top to bottom — the newest entry lands at the bottom.
  const pinNote = (line) => { st.scratchpad = appendToNotes(st.scratchpad, `• ${line}`); writeGmState(st); showToast("Pinned to the end of your notes."); rerender(); };
  // A roll writes its result into the card that produced it (and the roll log).
  const show = ({ label, text, pin, title, render, slot }) => {
    const pinLine = pin || `[${label}] ${text}`;
    // A roll fired from outside a card (a bare <details>, a stray row) still has
    // to show its result — park it on the panel rather than vanishing into a toast.
    const key = slot || cardTitleOf(activeBtn) || LOOSE;
    if (key) {
      st.results = st.results || {};
      const list = resultList(key);
      list.push({ id: uid(), title: title || label, html: renderToHtml(render), pinLine, ts: Date.now(), btnLabel: activeBtn?.textContent || null });
      while (list.length > RESULT_HISTORY) list.shift();   // keep the last few to compare
      st.results[key] = list;
      writeGmState(st);
    }
    if (st.autoPin && pinLine) st.scratchpad = appendToNotes(st.scratchpad, `• ${pinLine}`);
    record(label, text, pinLine);   // record() rerenders, painting the slot
  };

  mount.append(el("div", { class: "card screen-head" },
    sectionTitle("Game Master Screen"),
    el("p", { class: "muted" }, "Command center — manage the party, build cases, and drop adversaries into combat.")));
  mount.append(el("div", { class: "chips autopin" },
    el("button", {
      class: "chip" + (st.autoPin ? " chip--on" : ""),
      "aria-pressed": st.autoPin ? "true" : "false",
      onClick: () => { st.autoPin = !st.autoPin; writeGmState(st); showToast(st.autoPin ? "Auto-pin on — every roll is written to your notes." : "Auto-pin off."); rerender(); },
    }, `\u{1F4CC} Auto-pin every roll to notes${st.autoPin ? " \u2713" : ""}`)));
  mount.append(segmentNav({ segments: SEGMENTS, active: st.panel, onSelect: (k) => { st.panel = k; writeGmState(st); rerender(); } }));

  const panel = el("div", { class: "panel" });
  ({ prep: panelPrep, play: panelPlay, fight: panelFight, wrap: panelWrap, notes: panelNotes }[st.panel] || panelPrep)(panel);
  paintResults(panel);
  mount.append(panel);

  // Results are kept per card as a short history (oldest first). Older state
  // stored a single object — read it as a one-entry list.
  function resultList(key) {
    const v = st.results?.[key];
    return Array.isArray(v) ? v : v ? [{ id: v.id || "r0", ...v }] : [];
  }

  // Paint each card's results underneath it, and offer a per-tab clear.
  // The Reroll button re-clicks the button that produced the result, so it
  // survives a reload (the handler itself is not serializable).
  function paintResults(panelEl) {
    let live = 0;
    for (const cardEl of panelEl.querySelectorAll(".card")) {
      const key = cardEl.querySelector(".sheet__section")?.textContent;
      const list = key ? resultList(key) : [];
      if (!list.length) continue;
      live += list.length;
      // Oldest first, newest nearest the buttons — the same reading order as
      // the notes and the roll log. Only the newest offers a Reroll.
      list.forEach((r, i) => cardEl.append(resultSlot({
        title: r.title, html: r.html, pinLine: r.pinLine, stamp: r.ts,
        onPin: pinNote,
        onReroll: i === list.length - 1 ? () => {
          const again = [...cardEl.querySelectorAll(".btn")].find((b) => b.textContent === r.btnLabel);
          if (again) again.click();
          else showToast("Roll it again from the buttons above.", { kind: "warn" });
        } : null,
        onDismiss: () => {
          st.results[key] = resultList(key).filter((x) => x.id !== r.id);
          if (!st.results[key].length) delete st.results[key];
          writeGmState(st); rerender();
        },
      })));
    }
    // Results with no owning card hang at the end of the panel.
    for (const r of resultList(LOOSE)) {
      live += 1;
      panelEl.append(resultSlot({ title: r.title, html: r.html, pinLine: r.pinLine, stamp: r.ts, onPin: pinNote,
        onDismiss: () => { st.results[LOOSE] = resultList(LOOSE).filter((x) => x.id !== r.id); if (!st.results[LOOSE].length) delete st.results[LOOSE]; writeGmState(st); rerender(); } }));
    }
    if (!live) return;
    const shown = [...panelEl.querySelectorAll(".card")]
      .map((c) => c.querySelector(".sheet__section")?.textContent)
      .filter((k) => k && resultList(k).length)
      .concat(resultList(LOOSE).length ? [LOOSE] : []);
    panelEl.append(el("div", { class: "btn-row result-clear" },
      btn(`\u2715 Clear ${live === 1 ? "this result" : "these " + live + " results"}`, () => {
        for (const key of shown) delete st.results[key];
        writeGmState(st); rerender();
      }, "sm ghost")));
  }


  // ---- PANELS (in the order a session runs) --------------------------------
  function panelPrep(root) {
    const themeSelect = el("select", { class: "input roll-select" });
    GM.CASE_THEME.forEach((t) => themeSelect.append(el("option", { value: t.theme, selected: t.theme === st.selectedTheme || null }, t.theme)));
    themeSelect.addEventListener("change", () => { st.selectedTheme = themeSelect.value; writeGmState(st); });
    const c = stepCard("Before the session", "Build the case", "Roll the case skeleton: theme, assignment, sector, and the twist that turns it.");
    c.append(el("div", { class: "roll-row" }, el("span", { class: "muted roll-row__label" }, "Theme:"), themeSelect));
    c.append(grid(
      btn("🎲 Theme (D10)", () => { const roll = rollDie(10); const res = lookupRange(GM.CASE_THEME, roll); if (!res) return; st.selectedTheme = res.theme; writeGmState(st); show({ label: "Theme", text: res.theme, pin: `[Theme] ${res.theme}`, title: `Case Theme — ${roll} (D10)`, render: (b) => b.append(el("h3", { class: "roll-result" }, res.theme), el("p", { class: "muted" }, `Assignment uses D${res.die}.`)) }); }),
      btn("🎲 Assignment", () => { const theme = st.selectedTheme || "Replicant Crimes & Punishments"; const list = GM.CASE_ASSIGNMENT[theme] || []; if (!list.length) return; const roll = rollDie(list.length); const t = list[roll - 1]; show({ label: "Assignment", text: t, pin: `[Assignment] ${t}`, title: `Assignment — ${roll} (D${list.length})`, render: (b) => b.append(el("div", { class: "roll-eyebrow" }, theme), el("p", { class: "roll-prose" }, t)) }); }),
      btn("🎲 Sector (D8)", () => { const roll = rollDie(8); const res = lookupRange(GM.CASE_SECTOR, roll); show({ label: "Sector", text: res?.sector || "?", pin: `[Sector] ${res?.sector || "?"}`, title: `Sector — ${roll} (D8)`, render: (b) => b.append(el("h3", { class: "roll-result" }, res?.sector || "Unknown")) }); }),
      btn("🎲 Twist (D12)", () => { const roll = rollDie(12); const t = GM.CASE_TWIST[roll - 1]; show({ label: "Twist", text: t, pin: `[Twist] ${t}`, title: `Case Twist — ${roll} (D12)`, render: (b) => b.append(el("p", { class: "roll-prose" }, t)) }); }),
      btn("⚡ Full Case Briefing", async () => {
        const ok = await confirmModal("Generate a full case briefing and prepend it to the GM Scratchpad?", { title: "Generate Case Briefing" });
        if (!ok) return;
        const th = pick(GM.CASE_THEME), as = pick(GM.CASE_ASSIGNMENT[th.theme] || ["Unknown"]), se = pick(GM.CASE_SECTOR), tw = pick(GM.CASE_TWIST);
        st.scratchpad = appendToNotes(st.scratchpad, `=== CASE BRIEFING (${new Date().toLocaleString()}) ===\n• Theme: ${th.theme}\n• Sector: ${se.sector}\n• Assignment: ${as}\n• Twist: ${tw}`);
        writeGmState(st);
        record("Briefing", `${th.theme} · ${se.sector}`, `[Briefing] ${th.theme} — ${as}`);
        showToast("Case briefing added to scratchpad.");
      }, "primary")));
    root.append(c);

    // Main NPC generator (Case Table 3): D8 type + D6 occupation/quirk/name.
    const rollNpc = () => {
      const t = GM.CASE_MAIN_NPCS[rollDie(8) - 1];
      return { type: t.type, occ: t.occupation[rollDie(6) - 1], quirk: t.quirk[rollDie(6) - 1],
        name: `${t.firstName[rollDie(6) - 1]} ${t.lastName[rollDie(6) - 1]}` };
    };
    const nc = stepCard("Before the session", "Main NPC Generator", `Roll a case NPC — type, occupation, quirk, and name. A case carries ${GM.CASE_MAIN_NPC_COUNT.text}.`);
    nc.append(grid(
      btn("🎲 Main NPC", () => {
        const n = rollNpc();
        show({
          label: "Main NPC", text: `${n.name} · ${n.occ}`, pin: `[NPC] ${n.name} — ${n.occ} (${n.type}); quirk: ${n.quirk}`,
          title: "Main NPC",
          render: (b) => b.append(
            el("h3", { class: "roll-result" }, n.name),
            el("p", {}, `${n.occ} · ${n.type}`),
            el("div", { class: "roll-eyebrow" }, "Quirk"),
            el("p", { class: "muted" }, n.quirk)),
        });
      }),
      // Case Table 3 opens with a count roll: D3+3 main NPCs per case  [§3.16].
      btn("⚡ Full cast", () => {
        const d3 = Math.ceil(rollDie(6) / 2);
        const count = d3 + GM.CASE_MAIN_NPC_COUNT.bonus;
        const cast = Array.from({ length: count }, rollNpc);
        const lines = cast.map((n) => `${n.name} — ${n.occ} (${n.type}); ${n.quirk}`);
        show({
          label: "Main NPCs", text: `${count} NPCs`, pin: `[Cast] ${lines.join(" | ")}`,
          title: `Main cast — D3+${GM.CASE_MAIN_NPC_COUNT.bonus} = ${count}`,
          render: (b) => { for (const l of lines) b.append(el("p", { class: "roll-prose" }, l)); },
        });
      }, "primary")));
    root.append(nc);

    // Case Tables 5 (clues) and 7 (the final confrontation) — seeded while you
    // build the case, not improvised at the table.  [Ch09]
    const seeds = stepCard("Before the session", "Clues & the finale", "What they can find, and where it ends.");
    seeds.append(grid(btn("🎲 Clue (D8)", () => {
        const roll = rollDie(8); const row = lookupRange(GM.CASE_CLUES, roll);
        const detail = row.detailDie ? row.detail[rollDie(row.detailDie) - 1] : null;
        const text = detail ? `${row.type} — ${detail}` : row.type;
        show({ label: "Clue", text, pin: `[Clue] ${text}${row.note ? ` (${row.note})` : ""}`, title: `Clue — ${roll} (D8)`,
          // NB: append() renders a literal "null" for a null child — filter first.
          render: (b) => b.append(...[el("h3", { class: "roll-result" }, row.type),
            detail ? el("p", {}, detail) : null,
            row.note ? el("p", { class: "muted" }, row.note) : null].filter(Boolean)) });
      }),
      btn("🎲 Final Confrontation (D10)", () => {
        const l = rollDie(10), e = rollDie(10);
        const text = `${GM.CASE_FINALE_LOCATION[l - 1]} — ${GM.CASE_FINALE_ENVIRONMENT[e - 1]}`;
        show({ label: "Finale", text, pin: `[Finale] ${text}`, title: `Final Confrontation — ${l}/${e} (D10)`,
          render: (b) => b.append(el("h3", { class: "roll-result roll-result--big" }, GM.CASE_FINALE_LOCATION[l - 1]),
            el("p", { class: "roll-center muted" }, GM.CASE_FINALE_ENVIRONMENT[e - 1])) });
      })));
    root.append(seeds);

    root.append(el("div", { class: "btn-row" }, btn("Case built \u2014 run the session \u2192", () => { st.panel = "play"; writeGmState(st); rerender(); }, "primary")));
  }

  function panelPlay(root) {
    const c = stepCard("During the session", "Live Party Panel", "Monitor and adjust PC vitals, conditions, and resources.");
    if (!chars.length) c.append(el("p", { class: "muted" }, "No player characters yet. Create characters in the wizard to manage them here."));
    const rows = el("div", { class: "party-grid" });   // NB: `grid` is the module button-row helper
    chars.forEach((ch) => {
      const mh = maxHealth(ch), mr = maxResolve(ch), s = ch.state || {};
      const conds = Object.entries(s.conditions || {}).filter(([, v]) => v).map(([k]) => k.replace(/_/g, " ")).join(", ");
      const saveClamp = () => { reclampVitals(ch); Store.save(ch); rerender(); };
      rows.append(el("div", { class: "party-row" },
        el("div", { class: "party-row__head" },
          el("div", {}, el("strong", { class: "party-row__name" }, ch.name), el("span", { class: "muted" }, ` ${archName(ch)} (${titleCase(ch.nature || "human")})`)),
          el("div", { class: "party-row__badges" }, el("span", { class: "pip" }, `PP ${s.promotionPoints || 0}`), el("span", { class: "pip" }, `¥ ${s.chinyenPoints || 0}`), el("span", { class: "pip" }, `HUM ${s.humanityPoints || 0}`))),
        el("div", { class: "party-row__vitals" },
          el("span", { class: "pip pip--health" }, `♥ ${s.health}/${mh}`), el("span", { class: "pip pip--resolve" }, `◈ ${s.resolve}/${mr}`),
          el("span", { class: "muted party-row__conds" }, conds ? `Conditions: ${conds}` : "No conditions")),
        el("div", { class: "party-row__actions" },
          btn("−1 HP", () => { ch.state.health = Math.max(0, (s.health ?? mh) - 1); saveClamp(); }, "sm ghost"),
          btn("＋1 HP", () => { ch.state.health = Math.min(mh, (s.health ?? 0) + 1); saveClamp(); }, "sm ghost"),
          btn("−1 Res", () => { ch.state.resolve = Math.max(0, (s.resolve ?? mr) - 1); saveClamp(); }, "sm ghost"),
          btn("＋1 Res", () => { ch.state.resolve = Math.min(mr, (s.resolve ?? 0) + 1); saveClamp(); }, "sm ghost"),
          btn("Conditions…", () => openConditions(ch, rerender), "sm"),
          btn("Rewards…", () => openRewards(ch, rerender), "sm"))));
    });
    c.append(rows); root.append(c);

    // Improvised at the table: where this scene happens, and what it feels like.
    const dressing = stepCard("During the session", "Scene dressing", "Roll a place they head to unplanned, and the mood of it.  [Case Tables 4 & 8]");
    const sectorSelect = el("select", { class: "input roll-select" });
    GM.CASE_SECTOR.forEach((x) => sectorSelect.append(el("option", { value: x.sector, selected: x.sector === st.selectedSector || null }, x.sector)));
    sectorSelect.addEventListener("change", () => { st.selectedSector = sectorSelect.value; writeGmState(st); });
    dressing.append(el("div", { class: "roll-row" }, el("span", { class: "muted roll-row__label" }, "Sector:"), sectorSelect));
    dressing.append(grid(btn("🎲 Location (D6×D6)", () => {
        const sector = st.selectedSector || pick(GM.CASE_SECTOR).sector;
        const areas = GM.SECTOR_LOCATIONS[sector] || [];
        const a = rollDie(6); const area = lookupRange(areas, a) || areas[0];
        const p2 = rollDie(6); const place = area.places[p2 - 1];
        show({ label: "Location", text: `${place} · ${area.area}`, pin: `[Location] ${place} — ${area.area}, ${sector}`,
          title: `${sector} — area ${a}, place ${p2}`,
          render: (b) => b.append(el("h3", { class: "roll-result" }, place), el("p", { class: "muted" }, `${area.area} · ${sector}`)) });
      }),
      btn("🎲 Mood (D8×3)", () => {
        const w = GM.CASE_MOOD.weather[rollDie(8) - 1];
        const sc = GM.CASE_MOOD.screen[rollDie(8) - 1];
        const pb = GM.CASE_MOOD.passingBy[rollDie(8) - 1];
        show({ label: "Mood", text: `${w} · ${sc} · ${pb}`, pin: `[Mood] ${w}; on screen: ${sc}; passing by: ${pb}`,
          title: "Mood Pieces",
          render: (b) => b.append(el("div", { class: "roll-eyebrow" }, "Weather"), el("p", {}, w),
            el("div", { class: "roll-eyebrow" }, "On that screen"), el("p", {}, sc),
            el("div", { class: "roll-eyebrow" }, "Passing by"), el("p", {}, pb)) });
      })));
    root.append(dressing);

    root.append(el("div", { class: "btn-row" }, btn("Shots fired \u2014 open the fight tools \u2192", () => { st.panel = "fight"; writeGmState(st); rerender(); }, "primary")));
  }

  function panelFight(root) {

    const npcSelect = el("select", { class: "input roll-select" });
    NPCS.forEach((n) => npcSelect.append(el("option", { value: n.key }, `${n.name} (${n.nature}, HP ${n.health})`)));
    const c = stepCard("When it turns violent", "Drop-in Combatant Generator", "Inject a Core Rulebook adversary into the active Combat Tracker.");
    c.append(el("div", { class: "roll-row" }, npcSelect,
      btn("⚔ Drop into Combat", () => {
        const npc = NPCS.find((n) => n.key === npcSelect.value); if (!npc) return;
        const comb = Combat.get(); comb.active = true; comb.combatants = comb.combatants || [];
        comb.combatants.push({ id: uid(), kind: "npc", npcKey: npc.key, name: npc.name, nature: npc.nature || "human", health: npc.health || 5, maxHealth: npc.health || 5, card: null });
        Combat.save(comb); showToast(`Dropped ${npc.name} into the Combat Tracker.`);
      })));
    c.append(el("div", { class: "btn-row" }, btn("Open Combat Tracker →", () => navigate("combat"), "ghost")));
    root.append(c);

    root.append(el("div", { class: "btn-row" }, btn("Fight over \u2014 wrap the session \u2192", () => { st.panel = "wrap"; writeGmState(st); rerender(); }, "primary")));
  }

  function panelWrap(root) {
    // End-of-session awards  [Ch09] — one point per bullet, per character.
    const awards = stepCard("After the session", "Session Awards", `Promotion and Humanity checklists. Five or more Promotion Points in one session earns a distinction from Deputy Chief Holden.`);
    const checklist = (title, items) => {
      const box = el("details", { class: "rules__group" }, el("summary", {}, `${title} (${items.length})`));
      for (const line of items) box.append(el("div", { class: "muted sheet__note" }, "• " + line));
      return box;
    };
    awards.append(checklist("Promotion Points — award one each", GM.PROMOTION_AWARDS));
    awards.append(checklist("Promotion Points — lose one each", GM.PROMOTION_LOSSES));
    awards.append(checklist("Humanity Points — award one each", GM.HUMANITY_AWARDS));
    root.append(awards);

    const after = stepCard("After the session", "Consequences & downtime", "Misconduct catches up, and the crew gets a few hours off.");
    after.append(grid(btn("🎲 Disciplinary (D6)", () => { const roll = rollDie(6); const t = GM.DISCIPLINARY_ACTIONS[roll - 1]; show({ label: "Disciplinary", text: t, pin: `[Disciplinary] ${t}`, title: `Disciplinary — ${roll} (D6)`, render: (b) => b.append(el("p", { class: "roll-prose roll-result--warn" }, t)) }); }),
      btn("🎲 Downtime Event (D8)", () => {
        const roll = rollDie(8); const ev = lookupRange(GM.DOWNTIME_EVENT_CORE, roll);
        show({ label: "Downtime Event", text: `D8→${roll}`, pin: `[Downtime] Home: ${ev.home} / Street: ${ev.street}`,
          title: `Downtime Event — ${roll} (D8)`,
          render: (b) => b.append(el("div", { class: "roll-eyebrow" }, "At home"), el("p", {}, ev.home),
            el("div", { class: "roll-eyebrow" }, "On the street"), el("p", {}, ev.street)) });
      })));
    root.append(after);

    root.append(el("div", { class: "btn-row" }, btn("Prep the next case \u2192", () => { st.panel = "prep"; writeGmState(st); rerender(); }, "primary")));
  }

  function panelNotes(root) {
    root.append(rollLogCard({
      entries: st.log || [],
      pinLabel: "Pin to case notes",
      onPin: (e) => pinNote(e.pin),
      onDelete: (e) => { st.log = (st.log || []).filter((x) => x.id !== e.id); writeGmState(st); rerender(); },
      onClear: async () => { const ok = await confirmModal("Clear the entire roll log?", { title: "Clear Roll Log", danger: true }); if (ok) { st.log = []; writeGmState(st); rerender(); } },
    }));
    const c = card("GM Case Scratchpad & Notes", "Persistent notes, oldest at the top. Pinned rolls and briefings are added at the bottom.");
    const ta = el("textarea", { class: "input notes-area", rows: 12, placeholder: "Record campaign notes, secret twists, and NPC stats..." });
    ta.value = st.scratchpad || "";
    // newest entry is at the bottom — show it
    requestAnimationFrame(() => { ta.scrollTop = ta.scrollHeight; });
    ta.addEventListener("blur", () => { st.scratchpad = ta.value; writeGmState(st); showToast("GM notes saved."); });
    c.append(ta); root.append(c);
  }
}

// ---- modals ---------------------------------------------------------------
function openConditions(c, rerender) {
  modal({ title: `Conditions: ${c.name}`, render(body, close) {
    const list = el("div", { class: "check-list" });
    MANUAL_CONDITIONS.forEach((cond) => {
      const checked = !!c.state.conditions?.[cond.key];
      list.append(el("label", { class: "check-row" },
        el("input", { type: "checkbox", checked: checked || null, onChange: (e) => { if (!c.state.conditions) c.state.conditions = {}; c.state.conditions[cond.key] = e.target.checked; Store.save(c); rerender(); } }),
        el("span", {}, el("strong", {}, cond.name), " — ", el("span", { class: "muted" }, cond.text))));
    });
    body.append(list, el("div", { class: "modal__actions" }, el("button", { class: "btn btn--primary", onClick: () => close() }, "Done")));
  } });
}
function openRewards(c, rerender) {
  modal({ title: `Award Resources: ${c.name}`, render(body, close) {
    const mkRow = (label, key) => {
      const val = el("span", { class: "reward-row__val" }, `${label}: ${c.state[key] || 0}`);
      const bump = (d) => { c.state[key] = Math.max(0, (c.state[key] || 0) + d); Store.save(c); val.textContent = `${label}: ${c.state[key]}`; rerender(); };
      return el("div", { class: "reward-row" }, val, el("div", { class: "btn-row" }, el("button", { class: "btn btn--sm btn--ghost", onClick: () => bump(-1) }, "−1"), el("button", { class: "btn btn--sm", onClick: () => bump(+1) }, "＋1")));
    };
    body.append(mkRow("Promotion Points", "promotionPoints"), mkRow("Chinyen", "chinyenPoints"), mkRow("Humanity Points", "humanityPoints"),
      el("div", { class: "modal__actions" }, el("button", { class: "btn btn--primary", onClick: () => close() }, "Done")));
  } });
}

// ---- small builders -------------------------------------------------------
function card(title, sub, ...children) {
  const c = el("div", { class: "card" }, sectionTitle(title));
  if (sub) c.append(el("p", { class: "muted" }, sub));
  for (const ch of children) if (ch) c.append(ch);
  return c;
}
// A card headed with where it falls in the session.
function stepCard(step, title, sub, ...children) {
  const c = card(title, sub, ...children);
  c.prepend(el("div", { class: "roll-eyebrow step-eyebrow" }, step));
  return c;
}
function grid(...children) { return el("div", { class: "roll-grid" }, ...children.filter(Boolean)); }
function btn(label, onClick, variant = "roll") {
  const cls = "btn " + variant.split(" ").map((v) => (v === "roll" ? "btn--roll" : v === "primary" ? "btn--primary" : v === "ghost" ? "btn--ghost" : v === "sm" ? "btn--sm" : "")).join(" ");
  // Record the button so a result raised by this click knows which card it
  // belongs to (and which button to press again on Reroll).
  const b = el("button", { class: cls.trim(), onClick: (e) => { activeBtn = b; onClick(e); } }, label);
  return b;
}
