// tutorial.js — "How to Play": procedural walkthroughs for running a case in this
// app, solo and at a table.  Mounted at route #tutorial (no nav tab; reached from
// the Home tile and Settings).  Last-viewed panel persists in brp:tutorial.
//
// Scope rule (CLAUDE.md §10.2): this module teaches the APP's flow. Every rules
// NUMBER shown here is read live from data.js (or data-house.js, for the one
// house aid) — nothing mechanical is hardcoded.
import * as D from "../data.js";
import * as H from "../data-house.js";      // house aids (Case Board, §3.17)
import { skillName } from "./rules.js";
import { el, clear, titleCase, TUTORIAL_KEY } from "./core.js";
import { segmentNav } from "./ui.js";
import { Settings } from "./settings.js";
import { navigate } from "./router.js";

const SEGMENTS = [
  { key: "setup", label: "Setup" },
  { key: "solo", label: "Solo" },
  { key: "board", label: "Case Board" },
  { key: "table", label: "At the Table" },
  { key: "reference", label: "Cheat Sheet" },
];

const readPanel = () => { try { return localStorage.getItem(TUTORIAL_KEY) || "setup"; } catch { return "setup"; } };
const writePanel = (p) => { try { localStorage.setItem(TUTORIAL_KEY, p); } catch {} };

export function renderTutorial(mount, rerender) {
  clear(mount);
  const panel = SEGMENTS.some((s) => s.key === readPanel()) ? readPanel() : "setup";
  const body = el("section", { class: "screen" },
    el("h1", { class: "screen__title" }, "How to Play"),
    el("p", { class: "muted" }, "Running a case with this app, step by step. The rules themselves live in the Rules Library — this is the procedure."),
    segmentNav({ segments: SEGMENTS, active: panel, onSelect: (k) => { writePanel(k); rerender(); } }),
  );
  const host = el("div", { class: "panel" });
  ({ setup: panelSetup, solo: panelSolo, board: panelBoard, table: panelTable, reference: panelReference }[panel])(host, rerender);
  body.append(host);
  mount.append(body);
}

// ---- Setup (both modes) ---------------------------------------------------
function panelSetup(host) {
  host.append(
    steps("1 · Choose how you'll play", "Solo Mode and the GM Screen are off by default; each adds a bottom-nav tab.", [
      ["Playing alone", "Turn on <b>Solo Mode</b>. It replaces the Game Runner with the official oracle tables."],
      ["Playing with people", "Players need nothing. Whoever runs the game turns on the <b>GM Screen</b>."],
      ["Both", "Fine — turn on both. Nothing is exclusive."],
    ], [["Open Settings", () => navigate("settings")]]),

    steps("2 · Create a Blade Runner", "The wizard is the only path in — no pregens are published for this game.", [
      ["Nature", "Human or Replicant (roll or pick). Replicants get +2 Health, −2 Resolve, an extra Strength/Agility increase, and are always Rookies."],
      ["Archetype & years", "Archetype sets your key attribute (must end B+) and key skills (C+). Years on the Force sets your attribute/skill/specialty budgets and your starting point rolls."],
      ["Spend the budget", "The wizard blocks you from leaving a step until the allocation is legal, so you can't build an illegal character by accident."],
      ["Memory, relationship, identity", "Roll them or write your own. Your key memory is mechanical — spending it gives advantage."],
    ], [["New Blade Runner", () => navigate("wizard")]]),

    steps("3 · Learn the sheet", "Everything in play happens here.", [
      ["Roll", "Tap any skill to roll it. <b>⚔ Roll an attack</b> picks a weapon and resolves damage and criticals for you."],
      ["Track", "Health and Resolve steppers auto-derive the Broken states; conditions, Promotion/Chinyen/Humanity counters, and inventory are all one tap."],
      ["Survive", "Critical injuries, death saves, stabilizing, and recovery are guided — take the injury and the app walks the procedure."],
      ["Grow", "The Advancement card spends Promotion Points on specialties and Humanity Points on skills, and runs the Baseline Test for Replicants."],
    ], [["Open sheet", () => navigate("sheet")]]),

    steps("4 · Optional: play across devices", "Skip this entirely if you share one screen — the app is fully functional offline and local-only.", [
      ["Game Runner", "Settings → create a campaign. You get a three-word join code."],
      ["Players", "Settings → join with the code, then <b>share your character with the party</b>."],
      ["What syncs", "Vitals, conditions, and the combat tracker, live. The roll log and journal stay on your own device."],
    ], [["Open Settings", () => navigate("settings")]]),
  );
}

