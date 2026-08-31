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
import { el, rollDie, successesFor } from "./core.js";
import { showToast, promptModal } from "./ui.js";
import { lookupRange, rollColumn, skill as findSkill } from "./rules.js";
import { Store } from "./store.js";
import { maxHealth, maxResolve } from "./derived.js";
import { rollClue, rollSuspect } from "./board.js";

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

  // ---- no case: hand them one --------------------------------------------
  if (!st.caseOpen) {
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
  ({ plan, travel, here, result, accuse, solved }[stage] || plan)();

  // Where do you go? Three real places, or pick your own.
  function plan() {
    const opts = p.options?.length ? p.options : rollPlaces();
    if (!p.options) { p.options = opts; save(); }
    ask({
      eyebrow: `Shift ${st.shiftNo || 1}`,
      title: "Where do you go?",
      prose: [st.caseOpen.assignment ? `The case: ${st.caseOpen.assignment}` : null,
        p.leadHint || "Pick somewhere to start. There is no wrong answer — the case fills in around wherever you look."],
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
        ...ACTIONS.map((a) => [a.verb, () => doAction(a), "primary"]),
        suspects.length ? [`🎯 I think ${suspects[0].name} did it`, () => set({ stage: "accuse" }), "sm"] : null,
        ["🚕 Go somewhere else", nextShift, "sm ghost"],
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
      prose: [r.prose, r.detail],
      choices: [
        r.ok ? ["✓ Write it down and carry on", keepResult] : null,
        !r.ok && r.canPush ? ["😤 Push yourself — try again harder", pushIt, "primary"] : null,
        !r.ok ? ["Let it go", () => set({ stage: "here", pending: null, lastNarration: r.prose })] : null,
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

  async function startCase() {
    const b = rollBriefing();
    const title = await promptModal("Give the case a name you'll recognise later.",
      { title: "Name the case", value: b.assignment.split(/[,.;]/)[0].slice(0, 40), okLabel: "Take the case" });
    if (title === null) return;
    openCase({ title: (title || "Untitled case").trim(), assignment: b.assignment });
    set({ ...blank(), stage: "plan", leadHint: `Why it matters: ${b.relevance} Already going wrong: ${b.complication}` });
    showToast("Case open. Pick somewhere to start.");
  }

  // Declared as functions, not consts: the stage dispatch above runs before
  // these lines are reached, and a const would still be in its dead zone.
  // A person you can picture: a real name off the Core table, an occupation, a
  // quirk, and the Solo book's read on what they are like.
  function rollPerson() {
    const npc = rollMainNpc();
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
      return ev;
    }
    const i = S.ESCALATION_STEPS.indexOf(st.timerDie);
    if (i !== -1 && i < S.ESCALATION_STEPS.length - 1) st.timerDie = S.ESCALATION_STEPS[i + 1];
    return null;
  }

  // A skill roll, narrated. Same maths as the sheet: attribute die + skill die,
  // 6+ is a success, and a failed roll may be pushed.
  // A pool is the attribute die plus the skill die, kept alongside the faces so a
  // push can re-roll the right sizes. [§3.1]
  function poolFor(key) {
    const sk = findSkill(key);
    return [D.LEVEL_DIE[ch.attributes[sk.attr] || "C"], D.LEVEL_DIE[ch.skills[key] || "D"]];
  }
  function countSucc(faces) { return faces.reduce((n, f) => n + successesFor(f), 0); }

  function doAction(action) {
    const sizes = poolFor(action.key);
    const faces = sizes.map((size) => rollDie(size));
    finishRoll(action, { sizes, faces }, countSucc(faces), false);
  }

  // Push: re-roll every die that is not showing a 1; the 1s left behind are what
  // hurt you — damage on muscle, stress on nerve, always stress for Replicants.
  function pushIt() {
    const r = p.pending;
    const action = ACTIONS.find((a) => a.key === r.key) || ACTIONS[0];
    const { sizes, faces } = r.roll;
    const rolled = faces.map((f, i) => (f === D.PUSH_BANE_FACE ? f : rollDie(sizes[i])));
    const banes = rolled.filter((f) => f === D.PUSH_BANE_FACE).length;
    const physical = ["STR", "AGI"].includes(findSkill(action.key).attr) && ch.nature !== "replicant";
    if (banes) {
      if (physical) ch.state.health = Math.max(0, ch.state.health - banes);
      else ch.state.resolve = Math.max(0, ch.state.resolve - banes);
      Store.save(ch);
    }
    finishRoll(action, { sizes, faces: rolled }, countSucc(rolled), true, banes, physical);
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
          detail: pushed ? `You had to push for it.${cost}` : null,
        },
      });
    } else {
      set({
        stage: "result",
        pending: {
          // A failed roll is exactly what the book lets you push. [§3.1]
          ok: false, key: action.key, roll, canPush: !pushed,
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
      suspects.unshift({ id: `s${Date.now()}`, name: r.finding.name, detail: r.finding.detail, clues: 0, die: S.HYPOTHESIS.newRating });
      say(`• Someone involved: ${r.finding.name} — ${r.finding.detail}`);
    } else {
      say(`• Clue: ${r.finding.name} — ${r.finding.detail}`);
      // Evidence points at whoever you are currently looking at, and a hypothesis
      // strengthens one step per piece of evidence. [Solo Mode: Hypotheses]
      if (suspects[0]) {
        suspects[0] = { ...suspects[0], clues: suspects[0].clues + 1, die: upgrade(suspects[0].die) };
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
    applyPoints(ch, { pp: out.pp });
    pinNote(`Accused ${s.name} — ${out.name} (${out.pp >= 0 ? "+" : ""}${out.pp} Promotion)`);
    if (out.pp > 0) {
      set({
        stage: "solved",
        verdict: {
          culprit: s.name,
          outcome: succ >= 2 ? "Airtight. They never saw it coming." : "It held up. Just.",
          title: `It was ${s.name}`,
          prose: `The evidence holds. ${out.text} You take ${out.pp} Promotion Points for closing it.`,
        },
      });
    } else {
      set({
        stage: "here",
        suspects: (p.suspects || []).slice(1),
        lastNarration: `You were wrong about ${s.name}. It cost you ${Math.abs(out.pp)} Promotion Points, and the real answer is still out there.`,
      });
    }
  }
}

const blank = () => ({ stage: "plan", location: null, options: null, found: 0, suspects: [], pending: null, lastNarration: null, leadHint: null, event: null, danger: null, verdict: null });
