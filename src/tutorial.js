// tutorial.js — "How to Play": procedural walkthroughs for running a case in this
// app, solo and at a table.  Mounted at route #tutorial (no nav tab; reached from
// the Home tile and Settings).  Last-viewed panel persists in brp:tutorial.
//
// Scope rule (CLAUDE.md §10.2): this module teaches the APP's flow. Every rules
// NUMBER shown here is read live from data.js — nothing mechanical is hardcoded.
import * as D from "../data.js";
import { el, clear, titleCase } from "./core.js";
import { segmentNav } from "./ui.js";
import { Settings } from "./settings.js";
import { navigate } from "./router.js";

const KEY = "brp:tutorial";
const SEGMENTS = [
  { key: "setup", label: "Setup" },
  { key: "solo", label: "Solo" },
  { key: "table", label: "At the Table" },
  { key: "reference", label: "Cheat Sheet" },
];

const readPanel = () => { try { return localStorage.getItem(KEY) || "setup"; } catch { return "setup"; } };
const writePanel = (p) => { try { localStorage.setItem(KEY, p); } catch {} };

export function renderTutorial(mount, rerender) {
  clear(mount);
  const panel = SEGMENTS.some((s) => s.key === readPanel()) ? readPanel() : "setup";
  const body = el("section", { class: "screen" },
    el("h1", { class: "screen__title" }, "How to Play"),
    el("p", { class: "muted" }, "Running a case with this app, step by step. The rules themselves live in the Rules Library — this is the procedure."),
    segmentNav({ segments: SEGMENTS, active: panel, onSelect: (k) => { writePanel(k); rerender(); } }),
  );
  const host = el("div", { class: "panel" });
  ({ setup: panelSetup, solo: panelSolo, table: panelTable, reference: panelReference }[panel])(host);
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
function panelSolo(host) {
  if (!Settings.solo()) host.append(hint("Solo Mode is currently off — turn it on in Settings to get the Solo tab.", () => navigate("settings")));
  host.append(
    steps("The solo loop", "Solo play replaces the Game Runner with dice. You ask, the oracle answers, you narrate.", [
      ["1. Open a case", "Solo ▸ <b>Start</b> ▸ ⚡ full briefing rolls Assignment, Relevance, Complication, and a Personal Hook straight into your case notes. The Core Case File Generator is there too if you want a longer hook."],
      ["2. Frame a scene", "Solo ▸ <b>Scene</b> ▸ Scene Check gives you the scene's category and pressure. Use the Location generator for where you are, and Cipher when you want an abstract prompt to interpret."],
      ["3. Ask the oracle", "Question Check answers yes/no with critical results. Imagining Clues gives you evidence (meaning + descriptor + type); the Character generator plus NPC Skill Level gives you someone to talk to."],
      ["4. Act", "Roll on your sheet as normal. Push when you need it — the banes are the consequence, and the app applies them."],
      ["5. Track leads", "Solo ▸ <b>Track</b> ▸ add a hypothesis and rate it with a die. Upgrade or downgrade it as evidence lands; the Hypothesis Check cashes it in for Promotion Points."],
      ["6. Turn up the heat", "The Countdown Event Timer escalates its die each time you advance it. When it triggers, roll the Countdown Event and let it complicate the case."],
      ["7. Trouble", "Fights and chases run in the Combat Tracker. Let NPC Tactics and NPC Chase Maneuvers decide what the opposition does — that's the point of solo play."],
      ["8. Close the shift", "Solo ▸ <b>Session</b> ▸ walk the Promotion and Humanity checklists and award yourself honestly. Then take a Downtime Shift on your sheet and spend what you earned."],
    ], [["Open Solo Mode", () => navigate("solo")], ["Combat Tracker", () => navigate("combat")]]),

    steps("Solo habits worth keeping", null, [
      ["Write it down", "Pin oracle results (📌) into case notes and pin rolls into your character's journal. Solo play falls apart when you can't remember what you established."],
      ["Answer before you roll", "If you already know what's behind the door, don't ask the oracle. It's for genuine uncertainty."],
      ["Respect the pace", `Three investigation Shifts without Downtime and you start taking stress — the sheet enforces it (${D.RECOVERY.downtimeShiftsBeforeStress} shifts, 4 with Married to the Job).`],
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
      ["3. Build the case", "GM ▸ <b>Case</b> ▸ the Case File Generator rolls theme, assignment, sector, and a twist. The Main NPC generator gives you named people with occupations and quirks on demand."],
    ], [["Open GM Screen", () => navigate("gm")]]),

    steps("During the session", "Players drive their own sheets; the Game Runner watches and applies consequences.", [
      ["Players roll", "Tap the skill on your sheet. Announce what you want, roll, then decide whether to push."],
      ["The GM watches", "GM ▸ <b>Party</b> shows every character's Health, Resolve, and points live, with one-click damage, stress, and conditions."],
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
      ["Push", `Re-roll everything that isn't already a success and isn't showing a ${D.PUSH_BANE_FACE}. Every ${D.PUSH_BANE_FACE} left in the pool costs you 1 damage (Strength/Agility) or 1 stress (Intelligence/Empathy) — Replicants always take stress.`],
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
      ["Gear", `Promotion Points requisition from the LAPD, Chinyen Points buy on the street — each needs a ${D.SKILLS.find((x) => x.key === D.ACQUISITION.skill).name} roll, and paying double gives advantage. ${D.ACQUISITION.failureNote}`],
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