// ---- Solo -----------------------------------------------------------------
function panelSolo(host, rerender) {
  if (!Settings.solo()) host.append(hint("Solo Mode is currently off — turn it on in Settings to get the Solo tab.", () => navigate("settings")));
  host.append(
    steps("The solo loop", "Solo play replaces the Game Runner with dice. You ask, the oracle answers, you narrate.", [
      ["1. Open a case", "Solo ▸ <b>Case</b> ▸ ⚡ full briefing rolls Assignment, Relevance, Complication, and a Personal Hook straight into your case notes. The Core Case File Generator is there too if you want a longer hook."],
      ["2. Open the Shift", "Solo ▸ <b>Shift</b> ▸ roll a Location, then make the Countdown Event Check — those two open every Shift. Then Solo ▸ <b>Scene</b> ▸ Scene Check sets how hard the situation is."],
      ["3. Ask the oracle", "Question Check answers yes/no with critical results. Imagining Clues gives you evidence (meaning + descriptor + type); the Character generator plus NPC Skill Level gives you someone to talk to."],
      ["4. Act", "Roll on your sheet as normal. Push when you need it — the banes are the consequence, and the app applies them."],
      ["5. Track leads", "Solo ▸ <b>Leads</b> ▸ add a hypothesis and rate it with a die. Upgrade or downgrade it as evidence lands; the Hypothesis Check cashes it in for Promotion Points."],
      ["6. Turn up the heat", "The Countdown Event Check on the Shift tab is once per Shift, as you set off for a new location (never for Downtime). <b>Any success fires an event</b> — roll it, let it complicate the case, and reset the timer. No successes means no event, but the timer escalates and the next check is likelier to bite."],
      ["7. Trouble", "Fights and chases run in the Combat Tracker. Let NPC Tactics and NPC Chase Maneuvers decide what the opposition does — that's the point of solo play."],
      ["8. Close the shift", "Solo ▸ <b>Wrap</b> ▸ End the Shift (it advances the Shift counter on your sheet and enforces the Downtime cadence), roll a Downtime scene if you took one, then walk the Promotion and Humanity checklists."],
    ], [["Open Solo Mode", () => navigate("solo")], ["Combat Tracker", () => navigate("combat")]]),

    steps("Optional: the Case Board", "A house aid, not part of the Blade Runner rules — the Board tab in Solo Mode. Skip it and nothing else changes.", [
      ["What it adds", "Somewhere to pin your clues and suspects, draw the connections between them, and let the evidence tell you when the case has an answer."],
      ["Where it fits", "Between step 4 (what you find) and step 5 (your hypotheses). It feeds Leads; it never replaces it."],
      ["Full walkthrough", "The <b>Case Board</b> tab of this tutorial is the step-by-step guide."],
    ], [["Case Board guide", () => { writePanel("board"); rerender(); window.scrollTo(0, 0); }], ["Open the Case Board", () => navigate("solo")]]),

    steps("Solo habits worth keeping", null, [
      ["Write it down", "Pin oracle results (📌) into case notes and pin rolls into your character's journal. Solo play falls apart when you can't remember what you established."],
      ["Answer before you roll", "If you already know what's behind the door, don't ask the oracle. It's for genuine uncertainty."],
      ["Respect the pace", `Three investigation Shifts without Downtime and you start taking stress — the sheet enforces it (${D.RECOVERY.downtimeShiftsBeforeStress} shifts, 4 with Married to the Job).`],
    ]),
  );
}

