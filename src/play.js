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
import { showToast, promptModal, sectionTitle, termify, hint, typeText } from "./ui.js";
import { lookupRange, rollColumn, skill as findSkill } from "./rules.js";
import { Store, RollLog } from "./store.js";
import { maxHealth, maxResolve } from "./derived.js";
import { rollClue, rollSuspect, Board, addBox, connect, byId, isFull } from "./board.js";
import { skillPool, pushPoolPublic, poolIsPushable, dieNode } from "./roller.js";
import * as H from "../data-house.js";
import { placeArt, portraitPlaceholder, shiftClock } from "./art.js";
import { bigScene, cityMap } from "./scenes.js";
import { rollMeaning } from "./meanings.js";

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

// One keyboard listener for the whole app: on the guided card, 1–9 press the
// matching choice (never while typing, and never under a dialog).
let keysBound = false;
function bindChoiceKeys() {
  if (keysBound) return;
  keysBound = true;
  document.addEventListener("keydown", (e) => {
    if (!/^[1-9]$/.test(e.key) || e.ctrlKey || e.metaKey || e.altKey) return;
    if (document.querySelector(".modal-overlay")) return;
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || "")) return;
    const btns = document.querySelectorAll(".play-card .play__choices .btn");
    const b = btns[Number(e.key) - 1];
    if (b && !b.disabled) { e.preventDefault(); b.click(); }
  });
}

