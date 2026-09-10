// play.js — GUIDED PLAY. One question at a time, in plain words.
//
// The rest of the Solo screen is a toolbox: it assumes you know which table to
// roll and what to say about the answer. This panel assumes you know nothing.
// It shows ONE card, tells you what just happened in ordinary English, and
// offers two to four concrete things you could do next. Every button underneath
// is the same official machinery the other tabs expose — the location tables,
// the Countdown check, skill rolls, clues, the Hypothesis Check — just chosen
// for you and narrated.
//
// It owns no rules of its own. It has no state of its own either: the case, the
// notes, the Shift counter and the character all live where they already lived,
// so you can drop out into the tabs at any point and back again.

import * as S from "../data-solo.js";
import * as D from "../data.js";
import { el, rollDie, successesFor, outcomeSummary } from "./core.js";
import { showToast, promptModal } from "./ui.js";
import { lookupRange, rollColumn, skill as findSkill } from "./rules.js";
import { Store, RollLog } from "./store.js";
import { maxHealth, maxResolve } from "./derived.js";
import { rollClue, rollSuspect, Board, addBox, connect, byId, isFull } from "./board.js";
import { skillPool, pushPoolPublic, poolIsPushable } from "./roller.js";
import * as H from "../data-house.js";

// The four things a detective does at a place, in the player's words, each
// mapped to the skill the book would have you roll.
const ACTIONS = [
  { key: "observation", verb: "🔍 Look the place over", finds: "clue" },
  { key: "tech", verb: "🔬 Examine something closely", finds: "clue" },
  { key: "manipulation", verb: "💬 Talk to whoever is here", finds: "person" },
  { key: "connections", verb: "📞 Put the word out", finds: "person" },
];

// How many things you can turn up at one place before the app suggests moving on.
const ACTIONS_PER_LOCATION = 3;