// ---- Case Board (house aid) ------------------------------------------------
// Every number here is read from data-house.js — the tutorial never restates a
// value (§10.2), so correcting the aid corrects its documentation.
function panelBoard(host, rerender) {
  if (!Settings.solo()) host.append(hint("Solo Mode is off — the Board lives on the Solo tab, so turn Solo Mode on first.", () => navigate("settings")));

  const skills = H.DISCOVERY_SKILLS.map(skillName);
  const skillList = skills.slice(0, -1).join(", ") + " or " + skills.at(-1);
  const dice = H.MATRIX_DICE.map((d) => `D${d}`).join(", ");
  const clincherRow = H.DISCOVERY_OUTCOMES.find((r) => r.effect === "clincher");

  host.append(
    steps("What this is", H.BOARD.credit, [
      ["The idea", "A detective's corkboard. Every clue and every suspect gets a numbered box; when you work out that a clue implicates someone, you draw a line. Enough lines and the board names your culprit."],
      ["Why bother", "Solo play generates evidence faster than you can hold it in your head. The board remembers, and the connection counts turn a pile of notes into a case that visibly closes."],
      ["What it is not", `It is <b>not Blade Runner canon</b> and it awards nothing. Every card on the tab is headed "House aid". Ignore the tab and the rest of the app is unchanged.`],
      ["Where the content comes from", "Rolled boxes are filled from the <b>official Solo Mode tables</b> — Imagining Clues for a clue, the character generator for a suspect, Cipher when you want two words to interpret."],
    ]),

    steps("Step by step", "Do these in order the first time. After that it is just: find something, put it up, connect it.", [
      ["1 · Turn Solo Mode on", "Settings ▸ Solo Mode. The Solo tab appears in the bottom nav, and <b>Board</b> is its fourth pill: Case · Shift · Scene · <b>Board</b> · Leads · Wrap · Notes."],
      ["2 · Open a case first", "The board is for the middle of an investigation, not the start. Roll a briefing on Solo ▸ <b>Case</b> so you have something to investigate."],
      ["3 · Put your first boxes up", "Solo ▸ <b>Board</b>. <b>🎲 ＋ Clue</b> and <b>🎲 ＋ Suspect</b> roll one from the official tables; <b>✍ ＋ Clue</b> and <b>✍ ＋ Suspect</b> let you type what you already know. Boxes are numbered as they arrive — C1, S2, C3 — and that tag is how the app refers to them everywhere."],
      ["4 · Interpret every box before you move on", "A rolled clue is a prompt, not a fact. Decide what “Counterfeit Document” actually means in your case, then press <b>📌</b> on the box to write it into the Case Notes. A board you cannot read later is worthless."],
      ["5 · Connect what you can justify", "When you work out how a clue implicates a suspect, press <b>🔗</b> on either box. Pick the other end from the list, or press <b>🎲 Let the board decide</b> and interpret whatever it hands you — the surprise is usually more interesting. <b>Clues only ever connect to suspects</b>, never clue-to-clue."],
      ["6 · Earn Discovery Checks by playing", `You do not roll on the board for free. Succeed on ${skillList} <b>on your character sheet</b> and the result offers <b>🔍 Earn a Discovery Check</b>. Press it and the check is banked; the Board card shows how many you are holding.`],
      ["7 · Spend a check when you want a lead", `Solo ▸ Board ▸ <b>🎲 Discovery Check</b>. It rolls D${H.DISCOVERY_ROLL.die} and <b>adds the number of boxes already on the board</b>, so the fuller the case the better the result — a busy board closes itself. The outcome may hand you a clue, a name, a connection, or nothing.`],
      ["8 · Watch the connection counts", `The 🔗 number on each suspect is how close they are to being your answer. At <b>${H.CLINCHER_CONNECTIONS} connections</b> the board calls it without waiting for a clincher roll.`],
      ["9 · Close the case by the book", `When the board names someone, an <b>answer</b> card appears. Press <b>★ Promote to a hypothesis</b> and it lands on Solo ▸ <b>Leads</b>. ${H.PROMOTE.note}`],
      ["10 · Housekeeping", `The board holds ${H.BOX_MAX} boxes; past that, retire one with <b>✕</b> before adding another (removing a box takes its connections with it). <b>✕ Clear the board</b> wipes the boxes but leaves your notes. Solo ▸ Notes ▸ <b>⟲ Start a fresh case</b> clears the board along with everything else.`],
    ], [["Open the Case Board", () => navigate("solo")], ["Open sheet to earn a check", () => navigate("sheet")]]),

    facts("What a Discovery Check can give you", H.DISCOVERY_OUTCOMES.map((r) => [
      r.max === Infinity ? `${r.min}+` : `${r.min}–${r.max}`,
      r.text,
    ])),

    steps("Reading a Discovery Check result", `The total is the die plus your box count, so these bands arrive in roughly that order over a case.`, [
      ["A new box", "The app rolls its content for you and drops it on the board, numbered next in sequence."],
      ["A new box, connected", "Same, but it also rolls which existing box it implicates — that is the board handing you a lead you did not have."],
      ["A connection only", "Two things already on your board turn out to be linked. Decide why; that reason is usually the best story beat of the Shift."],
      ["Nothing useful", "The trail stays cold. It still cost you the check, and the board is one roll closer to converging."],
      ["The clincher", `At ${clincherRow.min} or more. Treated as a connected clue whose suspect <b>is</b> the answer.`],
      ["Something impossible", "An outcome the board cannot honour — a connection with nothing to connect to, or a new box on a full board — degrades to “nothing useful” rather than being re-rolled."],
    ]),

    facts("Board rules at a glance", [
      ["Boxes", `Up to ${H.BOX_MAX}, numbered in the order they arrive. C = clue, S = suspect.`],
      ["Connections", "Clue ↔ suspect only, never doubled, recorded on both boxes."],
      ["Discovery Check", `D${H.DISCOVERY_ROLL.die} + boxes on the board. ${H.DISCOVERY_ROLL.note}`],
      ["Earned by", skillList + " — a success on your sheet, while Solo Mode is on."],
      ["Letting the board choose", `The smallest die that reaches your box count (${dice}), skipping forward past any box the connection may not land on. A roll past the last box is yours to choose, not a re-roll.`],
      ["Clincher", `A clincher result, or any suspect reaching ${H.CLINCHER_CONNECTIONS} connections.`],
      ["Awards", "None. The board points; the Hypothesis Check on Leads pays."],
    ]),

    steps("A worked Shift", "What this looks like in play, start to finish.", [
      ["You arrive", "Shift tab: the Location generator puts you in a flooded parking structure. The Countdown check comes up empty, so the timer escalates."],
      ["You search", "Observation on your sheet succeeds with two dice. You take the 🔍 and bank a Discovery Check."],
      ["You put it up", "Board ▸ 🎲 ＋ Clue rolls something you read as a shell casing with the serial filed off. It becomes C1, and you pin your reading to the notes."],
      ["You name someone", "🎲 ＋ Suspect gives you an evasive fixer with security contacts. S2. You decide the casing came through their hands, so 🔗 connects C1 to S2."],
      ["You spend the check", "🎲 Discovery Check rolls 58, plus 2 boxes = 60: a new clue, already connected. It lands as C3 and the board ties it to S2. Now S2 carries two lines, and you have a reason to go looking for them."],
      ["Later, it closes", `Two Shifts on, S2 is carrying ${H.CLINCHER_CONNECTIONS} lines and the answer card appears. You ★ promote them, rate the hypothesis, and run the Hypothesis Check on Leads — and that is what pays you the Promotion Points.`],
    ], [["Back to the solo loop", () => { writePanel("solo"); rerender(); window.scrollTo(0, 0); }]]),

    steps("Habits that make it work", null, [
      ["Only connect what you can explain", "A line you cannot justify is a line you will not remember. Say the reason out loud, then pin it."],
      ["Do not put everything up", "Boxes are for things that could matter. A board of twenty trivia entries converges on a random name."],
      ["Let it surprise you", "When a connection or a suspect makes no sense yet, that is the case getting more interesting — not the aid misfiring."],
      ["Keep the book in charge", "The board is scaffolding. Scenes, rolls, pushes, stress, and every point you earn still come from the printed rules."],
    ]),
  );
}

