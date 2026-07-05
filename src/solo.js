// solo.js — Solo Mode Assistant, organized by phase of play  [Phase 6]
// Gated by Settings.solo(); mounted at route #solo. State in brp:solo.
// A segmented sub-nav swaps one phase panel into view (remembers last panel):
//   Start · Scene · Track · Session · Log & Notes
// Every oracle/generator roll shows a result modal AND records a labeled entry
// in the Roll Log; results pin (📌) to Case Notes.

import * as S from "../data-solo.js";
import * as GM from "../data-gm.js";
import { el, sectionTitle, segmentNav, resultModal, rollLogCard, showToast, promptModal, confirmModal } from "./ui.js";
import { rollDie, successesFor, uid, clear } from "./core.js";
import { lookupRange } from "./rules.js";
import { RollLog } from "./store.js";

const SOLO_KEY = "brp:solo";
const LOG_CAP = 50;
const SEGMENTS = [
  { key: "start", label: "Start" },
  { key: "scene", label: "Scene" },
  { key: "track", label: "Track" },
  { key: "session", label: "Session" },
  { key: "notes", label: "Log & Notes" },
];

function readSoloState() {
  try {
    const raw = localStorage.getItem(SOLO_KEY);
    if (raw) return { log: [], panel: "start", ...JSON.parse(raw) };
  } catch (e) {}
  return { timerDie: "D6", hypotheses: [], humanityChecks: {}, promoGainChecks: {}, promoLoseChecks: {}, log: [], panel: "start", scratchpad: "" };
}
function writeSoloState(st) { try { localStorage.setItem(SOLO_KEY, JSON.stringify(st)); } catch (e) {} }
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// Two-tier roll helpers (Solo Mode oracle procedure): roll D6 to pick a block,
// then a second die scoped to only that block's entries.
// Cipher/Location store flat arrays of 3 equal blocks of 12 (D6 1–2/3–4/5–6 → D12).
function rollColumn(flat) {
  const d6 = rollDie(6);
  const bi = d6 <= 2 ? 0 : d6 <= 4 ? 1 : 2;
  const d = rollDie(12);
  return { d6, d, entry: flat[bi * 12 + (d - 1)] };
}
// Grouped tables carry their own { secondDie, blockRanges, blocks }.
function rollGrouped(tbl) {
  const d6 = rollDie(6);
  const bi = Math.max(0, tbl.blockRanges.findIndex(([lo, hi]) => d6 >= lo && d6 <= hi));
  const block = tbl.blocks[bi];
  const d = rollDie(tbl.secondDie);
  return { d6, d, secondDie: tbl.secondDie, entry: block[Math.min(d, block.length) - 1] };
}