export function renderPlayPanel(root, ctx) {
  const { card, btn, st, save, rerender, openCase, closeCase, rollBriefing, rollMainNpc, addNote, pinNote, applyPoints, navigate } = ctx;
  const ch = Store.getActive();
  const p = (st.play ||= blank());

  // ---- the one card on screen -------------------------------------------
  // title: where you are. prose: what just happened. choices: what you can do.
  function ask({ eyebrow, title, prose, choices, footer }) {
    const c = card(title, null);
    if (eyebrow) c.prepend(el("div", { class: "roll-eyebrow step-eyebrow" }, eyebrow));
    for (const line of [].concat(prose || [])) {
      if (line) c.append(el("p", { class: "play__prose" }, line));
    }
    const row = el("div", { class: "play__choices" });
    for (const [label, fn, variant] of choices.filter(Boolean)) row.append(btn(label, fn, variant || "primary"));
    c.append(row);
    if (footer) c.append(el("p", { class: "muted small" }, footer));
    root.append(c);
  }

  const set = (patch) => { Object.assign(p, patch); save(); rerender(); };
  const say = (text) => { addNote(text); };

  // ---- no character: make one, no questions asked -------------------------
  if (!ch) {
    ask({
      eyebrow: "Start here",
      title: "You need a detective",
      prose: ["You play one Blade Runner: a cop who hunts replicants in a rained-out Los Angeles.",
        "The app can roll you a complete, legal one — name, background, skills and gear — in one press. You can change any of it later."],
      choices: [["⚄ Roll me a detective", () => navigate("wizard")]],
      footer: "Takes about ten seconds. Then come straight back here.",
    });
    return;
  }

  // ---- dead: nothing else happens until there is a new detective ----------
  if (ch.state?.dead) {
    ask({
      eyebrow: "End of the line",
      title: `${ch.name} is dead`,
      prose: ["That case ended the way some of them do. Nothing more happens on this sheet — no rolls, no Shifts, no new case.",
        "Roll up a replacement and pick the thread back up; your closed case files stay in the record."],
      choices: [["⚄ Roll me a new detective", () => navigate("wizard")],
        ["Look at the old sheet", () => navigate("sheet"), "sm ghost"]],
    });
    return;
  }

  // ---- no case: hand them one --------------------------------------------
  if (!st.caseOpen) {
    // Dispatch's offer sits in this branch too — the case is not open until it
    // is accepted and named.
    if (p.stage === "briefed" && p.briefing) { briefed(); return; }
    ask({
      eyebrow: "Start here",
      title: `${ch.name}, you have no case`,
      prose: ["Dispatch will hand you one. You'll get an assignment, why it matters, what's already gone wrong, and why it's personal.",
        "You don't have to understand any rules. This screen asks you one question at a time and does the dice itself."],
      choices: [["▶ Get me a case", startCase]],
      footer: "Everything you find is written into your case notes as you go.",
    });
    return;
  }

  // ---- the loop ------------------------------------------------------------
  const stage = p.stage || "plan";
  ({ plan, travel, here, result, accuse, solved, briefed }[stage] || plan)();

  // Where do you go? Three real places, or pick your own.
  function plan() {
    const opts = p.options?.length ? p.options : rollPlaces();
    if (!p.options) { p.options = opts; save(); }
    ask({
      eyebrow: `Shift ${st.shiftNo || 1}`,
      title: "Where do you go?",
      prose: [st.caseOpen.assignment ? `The case: ${st.caseOpen.assignment}` : null,
        p.leadHint || null,
        // After Shift 1 you are following something, so stop telling the player
        // there is no wrong answer. [playtest journal, finding 9]
        (p.suspects || []).length
          ? `You are looking at ${p.suspects[0].name}. Go where that leads, or somewhere new.`
          : (st.shiftNo || 1) > 1
            ? "Follow what you turned up, or try a different corner of the case."
            : "Pick somewhere to start. There is no wrong answer — the case fills in around wherever you look."],
      choices: [
        ...opts.map((o) => [`📍 ${o}`, () => goTo(o), "primary"]),
        ["✎ Somewhere else", askPlace, "sm ghost"],
        ["🎲 Different options", () => set({ options: null }), "sm ghost"],
      ],
      footer: "Travelling there takes a Shift — about half a day.",
    });
  }

  // Arriving: the Countdown check happens here, and gets narrated.
  function travel() {
    const ev = p.event;
    ask({
      eyebrow: "On the way",
      title: p.location,
      prose: ev
        ? [`Something goes wrong before you even get inside: ${ev.name.toLowerCase()}.`, ev.examples,
           "Play it out however you like — then get on with the search."]
        : ["You get there without trouble. The pressure is building, though; it will catch up with you eventually."],
      choices: [["Go in →", () => set({ stage: "here", event: null })]],
    });
  }

  // At the place: what do you do?
  function here() {
    const found = p.found || 0;
    const suspects = p.suspects || [];
    ask({
      eyebrow: p.danger ? `${p.location} — ${p.danger}` : p.location,
      title: "What do you do?",
      prose: [p.lastNarration || "You're here. Nothing has jumped out at you yet.",
        found >= ACTIONS_PER_LOCATION ? "You've turned this place over pretty thoroughly. Somewhere else might be more use." : null],
      choices: [
        ...ACTIONS.map((a) => [a.verb, () => doAction(a), found >= ACTIONS_PER_LOCATION ? "sm ghost" : "primary"]),
        suspects.length ? [`🎯 I think ${suspects[0].name} did it`, () => set({ stage: "accuse" }), "sm"] : null,
        ["🚕 Go somewhere else", nextShift, found >= ACTIONS_PER_LOCATION ? "primary" : "sm ghost"],
      ],
      footer: `Health ${ch.state.health}/${maxHealth(ch)} · Resolve ${ch.state.resolve}/${maxResolve(ch)}${suspects.length ? ` · ${suspects.length} name${suspects.length === 1 ? "" : "s"} so far` : ""}`,
    });
  }

  // What the roll turned up, and whether to press your luck.
  function result() {
    const r = p.pending;
    if (!r) { set({ stage: "here" }); return; }
    ask({
      eyebrow: r.ok ? "That worked" : "No luck",
      title: r.heading,
      prose: [r.prose, r.detail, r.stateNote ? `Your condition counted: ${r.stateNote}.` : null],
      choices: [
        r.ok ? ["✓ Write it down and carry on", keepResult] : null,
        // The Board's own economy was unreachable from the default panel: only
        // Scene-tab and sheet rolls offered a check. [playtest journal, finding 1]
        r.ok && !p.earned && H.DISCOVERY_SKILLS.includes(r.key)
          ? ["🔍 Bank a Discovery Check (house aid)", () => {
              const n = Board.earn(1);
              showToast(`Discovery Check banked — ${n} waiting on the Case Board.`);
              set({ earned: true });
            }, "sm ghost"] : null,
        !r.ok && r.canPush ? ["😤 Push yourself — try again harder", pushIt, "primary"] : null,
        !r.ok ? ["Let it go", () => set({ stage: "here", pending: null,
          lastNarration: "That line of enquiry came to nothing. Try something else, or somewhere else." })] : null,
      ],
      footer: !r.ok && r.canPush ? "Pushing re-rolls the dice. Any 1s left over cost you: a wound if it was muscle, stress if it was nerve." : null,
    });
  }

  // Naming someone. This creates the book's own hypothesis and tests it.
  function accuse() {
    const s = (p.suspects || [])[0];
    if (!s) { set({ stage: "here" }); return; }
    ask({
      eyebrow: "The accusation",
      title: `Is it ${s.name}?`,
      prose: [`${s.detail}`,
        `You have ${s.clues} piece${s.clues === 1 ? "" : "s"} of evidence pointing their way. That makes this a ${s.die} hunch.`,
        "Testing it settles the case one way or the other. If you're right, you close it. If you're wrong, it costs you."],
      choices: [
        ["⚖ Put it to the test", () => testAccusation(s), "primary"],
        ["Not yet — keep digging", () => set({ stage: "here" }), "sm ghost"],
        (p.suspects.length > 1) ? ["Someone else", cycleSuspect, "sm ghost"] : null,
      ],
    });
  }

  function solved() {
    ask({
      eyebrow: "Case closed",
      title: p.verdict?.title || "That's the case",
      prose: [p.verdict?.prose, "Your notes hold the whole story, and the case file is kept even if you start a new one."],
      choices: [
        ["✔ File it and take the next case", async () => { await closeCase({ culprit: p.verdict?.culprit, outcome: p.verdict?.outcome }); set(blank()); }, "primary"],
        ["Keep playing this one", () => set({ stage: "here" }), "sm ghost"],
      ],
    });
  }

  // ---- the moves ----------------------------------------------------------

  // Dispatch hands you the case BEFORE you name it — naming a case you have not
  // been told about is not a thing anyone can do. [playtest journal, finding 3]
  function startCase() {
    // Rolled, but kept out of the notes until the case is actually taken — a
    // cancelled name prompt used to leave a briefing for a case that never was.
    const b = rollBriefing({ write: false });
    set({ ...blank(), stage: "briefed", briefing: { assignment: b.assignment, relevance: b.relevance, complication: b.complication, hook: b.hook } });
  }

  // What dispatch handed you, on screen, before anything is asked of you.
  function briefed() {
    const b = p.briefing;
    if (!b) { set({ stage: "plan" }); return; }
    ask({
      eyebrow: "Dispatch",
      title: b.assignment,
      prose: [`Why it matters: ${b.relevance}`,
        `Already going wrong: ${b.complication}`,
        `Why it lands on you: ${b.hook}`],
      choices: [["✔ Take the case", () => nameCase(b), "primary"],
        ["🎲 Give me a different one", startCase, "sm ghost"]],
      footer: "Take it and you can name it — the whole briefing goes into your case notes.",
    });
  }

  async function nameCase(b) {
    const title = await promptModal("Give the case a name you'll recognise later.",
      { title: "Name the case", value: b.assignment.split(/[,.;]/)[0].slice(0, 40), okLabel: "Take the case" });
    if (title === null) return;
    // Write the briefing only once the case is real.
    say(`=== CASE BRIEFING — ${new Date().toLocaleDateString()} (Solo) ===\n• Assignment: ${b.assignment}\n• Relevance: ${b.relevance}\n• Complication: ${b.complication}\n• Personal Hook: ${b.hook}`);
    openCase({ title: (title || "Untitled case").trim(), assignment: b.assignment });
    set({ ...blank(), stage: "plan", leadHint: `Why it matters: ${b.relevance} Already going wrong: ${b.complication}` });
    showToast("Case open. Pick somewhere to start.");
  }

  // Declared as functions, not consts: the stage dispatch above runs before
  // these lines are reached, and a const would still be in its dead zone.
  // A person you can picture: a real name off the Core table, an occupation, a
  // quirk, and the Solo book's read on what they are like.
  function rollPerson() {
    const taken = new Set((p.suspects || []).map((s) => s.name));
    let npc = rollMainNpc();
    for (let i = 0; i < 8 && taken.has(npc.name); i++) npc = rollMainNpc(); // two people, one name reads as a bug
    const flavour = rollSuspect();
    return { name: npc.name, detail: `${npc.occ} — ${npc.quirk}. ${flavour.detail}` };
  }

  function rollPlaces() { return [1, 2, 3].map(() => `${rollColumn(S.LOCATION_ENVIRONMENT).entry} ${rollColumn(S.LOCATION_PLACE).entry}`); }

  async function askPlace() {
    const where = await promptModal("Where do you go?", { title: "Somewhere else", okLabel: "Go there" });
    if (where && where.trim()) goTo(where.trim());
  }

  // Going somewhere is the book's step 1 and step 2: travel, then the check.
  function goTo(where) {
    const fired = countdown();
    const scene = lookupRange(S.SCENE_CHECK, rollDie(8));
    say(`\n— ${where} —`);
    set({
      stage: "travel", location: where, options: null, found: 0, lastNarration: null,
      danger: scene.result === "Complicated" || scene.result === "Challenging" ? "not going to be easy" : null,
      event: fired,
    });
  }

  // The Countdown Event Check, made as you set off. Any success fires it.
  function countdown() {
    const parts = String(st.timerDie).split("/");
    let hits = 0;
    for (const part of parts) if (rollDie(parseInt(part.replace("D", ""), 10) || 6) >= D.SUCCESS_THRESHOLD) hits++;
    if (hits > 0) {
      const ev = S.COUNTDOWN_EVENT[rollDie(12) - 1];
      st.timerDie = S.ESCALATION_STEPS[0];
      say(`• Interruption: ${ev.name} — ${ev.examples}`);
      log("Countdown Event Check — guided play", `Event fires · ${ev.name}`);
      return ev;
    }
    const i = S.ESCALATION_STEPS.indexOf(st.timerDie);
    if (i !== -1 && i < S.ESCALATION_STEPS.length - 1) st.timerDie = S.ESCALATION_STEPS[i + 1];
    log("Countdown Event Check — guided play", `No event · timer now ${st.timerDie}`);
    return null;
  }

  // A skill roll, narrated. Same maths as the sheet: attribute die + skill die,
  // 6+ is a success, and a failed roll may be pushed.
  // A pool is the attribute die plus the skill die, kept alongside the faces so a
  // push can re-roll the right sizes. [§3.1]
  function countSucc(faces) { return faces.reduce((n, f) => n + successesFor(f), 0); }


  // The guided loop used to keep everything to itself: the Board stayed empty and
  // the Leads tab said "no active hypotheses" while this panel privately tracked
  // both. It now writes what it finds into the surfaces that exist for it, so
  // dropping into Board or Leads mid-case shows the case you have been playing.
  // [playtest journal, finding 1]
  function boardAdd(kind, name, detail, linkToBoxId = null) {
    try {
      const b = Board.get();
      if (isFull(b)) return null;
      const box = addBox(b, kind, name, detail);
      if (box && linkToBoxId && byId(b, linkToBoxId)) connect(b, box.id, linkToBoxId);
      Board.save(b);
      return box;
    } catch { return null; }
  }
  // Leads: one hypothesis per named suspect, kept at the rating this panel is using.
  function leadSync(suspect) {
    if (!suspect) return;
    st.hypotheses = st.hypotheses || [];
    const text = `${suspect.name} did it`;
    const found = st.hypotheses.find((h) => h.playId === suspect.id);
    if (found) { found.die = suspect.die; found.text = text; }
    else st.hypotheses.push({ id: `h${Date.now()}${st.hypotheses.length}`, playId: suspect.id, text, die: suspect.die });
  }
  function leadDrop(suspect) {
    if (!suspect) return;
    st.hypotheses = (st.hypotheses || []).filter((h) => h.playId !== suspect.id);
  }

  function log(label, text) {
    try { RollLog.add({ label, text, charId: ch.id, charName: ch.name, source: "solo" }); } catch { /* best effort */ }
  }

  function doAction(action) {
    // The same pool the sheet builds — injuries, Aiming and critical stress all
    // counted, and the aim spent. [playtest journal, finding 1]
    const r = skillPool(ch, action.key);
    log(`${findSkill(action.key).name} — guided play`, outcomeSummary(r.successes, 0));
    p.earned = false;
    finishRoll(action, { sizes: r.sizes, faces: r.faces, dice: r.dice, notes: r.notes }, r.successes, false);
  }

  // Push: re-roll every die that is not showing a 1; the 1s left behind are what
  // hurt you — damage on muscle, stress on nerve, always stress for Replicants.
  function pushIt() {
    const r = p.pending;
    const action = ACTIONS.find((a) => a.key === r.key) || ACTIONS[0];
    const { sizes, faces } = r.roll;
    // A push keeps successes as well as locking 1s — the engine's own rule.
    const rolled = faces.map((f, i) => (f === D.PUSH_BANE_FACE || successesFor(f) > 0 ? f : rollDie(sizes[i])));
    const banes = rolled.filter((f) => f === D.PUSH_BANE_FACE).length;
    const physical = ["STR", "AGI"].includes(findSkill(action.key).attr) && ch.nature !== "replicant";
    if (banes) {
      if (physical) ch.state.health = Math.max(0, ch.state.health - banes);
      else ch.state.resolve = Math.max(0, ch.state.resolve - banes);
      Store.save(ch);
      // What a push costs must be visible in the record, not only in prose. [audit]
      say(`• Pushed ${findSkill(action.key).name}: ${banes} ${physical ? "Health" : "Resolve"} lost.`);
      showToast(`Push cost ${banes} ${physical ? "Health" : "Resolve"}.`, { kind: "warn" });
    }
    const psucc = countSucc(rolled);
    log(`${findSkill(action.key).name} (push) — guided play`, outcomeSummary(psucc, banes, true));
    finishRoll(action, { sizes, faces: rolled }, psucc, true, banes, physical);
  }

  function finishRoll(action, roll, succ, pushed, banes = 0, physical = false) {
    const cost = banes ? (physical ? ` It cost you ${banes} Health.` : ` It cost you ${banes} Resolve — nerve, not blood.`) : "";
    if (succ > 0) {
      const finding = action.finds === "clue" ? rollClue() : rollPerson();
      set({
        stage: "result",
        pending: {
          ok: true, key: action.key, roll, finds: action.finds, finding,
          heading: action.finds === "clue" ? `You find something: ${finding.name}` : `You get a name: ${finding.name}`,
          prose: action.finds === "clue"
            ? `${finding.detail} What it means is up to you — say it out loud, then write it down.`
            : `${finding.detail} Decide how they're mixed up in this.`,
          detail: [(roll.notes || []).join(" · ") || null, pushed ? `You had to push for it.${cost}` : null].filter(Boolean).join(" ") || null,
        },
      });
    } else {
      set({
        stage: "result",
        pending: {
          // A failed roll is exactly what the book lets you push. [§3.1]
          ok: false, key: action.key, roll,
          canPush: !pushed && roll.faces.some((f, i) => f !== D.PUSH_BANE_FACE && successesFor(f) === 0),
          stateNote: (roll.notes || []).join(" · ") || null,
          heading: "Nothing useful",
          prose: pushed
            ? `Still nothing.${cost} Try somewhere else, or something else.`
            : "You come up empty. You can push yourself and try again, or let it go.",
        },
      });
    }
  }

  // Keeping a result: it goes in the notes, and a person becomes a suspect whose
  // hunch strengthens with every clue you find afterwards.
  function keepResult() {
    const r = p.pending;
    const suspects = [...(p.suspects || [])];
    if (r.finds === "person") {
      const box = boardAdd("suspect", r.finding.name, r.finding.detail);
      const s = { id: `s${Date.now()}`, name: r.finding.name, detail: r.finding.detail, clues: 0,
        die: S.HYPOTHESIS.newRating, boxId: box?.id || null };
      suspects.unshift(s);
      leadSync(s);
      say(`• Someone involved: ${r.finding.name} — ${r.finding.detail}`);
    } else {
      say(`• Clue: ${r.finding.name} — ${r.finding.detail}`);
      // Evidence points at whoever you are currently looking at, and a hypothesis
      // strengthens one step per piece of evidence. [Solo Mode: Hypotheses]
      boardAdd("clue", r.finding.name, r.finding.detail, suspects[0]?.boxId || null);
      if (suspects[0]) {
        suspects[0] = { ...suspects[0], clues: suspects[0].clues + 1, die: upgrade(suspects[0].die) };
        leadSync(suspects[0]);
      }
    }
    set({ stage: "here", pending: null, suspects, found: (p.found || 0) + 1, lastNarration: r.heading });
  }

  function upgrade(die) {
    const i = S.ESCALATION_STEPS.indexOf(die);
    return i >= 0 && i < S.ESCALATION_STEPS.length - 1 ? S.ESCALATION_STEPS[i + 1] : die;
  }

  function cycleSuspect() { set({ suspects: [...(p.suspects || []).slice(1), (p.suspects || [])[0]].filter(Boolean) }); }

  // Moving on ends the Shift: the character's counter advances on the sheet.
  function nextShift() {
    ctx.endShift();
    set({ stage: "plan", options: null, location: null, found: 0, lastNarration: null, leadHint: null });
  }

  // The real Hypothesis Check: roll the rating, no push. It pays out if it ends
  // the case, which is exactly what an accusation does.
  function testAccusation(s) {
    const sizes = String(s.die).split("/").map((x) => parseInt(x.replace(/\D/g, ""), 10) || 6);
    const dice = sizes.map((size) => rollDie(size));
    const succ = dice.reduce((n, f) => n + successesFor(f), 0);
    const out = succ >= 2 ? S.HYPOTHESIS_CHECK.crit : succ >= 1 ? S.HYPOTHESIS_CHECK.success : S.HYPOTHESIS_CHECK.failure;
    // applyPoints floors at 0, so report what was actually paid, not the sticker
    // price — the case file quotes this line. [audit]
    const applied = applyPoints(ch, { pp: out.pp });
    const ppReal = applied && typeof applied.pp === "number" ? applied.pp : out.pp;
    log(`Hypothesis Check — ${s.name}`, `${dice.join("/")} · ${out.name} (${ppReal >= 0 ? "+" : ""}${ppReal} Promotion)`);
    pinNote(`Accused ${s.name} — ${out.name} (${ppReal >= 0 ? "+" : ""}${ppReal} Promotion)`);
    if (out.pp > 0) {
      set({
        stage: "solved",
        verdict: {
          culprit: s.name,
          outcome: succ >= 2 ? "Airtight. They never saw it coming." : "It held up. Just.",
          title: `It was ${s.name}`,
          prose: `The evidence holds. ${out.text} You take ${ppReal} Promotion Points for closing it.`,
        },
      });
    } else {
      leadDrop(s);
      set({
        stage: "here",
        suspects: (p.suspects || []).slice(1),
        lastNarration: `You were wrong about ${s.name}. It cost you ${Math.abs(ppReal)} Promotion Points, and the real answer is still out there.`,
      });
    }
  }
}

const blank = () => ({ stage: "plan", briefing: null, earned: false, location: null, options: null, found: 0, suspects: [], pending: null, lastNarration: null, leadHint: null, event: null, danger: null, verdict: null });