// ---- At the table ---------------------------------------------------------
function panelTable(host) {
  if (!Settings.gm()) host.append(hint("The GM Screen is off — the Game Runner turns it on in Settings.", () => navigate("settings")));
  host.append(
    steps("Before the session (Game Runner)", null, [
      ["1. Turn on the GM Screen", "Settings → GM Screen. Players leave it off."],
      ["2. Create the campaign", "Settings → create a campaign, then hand out the three-word join code. Everyone joins and shares a character."],
      ["3. Build the case", "GM ▸ <b>Prep</b> ▸ the Case File Generator rolls theme, assignment, sector, and a twist. The Main NPC generator gives you named people with occupations and quirks on demand."],
    ], [["Open GM Screen", () => navigate("gm")]]),

    steps("During the session", "Players drive their own sheets; the Game Runner watches and applies consequences.", [
      ["Players roll", "Tap the skill on your sheet. Announce what you want, roll, then decide whether to push."],
      ["The GM watches", "GM ▸ <b>Play</b> shows every character's Health, Resolve, and points live, with one-click damage, stress, and conditions."],
      ["Rewards", "Promotion Points come from the Game Runner for doing the job. Humanity Points land at session end for acts of compassion — always at least one for touching a key memory, a key relationship, or failing a Baseline Test."],
      ["Reference", "The Rules Library is searchable — weapons, gear, conditions, and crit tables are all in there mid-scene."],
    ], [["Rules Library", () => navigate("rules")]]),

    steps("Running a fight", null, [
      ["1. Open the tracker", `Add the player characters and drop in NPCs. Draw initiative once — ${D.INITIATIVE_CARDS} cards, act low to high, and that order holds for the whole fight.`],
      ["2. Take turns", "Each combatant gets one action plus one move. Attack buttons on the card roll it properly: ranged is a straight Firearms roll, close combat is opposed and rolls both sides at once."],
      ["3. Apply it", "Damage applies to the target from the result modal. Criticals roll the real injury table and land on the target's sheet."],
      ["4. End it", "End Combat clears the tracker. Wounds, criticals, and stress stay on the sheets — recovery happens in Downtime."],
    ], [["Combat Tracker", () => navigate("combat")]]),

    steps("4 · When they run", "Chases have their own procedure, and the tracker runs it.", [
      ["Open the chase card", "It sits under the combatants on the Combat screen. Pick the environment and the starting distance."],
      ["Each round", "Both sides choose a maneuver, then reveal an obstacle — the app rolls it off the right D12 table."],
      ["Resolve", "Move the distance marker. Reaching Engaged means caught; going past Extreme means they are away."],
    ], [["Combat Tracker", () => navigate("combat")]]),

    steps("Between sessions", null, [
      ["Downtime", "Each player takes a Downtime Shift on their sheet: Health and Resolve come back, and once-per-Shift specialties reset."],
      ["Advancement", `Specialties cost ${D.SPECIALTY_LEARN_COST_PP} Promotion Points. Raising a skill costs Humanity — ${Object.entries(D.SKILL_INCREASE_COST_HP).map(([lv, c]) => `${lv}→ ${c}`).join(", ")}. Attributes never rise.`],
      ["Replicants", "A Replicant at zero Promotion Points takes the Baseline Test. The sheet runs it and tracks the escalating consequences of failing."],
    ]),
  );
}

