// solo.js — Solo Mode Assistant, laid out in the book's order of play  [Phase 6]
// Gated by Settings.solo(); mounted at route #solo. State in brp:solo.
//
// The segmented sub-nav walks the Investigation Procedure (Solo Mode p.005), so
// the buttons appear in the order you actually press them:
//   Case  — before the loop: your solo origin, opening a case, the briefing
//   Shift — step 1 proceed to a location · step 2 Countdown Event Check
//   Scene — step 3 frame the scene · step 4 skill rolls, clues, NPCs, combat
//   Board — HOUSE AID (src/board.js): the clue-and-suspect board, between the
//           scene that finds evidence and the leads it feeds
//   Leads — step 5 review hypotheses · step 6 Hypothesis Check
//   Wrap  — step 7 end the Shift, Downtime, and the award checklists
//   Notes — the Case Log and the roll log
// Every oracle/generator roll drops its result INLINE in the card that made it
// (with Reroll / Pin / dismiss, plus a per-tab clear) and records a labeled entry
// in the Roll Log; results pin (📌) to Case Notes.

import * as S from "../data-solo.js";
import * as GM from "../data-gm.js";
import * as D from "../data.js";
import { el, sectionTitle, segmentNav, resultSlot, renderToHtml, rollLogCard, showToast, promptModal, confirmModal, appendToNotes } from "./ui.js";
import { rollDie, successesFor, uid, clear, TUTORIAL_KEY, SOLO_KEY } from "./core.js";
import { lookupRange, rollColumn, rollGrouped } from "./rules.js";
import { RollLog, Store, Combat } from "./store.js";
import { applyInvestigationShift, applyDowntimeShift, downtimeLimitFor, maxHealth, maxResolve } from "./derived.js";
import { openSkillRoll, openWeaponPicker, openOpposedSkillRoll } from "./roller.js";
import { navigate } from "./router.js";
import { Board, renderBoardPanel } from "./board.js";
import { Chase } from "./chase.js";

const LOG_CAP = 50;
const RESULT_HISTORY = 3;   // results kept per card, so draws can be compared
const LOOSE = "__panel";    // bucket for rolls fired outside any card
const SEGMENTS = [
  { key: "case", label: "Case" },
  { key: "shift", label: "Shift" },
  { key: "scene", label: "Scene" },
  { key: "board", label: "Board" },
  { key: "leads", label: "Leads" },
  { key: "wrap", label: "Wrap" },
  { key: "notes", label: "Notes" },
];
// Panels renamed when the assistant was re-ordered to the book's procedure.
const LEGACY_PANELS = { start: "case", track: "leads", session: "wrap" };