export function renderSolo(mount, rerender) {
  clear(mount);
  const st = readSoloState();

  const record = (label, text, pin) => {
    st.log = st.log || [];
    st.log.unshift({ id: uid(), label, text, pin: pin || `[${label}] ${text}`, ts: Date.now() });
    if (st.log.length > LOG_CAP) st.log.length = LOG_CAP;
    writeSoloState(st);
    try { RollLog.add({ label, text, source: "solo" }); } catch {}
    rerender();
  };
  // Note-writers mutate the SAME `st` object record() uses, so combined
  // operations (e.g. full-briefing = prependNote + record) never clobber.
  const pinNote = (line) => {
    st.scratchpad = `• ${line}\n` + (st.scratchpad || "");
    writeSoloState(st); showToast("Pinned to notes."); rerender();
  };
  const prependNote = (block) => {
    st.scratchpad = block + (st.scratchpad || "");
    writeSoloState(st); rerender();
  };
  const show = ({ label, text, pin, title, render }) => {
    const pinLine = pin || `[${label}] ${text}`;
    record(label, text, pinLine);
    resultModal({ title, pinLine, onPin: pinNote, render });
  };
  // Hypothesis Check (Solo Mode): roll the hypothesis's rating dice as Base Dice
  // (6+ = 1 success, 10+ = 2), no push. ≥2 successes = crit, 1 = success, 0 = fail.
  const hypothesisCheck = (h) => {
    const sizes = String(h.die).split("/").map((p) => parseInt(p.replace(/\D/g, ""), 10) || 6);
    const dice = sizes.map((size) => { const face = rollDie(size); return { size, face, succ: successesFor(face) }; });
    const succ = dice.reduce((n, d) => n + d.succ, 0);
    const out = succ >= 2 ? S.HYPOTHESIS_CHECK.crit : succ >= 1 ? S.HYPOTHESIS_CHECK.success : S.HYPOTHESIS_CHECK.failure;
    const faces = dice.map((d) => `D${d.size}:${d.face}`).join(", ");
    const ppTxt = `${out.pp > 0 ? "+" : ""}${out.pp} PP`;
    record("Hypothesis Check", `${faces} · ${out.name} (${ppTxt})`, `[Hypothesis] ${h.text} → ${out.name} (${ppTxt})`);
    resultModal({ title: "Hypothesis Check", pinLine: `[Hypothesis] ${h.text} → ${out.name} (${ppTxt})`, onPin: pinNote, render: (b) => b.append(
      el("p", { class: "muted" }, `“${h.text}”`),
      el("p", { class: "muted small" }, `Rating ${h.die} · rolled ${faces} · ${succ} success${succ === 1 ? "" : "es"}`),
      el("h3", { class: "roll-result " + (out.pp > 0 ? "roll-result--ok" : "roll-result--warn") }, `${out.name} — ${ppTxt} (if this ends the case)`),
      el("p", {}, out.text),
      el("p", { class: "muted small" }, "Cannot be pushed. " + S.HYPOTHESIS_CHECK.convincing)) });
  };

  // header + segmented nav
  mount.append(el("div", { class: "card screen-head" },
    sectionTitle("Solo Mode Assistant"),
    el("p", { class: "muted" }, "Official Solo Mode oracle, generators, and trackers — organized by the flow of play.")));
  mount.append(segmentNav({ segments: SEGMENTS, active: st.panel, onSelect: (k) => { st.panel = k; writeSoloState(st); rerender(); } }));

  const panel = el("div", { class: "panel" });
  ({ start: panelStart, scene: panelScene, track: panelTrack, session: panelSession, notes: panelNotes }[st.panel] || panelStart)(panel);
  mount.append(panel);

  // ---- PANELS -------------------------------------------------------------
  function panelStart(root) {
    // Assignment is a D6×D10 table: 1–3 → first ten, 4–6 → second ten. [Solo Mode p.16]
    const rollAssignment = () => { const g = rollDie(6) <= 3 ? 0 : 1; const d = rollDie(10); return S.CASE_BRIEFING.assignment[g * 10 + (d - 1)]; };

    // Lead card: the Solo supplement's own Case Briefing generator (Solo Mode pp.16–17).
    const lead = card("Start a Case File",
      "Each investigation opens with a briefing. Generate one below, then ask Question Checks (Scene tab) to fill in the blanks.");
    lead.append(
      el("div", { class: "btn-row" },
        btn("⚡ Generate full briefing", () => {
          const a = rollAssignment(), r = pick(S.CASE_BRIEFING.relevance), c = pick(S.CASE_BRIEFING.complication), h = pick(S.CASE_BRIEFING.hook);
          prependNote(`=== CASE BRIEFING — ${new Date().toLocaleDateString()} (Solo) ===\n• Assignment: ${a}\n• Relevance: ${r}\n• Complication: ${c}\n• Personal Hook: ${h}\n\n`);
          record("Briefing", `${a} · ${r}`, `[Briefing] ${a} — ${r}`);
          showToast("Full briefing added to Case Notes.");
        }, "primary"),
        btn("✍ Blank case note", () => {
          prependNote(`=== NEW CASE — ${new Date().toLocaleDateString()} ===\n• Concept / hunch: \n• Unresolved lead from a past case: \n\n`);
          showToast("Blank case note added.");
        }, "ghost")),
      el("p", { class: "muted small" }, "Case Briefing tables (Solo Mode) — roll one at a time:"),
      grid(
        btn("🎲 Assignment", () => { const t = rollAssignment(); show({ label: "Assignment", text: t, title: "Case Briefing — Assignment", render: (b) => b.append(el("h3", { class: "roll-result" }, t)) }); }),
        btn("🎲 Relevance", () => rollTable("Relevance", S.CASE_BRIEFING.relevance, 12)),
        btn("🎲 Complication", () => rollTable("Complication", S.CASE_BRIEFING.complication, 12)),
        btn("🎲 Personal Hook", () => rollTable("Personal Hook", S.CASE_BRIEFING.hook, 12))));
    root.append(lead);

    // Alternate method (collapsed to reduce clutter): the Core Rulebook's Case File
    // Generator. The Solo book itself offers this as a second way to start (p.14).
    root.append(el("details", { class: "rules__group solo-alt" },
      el("summary", {}, "Alternate: Core Case File Generator"),
      el("p", { class: "muted small" }, "The Core Rulebook's case tables (pp.222+). Either method works — mix and match as you like."),
      grid(
        btn("🎲 Theme (D10)", () => { const roll = rollDie(10); const res = lookupRange(GM.CASE_THEME, roll); show({ label: "Theme", text: res.theme, title: `Case Theme — ${roll} (D10)`, render: (b) => { b.append(el("h3", { class: "roll-result" }, res.theme), el("p", { class: "muted" }, `Assignment uses D${res.die}.`)); } }); }),
        btn("🎲 Sector (D8)", () => { const roll = rollDie(8); const res = lookupRange(GM.CASE_SECTOR, roll); show({ label: "Sector", text: res?.sector || "?", title: `Sector — ${roll} (D8)`, render: (b) => { b.append(el("h3", { class: "roll-result" }, res?.sector || "Unknown")); } }); }),
        btn("🎲 Twist (D12)", () => rollTable("Twist", GM.CASE_TWIST, 12)))));

    // Solo character origin (Solo Mode: Blade Runner Origin table).
    root.append(card("Solo Blade Runner Origin", "Why your Blade Runner works alone — for a fresh solo character.",
      grid(btn("🎲 Origin Seed (D12)", () => { const roll = rollDie(12); const t = S.ORIGIN[roll - 1]; show({ label: "Origin", text: `D12→${roll}`, pin: `[Origin] ${t}`, title: `Origin Seed — ${roll} (D12)`, render: (b) => b.append(el("p", { class: "roll-prose" }, t)) }); }))));

    function rollTable(label, arr, die) {
      const roll = rollDie(die); const t = arr[roll - 1];
      show({ label, text: t, title: `${label} — ${roll} (D${die})`, render: (b) => b.append(el("p", { class: "roll-prose" }, t)) });
    }
  }

  function panelScene(root) {
    // Oracle
    const oddsSelect = el("select", { class: "input roll-select" },
      el("option", { value: "normal" }, "Normal odds (1D10)"),
      el("option", { value: "high" }, "High prob (2D10 keep highest)"),
      el("option", { value: "low" }, "Low prob (2D10 keep lowest)"));
    root.append(card("Oracle", "Resolve uncertainty and scene complexity.",
      grid(
        btn("🎲 Scene Check (D8)", () => { const roll = rollDie(8); const res = lookupRange(S.SCENE_CHECK, roll); show({ label: "Scene Check", text: `D8→${roll} · ${res.result}`, pin: `[Scene Check] ${res.result}`, title: `Scene Check — ${roll} (D8)`, render: (b) => { b.append(el("h3", { class: "roll-result" }, res.result)); if (res.detail) b.append(el("p", { class: "muted" }, res.detail)); } }); }),
        btn("🎲 Question Check", () => {
          const odds = oddsSelect.value; let roll = rollDie(10); let d = `${roll}`;
          if (odds === "high") { const a = rollDie(10), c = rollDie(10); roll = Math.max(a, c); d = `${a},${c}→${roll}`; }
          else if (odds === "low") { const a = rollDie(10), c = rollDie(10); roll = Math.min(a, c); d = `${a},${c}→${roll}`; }
          const res = lookupRange(S.QUESTION_CHECK, roll);
          show({ label: "Question", text: `${d} · ${res.result}`, pin: `[Question] ${res.result}`, title: `Question Check — ${d} (D10)`, render: (b) => { b.append(el("h3", { class: "roll-result" }, res.result)); if (res.detail) b.append(el("p", { class: "muted" }, res.detail)); } });
        }),
        btn("🎲 Crit Success (D8)", () => { const roll = rollDie(8); const res = S.CRITICAL_SUCCESS[roll - 1]; show({ label: "Crit Success", text: res.name, pin: `[Crit Success] ${res.name} — ${res.bonus}`, title: `Critical Success — ${roll} (D8)`, render: (b) => b.append(el("h3", { class: "roll-result" }, res.name), el("p", {}, res.text), el("div", { class: "roll-eyebrow" }, "Bonus"), el("p", { class: "muted" }, res.bonus)) }); })),
      el("div", { class: "roll-row" }, el("span", { class: "muted roll-row__label" }, "Question odds:"), oddsSelect),
      el("p", { class: "muted roll-note" }, S.QUESTION_ODDS_NOTE)));

    // Prompts
    root.append(card("Prompts", "Interpretive answers, places, and NPCs.",
      grid(
        btn("🎲 Scene Category (D12)", () => { const roll = rollDie(12); const res = S.SCENE_CATEGORIES[roll - 1]; show({ label: "Scene Category", text: res.name, pin: `[Scene Category] ${res.name} — ${res.detail}`, title: `Scene Category — ${roll} (D12)`, render: (b) => b.append(el("h3", { class: "roll-result" }, res.name), el("p", {}, res.detail), el("div", { class: "roll-eyebrow" }, "Suggested Skills"), el("p", { class: "muted" }, res.skills.join(", "))) }); }),
        btn("🎲 NPC Skill (D8)", () => { const roll = rollDie(8); const res = lookupRange(S.NPC_SKILL_LEVEL, roll); show({ label: "NPC Skill", text: res.name, pin: `[NPC Skill] ${res.name} (${res.dice})`, title: `NPC Skill Level — ${roll} (D8)`, render: (b) => b.append(el("h3", { class: "roll-result" }, res.name), el("p", { class: "muted" }, `Dice pool: ${res.dice}`)) }); }),
        btn("🎲 Cipher", () => { const m = rollColumn(S.CIPHER_METHOD), f = rollColumn(S.CIPHER_FOCUS); show({ label: "Cipher", text: `${m.entry} × ${f.entry}`, pin: `[Cipher] ${m.entry} × ${f.entry}`, title: "Cipher Oracle", render: (b) => b.append(el("h3", { class: "roll-result roll-result--big" }, `${m.entry} × ${f.entry}`), el("p", { class: "muted roll-center" }, `Method D6=${m.d6}/D12=${m.d}  |  Focus D6=${f.d6}/D12=${f.d}`)) }); }),
        btn("🎲 Location", () => { const e = rollColumn(S.LOCATION_ENVIRONMENT), p = rollColumn(S.LOCATION_PLACE); show({ label: "Location", text: `${e.entry} ${p.entry}`, pin: `[Location] ${e.entry} ${p.entry}`, title: "Location Generator", render: (b) => b.append(el("h3", { class: "roll-result roll-result--big" }, `${e.entry} ${p.entry}`), el("p", { class: "muted roll-center" }, `Environment D6=${e.d6}/D12=${e.d}  |  Place D6=${p.d6}/D12=${p.d}`)) }); }))));

    // Imagining Clues (p.18): Meaning + Evidence Descriptor + Evidence Type.
    root.append(card("Imagining Clues", "Assemble a clue: what it means, and the evidence itself.",
      grid(
        btn("🎲 Meaning (D8)", () => { const r = rollDie(8); const t = S.CLUE_MEANING[r - 1]; show({ label: "Clue Meaning", text: t, pin: `[Meaning] ${t}`, title: `Clue Meaning — ${r} (D8)`, render: (b) => b.append(el("p", { class: "roll-prose" }, t)) }); }),
        btn("🎲 Evidence Descriptor", () => { const g = rollGrouped(S.CLUE_EVIDENCE_DESCRIPTOR); const e = g.entry; show({ label: "Evidence Descriptor", text: `${e.result} — ${e.detail}`, pin: `[Evidence] ${e.result}: ${e.detail}`, title: `Evidence Descriptor — D6=${g.d6}/D10=${g.d}`, render: (b) => b.append(el("h3", { class: "roll-result" }, e.result), el("p", { class: "muted" }, e.detail)) }); }),
        btn("🎲 Evidence Type", () => { const g = rollGrouped(S.CLUE_EVIDENCE_TYPE); show({ label: "Evidence Type", text: g.entry, pin: `[Evidence Type] ${g.entry}`, title: `Evidence Type — D6=${g.d6}/D12=${g.d}`, render: (b) => b.append(el("h3", { class: "roll-result" }, g.entry)) }); }),
        btn("⚡ Full clue", () => {
          const m = S.CLUE_MEANING[rollDie(8) - 1];
          const d = rollGrouped(S.CLUE_EVIDENCE_DESCRIPTOR).entry, t = rollGrouped(S.CLUE_EVIDENCE_TYPE).entry;
          show({ label: "Clue", text: `${d.result} ${t}`, pin: `[Clue] ${d.result} ${t} — ${d.detail} Meaning: ${m}`, title: "Imagined Clue",
            render: (b) => b.append(el("h3", { class: "roll-result roll-result--big" }, `${d.result} ${t}`), el("p", {}, d.detail), el("div", { class: "roll-eyebrow" }, "Meaning"), el("p", { class: "muted" }, m)) });
        }, "primary"))));

    // Character / NPC generator (p.19): Sphere + Trait (+ Skill Level).
    root.append(card("Character (NPC)", "Generate an NPC: their sphere of life and a defining trait.",
      grid(
        btn("🎲 Sphere", () => { const g = rollGrouped(S.CHARACTER_SPHERE); show({ label: "Sphere", text: g.entry, pin: `[Sphere] ${g.entry}`, title: `Character Sphere — D6=${g.d6}/D8=${g.d}`, render: (b) => b.append(el("h3", { class: "roll-result" }, g.entry)) }); }),
        btn("🎲 Trait", () => { const g = rollGrouped(S.CHARACTER_TRAIT); show({ label: "Trait", text: g.entry, pin: `[Trait] ${g.entry}`, title: `Character Trait — D6=${g.d6}/D12=${g.d}`, render: (b) => b.append(el("h3", { class: "roll-result" }, g.entry)) }); }),
        btn("⚡ Full NPC", () => {
          const sph = rollGrouped(S.CHARACTER_SPHERE).entry, tr = rollGrouped(S.CHARACTER_TRAIT).entry, sk = lookupRange(S.NPC_SKILL_LEVEL, rollDie(8));
          show({ label: "NPC", text: `${tr} · ${sph}`, pin: `[NPC] ${tr} character from ${sph}; ${sk.name}`, title: "Generated NPC",
            render: (b) => b.append(el("h3", { class: "roll-result roll-result--big" }, `${tr} · ${sph}`), el("p", {}, `A ${tr.toLowerCase()} character connected to ${sph.toLowerCase()}.`), el("div", { class: "roll-eyebrow" }, "Skill Level"), el("p", { class: "muted" }, `${sk.name} — ${sk.dice}`)) });
        }, "primary"))));
  }

  function panelTrack(root) {
    // Countdown Timer
    const timerCard = card("Countdown Timer", S.COUNTDOWN_TIMER.note);
    timerCard.append(el("div", { class: "timer-display" }, el("span", { class: "timer-display__label" }, "Current Timer Die:"), el("span", { class: "timer-display__die" }, st.timerDie)));
    const stepTimer = (dir) => { const i = S.ESCALATION_STEPS.indexOf(st.timerDie) + dir; if (i >= 0 && i < S.ESCALATION_STEPS.length) { st.timerDie = S.ESCALATION_STEPS[i]; writeSoloState(st); rerender(); } };
    timerCard.append(el("div", { class: "btn-row" },
      btn("🎲 Roll Timer Die", () => {
        const parts = st.timerDie.split("/"); let successes = 0; const rr = [];
        for (const part of parts) { const size = parseInt(part.replace("D", ""), 10) || 6; const r = rollDie(size); rr.push(`D${size}:${r}`); if (r >= 6) successes++; }
        if (successes > 0) {
          const i = S.ESCALATION_STEPS.indexOf(st.timerDie); if (i !== -1 && i < S.ESCALATION_STEPS.length - 1) st.timerDie = S.ESCALATION_STEPS[i + 1];
          record("Timer", `${rr.join(", ")} · held → ${st.timerDie}`, `[Timer] Held (${rr.join(", ")}) → ${st.timerDie}`);
          resultModal({ title: "Countdown Timer — Held", render: (b) => b.append(el("p", { class: "roll-result--ok" }, `Rolled ${rr.join(", ")} (${successes} success${successes > 1 ? "es" : ""}).`), el("p", { class: "muted" }, `Timer did NOT trigger. Upgraded to ${st.timerDie}.`)) });
        } else {
          const evRoll = rollDie(12); const ev = S.COUNTDOWN_EVENT[evRoll - 1]; st.timerDie = "D6";
          record("Countdown Event", `Triggered · ${ev.name}`, `[Countdown] TRIGGERED — ${ev.name}: ${ev.examples}`);
          resultModal({ title: "⚠️ Countdown Event Triggered!", pinLine: `[Countdown] TRIGGERED — ${ev.name}: ${ev.examples}`, onPin: pinNote, render: (b) => b.append(el("p", { class: "roll-result--warn" }, `Rolled ${rr.join(", ")} (0 successes). Timer resets to D6.`), el("div", { class: "roll-eyebrow" }, `Event #${evRoll} — ${ev.name}`), el("p", { class: "roll-prose" }, ev.examples)) });
        }
      }),
      btn("▲ Upgrade", () => stepTimer(1), "sm ghost"),
      btn("▼ Downgrade", () => stepTimer(-1), "sm ghost"),
      btn("✕ Reset (D6)", () => { st.timerDie = "D6"; writeSoloState(st); rerender(); }, "sm ghost")));
    root.append(timerCard);

    // Hypotheses
    const hypCard = card("Hypothesis Tracker", "Track theories and rating dice; review at each Shift's end. Use 🎲 Check to test a hypothesis (rolls its rating; no push).");
    const hypList = el("div", { class: "hyp-list" });
    if (!st.hypotheses.length) hypList.append(el("p", { class: "muted" }, "No active hypotheses."));
    st.hypotheses.forEach((h, i) => {
      const stepHyp = (dir) => { const idx = S.ESCALATION_STEPS.indexOf(h.die) + dir; if (idx >= 0 && idx < S.ESCALATION_STEPS.length) { h.die = S.ESCALATION_STEPS[idx]; writeSoloState(st); rerender(); } };
      hypList.append(el("div", { class: "hyp-row" },
        el("div", { class: "hyp-row__main" }, el("strong", { class: "hyp-row__die" }, `[${h.die}]`), el("span", {}, h.text)),
        el("div", { class: "btn-row" }, btn("🎲 Check", () => hypothesisCheck(h), "sm"), btn("▲", () => stepHyp(1), "sm ghost"), btn("▼", () => stepHyp(-1), "sm ghost"), btn("✕", () => { st.hypotheses.splice(i, 1); writeSoloState(st); rerender(); }, "sm ghost"))));
    });
    hypCard.append(hypList, btn("＋ Add Hypothesis", async () => { const t = await promptModal("Hypothesis theory / lead", { title: "Add Hypothesis", okLabel: "Add" }); if (t && t.trim()) { st.hypotheses.push({ id: uid(), text: t.trim(), die: "D6" }); writeSoloState(st); rerender(); } }, "sm"));
    root.append(hypCard);

    // Downtime Event
    root.append(card("Downtime", "Between-investigation scenes.",
      grid(btn("🎲 Downtime Event (D12)", () => { const roll = rollDie(12); const ev = S.DOWNTIME_EVENT[roll - 1]; show({ label: "Downtime Event", text: `D12→${roll}`, pin: `[Downtime] Home: ${ev.home} / Street: ${ev.street}`, title: `Downtime Event — ${roll} (D12)`, render: (b) => b.append(el("div", { class: "roll-eyebrow" }, "At Home"), el("p", {}, ev.home), el("div", { class: "roll-eyebrow" }, "On the Street"), el("p", {}, ev.street)) }); }))));
  }

  function panelSession(root) {
    const c = card("Milestone & Session Checklists", "Check items off during play. At milestone/session end, count checked items for awards.");
    const mk = (title, items, map, keyName) => {
      const box = el("details", { class: "rules__group" });
      box.append(el("summary", {}, `${title} (${Object.values(map).filter(Boolean).length}/${items.length})`));
      const list = el("div", { class: "check-list" });
      items.forEach((text, idx) => {
        const checked = !!map[idx];
        list.append(el("label", { class: "check-row" }, el("input", { type: "checkbox", checked: checked || null, onChange: (e) => { st[keyName][idx] = e.target.checked; writeSoloState(st); rerender(); } }), el("span", { class: checked ? "muted strike" : "" }, text)));
      });
      box.append(list); return box;
    };
    c.append(
      mk("Humanity Gain (+1 each)", S.HUMANITY_CHECKLIST, st.humanityChecks, "humanityChecks"),
      mk("Promotion Gain (+1 PP each)", S.PROMOTION_GAIN, st.promoGainChecks, "promoGainChecks"),
      mk("Promotion Loss (−1 PP each)", S.PROMOTION_LOSE, st.promoLoseChecks, "promoLoseChecks"),
      btn("✕ Reset Checklists", async () => { const ok = await confirmModal("Reset all milestone checklists for a new session/milestone?", { title: "Reset Checklists", danger: true }); if (ok) { st.humanityChecks = {}; st.promoGainChecks = {}; st.promoLoseChecks = {}; writeSoloState(st); rerender(); } }, "sm ghost"));
    root.append(c);
  }

  function panelNotes(root) {
    root.append(rollLogCard({
      entries: st.log || [],
      onPin: (e) => pinNote(e.pin),
      onDelete: (e) => { st.log = (st.log || []).filter((x) => x.id !== e.id); writeSoloState(st); rerender(); },
      onClear: async () => { const ok = await confirmModal("Clear the entire roll log?", { title: "Clear Roll Log", danger: true }); if (ok) { st.log = []; writeSoloState(st); rerender(); } },
    }));
    const c = card("Solo Case Notes", "Persistent scratchpad. Pinned rolls and briefings are prepended here.");
    const ta = el("textarea", { class: "input notes-area", rows: 10, placeholder: "Record clues, suspects, and timeline events..." });
    ta.value = st.scratchpad || "";
    ta.addEventListener("blur", () => { st.scratchpad = ta.value; writeSoloState(st); showToast("Notes saved."); });
    c.append(ta); root.append(c);
  }
}

// ---- small builders -------------------------------------------------------
function card(title, sub, ...children) {
  const c = el("div", { class: "card" }, sectionTitle(title));
  if (sub) c.append(el("p", { class: "muted" }, sub));
  for (const ch of children) if (ch) c.append(ch);
  return c;
}
function grid(...children) { return el("div", { class: "roll-grid" }, ...children.filter(Boolean)); }
function btn(label, onClick, variant = "roll") {
  const cls = "btn " + variant.split(" ").map((v) => (v === "roll" ? "btn--roll" : v === "primary" ? "btn--primary" : v === "ghost" ? "btn--ghost" : v === "sm" ? "btn--sm" : "")).join(" ");
  return el("button", { class: cls.trim(), onClick }, label);
}