// ---- Cheat sheet (all numbers read live from data.js) ----------------------
function panelReference(host) {
  const dice = D.LEVELS.map((lv) => `${lv} = D${D.LEVEL_DIE[lv]}`).join(" · ");
  host.append(
    facts("Rolling", [
      ["Base Dice", `Attribute die + skill die (${dice}).`],
      ["Success", `A die showing ${D.SUCCESS_THRESHOLD}+ is one success; ${D.DOUBLE_THRESHOLD}+ is two. One success is enough — extras mean more effect or more damage.`],
      ["Advantage", "Adds a third die of the lower type. Disadvantage removes the lower die. They cancel one for one and never stack past one."],
      ["Push", `Only a <b>failed</b> roll can be pushed. Re-roll everything that isn't showing a ${D.PUSH_BANE_FACE}; every ${D.PUSH_BANE_FACE} left in the pool costs you 1 damage (Strength/Agility) or 1 stress (Intelligence/Empathy) — Replicants always take stress. NPCs never push.`],
    ]),
    facts("Vitals", [
      ["Health", "(Strength die + Agility die) ÷ 4, rounded up. Replicants +2."],
      ["Resolve", "(Intelligence die + Empathy die) ÷ 4, rounded up. Replicants −2."],
      ["Broken", "Health 0 = out of action, no skill rolls, further damage crits. Resolve 0 = a critical stress effect until you get a point back."],
    ]),
    facts("Combat", [
      ["Initiative", `${D.INITIATIVE_CARDS} cards, drawn once, act low to high, order persists.`],
      ["Turn", "One action, one move, plus free actions."],
      ["Ranges", D.RANGES.map((r) => r.name).join(" → ")],
      ["Close combat", "Opposed roll — the winner hits, ties miss, and only the attacker may push."],
      ["Armor", `When you are hit, roll ${D.ARMOR_DICE} dice of your armor's rating; each success stops ${D.ARMOR_DAMAGE_PER_SUCCESS} damage, and stopping all of it also stops the critical injury. Only one suit counts.`],
      ["Criticals", "Two successes over the target rolls the weapon's Crit Die on the Crushing or Piercing table; extra successes roll extra dice and you choose."],
    ]),
    facts("Chases", [
      ["How it runs", "No map: both sides pick a maneuver in secret, the Game Runner reveals an obstacle, then they resolve — prey first, pursuer last."],
      ["Distance", D.CHASE.distance],
      ["Caught", D.CHASE.caught],
      ["Away", D.CHASE.escape],
      ["Maneuvers", D.CHASE.maneuvers.map((m) => m.name).join(" · ")],
    ]),
    facts("Recovery", [
      ["Downtime Shift", `+${D.RECOVERY.downtimeHealthPerShift.human} Health for humans, +${D.RECOVERY.downtimeHealthPerShift.replicant} for Replicants, +${D.RECOVERY.medicalCareBonusHealth} more with medical care.`],
      ["Pace", `After ${D.RECOVERY.downtimeShiftsBeforeStress} investigation Shifts without Downtime you start accruing stress.`],
      ["First Aid", "A Medical Aid roll heals Health equal to its successes."],
    ]),
    facts("Spending points", [
      ["Specialty", `${D.SPECIALTY_LEARN_COST_PP} Promotion Points, one Shift at the Training Grounds.`],
      ["Skill", Object.entries(D.SKILL_INCREASE_COST_HP).map(([lv, c]) => `${lv} → next: ${c} Humanity`).join(" · ") + ". Downtime only."],
      ["Gear", `Promotion Points requisition from the LAPD, Chinyen Points buy on the street. ${D.AVAILABILITY_TIERS.filter((t) => t.skill).map((t) => t.key).join(", ")} goods need a ${D.SKILLS.find((x) => x.key === D.ACQUISITION.skill).name} roll (paying double gives advantage); ${D.AVAILABILITY_TIERS.filter((t) => !t.skill).map((t) => t.key).join(" and ")} goods are simply bought. ${D.ACQUISITION.failureNote}`],
      ["Selling", D.ACQUISITION.selling.note],
    ]),
    facts("Conditions", D.CONDITIONS.map((c) => [c.name, c.text])),
  );
}

// ---- builders -------------------------------------------------------------
function steps(title, sub, rows, actions) {
  const card = el("div", { class: "card" }, el("div", { class: "card__title" }, title));
  if (sub) card.append(el("p", { class: "muted" }, sub));
  const list = el("ol", { class: "tut__steps" });
  for (const [label, text] of rows) {
    list.append(el("li", { class: "tut__step" },
      el("span", { class: "tut__label" }, label),
      el("span", { class: "tut__text", html: text })));
  }
  card.append(list);
  if (actions?.length) {
    const row = el("div", { class: "roll-grid" });
    for (const [label, onClick] of actions) row.append(el("button", { class: "btn btn--ghost", onClick }, label + " →"));
    card.append(row);
  }
  return card;
}
function facts(title, rows) {
  return el("div", { class: "card" },
    el("div", { class: "card__title" }, title),
    el("dl", { class: "tut__facts" }, ...rows.flatMap(([k, v]) => [el("dt", {}, titleCase(k)), el("dd", {}, v)])));
}
function hint(text, onClick) {
  return el("div", { class: "card tut__hint" },
    el("p", { class: "muted" }, text),
    el("button", { class: "btn btn--ghost", onClick }, "Open Settings →"));
}