export function renderPlayPanel(root, ctx) {
  bindChoiceKeys();
  const { card, btn, st, save, rerender, openCase, closeCase, ensureNoOpenCase, rollBriefing, rollMainNpc, addNote, pinNote, applyPoints, navigate } = ctx;
  const ch = Store.getActive();
  // Play's step state belongs to ONE case. If the case on file is not the one
  // this state was playing (opened or closed from another tab), start over on it.
  // State saved before this link existed has no caseNo: it belongs to the case
  // that is open, unless it is a Dispatch offer (only ever made with no case).
  if (st.play && st.play.caseNo === undefined) st.play.caseNo = st.play.stage === "briefed" ? null : (st.caseOpen?.no ?? null);
  if (st.play && (st.play.caseNo ?? null) !== (st.caseOpen?.no ?? null)) st.play = null;
  const p = (st.play ||= { ...blank(), caseNo: st.caseOpen?.no ?? null });
  linkToTabs();

  // The other tabs drive the same case: a Shift ended on Wrap or on the sheet
  // leaves the place you were at, and the Leads tab owns the ratings — a lead
  // re-rated or dropped there is re-rated or dropped here.
  function linkToTabs() {
    const now = st.shiftNo || 1;
    if (p.shift === undefined) p.shift = now;
    if (p.shift !== now) {
      if (["travel", "here", "result"].includes(p.stage))
        Object.assign(p, { stage: "plan", options: null, location: null, found: 0, pending: null, event: null, danger: null,
          lastNarration: `Shift ${p.shift} ended on another tab. Where next?` });
      p.shift = now;
    }
    if ((p.suspects || []).length) {
      const leads = st.hypotheses || [];
      p.suspects = p.suspects.filter((x) => !x.lead || leads.some((h) => h.playId === x.id))
        .map((x) => { const h = leads.find((l) => l.playId === x.id); return h ? { ...x, die: h.die } : x; });
    }
  }

  // ---- the one card on screen -------------------------------------------
  // A picture, a title, a line or two, and big choices (radical redesign): the
  // screen is the scene. title: where you are. prose: what just happened.
  // choices: what you can do. art: the picture above the card.
  function ask({ eyebrow, title, prose, choices, footer, art, tip, typewriter, dice }) {
    root.append(bar());
    if (art) root.append(el("figure", { class: "vn__art" }, ...[].concat(art)));
    const h = sectionTitle(title);
    h.classList.add("vn__title");
    if (typewriter) { h.classList.add("vn__title--type"); h.replaceChildren(...typeText(title)); }
    const c = el("div", { class: "card play-card vn__card" }, el("div", { class: "card__head vn__head" }, h));
    if (eyebrow) c.prepend(el("div", { class: "roll-eyebrow step-eyebrow vn__eyebrow" }, eyebrow));
    // Where you are in the case, as a file reference.
    // A crumb the eyebrow already says ("Shift 3", the place) is not repeated.
    const crumbs = [st.caseOpen ? `Case #${st.caseOpen.no}` : null, st.caseOpen ? `Shift ${st.shiftNo || 1}` : null, p.location || null]
      .filter((x) => x && !(eyebrow && String(eyebrow).startsWith(x)));
    if (crumbs.length) c.prepend(el("div", { class: "play__crumbs", "aria-label": "Where you are" }, crumbs.join(" · ")));
    if (dice?.length) c.append(el("div", { class: "dice vn__dice" }, ...dice.map((d) => dieNode(d))));
    for (const line of [].concat(prose || [])) {
      // App-written lines get tappable game words; table text (raw) is left alone.
      if (line) c.append(el("p", { class: "play__prose" }, ...(line.raw ? [line.raw] : termify(line))));
    }
    // A meaning-table idea rolled on this card (house aid, §3.19).
    if (p.idea && p.idea.stage === (p.stage || "plan"))
      c.append(el("p", { class: "play__idea" }, el("span", { class: "tag tag--sm play__idea-tag" }, "House aid"), ` ${p.idea.label}: `, el("strong", {}, p.idea.text)));
    if (tip) c.append(tip);
    // Numbered choices: press 1–4 on a keyboard, or tap. Big tiles first, the
    // small "other options" after them on a quieter row.
    const row = el("div", { class: "play__choices" });
    const minor = el("div", { class: "play__minor" });
    choices.filter(Boolean).forEach(([label, fn, variant, place], i) => {
      const small = /\b(sm|ghost)\b/.test(variant || "");
      const b = btn(label, fn, small ? variant : (variant || "dest"));
      b.classList.add(small ? "vn-chip" : "vn-tile");
      if (place) b.prepend(placeArt(place));   // round 4: what kind of place it is
      if (i < 9) b.prepend(el("span", { class: "play__num", "aria-hidden": "true" }, String(i + 1)));
      if (!small) b.append(el("span", { class: "play__chev", "aria-hidden": "true" }, "→"));
      (small ? minor : row).append(b);
    });
    // The minor row stays inside .play__choices so keyboard numbers still count it.
    if (minor.childElementCount) row.append(minor);
    c.append(row);
    if (footer) c.append(el("p", { class: "muted small vn__footer" }, ...termify(footer)));
    root.append(c);
  }
  // The slim bar over the scene: who, how hurt, the clock, and the kit (Rookie).
  function bar() {
    const pill = (cls, ...kids) => el("span", { class: `vn__pill ${cls}` }, ...kids);
    const meter = (v, max, tone) => el("span", { class: `vn__meter vn__meter--${tone}`, style: `--v:${max ? Math.max(0, v) / max : 0}` });
    return el("div", { class: "vn__bar", role: "group", "aria-label": "Status" },
      ch ? el("button", { class: "vn__who", type: "button", title: "Open your sheet", onClick: () => navigate("sheet") }, ch.name) : null,
      ch ? pill("vn__pill--health", "♥", meter(ch.state.health, maxHealth(ch), "health"), `${ch.state.health}/${maxHealth(ch)}`) : null,
      ch ? pill("vn__pill--resolve", "◈", meter(ch.state.resolve, maxResolve(ch), "resolve"), `${ch.state.resolve}/${maxResolve(ch)}`) : null,
      st.caseOpen ? pill("vn__pill--shift", shiftClock(st.shiftNo || 1, D.SHIFTS_PER_DAY, "sclock--xs"), `S${st.shiftNo || 1}`) : null,
      st.caseOpen ? pill("vn__pill--timer", "⏱", st.timerDie) : null,
      el("button", { class: "vn__kit", type: "button", "aria-label": "Kit — every Solo tool and table", onClick: openKit },
        el("span", { class: "vn__kit-icon", "aria-hidden": "true" }, "📋"), "Kit"));
  }
  function openKit() { st.panel = st.lastKit || "case"; save(); rerender(); window.scrollTo(0, 0); }
  // A portrait set into a scene (a witness on the street, a suspect in the box).
  const withFace = (scene, name, cls = "") => [scene, el("div", { class: `vn__face ${cls}`.trim() }, portraitPlaceholder(name, "vn__portrait"), el("span", { class: "vn__nameplate" }, name))];
  const raw = (text) => (text ? { raw: String(text) } : null);
  const caseSeed = () => String(st.caseOpen?.no ?? "x");
  // Hints are keyed to the moment, so each shows once (ui.js hint()).
  const moment = (k) => `${st.caseOpen?.no ?? 0}:${st.shiftNo || 1}:${k}`;

  // Always writes to the CURRENT step state — opening or closing a case replaces it.
  const set = (patch) => { Object.assign(st.play ||= { ...blank(), caseNo: st.caseOpen?.no ?? null }, patch); save(); rerender(); };
  const say = (text) => { addNote(text); };

  // ---- no character: make one, no questions asked -------------------------
  if (!ch) {
    ask({
      eyebrow: "Start here",
      title: "You need a detective",
      art: bigScene("cold", "start"),
      prose: ["One press deals you a complete Blade Runner."],
      choices: [["⚄ Roll me a detective", () => navigate("wizard")]],
      footer: "Then the case starts here — one question at a time.",
    });
    return;
  }

  // ---- dead: nothing else happens until there is a new detective ----------
  if (ch.state?.dead) {
    ask({
      eyebrow: "End of the line",
      title: `${ch.name} is dead`,
      art: bigScene("dead", ch.name),
      prose: ["No more rolls, Shifts or cases on this sheet. Your case files stay."],
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
      eyebrow: "Dispatch",
      title: `${ch.name}, you have no case`,
      art: bigScene("dispatch", ch.name),
      prose: ["Dispatch has one waiting."],
      choices: [["▶ Get me a case", startCase]],
      footer: "One question at a time. No rulebook needed.",
      tip: hint("first-case", "Take a case and the app asks you one question at a time. You never need the rulebook.", "first"),
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
      art: cityMap({ options: opts, visited: p.visited || [], here: p.lastPlace || null, seed: caseSeed(), onPick: goTo }),
      tip: hint("travel", "Each trip uses up a Shift — half a day — and rolls the Countdown: the longer you go without trouble, the likelier it finds you.", moment("plan")),
      prose: [p.lastNarration || null,
        // After Shift 1 you are following something, so stop telling the player
        // there is no wrong answer. [playtest journal, finding 9]
        (p.suspects || []).length
          ? `You are looking at ${p.suspects[0].name}. Go where that leads, or somewhere new.`
          : (st.shiftNo || 1) > 1
            ? "Follow what you turned up, or try a different corner of the case."
            : "Pick somewhere to start."],
      choices: [
        ...opts.map((o) => [`📍 ${o}`, () => goTo(o), "dest", o]),
        ["✎ Somewhere else", askPlace, "sm ghost"],
        ["✦ Give me an idea", () => idea("locations"), "sm ghost"],
        ["🎲 Different options", () => set({ options: null }), "sm ghost"],
      ],
    });
  }

  // Arriving: the Countdown check happens here, and gets narrated.
  function travel() {
    const ev = p.event;
    ask({
      eyebrow: "On the way",
      title: p.location,
      art: bigScene(ev ? "event" : "travel", p.location),
      prose: ev
        ? [`Trouble on the way: ${ev.name.toLowerCase()}.`, raw(ev.examples)]
        : ["You get there without trouble."],
      // Going in is playing the event out — the Scene tab's Interruption clears too.
      choices: [["Go in →", () => { if (ev) st.pendingEvent = null; set({ stage: "here", event: null }); }]],
    });
  }

  // At the place: what do you do?
  function here() {
    const found = p.found || 0;
    const suspects = p.suspects || [];
    ask({
      eyebrow: p.danger ? `${p.location} — ${p.danger}` : p.location,
      title: "What do you do?",
      art: bigScene(p.location || "street", caseSeed()),
      tip: hint("roll", `Each choice rolls one of your skills: your attribute die plus your skill die. Any die showing ${D.SUCCESS_THRESHOLD} or more is a success.`, moment("here")),
      prose: [p.lastNarration || "Nothing has jumped out at you yet.",
        found >= ACTIONS_PER_LOCATION ? "You've turned this place over. Try somewhere else." : null],
      choices: [
        ...ACTIONS.map((a) => [a.verb, () => doAction(a), found >= ACTIONS_PER_LOCATION ? "sm ghost" : "dest"]),
        suspects.length ? [`🎯 I think ${suspects[0].name} did it`, () => set({ stage: "accuse" }), "dest"] : null,
        ["🚕 Go somewhere else", nextShift, found >= ACTIONS_PER_LOCATION ? "primary" : "sm ghost"],
        ["✦ Give me an idea", () => idea(suspects.length ? "characters" : "actions"), "sm ghost"],
      ],
    });
  }

  // What the roll turned up, and whether to press your luck.
  function result() {
    const r = p.pending;
    if (!r) { set({ stage: "here" }); return; }
    const dice = (r.roll?.faces || []).map((face, i) => ({ size: r.roll.sizes[i], face, succ: successesFor(face), bane: !r.ok && !r.canPush && face === D.PUSH_BANE_FACE }));
    const art = r.ok && r.finds === "person" ? withFace(bigScene(p.location || "street", caseSeed(), "scene--dim"), r.finding.name)
      : r.ok ? [bigScene("evidence", r.finding?.name || ""), el("div", { class: "vn__evidence" }, el("span", { class: "vn__evidence-tag" }, "Evidence"), r.finding?.name || "")]
      : bigScene(p.location || "street", caseSeed(), "scene--fail");
    ask({
      eyebrow: r.ok ? "That worked" : "No luck",
      title: r.heading,
      art, dice,
      tip: !r.ok && r.canPush ? hint("push", `Push = roll again. Every ${D.PUSH_BANE_FACE} you are left with hurts: Health for physical skills, Resolve for mental ones.`, moment("push")) : r.ok && r.finds === "person" ? hint("suspect", "Every clue you find from now on makes this hunch stronger. When you're sure, accuse them.", "first") : null,
      prose: [raw(r.prose), r.detail, r.stateNote ? `Your condition counted: ${r.stateNote}.` : null],
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
    });
  }

  // Naming someone. This creates the book's own hypothesis and tests it.
  function accuse() {
    const s = (p.suspects || [])[0];
    if (!s) { set({ stage: "here" }); return; }
    ask({
      eyebrow: "The accusation",
      title: `Is it ${s.name}?`,
      art: withFace(bigScene("interrogation", s.name), s.name, "vn__face--lineup"),
      tip: hint("accuse", `The test rolls your hunch's dice. Any success closes the case (+${S.HYPOTHESIS_CHECK.success.pp} Promotion Points or more); none costs you ${Math.abs(S.HYPOTHESIS_CHECK.failure.pp)}.`, "first"),
      prose: [raw(s.detail),
        `${s.clues} piece${s.clues === 1 ? "" : "s"} of evidence: a ${s.die} hunch.`],
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
      art: bigScene("solved", p.verdict?.culprit || ""),
      prose: [p.verdict?.prose ? raw(p.verdict.prose) : null],
      choices: [
        ["✔ File it and take the next case", async () => { await closeCase({ culprit: p.verdict?.culprit, outcome: p.verdict?.outcome }); set(blank()); }, "primary"],
        ["Keep playing this one", () => set({ stage: "here" }), "sm ghost"],
      ],
    });
  }

  // ---- the moves ----------------------------------------------------------

  // Two words from a meaning table when you are stuck (house aid, §3.19): shown
  // on this card and written into the notes like everything else you find.
  function idea(key) {
    const r = rollMeaning(key);
    say(`• [Idea · ${r.label}] ${r.text}`);
    set({ idea: { stage: p.stage || "plan", label: r.label, text: r.text } });
  }

  // Dispatch hands you the case BEFORE you name it — naming a case you have not
  // been told about is not a thing anyone can do. [playtest journal, finding 3]
  async function startCase() {
    if (!(await ensureNoOpenCase())) return;
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
      typewriter: true,
      art: bigScene("dispatch", b.assignment),
      prose: [raw(`Why it matters: ${b.relevance}`),
        raw(`Already going wrong: ${b.complication}`),
        raw(`Why it lands on you: ${b.hook}`)],
      choices: [["✔ Take the case", () => nameCase(b), "primary"],
        ["🎲 Give me a different one", startCase, "sm ghost"]],
    });
  }

  async function nameCase(b) {
    const title = await promptModal("Give the case a name you'll recognise later.",
      { title: "Name the case", value: b.assignment.split(/[,.;]/)[0].slice(0, 40), okLabel: "Take the case" });
    if (title === null) return;
    // Write the briefing only once the case is real.
    say(`=== CASE BRIEFING — ${new Date().toLocaleDateString()} (Solo) ===\n• Assignment: ${b.assignment}\n• Relevance: ${b.relevance}\n• Complication: ${b.complication}\n• Personal Hook: ${b.hook}`);
    if (!(await ensureNoOpenCase())) return;
    if (!openCase({ title: (title || "Untitled case").trim(), assignment: b.assignment })) return;
    set({ ...blank(), caseNo: st.caseOpen.no, stage: "plan", leadHint: `Why it matters: ${b.relevance} Already going wrong: ${b.complication}` });
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
    // Once per Shift (Solo Mode p.006): if the Shift tab already rolled it, the
    // result stands — an event it fired is the one waiting for you.
    const already = !!st.shiftFlags?.countdown;
    const fired = already ? (st.pendingEvent || null) : countdown();
    const scene = lookupRange(S.SCENE_CHECK, rollDie(8));
    say(`\n— ${where} —`);
    set({
      stage: "travel", shift: st.shiftNo || 1, location: where, options: null, found: 0, lastNarration: null,
      visited: [...new Set([...(p.visited || []), where])].slice(-12), lastPlace: where,
      danger: scene.result === "Complicated" || scene.result === "Challenging" ? "not going to be easy" : null,
      event: fired,
    });
  }

  // The Countdown Event Check, made as you set off. Any success fires it.
  function countdown() {
    const parts = String(st.timerDie).split("/");
    let hits = 0;
    for (const part of parts) if (rollDie(parseInt(part.replace("D", ""), 10) || 6) >= D.SUCCESS_THRESHOLD) hits++;
    // The same check the Shift tab makes: it marks the Shift and holds the event.
    (st.shiftFlags ||= {}).countdown = true;
    if (hits > 0) {
      const ev = S.COUNTDOWN_EVENT[rollDie(12) - 1];
      st.timerDie = S.ESCALATION_STEPS[0];
      st.pendingEvent = { name: ev.name, examples: ev.examples, shift: st.shiftNo || 1 };
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
      if (box) flyToBoard(kind, name);
      return box;
    } catch { return null; }
  }
  // Leads: one hypothesis per named suspect, kept at the rating this panel is using.
  function leadSync(suspect) {
    if (!suspect) return;
    st.hypotheses = st.hypotheses || [];
    const text = `${suspect.name} did it`;
    suspect.lead = true;   // from here on the Leads tab owns this rating
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
    set({ stage: "plan", shift: st.shiftNo || 1, options: null, location: null, found: 0, lastNarration: null, leadHint: null });
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

// A find flies onto the Case Board (radical redesign): a card-shaped chip that
// rises toward the Kit and fades. Decorative; the board itself is the record.
function flyToBoard(kind, name) {
  const chip = el("div", { class: `fly-card fly-card--${kind}`, "aria-hidden": "true" },
    el("span", { class: "fly-card__kind" }, kind === "suspect" ? "Suspect" : "Clue"), String(name).slice(0, 40));
  document.body.append(chip);
  setTimeout(() => chip.remove(), 1600);
}

const blank = () => ({ stage: "plan", briefing: null, earned: false, location: null, options: null, found: 0, suspects: [], pending: null, lastNarration: null, leadHint: null, event: null, danger: null, verdict: null });