function readSoloState() {
  const base = { timerDie: "D6", hypotheses: [], humanityChecks: {}, promoGainChecks: {}, promoLoseChecks: {},
    log: [], panel: "case", scratchpad: "", shiftNo: 1, shiftFlags: {}, selectedTheme: null,
    pendingEvent: null, lastSkill: null };
  try {
    const raw = localStorage.getItem(SOLO_KEY);
    if (raw) {
      const st = { ...base, ...JSON.parse(raw) };
      st.panel = LEGACY_PANELS[st.panel] || st.panel;
      if (!SEGMENTS.some((s) => s.key === st.panel)) st.panel = "case";
      st.shiftFlags = st.shiftFlags || {};
      return st;
    }
  } catch (e) {}
  return base;
}
function writeSoloState(st) { try { localStorage.setItem(SOLO_KEY, JSON.stringify(st)); } catch (e) {} }
// Set by btn() on every click so show() knows which card to drop the result in.
let activeBtn = null;
// Card key of the result just rolled — scrolled into view once, after paint.
let freshResult = null;
const cardTitleOf = (node) => node?.closest(".card")?.querySelector(".sheet__section")?.textContent || null;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// ---- "How to use this" — per-card guidance ---------------------------------
// Keyed by card title. Each line is [what you press, when you press it and what
// you do with the result]. Procedure only — no rules numbers live here (§10.2).
const HOW = {
  "Your solo Blade Runner": [
    ["Skip this card", "if you already have a Blade Runner. It is for a brand-new solo character."],
    ["🎲 Origin Seed", "rolls why this detective works alone. Write it into the sheet's Notes — it is the hook the oracle keeps coming back to."],
  ],
  "How to start a Case File": [
    ["Pick ONE way in", "then move down to the briefing. All four are official; they differ only in how much the dice decide."],
    ["✍ Seed a note", "writes a stub into Case Notes for you to fill in yourself. Use it when you already have an idea."],
    ["✍ Seed from an old case", "same, but for a thread left dangling by a previous investigation."],
  ],
  "Case Briefing": [
    ["⚡ Generate full briefing", "once, at the start of a case. Read the four lines as the briefing Holden gives you, then start work."],
    ["Single tables", "replace one part you do not like — reroll just the Assignment, or just the Hook."],
    ["Anything the briefing leaves open", "is answered later with a Question Check on the Scene tab. Do not fill in every blank now."],
  ],
  "Core Case File Generator": [
    ["Use this instead of the briefing", "when you want a Core-rulebook style case rather than the solo one."],
    ["🎲 Theme first", "— it selects which Assignment table you roll on. Then Sector and Twist."],
    ["⚡ Full cast", "rolls how many named people the case carries, then each one — occupation, quirk and name."],
  ],
  "Flesh out the case": [
    ["Roll as much or as little as you like", "— none of this is required to start. Leave it and the same tables are waiting on the Scene tab."],
    ["⚡ Someone involved", "gives you a person: what world they come from, what they are like, how good they are, and whether they are human."],
    ["🎲 Where it starts", "names the first location; 🎲 Cipher gives two words to interpret when you want a prompt rather than an answer."],
    ["More Core case tables", "hold what the players can find (clues), where it ends (the finale), and the weather and street noise of a scene."],
  ],
  "Proceed to a location": [
    ["Decide from your leads", "where the case takes you. Travelling there costs the Shift."],
    ["🎲 Location", "only when you do not already know where you are going, or want the place described for you."],
  ],
  "Countdown Event Check": [
    ["🎲 Roll the timer", "once per Shift, right after you pick the location — never on a Downtime Shift."],
    ["Any success", "fires the event now: narrate the interruption, then the timer resets to D6."],
    ["No successes", "means no event, but the die escalates — the next Shift is likelier to bite."],
  ],
  "Frame the scene": [
    ["🎲 Scene Check", "when you are unsure how hard or dangerous a situation is. It tells you whether a skill roll is needed at all."],
    ["🎲 Scene Category", "only when you are stuck for what the scene even is — it hands you an activity to play."],
  ],
  "Roll it out": [
    ["The skill roll itself", "happens on your character sheet. These buttons answer the questions around it."],
    ["🎲 Question Check", "for a yes/no fact — set the odds first if a yes is likely or unlikely."],
    ["🎲 Cipher", "for an open question. Read the two words as a prompt and interpret them."],
    ["🎲 Crit Success", "after you roll two or more successes outside combat — it turns the crit into a concrete benefit."],
  ],
  "Gather clues": [
    ["Roll here after a successful", "search, examination, or interview on your sheet — a success is what earns a clue."],
    ["⚡ Full clue", "gives all three parts at once. The single buttons fill one gap."],
    ["Meaning", "is what the clue tells you; Descriptor and Type are the physical evidence."],
    ["Then", "pin it into your Case Notes and turn it into a lead on the Leads tab."],
  ],
  "People you meet": [
    ["Roll when an NPC appears", "that you had not planned — a witness, a fixer, a suspect."],
    ["⚡ Full NPC", "does sphere, trait, skill level and human/Replicant in one press."],
    ["🎲 NPC Skill", "only matters when they will be rolled against you. Never push an NPC's roll."],
  ],
  "Combat & chases": [
    ["Roll when the opposition acts", "and you do not know what they would do — that is the job the Game Runner would have."],
    ["🎲 NPC Tactics", "for how they fight; 🎲 NPC Chase Maneuver for how they run or pursue."],
    ["Then", "run the exchange in the Combat Tracker."],
  ],
  "Review your hypotheses": [
    ["Once per Shift", "when the location's scenes are done — not after every roll."],
    ["＋ Add Hypothesis", "for a new theory (starts at D6). ▲ when evidence supports it, ▼ when it contradicts."],
  ],
  "Hypothesis Check": [
    ["🎲 Check on a row", "only when the fiction can conclusively prove or disprove that theory."],
    ["It cannot be pushed", "and a critical success is how a case ends."],
  ],
  "End the Shift": [
    ["▶ End the Shift", "when you leave the location. It advances the counter on your sheet and warns you at the Downtime limit."],
    ["🛌 Take Downtime instead", "to heal and reset the counter. No Countdown Check on a Downtime Shift."],
  ],
  "Downtime scene": [
    ["🎲 Downtime Event", "only when you actually took Downtime — it colours the off-hours."],
  ],
  "Award your points": [
    ["Tick as they happen", "during play, then count them at the end of the case or session."],
    ["Move the totals", "onto your sheet, where they are spent on specialties and skills."],
  ],
  "Case Board": [
    ["This whole tab is a house aid", "not part of the Blade Runner rules. Ignore it and nothing else changes."],
    ["🎲 ＋ Clue / ＋ Suspect", "when you find evidence or meet someone worth suspecting — the box is filled from the official Solo tables."],
    ["✍ ＋ Clue / ＋ Suspect", "when you already know what you found and only want it on the board."],
    ["🔗 Connect", "when you work out how a clue implicates a suspect. Clues only ever connect to suspects. Let the board decide if you want the link to surprise you."],
    ["🔗 count on a suspect", "is how close they are to being your answer — the board calls it once one of them is far enough ahead."],
    ["★ on a suspect", "sends them to Leads as a hypothesis, which is what actually pays out."],
  ],
  "Discovery Check": [
    ["Earn one first", "by succeeding on Observation, Tech, Medical Aid, Connections, Manipulation or Insight on your sheet — the result offers you the check."],
    ["🎲 Discovery Check", "when you want the board to give you something. The fuller the board, the better the result: a busy case closes itself."],
    ["Spent a scene searching?", "roll it without a banked check and confirm — the honesty is yours."],
  ],
  "The answer": [
    ["Appears only", "when a clincher lands or one suspect is far enough ahead on connections."],
    ["★ Promote to a hypothesis", "then rate it and run the Hypothesis Check on Leads. The board never awards Promotion Points itself."],
  ],
};

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
  // operations (e.g. full-briefing = addNote + record) never clobber.
  // Notes read top to bottom — the newest entry lands at the bottom.
  const pinNote = (line) => {
    st.scratchpad = appendToNotes(st.scratchpad, `• ${line}`);
    writeSoloState(st); showToast("Pinned to the end of your notes."); rerender();
  };
  const addNote = (block) => {
    st.scratchpad = appendToNotes(st.scratchpad, block);
    writeSoloState(st); rerender();
  };
  // A roll writes its result into the card that produced it (and the roll log).
  // `slot` overrides the card lookup for results raised outside a button click.
  const show = ({ label, text, pin, title, render, slot, skipAutoPin }) => {
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
      writeSoloState(st);
    }
    if (st.autoPin && pinLine && !skipAutoPin) st.scratchpad = appendToNotes(st.scratchpad, `• ${pinLine}`);
    freshResult = key;
    record(label, text, pinLine);   // record() rerenders, painting the slot
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
    show({ label: "Hypothesis Check", text: `${faces} · ${out.name} (${ppTxt})`,
      pin: `[Hypothesis] ${h.text} → ${out.name} (${ppTxt})`, title: "Hypothesis Check", render: (b) => b.append(
      el("p", { class: "muted" }, `“${h.text}”`),
      el("p", { class: "muted small" }, `Rating ${h.die} · rolled ${faces} · ${succ} success${succ === 1 ? "" : "es"}`),
      el("h3", { class: "roll-result " + (out.pp > 0 ? "roll-result--ok" : "roll-result--warn") }, `${out.name} — ${ppTxt} (if this ends the case)`),
      el("p", {}, out.text),
      el("p", { class: "muted small" }, "Cannot be pushed. " + S.HYPOTHESIS_CHECK.convincing)) });
    // The award lands only if the check ends the case (Solo Mode), so ask — one
    // tap — instead of leaving the player to mirror the number onto the sheet.
    offerPoints(out.pp, `Hypothesis Check — ${h.text}`);
  };
  // Apply a Promotion Point swing to the active character, on confirmation.
  async function offerPoints(pp, why) {
    const ch = Store.getActive();
    if (!pp || !ch) return;
    const sign = pp > 0 ? `+${pp}` : `${pp}`;
    const ok = await confirmModal(
      `Did that end the case? If so ${ch.name} takes ${sign} Promotion Point${Math.abs(pp) === 1 ? "" : "s"} now. Otherwise skip it and apply it when the case closes.`,
      { title: `${sign} Promotion Points`, okLabel: `Apply ${sign} PP`, cancelLabel: "Not yet" });
    if (!ok) return;
    applyPoints(ch, { pp });
    record("Promotion", `${sign} PP · ${ch.name}`, `[Promotion] ${sign} PP — ${why}`);
    showToast(`${ch.name}: ${sign} Promotion Points (now ${ch.state.promotionPoints}).`);
  }
  // Points never go below zero (§3.10). Saves the character.
  function applyPoints(ch, { pp = 0, humanity = 0 }) {
    ch.state.promotionPoints = Math.max(0, (ch.state.promotionPoints || 0) + pp);
    ch.state.humanityPoints = Math.max(0, (ch.state.humanityPoints || 0) + humanity);
    Store.save(ch);
    return ch;
  }

  // header + segmented nav
  mount.append(el("div", { class: "card screen-head" },
    sectionTitle("Solo Mode Assistant"),
    el("p", { class: "muted" }, "Official Solo Mode oracle, generators, and trackers — organized by the flow of play.")));
  mount.append(el("div", { class: "chips autopin" },
    el("button", {
      class: "chip" + (st.autoPin ? " chip--on" : ""),
      "aria-pressed": st.autoPin ? "true" : "false",
      onClick: () => { st.autoPin = !st.autoPin; writeSoloState(st); showToast(st.autoPin ? "Auto-pin on — every roll is written to your notes." : "Auto-pin off."); rerender(); },
    }, `\u{1F4CC} Auto-pin every roll to notes${st.autoPin ? " \u2713" : ""}`)));
  mount.append(statusStrip());
  mount.append(segmentNav({ segments: SEGMENTS, active: st.panel,
    // Switching tabs starts at the top; an in-panel roll keeps your place.
    onSelect: (k) => { st.panel = k; writeSoloState(st); rerender(); window.scrollTo(0, 0); } }));

  // Step 4's actual dice. openSkillRoll/openWeaponPicker/openOpposedSkillRoll are
  // standalone modals (the sheet calls them the same way), so a scene never has to
  // leave the Solo screen to roll — which used to cost a round trip and your place
  // on the page.
  function rollHere() {
    const ch = Store.getActive();
    if (!ch) return el("div", { class: "btn-row" }, btn("Create a character to roll →", () => navigate("wizard"), "sm ghost"));
    const pick = el("select", { class: "input roll-select", "aria-label": "Skill to roll" });
    for (const sk of D.SKILLS) pick.append(el("option", { value: sk.key }, `${sk.name} (${ch.skills[sk.key] || "D"})`));
    if (st.lastSkill && D.SKILLS.some((x) => x.key === st.lastSkill)) pick.value = st.lastSkill;
    const roll = () => {
      st.lastSkill = pick.value; writeSoloState(st);
      openSkillRoll(ch, pick.value, rerender);
    };
    return el("div", { class: "roll-row solo-roll" },
      pick,
      btn("⚄ Roll", roll, "primary"),
      btn("⚔ Attack", () => openWeaponPicker(ch, rerender), "sm"),
      btn("⚖ Opposed", () => openOpposedSkillRoll(ch, rerender), "sm"),
      btn("Sheet →", () => navigate("sheet"), "sm ghost"));
  }

  // Vitals, the Shift, the timer and any banked Discovery Check, on EVERY panel —
  // damage and stress land during a scene, which is not the tab that used to show
  // them. Numbers only; the sheet is one tap away from the Shift tab.
  function statusStrip() {
    const ch = Store.getActive();
    const wrap = el("div", { class: "solo-status" });
    if (!ch) {
      wrap.append(el("span", { class: "solo-status__cell muted" }, "No active character"),
        btn("Create one →", () => navigate("wizard"), "sm ghost"));
      return wrap;
    }
    const limit = downtimeLimitFor(ch), used = ch.state.shiftsSinceDowntime || 0;
    const atLimit = used >= limit;
    const cell = (text, cls = "") => el("span", { class: "solo-status__cell " + cls }, text);
    wrap.append(
      cell(ch.name, "solo-status__name"),
      cell(`♥ ${ch.state.health}/${maxHealth(ch)}`, ch.state.health <= 0 ? "warn" : ""),
      cell(`◈ ${ch.state.resolve}/${maxResolve(ch)}`, ch.state.resolve <= 0 ? "warn" : ""),
      cell(`Shift ${st.shiftNo || 1}`),
      cell(`${used}/${limit} to Downtime`, atLimit ? "warn" : ""),
      cell(`⏱ ${st.timerDie}`),
    );
    const banked = Board.checks();
    if (banked) wrap.append(el("button", {
      class: "solo-status__cell solo-status__link",
      onClick: () => { st.panel = "board"; writeSoloState(st); rerender(); window.scrollTo(0, 0); },
    }, `🔍 ${banked}`));
    return wrap;
  }

  // A card headed with its place in the Investigation Procedure (Solo Mode p.005).
  // Pass the step NUMBER and the eyebrow is built from S.SOLO_SEQUENCE, so the
  // sequence of play is stated once, in the data layer (§10.2); pass a string
  // for the cards that sit outside the numbered loop ("Before you start").
  function stepCard(step, title, sub, ...children) {
    const c = card(title, sub, ...children);
    c.prepend(el("div", { class: "roll-eyebrow step-eyebrow" }, typeof step === "number" ? `Step ${procStep(step).step}` : step));
    return c;
  }
  const procStep = (n) => S.SOLO_SEQUENCE.find((s) => s.step === n) || { step: n, title: "", text: "" };
  // The whole loop, collapsed, so you can see where the current tab sits in it.
  function procedureCard() {
    const d = el("details", { class: "rules__group solo-proc" }, el("summary", {}, "The Investigation Procedure — the whole loop"));
    const list = el("ol", { class: "solo-proc__list" });
    for (const s of S.SOLO_SEQUENCE)
      list.append(el("li", {}, el("strong", {}, s.title), " — ", el("span", {}, s.text), " ", el("span", { class: "muted small" }, `(${s.where} tab)`)));
    d.append(list);
    return d;
  }
  // Soft gating (owner ruling): once-per-Shift actions are marked, not blocked —
  // a second roll only asks for confirmation.
  const flagged = (key) => !!st.shiftFlags[key];
  const setFlag = (key, on = true) => { st.shiftFlags[key] = on; writeSoloState(st); };
  async function onceThisShift(key, label) {
    if (!flagged(key)) return true;
    return confirmModal(`${label} is already done this Shift. Do it again anyway?`, { title: "Already done this Shift", okLabel: "Roll again" });
  }
  const doneChip = (key) => (flagged(key) ? el("span", { class: "chip chip--done" }, "✓ done this Shift") : null);

  const panel = el("div", { class: "panel" });
  ({ case: panelCase, shift: panelShift, scene: panelScene, board: panelBoard, leads: panelLeads, wrap: panelWrap, notes: panelNotes }[st.panel] || panelCase)(panel);
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
      // Collapsed "how to use this" note, so the buttons explain when to press them.
      if (HOW[key]) {
        cardEl.append(el("details", { class: "how" },
          el("summary", {}, "How to use this"),
          ...HOW[key].map(([what, when]) => el("p", { class: "how__line" },
            el("strong", {}, what), " ", el("span", { class: "muted" }, when)))));
      }
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
          writeSoloState(st); rerender();
        },
      })));
    }
    // Bring the result you just rolled into view: the panel re-renders in place,
    // and a long panel can push a new slot below the fold.
    if (freshResult) {
      const fresh = freshResult; freshResult = null;
      requestAnimationFrame(() => {
        const host = [...panelEl.querySelectorAll(".card")].find((c) => c.querySelector(".sheet__section")?.textContent === fresh) || panelEl;
        const slotEls = host.querySelectorAll(":scope > .result-slot");
        slotEls[slotEls.length - 1]?.scrollIntoView({ block: "nearest", behavior: "smooth" });
      });
    }
    // Results with no owning card hang at the end of the panel.
    for (const r of resultList(LOOSE)) {
      live += 1;
      panelEl.append(resultSlot({ title: r.title, html: r.html, pinLine: r.pinLine, stamp: r.ts, onPin: pinNote,
        onDismiss: () => { st.results[LOOSE] = resultList(LOOSE).filter((x) => x.id !== r.id); if (!st.results[LOOSE].length) delete st.results[LOOSE]; writeSoloState(st); rerender(); } }));
    }
    if (!live) return;
    const shown = [...panelEl.querySelectorAll(".card")]
      .map((c) => c.querySelector(".sheet__section")?.textContent)
      .filter((k) => k && resultList(k).length)
      .concat(resultList(LOOSE).length ? [LOOSE] : []);
    panelEl.append(el("div", { class: "btn-row result-clear" },
      btn(`\u2715 Clear ${live === 1 ? "this result" : "these " + live + " results"}`, () => {
        for (const key of shown) delete st.results[key];
        writeSoloState(st); rerender();
      }, "sm ghost")));
  }


  // ---- PANELS -------------------------------------------------------------
  function panelCase(root) {
    // Assignment is a D6×D10 table: 1–3 → first ten, 4–6 → second ten. [Solo Mode p.16]
    const rollAssignment = () => { const g = rollDie(6) <= 3 ? 0 : 1; const d = rollDie(10); return S.CASE_BRIEFING.assignment[g * 10 + (d - 1)]; };

    // Before the loop: the solo character themselves.
    root.append(stepCard("Before you start", "Your solo Blade Runner", S.SOLO_NO_ARCHETYPE.advice,
      grid(btn("🎲 Origin Seed (D12)", () => { const roll = rollDie(12); const t = S.ORIGIN[roll - 1]; show({ label: "Origin", text: `D12→${roll}`, pin: `[Origin] ${t}`, title: `Origin Seed — ${roll} (D12)`, render: (b) => b.append(el("p", { class: "roll-prose" }, t)) }); }),
        btn("Creation wizard →", () => navigate("wizard"), "ghost"))));

    // Step 0a — pick a way in. Four official methods (Solo Mode p.004).
    const methods = stepCard("Open the case", "How to start a Case File", "Four official approaches. Mix and match as you like.");
    for (const m of S.CASE_START_METHODS) {
      const row = el("div", { class: "solo-method" },
        el("div", {}, el("strong", {}, m.name), " — ", el("span", { class: "muted" }, m.text)));
      if (m.key === "gut" || m.key === "thread") {
        row.append(btn(m.key === "gut" ? "✍ Seed a note" : "✍ Seed from an old case", () => {
          addNote(m.key === "gut"
            ? `=== NEW CASE — ${new Date().toLocaleDateString()} (trust your gut) ===\n• The case as you see it: \n\n`
            : `=== NEW CASE — ${new Date().toLocaleDateString()} (following a thread) ===\n• Unresolved thread from an earlier case: \n• Why it warrants a new investigation: \n\n`);
          showToast("Case note added.");
        }, "sm ghost"));
      }
      methods.append(row);
    }
    root.append(methods);

    // Step 0b — the briefing itself (Solo Mode pp.16–17).
    const lead = stepCard("Get briefed", "Case Briefing",
      "Every investigation opens with a briefing. Generate one, then fill the blanks with Question Checks on the Scene tab.");
    lead.append(
      el("div", { class: "btn-row" },
        btn("⚡ Generate full briefing", () => {
          const a = rollAssignment(), r = pick(S.CASE_BRIEFING.relevance), c = pick(S.CASE_BRIEFING.complication), h = pick(S.CASE_BRIEFING.hook);
          // The whole briefing goes to the notes AND stays on screen in the card.
          st.scratchpad = appendToNotes(st.scratchpad, `=== CASE BRIEFING — ${new Date().toLocaleDateString()} (Solo) ===\n• Assignment: ${a}\n• Relevance: ${r}\n• Complication: ${c}\n• Personal Hook: ${h}`);
          show({ label: "Briefing", text: `${a} · ${r}`, pin: `[Briefing] ${a} — ${r}`, title: "Case Briefing", skipAutoPin: true,
            render: (b) => b.append(
              el("div", { class: "roll-eyebrow" }, "Assignment"), el("p", {}, a),
              el("div", { class: "roll-eyebrow" }, "Relevance"), el("p", { class: "muted" }, r),
              el("div", { class: "roll-eyebrow" }, "Complication"), el("p", { class: "muted" }, c),
              el("div", { class: "roll-eyebrow" }, "Personal Hook"), el("p", { class: "muted" }, h)) });
          showToast("Full briefing added to Case Notes.");
        }, "primary")),
      el("p", { class: "muted small" }, "Or roll the briefing tables one at a time:"),
      grid(
        btn("🎲 Assignment", () => { const t = rollAssignment(); show({ label: "Assignment", text: t, title: "Case Briefing — Assignment", render: (b) => b.append(el("h3", { class: "roll-result" }, t)) }); }),
        btn("🎲 Relevance", () => rollTable("Relevance", S.CASE_BRIEFING.relevance, 12)),
        btn("🎲 Complication", () => rollTable("Complication", S.CASE_BRIEFING.complication, 12)),
        btn("🎲 Personal Hook", () => rollTable("Personal Hook", S.CASE_BRIEFING.hook, 12))));
    root.append(lead);

    // Alternate route in: the Core Rulebook's Case File Generator. Theme picks the
    // Assignment sub-table, so rolling Theme arms the Assignment button. [Core p.222]
    // It lives in a CARD (collapsed by default) so its rolls get a result slot like
    // every other card; the open state persists so a roll doesn't fold it shut.
    const alt = stepCard("Alternative", "Core Case File Generator", "The Core Rulebook's case tables (pp.222+). Either method works — mix and match as you like.");
    const themeLabel = el("p", { class: "muted small" }, st.selectedTheme ? `Assignment table: ${st.selectedTheme}` : "Roll a Theme first — it selects the Assignment table.");
    const details = el("details", { class: "rules__group solo-alt", open: st.altOpen || null },
      el("summary", {}, "Show the Core tables"),
      themeLabel,
      grid(
        btn("🎲 Theme (D10)", () => { const roll = rollDie(10); const res = lookupRange(GM.CASE_THEME, roll); st.selectedTheme = res.theme; writeSoloState(st); show({ label: "Theme", text: res.theme, pin: `[Theme] ${res.theme}`, title: `Case Theme — ${roll} (D10)`, render: (b) => b.append(el("h3", { class: "roll-result" }, res.theme), el("p", { class: "muted" }, `Assignment uses D${res.die}.`)) }); }),
        btn("🎲 Core Assignment", () => {
          const theme = st.selectedTheme || GM.CASE_THEME[0].theme;
          const list = GM.CASE_ASSIGNMENT[theme] || [];
          if (!list.length) { showToast("Roll a Theme first.", { kind: "warn" }); return; }
          const roll = rollDie(list.length); const t = list[roll - 1];
          show({ label: "Assignment", text: t, pin: `[Assignment] ${t}`, title: `Assignment — ${roll} (D${list.length})`, render: (b) => b.append(el("div", { class: "roll-eyebrow" }, theme), el("p", { class: "roll-prose" }, t)) });
        }),
        btn("🎲 Sector (D8)", () => { const roll = rollDie(8); const res = lookupRange(GM.CASE_SECTOR, roll); show({ label: "Sector", text: res?.sector || "?", pin: `[Sector] ${res?.sector || "?"}`, title: `Sector — ${roll} (D8)`, render: (b) => b.append(el("h3", { class: "roll-result" }, res?.sector || "Unknown")) }); }),
        btn("🎲 Twist (D12)", () => rollTable("Twist", GM.CASE_TWIST, 12)),
        // Case Table 3. The Solo book names it as part of this method, so it
        // has to be rollable here and not only on the GM screen. [Solo p.004]
        btn("🎲 Main NPC", () => { const n = rollMainNpc(); show({ label: "Main NPC", text: `${n.name} · ${n.occ}`, pin: `[NPC] ${n.name} — ${n.occ} (${n.type}); quirk: ${n.quirk}`, title: "Main NPC", render: (b) => b.append(el("h3", { class: "roll-result" }, n.name), el("p", {}, `${n.occ} · ${n.type}`), el("div", { class: "roll-eyebrow" }, "Quirk"), el("p", { class: "muted" }, n.quirk)) }); }),
        btn("⚡ Full cast", () => {
          const count = Math.ceil(rollDie(6) / 2) + GM.CASE_MAIN_NPC_COUNT.bonus;   // D3+3
          const lines = Array.from({ length: count }, rollMainNpc).map((n) => `${n.name} — ${n.occ} (${n.type}); ${n.quirk}`);
          show({ label: "Main NPCs", text: `${count} NPCs`, pin: `[Cast] ${lines.join(" | ")}`, title: `Main cast — D3+${GM.CASE_MAIN_NPC_COUNT.bonus} = ${count}`,
            render: (b) => { for (const l of lines) b.append(el("p", { class: "roll-prose" }, l)); } });
        }, "primary")));
    details.addEventListener("toggle", () => { st.altOpen = details.open; writeSoloState(st); });
    alt.append(details);
    root.append(alt);

    // The book's fourth way in — "seek inspiration" — points at the Character and
    // Location tables as well as the briefing, and the Core Rulebook's remaining
    // case tables flesh out what the players can find. All were reachable only
    // from the GM screen, which a solo player never turns on. [Solo p.004, Ch09]
    const flesh = stepCard("Optional", "Flesh out the case", "Detail you can roll now or leave for play. The same generators live on the Scene tab.");
    flesh.append(grid(
      btn("⚡ Someone involved", () => {
        const sph = rollGrouped(S.CHARACTER_SPHERE).entry, tr = rollGrouped(S.CHARACTER_TRAIT).entry;
        const sk = lookupRange(S.NPC_SKILL_LEVEL, rollDie(8)), nat = lookupRange(S.NPC_NATURE, rollDie(10));
        show({ label: "NPC", text: `${tr} · ${sph} · ${nat.result}`, pin: `[NPC] ${tr} character from ${sph}; ${sk.name}; ${nat.result}`, title: "Someone involved",
          render: (b) => b.append(el("h3", { class: "roll-result roll-result--big" }, `${tr} · ${sph}`),
            el("div", { class: "roll-eyebrow" }, "Skill level"), el("p", { class: "muted" }, `${sk.name} — ${sk.dice}`),
            el("div", { class: "roll-eyebrow" }, "Human or Replicant"), el("p", { class: "muted" }, `${nat.result} — ${nat.detail}`)) });
      }, "primary"),
      btn("🎲 Where it starts", () => { const e = rollColumn(S.LOCATION_ENVIRONMENT), p2 = rollColumn(S.LOCATION_PLACE); show({ label: "Location", text: `${e.entry} ${p2.entry}`, pin: `[Location] ${e.entry} ${p2.entry}`, title: "Where it starts", render: (b) => b.append(el("h3", { class: "roll-result roll-result--big" }, `${e.entry} ${p2.entry}`), el("p", { class: "muted roll-center" }, `Environment D6=${e.d6}/D12=${e.d}  |  Place D6=${p2.d6}/D12=${p2.d}`)) }); }),
      btn("🎲 Cipher", () => { const m = rollColumn(S.CIPHER_METHOD), f = rollColumn(S.CIPHER_FOCUS); show({ label: "Cipher", text: `${m.entry} × ${f.entry}`, pin: `[Cipher] ${m.entry} × ${f.entry}`, title: "Cipher — interpret it", render: (b) => b.append(el("h3", { class: "roll-result roll-result--big" }, `${m.entry} × ${f.entry}`), el("p", { class: "muted roll-center" }, `Method D6=${m.d6}/D12=${m.d}  |  Focus D6=${f.d6}/D12=${f.d}`)) }); })));

    const sectorSelect = el("select", { class: "input roll-select" });
    GM.CASE_SECTOR.forEach((x) => sectorSelect.append(el("option", { value: x.sector, selected: x.sector === st.selectedSector || null }, x.sector)));
    sectorSelect.addEventListener("change", () => { st.selectedSector = sectorSelect.value; writeSoloState(st); });
    const more = el("details", { class: "rules__group solo-alt", open: st.moreOpen || null },
      el("summary", {}, "More Core case tables — clues, the finale, mood"),
      el("div", { class: "roll-row" }, el("span", { class: "muted roll-row__label" }, "Sector:"), sectorSelect),
      grid(
        btn("🎲 Clue (D8)", () => {
          const roll = rollDie(8); const row = lookupRange(GM.CASE_CLUES, roll);
          const detail = row.detailDie ? row.detail[rollDie(row.detailDie) - 1] : null;
          const text = detail ? `${row.type} — ${detail}` : row.type;
          show({ label: "Clue", text, pin: `[Clue] ${text}${row.note ? ` (${row.note})` : ""}`, title: `Clue — ${roll} (D8)`,
            render: (b) => b.append(...[el("h3", { class: "roll-result" }, row.type), detail ? el("p", {}, detail) : null, row.note ? el("p", { class: "muted" }, row.note) : null].filter(Boolean)) });
        }),
        btn("🎲 Sector location (D6×D6)", () => {
          const sector = st.selectedSector || GM.CASE_SECTOR[0].sector;
          const areas = GM.SECTOR_LOCATIONS[sector] || [];
          if (!areas.length) { showToast("No locations for that sector.", { kind: "warn" }); return; }
          const a = rollDie(6); const area = lookupRange(areas, a) || areas[0];
          const p2 = rollDie(6); const place = area.places[p2 - 1];
          show({ label: "Location", text: `${place} · ${area.area}`, pin: `[Location] ${place} — ${area.area}, ${sector}`, title: `${sector} — area ${a}, place ${p2}`,
            render: (b) => b.append(el("h3", { class: "roll-result" }, place), el("p", { class: "muted" }, `${area.area} · ${sector}`)) });
        }),
        btn("🎲 Final Confrontation (D10)", () => {
          const l = rollDie(10), e = rollDie(10);
          show({ label: "Finale", text: `${GM.CASE_FINALE_LOCATION[l - 1]} — ${GM.CASE_FINALE_ENVIRONMENT[e - 1]}`, pin: `[Finale] ${GM.CASE_FINALE_LOCATION[l - 1]} — ${GM.CASE_FINALE_ENVIRONMENT[e - 1]}`, title: `Final Confrontation — ${l}/${e} (D10)`,
            render: (b) => b.append(el("h3", { class: "roll-result roll-result--big" }, GM.CASE_FINALE_LOCATION[l - 1]), el("p", { class: "roll-center muted" }, GM.CASE_FINALE_ENVIRONMENT[e - 1])) });
        }),
        btn("🎲 Mood (D8×3)", () => {
          const w = GM.CASE_MOOD.weather[rollDie(8) - 1], sc = GM.CASE_MOOD.screen[rollDie(8) - 1], pb = GM.CASE_MOOD.passingBy[rollDie(8) - 1];
          show({ label: "Mood", text: `${w} · ${sc} · ${pb}`, pin: `[Mood] ${w}; on screen: ${sc}; passing by: ${pb}`, title: "Mood Pieces",
            render: (b) => b.append(el("div", { class: "roll-eyebrow" }, "Weather"), el("p", {}, w),
              el("div", { class: "roll-eyebrow" }, "On that screen"), el("p", {}, sc),
              el("div", { class: "roll-eyebrow" }, "Passing by"), el("p", {}, pb)) });
        })));
    more.addEventListener("toggle", () => { st.moreOpen = more.open; writeSoloState(st); });
    flesh.append(more);
    root.append(flesh);

    root.append(el("div", { class: "btn-row" }, btn("Briefed — start the first Shift →", () => { st.panel = "shift"; writeSoloState(st); rerender(); }, "primary")));

    // Case Table 3: D8 type, then D6 each for occupation, quirk, and both names.
    function rollMainNpc() {
      const t = GM.CASE_MAIN_NPCS[rollDie(8) - 1];
      return { type: t.type, occ: t.occupation[rollDie(6) - 1], quirk: t.quirk[rollDie(6) - 1],
        name: `${t.firstName[rollDie(6) - 1]} ${t.lastName[rollDie(6) - 1]}` };
    }

    function rollTable(label, arr, die) {
      const roll = rollDie(die); const t = arr[roll - 1];
      show({ label, text: t, title: `${label} — ${roll} (D${die})`, render: (b) => b.append(el("p", { class: "roll-prose" }, t)) });
    }
  }

  // ---- SHIFT: steps 1–2 ---------------------------------------------------
  function panelShift(root) {
    const ch = Store.getActive();
    const head = card(`Shift ${st.shiftNo}`, ch
      ? `${ch.name} · ♥ ${ch.state.health}/${maxHealth(ch)} · ◈ ${ch.state.resolve}/${maxResolve(ch)} · ${ch.state.shiftsSinceDowntime || 0}/${downtimeLimitFor(ch)} Shifts since Downtime`
      : "No active character — vitals and the Shift counter are tracked on a character sheet.");
    if (ch && (ch.state.shiftsSinceDowntime || 0) >= downtimeLimitFor(ch)) {
      head.append(el("p", { class: "roll-result--warn" }, "At the Downtime limit — another investigation Shift costs you 1 stress."));
    }
    head.append(el("div", { class: "btn-row" }, btn(ch ? "Open sheet →" : "Create a character →", () => navigate(ch ? "sheet" : "wizard"), "sm ghost")));
    head.append(procedureCard());
    root.append(head);

    root.append(stepCard(1, "Proceed to a location",
      "Decide where the leads point, then roll if you want the place itself generated. Travelling takes the Shift.",
      grid(btn("🎲 Location", () => { const e = rollColumn(S.LOCATION_ENVIRONMENT), p = rollColumn(S.LOCATION_PLACE); show({ label: "Location", text: `${e.entry} ${p.entry}`, pin: `[Location] ${e.entry} ${p.entry}`, title: "Location Generator", render: (b) => b.append(el("h3", { class: "roll-result roll-result--big" }, `${e.entry} ${p.entry}`), el("p", { class: "muted roll-center" }, `Environment D6=${e.d6}/D12=${e.d}  |  Place D6=${p.d6}/D12=${p.d}`)) }); }))));

    // Countdown Event Check — once per Shift, when you head to a new location.
    const TIMER_CARD = "Countdown Event Check";
    const timerCard = stepCard(2, TIMER_CARD, S.COUNTDOWN_TIMER.note);
    const chip = doneChip("countdown");
    if (chip) timerCard.append(el("div", { class: "chips" }, chip));
    timerCard.append(el("div", { class: "timer-display" }, el("span", { class: "timer-display__label" }, "Current Timer Die:"), el("span", { class: "timer-display__die" }, st.timerDie)));
    const stepTimer = (dir) => { const i = S.ESCALATION_STEPS.indexOf(st.timerDie) + dir; if (i >= 0 && i < S.ESCALATION_STEPS.length) { st.timerDie = S.ESCALATION_STEPS[i]; writeSoloState(st); rerender(); } };
    timerCard.append(el("div", { class: "btn-row" },
      btn("🎲 Roll the timer", async () => {
        if (!(await onceThisShift("countdown", "The Countdown Event Check"))) return;
        // Solo Mode p.006: "If any timer die rolls one or more successes, a
        // Countdown Event is TRIGGERED." No trigger → the timer escalates.
        const parts = st.timerDie.split("/"); let successes = 0; const rr = [];
        for (const part of parts) { const size = parseInt(part.replace("D", ""), 10) || 6; const r = rollDie(size); rr.push(`D${size}:${r}`); if (r >= D.SUCCESS_THRESHOLD) successes++; }
        setFlag("countdown");
        if (successes > 0) {
          const evRoll = rollDie(12); const ev = S.COUNTDOWN_EVENT[evRoll - 1]; st.timerDie = S.ESCALATION_STEPS[0];
          st.pendingEvent = { name: ev.name, examples: ev.examples, shift: st.shiftNo || 1 };
          show({ label: "Countdown Event", text: `Triggered · ${ev.name}`, pin: `[Countdown] TRIGGERED — ${ev.name}: ${ev.examples}`,
            title: "⚠️ Countdown Event Triggered!", render: (b) => b.append(el("p", { class: "roll-result--warn" }, `Rolled ${rr.join(", ")} (${successes} success${successes > 1 ? "es" : ""}) — the event fires. Timer resets to ${S.ESCALATION_STEPS[0]}.`), el("div", { class: "roll-eyebrow" }, `Event #${evRoll} — ${ev.name}`), el("p", { class: "roll-prose" }, ev.examples)) });
        } else {
          const i = S.ESCALATION_STEPS.indexOf(st.timerDie); if (i !== -1 && i < S.ESCALATION_STEPS.length - 1) st.timerDie = S.ESCALATION_STEPS[i + 1];
          show({ label: "Timer", text: `${rr.join(", ")} · no event → ${st.timerDie}`, pin: `[Timer] No event (${rr.join(", ")}) → ${st.timerDie}`,
            title: "Countdown Timer — No Event", render: (b) => b.append(el("p", { class: "roll-result--ok" }, `Rolled ${rr.join(", ")} (no successes).`), el("p", { class: "muted" }, `No event this Shift — the pressure builds. Timer upgraded to ${st.timerDie}.`)) });
        }
      }),
      btn("▲ Upgrade", () => stepTimer(1), "sm ghost"),
      btn("▼ Downgrade", () => stepTimer(-1), "sm ghost"),
      // A reset UNDOES this Shift's check: the die goes back to the start of the
      // ladder, the "done this Shift" marker clears, and the stale result is
      // dropped — otherwise the card kept claiming the check was already made.
      btn(`✕ Reset (${S.ESCALATION_STEPS[0]})`, () => {
        st.timerDie = S.ESCALATION_STEPS[0];
        setFlag("countdown", false);
        if (st.results) delete st.results[TIMER_CARD];
        writeSoloState(st);
        rerender();
      }, "sm ghost")));
    root.append(timerCard);

    root.append(el("div", { class: "btn-row" }, btn(
      st.pendingEvent ? "The event interrupts — play it out →" : "At the location — play the scenes →",
      () => { st.panel = "scene"; writeSoloState(st); rerender(); window.scrollTo(0, 0); }, "primary")));
  }

  // ---- SCENE: steps 3-4 ---------------------------------------------------
  function panelScene(root) {
    // A triggered Countdown Event follows you here — it is a scene, and the loop
    // used to hand you the prose and stop.
    if (st.pendingEvent) {
      const ev = st.pendingEvent;
      const card2 = card(`Interruption — ${ev.name}`, "A Countdown Event fired. Frame it as a scene: as you set off, or waiting for you at the location.");
      card2.prepend(el("div", { class: "roll-eyebrow step-eyebrow" }, "Play this first"));
      card2.append(el("p", { class: "roll-prose" }, ev.examples),
        el("div", { class: "btn-row" },
          btn("✓ Played it out", () => { st.pendingEvent = null; writeSoloState(st); showToast("Interruption resolved — carry on with the location."); rerender(); }, "sm"),
          btn("📌 Pin it to the notes", () => pinNote(`[Countdown] ${ev.name}: ${ev.examples}`), "sm ghost")));
      root.append(card2);
    }
    const oddsSelect = el("select", { class: "input roll-select" },
      el("option", { value: "normal" }, "Normal odds (1D10)"),
      el("option", { value: "high" }, "High prob (2D10 keep highest)"),
      el("option", { value: "low" }, "Low prob (2D10 keep lowest)"));

    // Step 3 - set the shape of the situation before you touch a skill.
    root.append(stepCard(3, "Frame the scene",
      "Check only when you are unsure how hard a situation is. Stuck for a scene at all? Roll a category.",
      grid(btn("🎲 Scene Check (D8)", () => { const roll = rollDie(8); const res = lookupRange(S.SCENE_CHECK, roll); show({ label: "Scene Check", text: `D8→${roll} · ${res.result}`, pin: `[Scene Check] ${res.result}`, title: `Scene Check — ${roll} (D8)`, render: (b) => { b.append(el("h3", { class: "roll-result" }, res.result)); if (res.detail) b.append(el("p", { class: "muted" }, res.detail)); } }); }),
        btn("🎲 Scene Category (D12)", () => { const roll = rollDie(12); const res = S.SCENE_CATEGORIES[roll - 1]; show({ label: "Scene Category", text: res.name, pin: `[Scene Category] ${res.name} — ${res.detail}`, title: `Scene Category — ${roll} (D12)`, render: (b) => b.append(el("h3", { class: "roll-result" }, res.name), el("p", {}, res.detail), el("div", { class: "roll-eyebrow" }, "Suggested Skills"), el("p", { class: "muted" }, res.skills.join(", "))) }); }))));

    // Step 4a - resolving the action itself.
    root.append(stepCard(4, "Roll it out",
      "Skill rolls happen on your character sheet. These answer the questions around the roll.",
      grid(btn("🎲 Question Check", () => {
          const odds = oddsSelect.value; let roll = rollDie(10); let d = `${roll}`;
          if (odds === "high") { const a = rollDie(10), c = rollDie(10); roll = Math.max(a, c); d = `${a},${c}→${roll}`; }
          else if (odds === "low") { const a = rollDie(10), c = rollDie(10); roll = Math.min(a, c); d = `${a},${c}→${roll}`; }
          const res = lookupRange(S.QUESTION_CHECK, roll);
          show({ label: "Question", text: `${d} · ${res.result}`, pin: `[Question] ${res.result}`, title: `Question Check — ${d} (D10)`, render: (b) => { b.append(el("h3", { class: "roll-result" }, res.result)); if (res.detail) b.append(el("p", { class: "muted" }, res.detail)); } });
        }),
        btn("🎲 Crit Success (D8)", () => { const roll = rollDie(8); const res = S.CRITICAL_SUCCESS[roll - 1]; show({ label: "Crit Success", text: res.name, pin: `[Crit Success] ${res.name} — ${res.bonus}`, title: `Critical Success — ${roll} (D8)`, render: (b) => b.append(el("h3", { class: "roll-result" }, res.name), el("p", {}, res.text), el("div", { class: "roll-eyebrow" }, "Bonus"), el("p", { class: "muted" }, res.bonus)) }); }),
        btn("🎲 Cipher", () => { const m = rollColumn(S.CIPHER_METHOD), f = rollColumn(S.CIPHER_FOCUS); show({ label: "Cipher", text: `${m.entry} × ${f.entry}`, pin: `[Cipher] ${m.entry} × ${f.entry}`, title: "Cipher Oracle", render: (b) => b.append(el("h3", { class: "roll-result roll-result--big" }, `${m.entry} × ${f.entry}`), el("p", { class: "muted roll-center" }, `Method D6=${m.d6}/D12=${m.d}  |  Focus D6=${f.d6}/D12=${f.d}`)) }); })),
      el("div", { class: "roll-row" }, el("span", { class: "muted roll-row__label" }, "Question odds:"), oddsSelect),
      el("p", { class: "muted roll-note" }, S.QUESTION_ODDS_NOTE),
      rollHere()));

    // Step 4b - what you find.
    root.append(stepCard(4, "Gather clues", "Assemble a clue: what it means, and the evidence itself.",
      grid(btn("🎲 Meaning (D8)", () => { const r = rollDie(8); const t = S.CLUE_MEANING[r - 1]; show({ label: "Clue Meaning", text: t, pin: `[Meaning] ${t}`, title: `Clue Meaning — ${r} (D8)`, render: (b) => b.append(el("p", { class: "roll-prose" }, t)) }); }),
        btn("🎲 Evidence Descriptor", () => { const g = rollGrouped(S.CLUE_EVIDENCE_DESCRIPTOR); const e = g.entry; show({ label: "Evidence Descriptor", text: `${e.result} — ${e.detail}`, pin: `[Evidence] ${e.result}: ${e.detail}`, title: `Evidence Descriptor — D6=${g.d6}/D10=${g.d}`, render: (b) => b.append(el("h3", { class: "roll-result" }, e.result), el("p", { class: "muted" }, e.detail)) }); }),
        btn("🎲 Evidence Type", () => { const g = rollGrouped(S.CLUE_EVIDENCE_TYPE); show({ label: "Evidence Type", text: g.entry, pin: `[Evidence Type] ${g.entry}`, title: `Evidence Type — D6=${g.d6}/D12=${g.d}`, render: (b) => b.append(el("h3", { class: "roll-result" }, g.entry)) }); }),
        btn("⚡ Full clue", () => {
          const m = S.CLUE_MEANING[rollDie(8) - 1];
          const d = rollGrouped(S.CLUE_EVIDENCE_DESCRIPTOR).entry, t = rollGrouped(S.CLUE_EVIDENCE_TYPE).entry;
          show({ label: "Clue", text: `${d.result} ${t}`, pin: `[Clue] ${d.result} ${t} — ${d.detail} Meaning: ${m}`, title: "Imagined Clue",
            render: (b) => b.append(el("h3", { class: "roll-result roll-result--big" }, `${d.result} ${t}`), el("p", {}, d.detail), el("div", { class: "roll-eyebrow" }, "Meaning"), el("p", { class: "muted" }, m)) });
        }, "primary"))));

    // Step 4c - who you meet. Skill Level sits with the other NPC rolls.
    root.append(stepCard(4, "People you meet", "Generate an NPC: sphere of life, a defining trait, and how good they are.",
      grid(btn("🎲 Sphere", () => { const g = rollGrouped(S.CHARACTER_SPHERE); show({ label: "Sphere", text: g.entry, pin: `[Sphere] ${g.entry}`, title: `Character Sphere — D6=${g.d6}/D8=${g.d}`, render: (b) => b.append(el("h3", { class: "roll-result" }, g.entry)) }); }),
        btn("🎲 Trait", () => { const g = rollGrouped(S.CHARACTER_TRAIT); show({ label: "Trait", text: g.entry, pin: `[Trait] ${g.entry}`, title: `Character Trait — D6=${g.d6}/D12=${g.d}`, render: (b) => b.append(el("h3", { class: "roll-result" }, g.entry)) }); }),
        btn("🎲 Human or Replicant (D10)", () => {
          const r = rollDie(10); const n = lookupRange(S.NPC_NATURE, r);
          show({ label: "NPC Nature", text: `D10→${r} · ${n.result}`, pin: `[NPC Nature] ${n.result} — ${n.detail}`, title: `Human or Replicant — ${r} (D10)`,
            render: (b) => b.append(el("h3", { class: "roll-result" }, n.result), el("p", { class: "muted" }, n.detail)) });
        }),
        btn("🎲 NPC Skill (D8)", () => { const roll = rollDie(8); const res = lookupRange(S.NPC_SKILL_LEVEL, roll); show({ label: "NPC Skill", text: res.name, pin: `[NPC Skill] ${res.name} (${res.dice})`, title: `NPC Skill Level — ${roll} (D8)`, render: (b) => b.append(el("h3", { class: "roll-result" }, res.name), el("p", { class: "muted" }, `Dice pool: ${res.dice}`)) }); }),
        btn("⚡ Full NPC", () => {
          const sph = rollGrouped(S.CHARACTER_SPHERE).entry, tr = rollGrouped(S.CHARACTER_TRAIT).entry, sk = lookupRange(S.NPC_SKILL_LEVEL, rollDie(8));
          const nat = lookupRange(S.NPC_NATURE, rollDie(10));
          show({ label: "NPC", text: `${tr} · ${sph} · ${nat.result}`, pin: `[NPC] ${tr} character from ${sph}; ${sk.name}; ${nat.result}`, title: "Generated NPC",
            render: (b) => b.append(el("h3", { class: "roll-result roll-result--big" }, `${tr} · ${sph}`), el("p", {}, `A ${tr.toLowerCase()} character connected to ${sph.toLowerCase()}.`), el("div", { class: "roll-eyebrow" }, "Skill Level"), el("p", { class: "muted" }, `${sk.name} — ${sk.dice}`), el("div", { class: "roll-eyebrow" }, "Human or Replicant"), el("p", { class: "muted" }, `${nat.result} — ${nat.detail}`)) });
        }, "primary")),
      el("p", { class: "muted roll-note" }, `Roll for an NPC only when they are pitted directly against you \u2014 and never push an NPC's roll. Not worth statting? Assume ${S.NPC_SKILL_DEFAULT}.`)));

    // Step 4d - when it turns violent.
    root.append(stepCard(4, "Combat & chases", "Direct the opposition, then run the fight in the tracker.",
      grid(btn("🎲 NPC Tactics (D8)", () => { const r = rollDie(8); const t = lookupRange(S.NPC_TACTICS, r); show({ label: "NPC Tactics", text: t.name, pin: `[NPC Tactics] ${t.name} — ${t.behavior}`, title: `NPC Tactics — ${r} (D8)`, render: (b) => b.append(el("h3", { class: "roll-result" }, t.name), el("p", { class: "muted" }, t.behavior)) }); }),
        btn("🎲 NPC Chase Maneuver (D8)", () => { const r = rollDie(8); const m = lookupRange(S.NPC_CHASE_MANEUVERS, r); show({ label: "NPC Chase Maneuver", text: `Pursuer: ${m.pursuer} · Prey: ${m.prey}`, pin: `[Chase] Pursuer: ${m.pursuer} / Prey: ${m.prey}`, title: `NPC Chase Maneuver — ${r} (D8)`, render: (b) => b.append(el("div", { class: "roll-eyebrow" }, "If the NPC is the Pursuer"), el("p", {}, m.pursuer), el("div", { class: "roll-eyebrow" }, "If the NPC is the Prey"), el("p", {}, m.prey)) }); })),
      el("div", { class: "btn-row" }, btn("Combat Tracker \u2192", () => navigate("combat"), "sm ghost"))));

    root.append(el("div", { class: "btn-row" }, btn("Scenes done \u2014 review the leads \u2192", () => { st.panel = "leads"; writeSoloState(st); rerender(); }, "primary")));
  }

  // ---- BOARD: a house aid, not part of the printing -----------------------
  function panelBoard(root) {
    renderBoardPanel(root, {
      card, btn, grid, show, rerender,
      pin: pinNote,
      // The board is a house aid, so it carries a link to its own walkthrough.
      openGuide: () => { try { localStorage.setItem(TUTORIAL_KEY, "board"); } catch {} navigate("tutorial"); },
      // A promoted suspect becomes a hypothesis on the Leads tab, so the case
      // still closes through the book's own Hypothesis Check.
      onPromote: (text) => {
        st.hypotheses.push({ id: uid(), text, die: S.HYPOTHESIS.newRating });
        setFlag("review");
        writeSoloState(st);
        rerender();
      },
    });
    root.append(el("div", { class: "btn-row" },
      btn("Board reviewed \u2014 on to your leads \u2192", () => { st.panel = "leads"; writeSoloState(st); rerender(); window.scrollTo(0, 0); }, "primary")));
  }

  // ---- LEADS: steps 5-6 ---------------------------------------------------
  function panelLeads(root) {
    const review = stepCard(5, "Review your hypotheses",
      "Once per Shift, when the location's scenes are resolved: add a theory at D6, upgrade or downgrade whatever the evidence moved.");
    const chip = doneChip("review");
    if (chip) review.append(el("div", { class: "chips" }, chip));
    const hypList = el("div", { class: "hyp-list" });
    if (!st.hypotheses.length) hypList.append(el("p", { class: "muted" }, "No active hypotheses."));
    st.hypotheses.forEach((h, i) => {
      // Any add/upgrade/downgrade counts as this Shift's review (soft marker).
      const stepHyp = (dir) => { const idx = S.ESCALATION_STEPS.indexOf(h.die) + dir; if (idx >= 0 && idx < S.ESCALATION_STEPS.length) { h.die = S.ESCALATION_STEPS[idx]; setFlag("review"); writeSoloState(st); rerender(); } };
      hypList.append(el("div", { class: "hyp-row" },
        el("div", { class: "hyp-row__main" }, el("strong", { class: "hyp-row__die" }, `[${h.die}]`), el("span", {}, h.text)),
        el("div", { class: "btn-row" }, btn("🎲 Check", () => hypothesisCheck(h), "sm"), btn("▲", () => stepHyp(1), "sm ghost"), btn("▼", () => stepHyp(-1), "sm ghost"), btn("✕", () => { st.hypotheses.splice(i, 1); writeSoloState(st); rerender(); }, "sm ghost"))));
    });
    review.append(hypList, btn("＋ Add Hypothesis", async () => { const t = await promptModal("Hypothesis theory / lead", { title: "Add Hypothesis", okLabel: "Add" }); if (t && t.trim()) { st.hypotheses.push({ id: uid(), text: t.trim(), die: S.HYPOTHESIS.newRating }); setFlag("review"); writeSoloState(st); rerender(); } }, "sm"));
    root.append(review);

    root.append(stepCard(6, "Hypothesis Check",
      "When an action or circumstance will conclusively prove or disprove a theory, press the Check button on its row above. It rolls the rating as Base Dice and cannot be pushed.",
      el("p", { class: "muted small" }, `${S.HYPOTHESIS_CHECK.crit.name}: ${S.HYPOTHESIS_CHECK.crit.pp > 0 ? "+" : ""}${S.HYPOTHESIS_CHECK.crit.pp} PP \u00b7 ${S.HYPOTHESIS_CHECK.success.name}: +${S.HYPOTHESIS_CHECK.success.pp} PP \u00b7 ${S.HYPOTHESIS_CHECK.failure.name}: ${S.HYPOTHESIS_CHECK.failure.pp} PP`)));

    root.append(el("div", { class: "btn-row" }, btn("Leads reviewed \u2014 end the Shift \u2192", () => { st.panel = "wrap"; writeSoloState(st); rerender(); }, "primary")));
  }

  // ---- WRAP: step 7 -------------------------------------------------------
  function panelWrap(root) {
    const ch = Store.getActive();
    const endCard = stepCard(7, "End the Shift",
      ch ? `${ch.name} \u2014 ${ch.state.shiftsSinceDowntime || 0}/${downtimeLimitFor(ch)} Shifts since Downtime.`
         : "No active character \u2014 the Shift counter lives on a character sheet.");
    endCard.append(el("div", { class: "btn-row" },
      btn("\u25b6 End the Shift (investigation)", () => {
        const closed = st.shiftNo || 1;
        st.shiftNo = closed + 1;
        st.shiftFlags = {};
        st.pendingEvent = null;
        writeSoloState(st);
        if (!ch) { showToast(`Shift ${closed} closed. No active character to log it against.`, { kind: "warn" }); rerender(); return; }
        const r = applyInvestigationShift(ch);
        Store.save(ch);
        record("Shift", `Shift ${closed} closed \u00b7 ${r.shifts}/${r.limit} since Downtime${r.overLimit ? " \u00b7 +1 stress" : ""}`,
          `[Shift ${closed}] closed \u2014 ${r.shifts}/${r.limit} Shifts since Downtime${r.overLimit ? " (+1 stress)" : ""}`);
        showToast([`Shift closed \u2014 now Shift ${st.shiftNo}.`,
          r.overLimit ? "Over the Downtime limit: +1 stress." : "",
          r.brokenHeal ? `Broken and alone: +${r.brokenHeal} Health.` : ""].filter(Boolean).join(" "),
          { kind: r.overLimit ? "warn" : "info" });
      }, "primary"),
      btn("\u{1F6CC} Take Downtime instead", async () => {
        if (!ch) { showToast("No active character.", { kind: "warn" }); return; }
        const care = await confirmModal("Spend this Downtime under medical care (or with a MedChecker)?", { title: "Downtime Shift", okLabel: "With care", cancelLabel: "On your own" });
        const r = applyDowntimeShift(ch, care);
        Store.save(ch);
        st.shiftNo = (st.shiftNo || 1) + 1;
        st.shiftFlags = {};
        st.pendingEvent = null;
        writeSoloState(st);
        record("Downtime", `+${r.health} Health, +${r.resolve} Resolve \u00b7 counter reset`, `[Downtime] +${r.health} Health, +${r.resolve} Resolve`);
        showToast(`Downtime Shift: +${r.health} Health, +${r.resolve} Resolve.`);
      }, "ghost")));
    endCard.append(el("p", { class: "muted small" }, "No Countdown Event Check on a Downtime Shift."));
    root.append(endCard);

    root.append(stepCard(7, "Downtime scene", "Roll how the off-hours go.",
      grid(btn("🎲 Downtime Event (D12)", () => { const roll = rollDie(12); const ev = S.DOWNTIME_EVENT[roll - 1]; show({ label: "Downtime Event", text: `D12→${roll}`, pin: `[Downtime] Home: ${ev.home} / Street: ${ev.street}`, title: `Downtime Event — ${roll} (D12)`, render: (b) => b.append(el("div", { class: "roll-eyebrow" }, "At Home"), el("p", {}, ev.home), el("div", { class: "roll-eyebrow" }, "On the Street"), el("p", {}, ev.street)) }); }))));

    const c = stepCard(7, "Award your points", "Tick these as they happen, then apply the total — the app does the counting.");
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

    // The totals are fully derivable — Humanity is one per tick, Promotion is
    // gains minus losses — so the player should never be doing this arithmetic.
    const ticked = (m) => Object.values(m).filter(Boolean).length;
    const hum = ticked(st.humanityChecks), gain = ticked(st.promoGainChecks), lose = ticked(st.promoLoseChecks);
    const ppTotal = gain - lose;
    c.append(el("p", { class: "muted small" },
      `Ticked: Humanity +${hum} · Promotion +${gain} −${lose} = ${ppTotal >= 0 ? "+" : ""}${ppTotal}.`));
    if (hum || gain || lose) {
      c.append(el("div", { class: "btn-row" },
        btn(`✔ Apply to ${ch ? ch.name : "your character"}`, async () => {
          if (!ch) { showToast("No active character.", { kind: "warn" }); return; }
          const bits = [hum ? `+${hum} Humanity` : null, ppTotal ? `${ppTotal > 0 ? "+" : ""}${ppTotal} Promotion` : null].filter(Boolean).join(" and ");
          if (!bits) { showToast("Nothing to apply — the gains and losses cancel out."); return; }
          const ok = await confirmModal(`Give ${ch.name} ${bits}, and clear the checklists?`,
            { title: "Apply your awards", okLabel: "Apply" });
          if (!ok) return;
          applyPoints(ch, { pp: ppTotal, humanity: hum });
          st.humanityChecks = {}; st.promoGainChecks = {}; st.promoLoseChecks = {};
          record("Awards", bits, `[Awards] ${ch.name}: ${bits}`);
          showToast(`${ch.name}: ${bits}. Promotion ${ch.state.promotionPoints}, Humanity ${ch.state.humanityPoints}.`);
        }, "primary"),
        btn("Open sheet to spend them →", () => navigate("sheet"), "sm ghost")));
    } else {
      c.append(el("div", { class: "btn-row" }, btn("Open sheet to spend them →", () => navigate("sheet"), "sm ghost")));
    }
    root.append(c);

    root.append(el("div", { class: "btn-row" }, btn("New Shift \u2014 back to the streets \u2192", () => { st.panel = "shift"; writeSoloState(st); rerender(); }, "primary")));
  }

  function panelNotes(root) {
    // "Solo" shows the oracle's own log; "All rolls" shows the global roll log —
    // every skill roll, attack and oracle result from anywhere in the app — so
    // any of them can be pinned into the case notes.
    const scope = st.logScope === "all" ? "all" : "solo";
    const globalRolls = () => RollLog.list().slice(0, 50).map((e) => ({
      id: e.id, ts: e.ts,
      label: e.charName ? `${e.charName} · ${e.label}` : e.label,
      text: e.text,
      pin: `[${e.charName ? `${e.charName} · ` : ""}${e.label}] ${e.text}`,
    }));
    const entries = scope === "all" ? globalRolls() : (st.log || []);
    const scopeChip = (label, key) => el("button", {
      class: "chip" + (scope === key ? " chip--on" : ""),
      onClick: () => { st.logScope = key; writeSoloState(st); rerender(); },
    }, label);
    root.append(rollLogCard({
      entries,
      title: scope === "all" ? "Roll Log — every roll" : "Roll Log — solo oracle",
      pinLabel: "Pin to case notes",
      head: el("div", { class: "chips rolllog__scope" }, scopeChip("Solo oracle", "solo"), scopeChip("All rolls", "all")),
      onPin: (e) => pinNote(e.pin || `[${e.label}] ${e.text}`),
      onDelete: (e) => {
        if (scope === "all") RollLog.remove(e.id);
        else st.log = (st.log || []).filter((x) => x.id !== e.id);
        writeSoloState(st); rerender();
      },
      onClear: async () => {
        const ok = await confirmModal(scope === "all" ? "Clear the global roll log?" : "Clear the solo oracle log?", { title: "Clear Roll Log", danger: true });
        if (!ok) return;
        if (scope === "all") RollLog.clear(); else st.log = [];
        writeSoloState(st); rerender();
      },
    }));
    const c = card("Solo Case Notes", "Persistent scratchpad, oldest at the top. Pinned rolls and briefings are added at the bottom.");
    const ta = el("textarea", { class: "input notes-area", rows: 10, placeholder: "Record clues, suspects, and timeline events..." });
    ta.value = st.scratchpad || "";
    // newest entry is at the bottom — show it
    requestAnimationFrame(() => { ta.scrollTop = ta.scrollHeight; });
    ta.addEventListener("blur", () => { st.scratchpad = ta.value; writeSoloState(st); showToast("Notes saved."); });
    c.append(ta);
    c.append(el("div", { class: "btn-row" },
      // One action, and it wipes the whole case (owner ruling): every solo tab,
      // every inline result, both roll logs, the Case Board, and any fight or
      // chase left over from the old case. Characters are NOT touched — vitals,
      // points, inventory, injuries and journal entries all live on the sheet.
      btn("⟲ Start a fresh case", async () => {
        const ok = await confirmModal(
          "Wipe the whole case: every solo tab, all roll results, all pinned notes, both roll logs, the Case Board, and any fight or chase still open. Your characters are not touched — vitals, points, inventory and journal entries stay exactly as they are.",
          { title: "Start a fresh case", okLabel: "Wipe everything", danger: true });
        if (!ok) return;
        // Solo's own state: notes, oracle log, inline results on every tab,
        // leads, checklists, the timer, and the Shift counter.
        st.scratchpad = "";
        st.log = [];
        st.results = {};
        st.hypotheses = [];
        st.humanityChecks = {}; st.promoGainChecks = {}; st.promoLoseChecks = {};
        st.timerDie = S.ESCALATION_STEPS[0];
        st.shiftNo = 1; st.shiftFlags = {}; st.selectedTheme = null; st.pendingEvent = null;
        st.panel = "case";              // a new case starts on the Case tab
        // Everything else this case wrote outside the solo screen.
        RollLog.clear();                // the global log, shown here, on the sheet and on Home
        Board.clear();
        Combat.clear();                 // the combatant list and initiative, not anyone's Health
        Chase.clear();
        writeSoloState(st);
        showToast("Fresh case — everything cleared. Your characters are untouched.");
        rerender();
      }, "sm ghost")));
    root.append(c);
    root.append(el("div", { class: "btn-row" }, btn("Back to the case \u2014 next Shift \u2192", () => { st.panel = "shift"; writeSoloState(st); rerender(); window.scrollTo(0, 0); }, "primary")));
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
  // Record the button so a result raised by this click knows which card it
  // belongs to (and which button to press again on Reroll).
  const b = el("button", { class: cls.trim(), onClick: (e) => { activeBtn = b; onClick(e); } }, label);
  return b;
}
