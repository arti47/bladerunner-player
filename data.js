// data.js — Blade Runner Player: CORE RULES LIBRARY (single source of truth)
// Every number/table below is extracted from the Blade Runner RPG Core Rulebook
// (Free League). Flavor text is paraphrased. Page/chapter cites in comments.
// See CLAUDE.md §3 and scratchpad/EXTRACTION.md for the full profile.

// ---------------------------------------------------------------------------
// DICE & LEVELS  [Ch01/Ch02/Ch03]
// Attribute & skill levels A–D map to step-dice. 6+ = success, 10+ = 2 successes.
// ---------------------------------------------------------------------------
export const LEVELS = ["A", "B", "C", "D"]; // best -> worst
export const LEVEL_DIE = { A: 12, B: 10, C: 8, D: 6 }; // die size (== max face)
export const ATTR_LEVEL_DESC = { A: "Extraordinary", B: "Capable", C: "Average", D: "Feeble" };
export const SKILL_LEVEL_DESC = { A: "Elite", B: "Experienced", C: "Novice", D: "Untrained" };
export const SUCCESS_THRESHOLD = 6;   // a die showing >= 6 is one success
export const DOUBLE_THRESHOLD = 10;   // a die showing >= 10 is two successes
export const PUSH_BANE_FACE = 1;      // a 1 on a pushed die inflicts damage/stress
export const PUSH_FAILED_ROLLS_ONLY = true; // "If you fail a Base Dice roll, you can push the roll"
export const DIE_SIZES = [6, 8, 10, 12]; // every step die used by the system

// ---------------------------------------------------------------------------
// ATTRIBUTES  [Ch02]
// ---------------------------------------------------------------------------
export const ATTRIBUTES = [
  { key: "STR", name: "Strength", blurb: "Muscle power, toughness, and physical endurance." },
  { key: "AGI", name: "Agility", blurb: "Body control, speed, and fine motor skills." },
  { key: "INT", name: "Intelligence", blurb: "Perception, intellect, and mental stability." },
  { key: "EMP", name: "Empathy", blurb: "Social intelligence, charisma, and emotional stability." },
];
export const ATTR_START_LEVEL = "C"; // baseline before increases

// ---------------------------------------------------------------------------
// SKILLS (13)  [Ch03]
// Twelve are governed by an attribute; DRIVING is governed by a vehicle's
// MANEUVERABILITY, so it has no character attribute.
// ---------------------------------------------------------------------------
export const SKILLS = [
  { key: "hand_to_hand", name: "Hand-to-Hand Combat", attr: "STR", blurb: "Attack or defend unarmed or with a melee weapon." },
  { key: "stamina", name: "Stamina", attr: "STR", blurb: "Endure hardship; roll to survive lethal critical injuries (death saves)." },
  { key: "force", name: "Force", attr: "STR", blurb: "Lift, push, or break heavy things — any feat of strength." },
  { key: "stealth", name: "Stealth", attr: "AGI", blurb: "Sneak, hide, pick pockets. Opposed by Observation." },
  { key: "mobility", name: "Mobility", attr: "AGI", blurb: "Climb, jump, sprint, dodge; foot chases." },
  { key: "firearms", name: "Firearms", attr: "AGI", blurb: "Fire ranged and thrown weapons." },
  { key: "observation", name: "Observation", attr: "INT", blurb: "Spot sneaks and examine areas for clues." },
  { key: "medical_aid", name: "Medical Aid", attr: "INT", blurb: "Revive the Broken; stabilize lethal critical injuries." },
  { key: "tech", name: "Tech", attr: "INT", blurb: "Program, repair, decrypt, or manipulate technology." },
  { key: "connections", name: "Connections", attr: "EMP", blurb: "Word on the street; find people; acquire gear." },
  { key: "manipulation", name: "Manipulation", attr: "EMP", blurb: "Trick or persuade. Opposed by Insight." },
  { key: "insight", name: "Insight", attr: "EMP", blurb: "Read people; resist Manipulation; Replicant Baseline Tests." },
  { key: "driving", name: "Driving", attr: "MANEUVER", blurb: "Drive vehicles; governed by a vehicle's Maneuverability, not an attribute." },
];
export const SKILL_START_LEVEL = "D"; // baseline before increases

// ---------------------------------------------------------------------------
// NATURE (Human / Replicant)  [Ch02]
// ---------------------------------------------------------------------------
export const NATURES = {
  human: {
    key: "human", name: "Human",
    healthMod: 0, resolveMod: 0, bonusAttrIncreases: 0,
    // Replicant-only rules that DON'T apply to humans:
    pushStressOnly: false, // humans take damage on STR/AGI pushes
  },
  replicant: {
    key: "replicant", name: "Replicant",
    healthMod: +2, resolveMod: -2,
    bonusAttrIncreases: 1,          // +1 increase, must be STR or AGI
    bonusAttrLimitedTo: ["STR", "AGI"],
    alwaysRookie: true,             // all Replicants are Rookies
    startingPromotionMod: -1,       // -1 starting Promotion Point (min 0)
    startingChinyenMod: -1,         // -1 starting Chinyen Point (min 0)
    pushStressOnly: true,           // Replicants suffer stress on ALL pushes
  },
};
// Secret Replicant option  [Ch02] — build and play as an apparent human; when
// the truth comes out the full Replicant rules apply from that moment.
export const SECRET_REPLICANT = {
  secretRollDie: 6,
  secretRollHit: 6,   // a 6 on the Game Runner's secret D6 = you are a Replicant
  note: "Play as an apparent human. On reveal: +2 max Health, −2 max Resolve, and every push costs stress instead of damage.",
};
// Step 1 of creation: D6 -> nature
export const NATURE_TABLE = [
  { min: 1, max: 3, nature: "human" },
  { min: 4, max: 6, nature: "replicant" },
];

// ---------------------------------------------------------------------------
// YEARS ON THE FORCE  [Ch02]
// attrIncreases / skillIncreases / specialties by tier.
// startingPromotionDie = die ROLLED for starting Promotion Points.
// chinyenMod = modifier applied to the archetype's Chinyen die roll.
// Replicants are always "rookie".
// ---------------------------------------------------------------------------
export const YEARS_ON_FORCE = [
  { key: "rookie",    name: "Rookie",    years: "0–1",  d12: [1, 2],   attrIncreases: 4, skillIncreases: 8,  specialties: 0, startingPromotionDie: 3,  chinyenMod: -1 },
  { key: "seasoned",  name: "Seasoned",  years: "2–7",  d12: [3, 6],   attrIncreases: 3, skillIncreases: 10, specialties: 1, startingPromotionDie: 6,  chinyenMod: 0 },
  { key: "veteran",   name: "Veteran",   years: "8–15", d12: [7, 10],  attrIncreases: 2, skillIncreases: 12, specialties: 2, startingPromotionDie: 8,  chinyenMod: +1 },
  { key: "oldtimer",  name: "Old-Timer", years: "16+",  d12: [11, 12], attrIncreases: 1, skillIncreases: 14, specialties: 3, startingPromotionDie: 10, chinyenMod: +2 },
];

// ---------------------------------------------------------------------------
// ARCHETYPES (7)  [Ch02 pp039-051]
// nature: "any" | "human" | "replicant". chinyenDie = die for starting Chinyen.
// keyAttr must end at B+; keySkills must end at C+. specialtyOptions = the D3
// suggestion table (choose or roll). names/appearance = D3 flavor tables
// (partial — completed in a data flavor sub-phase; see EXTRACTION.md).
// ---------------------------------------------------------------------------
export const ARCHETYPES = [
  { key: "analyst", name: "Analyst", nature: "any", keyAttr: "INT",
    keySkills: ["observation", "medical_aid", "tech"], chinyenDie: 8,
    specialtyOptions: ["insider", "musician", "scientist"],
    blurb: "Master of the crime lab — a meticulous forensics specialist who wrings the truth from evidence.",
    names: ["Fisher Vaas", "Piper Dallos", "Quinn Kosonan"],
    appearance: [
      "A pristinely-kept tragedy taped off from the public; you'd need a microscope and a post-grad degree to understand.",
      "OCD and a god complex wrapped in an emotionally guarded scarf.",
      "Your mom says you're a catch.",
    ] },
  { key: "cityspeaker", name: "Cityspeaker", nature: "human", keyAttr: "EMP",
    keySkills: ["mobility", "connections", "insight"], chinyenDie: 8,
    specialtyOptions: ["gutter_rat", "hardened", "origami"],
    blurb: "A deep-cover Vice operative the street trusts on sight — every syndicate and scavenger knows your face, not your badge.",
    names: ["Chiyo", "Sammon", "Corso"],
    appearance: [
      "You look like street trash, because you are street trash.",
      "The ugliest side of humanity on the outside; its greatest hope on the inside.",
      "A Dickensian acid trip.",
    ] },
  { key: "doxie", name: "Doxie", nature: "replicant", keyAttr: "AGI",
    keySkills: ["hand_to_hand", "mobility", "manipulation"], chinyenDie: 8,
    specialtyOptions: ["fast_reflexes", "interrogator", "merciful"],
    blurb: "A pleasure-model Replicant turned Blade Runner — disarming, agile, and dangerous up close.",
    names: ["Fenna", "Cadence", "Remedy"],
    appearance: [
      "You are a thing of beauty. Quite literally.",
      "However stunning you are, all they see are those sad, soulful eyes.",
      "You don't mind that people avoid your eyes — they'd otherwise notice how closely you study them.",
    ] },
  { key: "enforcer", name: "Enforcer", nature: "any", keyAttr: "STR",
    keySkills: ["hand_to_hand", "stamina", "firearms"], chinyenDie: 6,
    specialtyOptions: ["fast_reflexes", "killer", "tough"],
    blurb: "The muscle of the unit — you kick down the door and win the firefight.",
    names: ["Oelson Baaker", "Basher Kerrigan", "Dutch Szalay"],
    appearance: [
      "Ass-kicking boots; the rest is whatever wasn't dirty or bloody from the day before.",
      "You're human C4 — a drab, mushy square that's sexiest when it's armed.",
      "You only own two outfits: gym clothes and riot gear.",
    ] },
  { key: "fixer", name: "Fixer", nature: "any", keyAttr: "EMP",
    keySkills: ["connections", "manipulation", "insight"], chinyenDie: 10,
    specialtyOptions: ["cashflow", "insider", "protected"],
    blurb: "The unit's social engine — you know a guy, you cut the deal, you smooth it over.",
    names: ["Visser Janssen", "Mieko Saneda", "Elon Amancio"],
    appearance: [
      "Everything you wear is a statement — and they all say either Screw You or You Wish.",
      "You dress for whatever you want today, and you've got a walk-in closet.",
      "You walk, talk, and dress like someone who'll fire everybody you know one day.",
    ] },
  { key: "inspector", name: "Inspector", nature: "any", keyAttr: "AGI",
    keySkills: ["firearms", "observation", "connections"], chinyenDie: 6,
    specialtyOptions: ["hardened", "married_to_the_job", "smokes"],
    blurb: "The classic Rep-Detect detective — a sharp-eyed, street-hardened case-cracker.",
    names: ["Willem Novak", "Foster Worth", "Chaya Hoff"],
    appearance: [
      "That old trenchcoat reflects you — a desire or regret behind every scuff and tear you can't forget.",
      "A smirk that cuts glass, a stare that stretches for miles, a fist coiled and ready.",
      "You keep fidgeting with the dent where your wedding ring used to be.",
    ] },
  { key: "skimmer", name: "Skimmer", nature: "human", keyAttr: "EMP",
    keySkills: ["firearms", "connections", "manipulation"], chinyenDie: 12,
    specialtyOptions: ["cashflow", "kickbacks", "sycophant"],
    blurb: "A high-flying operator who works the upper floors and the money angles.",
    names: ["Tanner Rigo", "Mirren Smythe", "Dino Esposito"],
    appearance: [
      "What? Got mustard on my face or somethin'?",
      "People can tell what you're getting into by what you smell like — but you always smell like something.",
      "You live off shitty coffee, shitty takeout, and shitty people. And you're in your prime.",
    ] },
];
// Creation archetype-roll tables (D12) — differ by nature  [Ch02]
export const ARCHETYPE_TABLE = {
  human: [
    { min: 1, max: 1, key: "analyst" }, { min: 2, max: 3, key: "cityspeaker" },
    { min: 4, max: 5, key: "enforcer" }, { min: 6, max: 7, key: "fixer" },
    { min: 8, max: 10, key: "inspector" }, { min: 11, max: 12, key: "skimmer" },
  ],
  replicant: [
    { min: 1, max: 3, key: "analyst" }, { min: 4, max: 6, key: "doxie" },
    { min: 7, max: 8, key: "enforcer" }, { min: 9, max: 9, key: "fixer" },
    { min: 10, max: 12, key: "inspector" },
  ],
};

// ---------------------------------------------------------------------------
// SPECIALTIES (24 general)  [Ch03 p060-061]
// effect: machine-readable hooks where mechanical; maxTimes for repeatable.
// ---------------------------------------------------------------------------
export const SPECIALTIES = [
  { key: "bodyguard", name: "Bodyguard", text: "If someone within Short range is hit, roll Mobility (not an action) to take the hit for them. One+ success = you take it. Pushable." },
  { key: "cashflow", name: "Cashflow", text: "Off-the-books income: gain a Chinyen Point at the start of every Case File.", effect: { chinyenPerCase: 1 } },
  { key: "controlled", name: "Controlled", text: "When rolling a critical stress effect, you may re-roll the result once (keep the new one)." },
  { key: "counselor", name: "Counselor", text: "Once per Shift, heal 1 stress from another character by talking (not yourself)." },
  { key: "fast_reflexes", name: "Fast Reflexes", text: "Draw an extra initiative card at the start of combat; choose which to use.", effect: { extraInitiativeCards: 1 } },
  { key: "gutter_rat", name: "Gutter Rat", text: "Move to a new LA location on foot without rolling Connections." },
  { key: "hardened", name: "Hardened", text: "+1 maximum Resolve. Take up to three times.", maxTimes: 3, effect: { resolveMax: 1 } },
  { key: "hip_flask", name: "Hip Flask", text: "Once per Shift, take a swig to heal 1 stress." },
  { key: "insider", name: "Insider", text: "Advantage to all Connections rolls to acquire gear/resources from the LAPD." },
  { key: "interrogator", name: "Interrogator", text: "Advantage to Manipulation rolls extracting info from a prisoner or witness." },
  { key: "kickbacks", name: "Kickbacks", text: "Advantage to Connections rolls to buy or sell on the black market." },
  { key: "killer", name: "Killer", text: "On a critical hit, roll an extra Crit Die and choose the result.", effect: { extraCritDie: 1 } },
  { key: "married_to_the_job", name: "Married to the Job", text: "Go four Shifts without Downtime before suffering stress (instead of three).", effect: { downtimeGrace: 4 } },
  { key: "martial_arts", name: "Martial Arts", text: "Advantage to Hand-to-Hand Combat rolls when fighting unarmed." },
  { key: "merciful", name: "Merciful", text: "When you inflict a critical injury, you may voluntarily reduce the Crit Die to make it less lethal." },
  { key: "musician", name: "Musician", text: "Advantage to Manipulation rolls where singing/playing an instrument helps (GM's call)." },
  { key: "origami", name: "Origami", text: "Fold a figure over a few minutes to heal 1 stress; once per Shift." },
  { key: "people_person", name: "People Person", text: "Gain a second key relationship with the same rules effects.", effect: { extraKeyRelationship: 1 } },
  { key: "protected", name: "Protected", text: "When you'd lose Promotion Points for failures, roll Connections; each success reduces the loss by one (min 0)." },
  { key: "scientist", name: "Scientist", text: "Advantage to Tech or Medical Aid rolls involving natural-science knowledge (physics, biology, forensics, etc.)." },
  { key: "smokes", name: "Smokes", text: "Once per Shift, light up to heal 1 stress." },
  { key: "sniper", name: "Sniper", text: "Advantage to Firearms rolls firing a single shot at Long+ range from a hidden position." },
  { key: "sycophant", name: "Sycophant", text: "Gain an additional Promotion Point at the end of each session.", effect: { promotionPerSession: 1 } },
  { key: "tough", name: "Tough", text: "+1 maximum Health. Take up to three times.", maxTimes: 3, effect: { healthMax: 1 } },
];
export const SPECIALTY_LEARN_COST_PP = 5; // 1 Shift at Training Grounds

// ---------------------------------------------------------------------------
// ADVANCEMENT  [Ch02/07/09]
// ---------------------------------------------------------------------------
export const SKILL_INCREASE_COST_HP = { D: 5, C: 10, B: 15 }; // HP to raise FROM this level (D->C=5, C->B=10, B->A=15). 'A' is max.
export const HUMANITY_ALWAYS_TRIGGERS = [
  "Interacted with your key memory during the session.",
  "Interacted with your key relationship during the session.",
  "Failed a Baseline Test this session (Replicants only).",
];
export const BASELINE_TEST = {
  skill: "insight",
  triggersAtZeroPromotion: true,
  triggersWhenBrokenByStress: true,   // [Ch08] zero Promotion Points OR Broken by stress
  onSuccess: "+1 Promotion Point.",
  onFail: "+1 Humanity Point, plus escalating penalties by number of tests failed.",
  note: "Takes 1 Shift at the LAPD; does not count as Downtime.",
};

// ---------------------------------------------------------------------------
// CONDITIONS & STATUSES  [Ch04] — engine auto-applies `effect`
// effect.disadvantage: array of skill keys that get disadvantage while active.
// effect.flag: special behavioral flags handled by the engine.
// ---------------------------------------------------------------------------
// Machine-readable keys consumed by the engine (roller.js/combat.js):
//   selfMeleeDisadvantage   — the afflicted character's own close-combat roll
//   attackerMeleeAdvantage  — anyone attacking them in close combat
//   attackerRangedDisadvantage — anyone shooting at them
//   cannotDefend            — rolls no defence dice in an opposed close combat
export const CONDITIONS = [
  { key: "broken_damage", name: "Broken (Damage)", text: "0 Health. Out of action — may crawl/mumble, no actions or skill rolls. Further damage triggers an automatic critical injury.", effect: { flag: "no_skill_rolls", cannotDefend: true } },
  { key: "broken_stress", name: "Broken (Stress)", text: "Stress ≥ Resolve. Suffer a critical stress effect until you recover ≥1 Resolve.", effect: { flag: "critical_stress" } },
  { key: "prone", name: "Prone", text: "Disadvantage to close combat vs a standing target; standing target has advantage vs you. Stand up = free action on your turn.", effect: { selfMeleeDisadvantage: true, attackerMeleeAdvantage: true } },
  { key: "cover", name: "In Cover", text: "Attackers shooting you suffer disadvantage.", effect: { attackerRangedDisadvantage: true } },
  { key: "grappled", name: "Grappled / Restrained", text: "Cannot move or defend; only action is to break free (opposed Hand-to-Hand).", effect: { flag: "cannot_defend", cannotDefend: true } },
  { key: "aiming", name: "Aiming", text: "Advantage to your next single ranged shot. Lost if you do anything else or are hit.", effect: { advantage: ["firearms"] } },
];

// ---------------------------------------------------------------------------
// ARMOR PROCEDURE  [Ch04] — when you are hit, roll TWO dice of the armor's
// rating; every success reduces the damage by one. If the damage is reduced to
// zero the armor also negates the critical injury. Only one suit counts.
// ---------------------------------------------------------------------------
export const ARMOR_DICE = 2;              // dice rolled per hit
export const ARMOR_DAMAGE_PER_SUCCESS = 1; // damage removed per success

// ---------------------------------------------------------------------------
// CRITICAL INJURY TABLES (d12)  [Ch04 p073]
// lethal: needs death saves. deathSave: interval ('round'|'shift'|null).
// instantKill: dies immediately. healing: recovery time. disadvantage: skills.
// ---------------------------------------------------------------------------
export const CRIT_CRUSHING = [
  { roll: 1, injury: "Teeth knocked out", lethal: false, deathSave: null, healing: "Week", effect: "Disadvantage to Manipulation.", disadvantage: ["manipulation"] },
  { roll: 2, injury: "Broken nose", lethal: false, deathSave: null, healing: "Week", effect: "Disadvantage to Observation.", disadvantage: ["observation"] },
  { roll: 3, injury: "Broken fingers", lethal: false, deathSave: null, healing: "Week", effect: "Disadvantage to Firearms and Hand-to-Hand Combat.", disadvantage: ["firearms", "hand_to_hand"] },
  { roll: 4, injury: "Gouged eye", lethal: false, deathSave: null, healing: "Month", effect: "Disadvantage to Firearms and Observation.", disadvantage: ["firearms", "observation"] },
  { roll: 5, injury: "Cracked ribs", lethal: false, deathSave: null, healing: "Week", effect: "Disadvantage to Mobility.", disadvantage: ["mobility"] },
  { roll: 6, injury: "Concussion", lethal: false, deathSave: null, healing: "Week", effect: "Disadvantage to Observation and Tech.", disadvantage: ["observation", "tech"] },
  { roll: 7, injury: "Broken leg", lethal: false, deathSave: null, healing: "Month", effect: "Cannot stand — crawling only.", disadvantage: [], flag: "crawl_only" },
  { roll: 8, injury: "Broken arm", lethal: false, deathSave: null, healing: "Month", effect: "One arm unusable.", disadvantage: [] },
  { roll: 9, injury: "Internal bleeding", lethal: true, deathSave: "shift", healing: "Week", effect: "Disadvantage to Stamina and Mobility.", disadvantage: ["stamina", "mobility"] },
  { roll: 10, injury: "Broken neck", lethal: true, deathSave: "shift", healing: "Permanent", effect: "Cannot move at all.", disadvantage: [], flag: "immobile" },
  { roll: 11, injury: "Shattered pelvis", lethal: true, deathSave: "round", healing: "Month", effect: "Cannot stand — crawling only.", disadvantage: [], flag: "crawl_only" },
  { roll: 12, injury: "Crushed skull", lethal: true, deathSave: null, instantKill: true, healing: "—", effect: "Instant death." },
];
export const CRIT_PIERCING = [
  { roll: 1, injury: "Ear torn off", lethal: false, deathSave: null, healing: "Week", effect: "Disadvantage to Observation.", disadvantage: ["observation"] },
  { roll: 2, injury: "Hand impaled", lethal: false, deathSave: null, healing: "Week", effect: "Disadvantage to Firearms and Hand-to-Hand Combat.", disadvantage: ["firearms", "hand_to_hand"] },
  { roll: 3, injury: "Pierced eye", lethal: false, deathSave: null, healing: "Month", effect: "Disadvantage to Firearms and Observation.", disadvantage: ["firearms", "observation"] },
  { roll: 4, injury: "Shoulder hit", lethal: false, deathSave: null, healing: "Week", effect: "Disadvantage to Mobility and Firearms.", disadvantage: ["mobility", "firearms"] },
  { roll: 5, injury: "Bleeding gut", lethal: true, deathSave: "shift", healing: "Week", effect: "Any Mobility roll re-opens the wound.", disadvantage: [] },
  { roll: 6, injury: "Cracked skull", lethal: true, deathSave: "shift", healing: "Week", effect: "Disadvantage to Observation and Tech.", disadvantage: ["observation", "tech"] },
  { roll: 7, injury: "Punctured lung", lethal: true, deathSave: "shift", healing: "Month", effect: "Disadvantage to Stamina and Mobility.", disadvantage: ["stamina", "mobility"] },
  { roll: 8, injury: "Brains blown out", lethal: true, deathSave: null, instantKill: true, healing: "Permanent", effect: "Instant death." },
  { roll: 9, injury: "Massive internal organ damage", lethal: true, deathSave: "round", healing: "Month", effect: "Cannot stand — crawling only.", disadvantage: [], flag: "crawl_only" },
  { roll: 10, injury: "Pierced heart", lethal: true, deathSave: null, instantKill: true, healing: "Permanent", effect: "Instant death." },
  { roll: 11, injury: "Severed leg", lethal: true, deathSave: "shift", healing: "Permanent", effect: "Cannot stand — crawling only.", disadvantage: [], flag: "crawl_only" },
  { roll: 12, injury: "Shattered head", lethal: true, deathSave: null, instantKill: true, healing: "Permanent", effect: "Instant death." },
];

// ---------------------------------------------------------------------------
// STRESS  [Ch04]
// ---------------------------------------------------------------------------
export const STRESS_FACTORS = [
  { factor: 1, text: "Being threatened with violence." },
  { factor: 1, text: "Seeing a friendly character suffer a lethal critical injury." },
  { factor: 1, text: "Learning something distressing about the world or yourself." },
  { factor: 1, text: "Facing a person from your key memory." },
  { factor: 2, text: "Seeing a friendly character die." },
  { factor: 2, text: "Being interrogated." },
  { factor: 2, text: "Learning something profound about the world or yourself." },
  { factor: 3, text: "Witnessing a massacre." },
  { factor: 3, text: "Being tortured." },
  { factor: 3, text: "Learning something that fundamentally changes who you are (3+)." },
];
// `noSkillRolls` / `skillDisadvantage` / `noPush` are the engine-enforceable
// mechanical effects (Ch04); unflagged entries are roleplay-adjudicated.
export const CRITICAL_STRESS_HUMAN = [
  { roll: 1, name: "To Live in Fear", text: "Paralyzed by fear/indecision — you can't force yourself to do anything, even to save your own life.", noSkillRolls: true },
  { roll: 2, name: "Too Bad She Won't Live", text: "You break down in despair. You can move to safety but can't make skill rolls.", noSkillRolls: true },
  { roll: 3, name: "No Choice, Pal", text: "You surrender to the obstacle/adversary, or give up (as #2).", noSkillRolls: true },
  { roll: 4, name: "Tell Him I'm Eating", text: "You lash out at a nearby friendly or neutral character — possibly violently." },
  { roll: 5, name: "Twice as Quit", text: "You leave the scene; you can't work the case or make skill rolls.", noSkillRolls: true },
  { roll: 6, name: "Shakes? Me Too", text: "You function but with disadvantage to all skill rolls, and can't push (6+).", skillDisadvantage: true, noPush: true },
];
export const CRITICAL_STRESS_REPLICANT = [
  { roll: 1, name: "Let Me Tell You About My Mother", text: "Immediately attack the nearest person until you or the target is Broken, then see #2." },
  { roll: 2, name: "Time to Die", text: "You lose the will to live and collapse; you can't force yourself to act.", noSkillRolls: true },
  { roll: 3, name: "More Human Than Human", text: "You break down in complete despair. Move to safety but no skill rolls.", noSkillRolls: true },
  { roll: 4, name: "We're Physical", text: "Self-harm for 1 damage. If it Breaks you, roll a D6 Crit Die." },
  { roll: 5, name: "I've Seen Things", text: "You must connect/talk to someone; no skill rolls, won't leave unless life is in danger.", noSkillRolls: true },
  { roll: 6, name: "Twice as Bright", text: "A bonus action now (breaks initiative) with advantage; then see #2 (6+)." },
];

// ---------------------------------------------------------------------------
// RECOVERY  [Ch04/Ch09]
// ---------------------------------------------------------------------------
export const RECOVERY = {
  brokenAloneHealPerShift: 1,         // auto +1 Health after a Shift if alone
  downtimeHealthPerShift: { human: 1, replicant: 2 },
  medicalCareBonusHealth: 1,          // +1 more Health if a Shift is spent on care
  downtimeShiftsBeforeStress: 3,      // (Married to the Job -> 4)
  firstAidHealsSuccesses: true,       // Medical Aid: regain Health = successes
};

// ---------------------------------------------------------------------------
// COMBAT REFERENCE  [Ch04]
// ---------------------------------------------------------------------------
export const RANGES = [
  { key: "engaged", name: "Engaged", desc: "Right next to you." },
  { key: "short", name: "Short", desc: "A few meters, same zone." },
  { key: "medium", name: "Medium", desc: "Up to ~25 m, adjacent zone." },
  { key: "long", name: "Long", desc: "Up to ~100 m (four zones)." },
  { key: "extreme", name: "Extreme", desc: "Up to ~1 km." },
];
export const INITIATIVE_CARDS = 10; // draw from #1..#10, act low -> high
export const COMBAT_ACTIONS = [
  { action: "Sprint", prereq: "Standing", skill: "mobility" },
  { action: "Crawl", prereq: "Prone", skill: null },
  { action: "Unarmed attack", prereq: "Unarmed", skill: "hand_to_hand" },
  { action: "Melee attack", prereq: "Melee weapon", skill: "hand_to_hand" },
  { action: "Grapple", prereq: "Unarmed", skill: "hand_to_hand" },
  { action: "Break free", prereq: "Grappled", skill: "hand_to_hand" },
  { action: "Shoot firearm", prereq: "Firearm", skill: "firearms" },
  { action: "Careful aim", prereq: "Ranged weapon", skill: null },
  { action: "Throw weapon", prereq: "Thrown weapon", skill: "firearms" },
  { action: "First Aid", prereq: "Broken/dying victim", skill: "medical_aid" },
  { action: "Manipulate", prereq: "Audible", skill: "manipulation" },
  { action: "Use item", prereq: "Varies", skill: null },
];

// ---------------------------------------------------------------------------
// CHASES  [Ch04 p081] — foot & vehicle. No initiative; range-tracked lead.
// ---------------------------------------------------------------------------
export const CHASE = {
  procedure: [
    "Each participant SECRETLY selects a chase maneuver.",
    "The Game Runner randomly generates and reveals a chase obstacle (D12 by environment).",
    "Both sides reveal their maneuvers.",
    "Resolve maneuvers — prey first, pursuer last. (After the obstacle is revealed you may cancel your maneuver and do nothing, but not switch to another.)",
  ],
  distance: "Tracked by Range Category (Engaged→Extreme). GR sets the start, max Long.",
  escape: "Distance exceeds Extreme at end of a round, OR the prey wins a Hide maneuver.",
  caught: "Distance reduced to Engaged (or less): pursuer gets an immediate non-opposed Hand-to-Hand (or ramming) attack.",
  maneuvers: [
    { name: "Pursue / Flee", who: "both", skill: "mobility", vehicleSkill: "driving", text: "Each success moves distance one range category (closer for pursuer, farther for prey)." },
    { name: "Hide", who: "prey", skill: "stealth", vehicleSkill: "driving", opposedBy: "observation", text: "Not at Short or less; disadvantage at Medium, advantage at Extreme. Win = chase over (or ambush attack)." },
    { name: "Block", who: "prey", skill: "force", vehicleSkill: "driving", text: "Success: distance +1 category and the pursuer must also pass Force/Driving or have their maneuver canceled." },
    { name: "Cut Off", who: "pursuer", skill: "mobility", vehicleSkill: "driving", opposedBy: "mobility", text: "Disadvantage at Long/Extreme. Win = distance becomes Engaged + free attack. Lose/tie = distance to Extreme (prey escapes if already Extreme)." },
    { name: "Stand and Shoot", who: "both", skill: "firearms", text: "Resolves as a normal ranged attack." },
    { name: "Other", who: "both", skill: null, text: "Something else, usually no relative movement." },
  ],
  // D12 obstacle tables per environment (concise effects). [Ch04]
  obstacles: {
    foot: [
      "Dead end: auto-fails Pursue/Flee, Hide, or Block.",
      "Sidewalk crossing: advantage to Hide; disadvantage to Pursue/Flee and Stand & Shoot.",
      "Storefront window: fleeing/hiding/blocking prey passes Force to crash through or takes D3 and fails.",
      "MetroKab: disadvantage to Pursue/Flee and Stand & Shoot; advantage to Cut Off.",
      "Neon umbrellas (crowd): advantage to Hide; pursuer passes Observation or maneuver fails.",
      "Chanting monks: prey rolls Manipulation — success aids Hide, failure cancels the maneuver.",
      "LAPD street cops: disadvantage to Pursue/Flee, Hide, Stand & Shoot; shooters get fired on unless they pass Connections.",
      "Old man begging: pursuer passes Connections or Force or their maneuver is canceled.",
      "Garbage / slippery ground: disadvantage to Pursue/Flee; advantage to Block.",
      "Open space: advantage to Stand & Shoot; disadvantage to Hide.",
      "Street thugs: prey rolls Connections to pass or the thugs attack; success turns them on the pursuer.",
      "Human supremacist protest: disadvantage to prey Flee/Hide; advantage to pursuer Pursue/Cut Off.",
    ],
    ground: [
      "Dead end: auto-fails Pursue/Flee, Hide, or Block.",
      "Holo ad: drivers pass Observation or maneuver fails.",
      "Downpour: disadvantage to Pursue/Flee; advantage to Hide.",
      "Metrokab: advantage to Block; disadvantage to Pursue/Flee (failure = D3 vehicle damage).",
      "Traffic lights / pedestrians: advantage to Cut Off; disadvantage to Pursue/Flee and Stand & Shoot.",
      "LAPD Spinner: disadvantage to Pursue/Flee, Hide, Stand & Shoot; shooters get fired on unless they pass Connections.",
      "Wide freeway: advantage to Pursue/Flee and Stand & Shoot; disadvantage to Hide and Block.",
      "Street kids: prey rolls Connections to clear or takes 1 vehicle damage and fails the maneuver.",
      "Roadworks: advantage to Hide/Block/Cut Off; disadvantage to Pursue/Flee and Stand & Shoot (failure = D3 vehicle damage).",
      "Cyclists: advantage to Block; disadvantage to Pursue/Flee and Stand & Shoot.",
      "Self-driving truck: advantage to Cut Off; disadvantage to Pursue/Flee (failure = D6 vehicle damage).",
      "Narrow alley: Driving roll to pass unscathed; failure = vehicle Wrecked and chase ends.",
    ],
    aerial: [
      "Ad blimp: drivers pass Observation or maneuver fails.",
      "Industrial explosion: drivers pass Driving or take D6 and fail the maneuver.",
      "Polluted smog: advantage to Hide; pursuer passes Observation or maneuver fails.",
      "Low / narrow streets: advantage to Hide/Block/Cut Off; disadvantage to Pursue/Flee and Stand & Shoot (failure = D3 vehicle damage).",
      "Canyon of neon billboards: disadvantage to Hide.",
      "LAPD Spinner: disadvantage to Pursue/Flee, Hide, Stand & Shoot; shooters get fired on unless they pass Connections.",
      "Open air: advantage to Pursue/Flee and Stand & Shoot; disadvantage to Hide and Block.",
      "Neon billboard block: a failed Pursue/Flee crashes the Spinner and ends the chase.",
      "Construction site: advantage to Hide/Block/Cut Off; disadvantage to Pursue/Flee and Stand & Shoot (failure = D3 vehicle damage).",
      "Holo ad: drivers pass Observation or maneuver fails.",
      "Sudden downpour: advantage to Hide.",
      "Lightning strike: hits prey or pursuer at random; driver passes Tech to avoid a crash, but their maneuver auto-fails this round.",
    ],
  },
};

// Vehicles  [Ch08] — stat: Maneuverability (A-D), Hull, Armor, passengers.
export const VEHICLES = [
  { key: "spinner", name: "LAPD Spinner — Detective Special 294-02", maneuverability: "B", hull: 4, armor: "C", passengers: 2, avail: "Rare", cost: 5, note: "The Blade Runner's unmarked aerodyne cruiser; optional twin .50 machineguns." },
  { key: "spinner_dmv", name: "LAPD Spinner — DMV 137", maneuverability: "C", hull: 5, armor: "C", passengers: 2, avail: "Rare", cost: 5, note: "The marked blue-and-white patrol cruiser." },
  { key: "spinner_squad", name: "Spinner Squad Transport", maneuverability: "D", hull: 8, armor: "C", passengers: 20, avail: "Luxury", cost: 10, note: "Task-force transport; twin .50 machineguns standard." },
  { key: "spinner_carrier", name: "Spinner Carrier", maneuverability: "B", hull: 6, armor: "C", passengers: 6, avail: "Rare", cost: 6, note: "Troop carrier; optional tactical missile launcher." },
  { key: "spinner_cycle", name: "LAPD Spinner Cycle (Detective Special 08-3)", maneuverability: "A", hull: 2, armor: null, passengers: 1, avail: "Rare", cost: 5, note: "Fast stealth recon craft; no armaments." },
  { key: "ground_car", name: "Civilian Ground Car", maneuverability: "C", hull: 4, armor: "D", passengers: 4, avail: "Premium", cost: 3 },
  { key: "ground_truck", name: "Civilian Ground Truck", maneuverability: "D", hull: 8, armor: "D", passengers: 3, avail: "Rare", cost: 4 },
];
export const VEHICLE_WEAPONS = [
  { key: "autocannon", name: "Autocannon", damage: 3, critDie: 10, minRange: "short", maxRange: "long", fullAuto: true },
  { key: "tactical_missile", name: "Tactical Missile", damage: 6, critDie: 12, minRange: "long", maxRange: "extreme", note: "Blast Power B in addition to direct damage." },
  { key: "flares_chaff", name: "Flares & Chaff", damage: null, note: "Disadvantage to missile attacks against the vehicle." },
];

// ---------------------------------------------------------------------------
// WEAPONS  [Ch08]
// damage:int, critDie: number die-size OR "STR" (blunt = attacker Strength die),
// type: "crushing"|"piercing"|null, minRange/maxRange: range keys, cost, avail,
// fullAuto: bool, hidden: needs Observation to spot, note.
// Ranged/melee/explosive lists are complete per Ch08 (extracted Phase 0b).
// ---------------------------------------------------------------------------
export const WEAPONS_MELEE = [
  { key: "unarmed", name: "Unarmed", damage: 1, critDie: "STR", type: "crushing", avail: "—", cost: 0 },
  { key: "blunt_object", name: "Blunt Object", damage: 2, critDie: "STR", type: "crushing", avail: "Incidental", cost: 0, note: "One use only." },
  { key: "police_truncheon", name: "Police Truncheon", damage: 2, critDie: "STR", type: "crushing", avail: "Standard", cost: 1 },
  { key: "folding_knife", name: "Folding Knife", damage: 1, critDie: 8, type: "piercing", avail: "Incidental", cost: 0, hidden: true },
  { key: "survival_knife", name: "Survival Knife", damage: 1, critDie: 10, type: "piercing", avail: "Standard", cost: 1 },
  { key: "brass_knuckles", name: "Brass Knuckles", damage: 2, critDie: "STR", type: "crushing", avail: "Standard", cost: 1, hidden: true },
  { key: "pepper_spray", name: "Pepper Spray", damage: 1, critDie: null, type: null, avail: "Standard", cost: 1, note: "Cannot inflict a critical injury." },
];
export const WEAPONS_RANGED = [
  { key: "pkd_44", name: "PK-D 5223 Blaster (.44 Special)", damage: 2, critDie: 12, type: "piercing", minRange: "short", maxRange: "medium", avail: "Standard", cost: "Special" },
  { key: "pkd_sonic", name: "PK-D 5223 Blaster (Sonic Round)", damage: 1, critDie: 6, type: "crushing", minRange: "short", maxRange: "medium", avail: "Standard", cost: "Special" },
  { key: "pkd_222", name: "PK-D 5223 Blaster (.222 Rifle Round)", damage: 2, critDie: 10, type: "piercing", minRange: "medium", maxRange: "long", avail: "Standard", cost: "Special", note: "Single-shot; loading a .222 round is an action." },
  { key: "fkm890_sonic", name: "PK-D FKM890 (Sonic Round)", damage: 1, critDie: 6, type: "crushing", minRange: "short", maxRange: "long", avail: "Standard", cost: 2 },
  { key: "fkm890_blast", name: "PK-D FKM890 (Sonic Blast)", damage: 2, critDie: 10, type: "crushing", minRange: "short", maxRange: "medium", avail: "Standard", cost: 2 },
  { key: "subcompact_357", name: ".357 Subcompact", damage: 1, critDie: 12, type: "piercing", minRange: "engaged", maxRange: "short", avail: "Standard", cost: 1 },
  { key: "magnum_357", name: ".357 Magnum", damage: 2, critDie: 10, type: "piercing", minRange: "short", maxRange: "medium", avail: "Standard", cost: 1 },
  { key: "m1887_20g", name: "PK-D M1887 20 Gauge", damage: 3, critDie: 10, type: "piercing", minRange: "short", maxRange: "medium", avail: "Standard", cost: 2 },
  { key: "ender_scope", name: "Ender Scope Rifle", damage: 2, critDie: 12, type: "piercing", minRange: "medium", maxRange: "extreme", avail: "Premium", cost: 2 },
  { key: "ender_assault", name: "Ender Assault Rifle", damage: 2, critDie: 10, type: "piercing", minRange: "medium", maxRange: "long", avail: "Premium", cost: 3, fullAuto: true },
];
export const WEAPONS = [...WEAPONS_MELEE, ...WEAPONS_RANGED];


// Explosives & grenades  [Ch08]. Blast damage scales with Blast Power (see BLAST_POWER).
export const EXPLOSIVES = [
  { key: "grenade", name: "Grenade", damage: 2, critDie: 8, type: "piercing", blastPower: "C", maxRange: "medium", thrown: true, avail: "Premium", cost: 1 },
  { key: "explosive", name: "Explosive Charge", damage: "2–4", critDie: "8–12", type: "piercing", blastPower: "A–C", thrown: false, avail: "Premium", cost: "1–4", note: "Placed, not thrown. Cost is 1 at Blast Power C and doubles for each step up (B=2, A=4)." },
  { key: "tear_gas", name: "Tear Gas Grenade", damage: null, critDie: null, type: "gas", maxRange: "medium", thrown: true, avail: "Standard", cost: 1, note: "Everyone in the zone rolls Stamina (no action) on their turn or loses their action. Lingers D6 Rounds." },
  { key: "flash_bang", name: "Flash-Bang Grenade", damage: null, critDie: null, type: "flash", maxRange: "medium", thrown: true, avail: "Standard", cost: 2, note: "Everyone in the zone rolls Observation (no action) or loses their next turn." },
  { key: "sonic_grenade", name: "Sonic Grenade", damage: 2, critDie: 8, type: "crushing", blastPower: "C", maxRange: "medium", thrown: true, avail: "Premium", cost: 2 },
  { key: "sonic_charge", name: "Sonic Charge", damage: 3, critDie: 10, type: "crushing", blastPower: "B", thrown: false, avail: "Premium", cost: 4, note: "Placed, not thrown." },
];
// Blast Power rating -> damage & Crit Die (explosions/vehicle weapons)  [Ch04/08]
export const BLAST_POWER = { A: { damage: 4, critDie: 12 }, B: { damage: 3, critDie: 10 }, C: { damage: 2, critDie: 8 } };
export const ARMOR = [
  { key: "police_heavy_duty", name: "Police Heavy Duty Street Gear", rating: "B", avail: "Premium", cost: 2, disadvantage: ["mobility", "stealth", "observation", "connections", "manipulation"] },
  { key: "police_undershirt", name: "Police Undershirt Armor", rating: "C", avail: "Standard", cost: 1, disadvantage: ["mobility", "stealth"] },
  { key: "police_bracer", name: "Police Multi-Tool Bracer", rating: "D", avail: "Standard", cost: 1, disadvantage: ["stealth"], note: "Includes tools and a folding knife." },
  { key: "police_shield", name: "Police Shield", rating: null, avail: "Standard", cost: 2, disadvantage: ["mobility", "stealth", "connections", "manipulation"], note: "Disadvantage to attacks against you from the front (close and ranged)." },
  { key: "zip_ties", name: "Zip Ties", rating: null, avail: "Incidental", cost: 0, note: "Restraint. One action to apply; Force roll to break free." },
];
export const AVAILABILITY = ["Incidental", "Standard", "Premium", "Rare", "Luxury"]; // Cost = # of Promotion or Chinyen Points

// The Purchases table  [Ch08 p204] — availability sets the time, the cost band,
// and whether the deal needs a CONNECTIONS roll at all. Incidental and Standard
// goods are simply bought; Premium and up take time and a roll.
export const AVAILABILITY_TIERS = [
  { key: "Incidental", time: "Instant", cost: "—", skill: null },
  { key: "Standard", time: "Instant", cost: "1–2", skill: null },
  { key: "Premium", time: "A Shift", cost: "2–3", skill: "connections" },
  { key: "Rare", time: "A day or more", cost: "3–6", skill: "connections" },
  { key: "Luxury", time: "Several days", cost: "7+", skill: "connections" },
];

// Acquiring gear  [Ch08 p204] — pay the Cost in Promotion Points (LAPD
// requisition) or Chinyen Points (black market / private sale). Premium and
// rarer goods also need a CONNECTIONS roll; paying double gives advantage, and a
// failed roll wastes the time, not the points.
export const ACQUISITION = {
  skill: "connections",
  doublePaymentAdvantage: true,
  failureNote: "The deal falls through — you keep the points but the Shift is wasted.",
  sources: [
    { key: "lapd", name: "LAPD requisition", currency: "promotionPoints", currencyName: "Promotion Points", symbol: "PP" },
    { key: "market", name: "Black market / private", currency: "chinyenPoints", currencyName: "Chinyen Points", symbol: "¥" },
  ],
  // Selling on the black market  [Ch08 p207].
  selling: {
    payoutFraction: 0.5,     // half the listed Cost…
    roundUp: true,           // …rounded up
    currency: "chinyenPoints",
    rollFromAvailability: "Premium",  // finding a buyer at Premium or higher needs a roll
    note: "Selling takes as long as buying. You are paid half the item's Cost, rounded up; finding a buyer for Premium or rarer goods needs a CONNECTIONS roll.",
  },
};

// Standard-issue gear granted at creation  [Ch02]
export const STANDARD_ISSUE = [
  "Badge", "PK-D Blaster (or .357 Subcompact)", "Knowledge Integration Assistant (KIA)", "Detective Special Spinner",
];

// General gear & equipment  [Ch08]. once_per_shift heal flags are enforced by the engine.
export const GEAR = [
  { key: "badge", name: "Badge", cat: "Core", avail: "Standard Issue", cost: 0, text: "Skeleton key to most of the city + scannable ID barcode. Must be carried at all times (losing it = disciplinary action + Promotion Point loss)." },
  { key: "kia", name: "Knowledge Integration Assistant (KIA)", cat: "Core", avail: "Standard Issue", cost: 0, text: "Personal data manager with a datalink to the LAPD Mainframe; encrypted two-way comms, Esper audio-video recorder, bioscanner for Nexus serial numbers." },
  { key: "voight_kampff", name: "Voight-Kampff Machine", cat: "Core", avail: "Standard", cost: 0, text: "Portable Empathy Test. Takes a Shift; opposed Insight vs the subject's Manipulation, with disadvantage to the subject." },
  { key: "glue", name: "Glue Medical Adhesive", cat: "Medical", avail: "Incidental", cost: 0, text: "Advantage to a Medical Aid roll when giving first aid to a Broken character." },
  { key: "medchecker", name: "MedChecker Kiosk", cat: "Medical", avail: "Standard", cost: 1, text: "Heal 1 Health and 1 Resolve even outside Downtime. Once per Shift." },
  { key: "surgeons_kit", name: "Surgeon's Field Kit", cat: "Medical", avail: "Premium", cost: 3, text: "Advantage to a Medical Aid roll to stabilize a lethal critical injury." },
  { key: "instant_fix", name: "Instant Fix (Painkiller)", cat: "Medical", avail: "Standard", cost: 1, text: "Immediately heal 1 Health. Once per Shift." },
  { key: "soviet_happy", name: "Soviet Happy (Stimulant)", cat: "Medical", avail: "Standard", cost: 1, text: "Immediately heal 1 Resolve. Once per Shift." },
  { key: "zllsh", name: "ZLLSH (Hard Narcotic)", cat: "Medical", avail: "Standard", cost: 1, text: "No skill rolls for a full Shift after use." },
  { key: "med_regular", name: "Regular Medical Procedure", cat: "Medical", avail: "Premium", cost: 3, text: "Leveled Medical Aid roll to stabilize a lethal critical injury." },
  { key: "med_emergency", name: "Emergency Medical Procedure", cat: "Medical", avail: "Rare", cost: 6, text: "Higher-level Medical Aid roll to stabilize a lethal critical injury." },
  { key: "ko_kuma", name: "Ko-Kuma", cat: "Consumable", avail: "Incidental", cost: 0, text: "Energy drink." },
  { key: "beer", name: "Beer", cat: "Consumable", avail: "Incidental", cost: 0, text: "A drink." },
  { key: "hard_alcohol", name: "Hard Alcohol", cat: "Consumable", avail: "Incidental", cost: 0, text: "A stiff drink." },
  { key: "experience", name: "Experience", cat: "Consumable", avail: "Incidental", cost: 0, text: "Light narcotic." },
  { key: "handcuffs", name: "Standard Handcuffs", cat: "Restraint", avail: "Standard", cost: 1, text: "One action to apply; subject rolls Force at disadvantage to break free." },
  { key: "surveillance_drone", name: "Surveillance Drone", cat: "Utility", avail: "Standard", cost: 1, text: "Remote data capture and surveillance. Requisition for a Shift + a Connections roll." },
];

// Synthetic augmentations & implants  [Ch08]
export const AUGMENTATIONS = [
  { key: "altered_appearance", name: "Altered Appearance", avail: "Premium", cost: "4–10", text: "Change appearance, from minor surgery to unrecognizable (including apparent age)." },
  { key: "biometric_reader", name: "Biometric Reader", avail: "Premium", cost: 6, text: "Proximity/touch personal identification." },
  { key: "ocular_implant", name: "Ocular Implant", avail: "Premium", cost: 8, text: "Advantage to Observation in darkness; KIA uplink." },
  { key: "cochlear_implants", name: "Cochlear Implants", avail: "Premium", cost: 8, text: "Advantage to Observation when listening." },
  { key: "medical_implant", name: "Medical Implant", avail: "Rare", cost: "6–10", text: "Permanently removes the ongoing effect of a critical injury." },
  { key: "prosthetic_arm", name: "Prosthetic Arm", avail: "Rare", cost: 10, text: "Advantage to Force using arm strength; unarmed attacks deal base Damage 2." },
  { key: "prosthetic_leg", name: "Prosthetic Leg", avail: "Rare", cost: 10, text: "Advantage to Mobility when running or jumping." },
  { key: "synaptic_implants", name: "Synaptic Implants", avail: "Rare", cost: 12, text: "Draw an extra initiative card at the start of combat and choose which to use." },
];

// ---------------------------------------------------------------------------
// KEY MEMORY TABLES (roll one on each)  [Ch02]
// ---------------------------------------------------------------------------
export const MEMORY_WHEN = [ // D6
  "When you were a small child — now a fleeting vision.",
  "During childhood — you remember it like yesterday.",
  "As a young teen — it defined your view of the adult world.",
  "As an older teenager, turning into a young adult.",
  "Some years back.",
  "Just a few weeks ago.",
];
export const MEMORY_WHERE = [ // D12
  "On a rain-soaked downtown LA street corner.",
  "In a lavish penthouse over the Fashion District.",
  "Watching the synthetic fish tanks on Animoid Row.",
  "Lost in a crowd in a loud, dim nightclub.",
  "In a serene, exclusive corporate HQ.",
  "In the derelict housing projects of the LA Hills.",
  "Off the grid in the Kipple wastelands.",
  "On a protein farm in the Energy Empire.",
  "On a distant farmstead in the rural countryside.",
  "In a wintry, snow-covered landscape.",
  "In a foreign land amid an unknown language.",
  "Somewhere in the off-world colonies.",
];
export const MEMORY_WHO = [ // D12
  "Your parent(s)", "Your sibling", "A superior or authority figure", "Your romantic partner",
  "A trusted friend", "An LAPD cop", "A Blade Runner", "A throng of faceless people",
  "Masked killers", "A perfect stranger", "A hunted Replicant", "No one but you",
];
export const MEMORY_WHAT = [ // D12
  "You saw something extraordinary you can't explain.", "You took part in or witnessed a violent crime.",
  "You witnessed a natural phenomenon.", "You took part in a battle or a massacre.",
  "You were physically attacked or abused.", "You were psychologically abused.",
  "You suffered a breach of trust or betrayal.", "You made an unforgivable compromise.",
  "You suffered or witnessed a horrible accident.", "You made or witnessed a selfless sacrifice.",
  "You suffered a moment of weakness.", "You witnessed a miracle.",
];
export const MEMORY_FEEL = [ // D12
  "Hopeful", "Lost", "Vulnerable", "Jaded", "Haunted", "Blessed",
  "Loved", "Bold", "Disgusted", "Shameful", "Terrified", "Tempted",
];

// ---------------------------------------------------------------------------
// TYPICAL NPCS (14)  [Ch09]  -> also see data-npcs.js (canonical combatant list)
// Kept here as a quick reference count; data-npcs.js holds full stat objects.
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// KEY RELATIONSHIP TABLES (roll one on each)  [Ch02 p032]
// ---------------------------------------------------------------------------
export const RELATIONSHIP_WHO = [ // D12
  "Parent", "Sibling", "Child", "Spouse", "Romantic partner", "Old friend",
  "Colleague", "Superior", "Suspect", "Neighbor", "Doxie", "DiJi",
];
export const RELATIONSHIP_LIKE = [ // D12
  "Friendly", "Loving", "Passionate", "Trusting", "Protective", "Estranged",
  "Violent", "Deceitful", "One-sided", "Hateful", "Distant", "Only in your head",
];
export const RELATIONSHIP_GOING_ON = [ // D12
  "You're in a fight about something.", "They have gone missing.", "They want something from you.",
  "They want you to quit your job.", "You think they are hiding something.", "They constantly disappoint you.",
  "They need help with something.", "Their life is in danger.", "They are suspected of a crime.",
  "You constantly disappoint them.", "They know your deepest secret.", "They threaten you with something.",
];

// Signature item  [Ch02 p034] — interacting with it recovers 1 stress, once per session.
export const SIGNATURE_ITEMS = [ // D12
  "A photograph", "A book", "A ring", "A necklace", "A musical instrument", "An old coat",
  "A dog tag", "An origami bird", "A cheap souvenir", "A second-hand animoid pet",
  "An open stool at your favorite bar", "A tombstone",
];
export const SIGNATURE_ITEM_HEAL = { resolve: 1, period: "session" };

// Where you live  [Ch02 p034] — D12; 1–4 is the standard LAPD apartment.
export const HOME_TABLE = [
  { range: [1, 4], text: "A sparsely furnished LAPD housing apartment in Sector 5 — small and claustrophobic." },
  { range: [5, 5], text: "A condo full of old mementos, with a balcony over the neon streets of Little Tokyo." },
  { range: [6, 6], text: "A cheap run-down hotel room by Hawker's Circle, flickering lights and dripping pipes." },
  { range: [7, 7], text: "A huge, dilapidated apartment in an abandoned building on Retirement Row — leaking ceilings, debris everywhere." },
  { range: [8, 8], text: "A dingy flat above a seedy bar off Nightclub Row." },
  { range: [9, 9], text: "A cluttered warehouse off Animoid Row, hidden from prying eyes." },
  { range: [10, 10], text: "A serene luxury penthouse hotel suite in the Financial District." },
  { range: [11, 11], text: "No home at all — you drift, spending every night somewhere different." },
  { range: [12, 12], text: "With your key relationship. Roll again to see where they live." },
];

export const TIME_UNITS = { round: "5–10 seconds (combat/chase)", shift: "5–10 hours (investigation); 4 per day" };

export const META = {
  game: "Blade Runner RPG",
  publisher: "Free League Publishing",
  scope: "Core Rulebook + official Solo Mode (personal play aid).",
};

// ---------------------------------------------------------------------------
// GLOSSARY — plain-language definitions of the vocabulary the app uses.
// Written for someone who has never read the rulebook or played a solo RPG:
// what the word means and what you DO about it. Paraphrase only (CLAUDE.md §12);
// the numbers live in the tables above and are never repeated here.
// ---------------------------------------------------------------------------
export const GLOSSARY = [
  { term: "Base Dice", text: "The dice you roll for an action: your attribute die plus the skill die. The app builds the pool for you — you just press the skill." },
  { term: "Success", text: "A high enough face on any die. One is all you need for the action to work; more successes mean a better outcome." },
  { term: "Critical success", text: "Two or more successes on one roll. In a fight that means a critical injury; outside one, roll the Crit Success table for a concrete benefit." },
  { term: "Push", text: "Re-rolling a failed roll for a second chance, at a price: any 1 left in the pool costs you Health (physical skills) or stress (mental ones). Replicants always pay in stress." },
  { term: "Bane", text: "A die showing 1 after a push. Each one is the cost of having pushed." },
  { term: "Advantage / disadvantage", text: "One extra die, or one die removed. The app applies the ones your character's state earns automatically." },
  { term: "Health", text: "How much physical punishment you can take. At zero you are Broken: out of the action until someone patches you up." },
  { term: "Resolve", text: "How much pressure your mind can take. It drops from stress, not wounds. At zero you break down and suffer a critical stress effect." },
  { term: "Broken", text: "Out of action — no skill rolls, no defending. From damage it is Health at zero; from stress it is Resolve at zero. Both are recoverable." },
  { term: "Critical injury", text: "A serious wound rolled on a table when you take a critical hit. Some are lethal and start death saves; the app walks you through the whole procedure." },
  { term: "Shift", text: "A block of a few hours — the unit of time an investigation runs on. Visiting one location usually costs one Shift." },
  { term: "Downtime", text: "A Shift spent off the case: you heal, and the counter that tracks how long you have been pushing resets. Skip it too long and you start taking stress." },
  { term: "Promotion Points", text: "Your standing in the department. Earned by doing the job well, spent on gear from the LAPD and on new specialties." },
  { term: "Chinyen Points", text: "Street money. Spent on anything the department will not sign off on." },
  { term: "Humanity Points", text: "Earned for acts of compassion and for touching your memories and relationships. Spent to raise a skill." },
  { term: "Specialty", text: "A named knack that bends a rule in your favour — the closest thing this game has to a feat or perk." },
  { term: "Baseline Test", text: "The interrogation a Replicant blade runner has to pass to stay on duty. The app runs it and tracks the consequences of failing." },
  { term: "Oracle", text: "Solo play has no Game Runner, so dice answer the questions instead. Any table you roll to find out what happens is an oracle." },
  { term: "Scene Check", text: "A solo roll that tells you how hard or dangerous a situation is before you commit to it." },
  { term: "Question Check", text: "A solo roll that answers a yes/no question about the world when you genuinely do not know the answer." },
  { term: "Countdown Event Check", text: "A once-per-Shift roll that decides whether trouble interrupts you on the way to a location. The longer nothing happens, the likelier it becomes." },
  { term: "Hypothesis", text: "Your working theory of the case, rated with a die that rises as evidence supports it. Testing it is how a solo case ends." },
  { term: "Clue / lead", text: "A clue is what you find; a lead is where it points you next. Clues go in your notes, leads decide the next location." },
  { term: "Initiative card", text: "A drawn number that fixes the order of a fight. Low numbers act first, and the order holds for the whole fight." },
  { term: "Engaged", text: "Close enough to hit each other by hand. The other range bands step outward from there." },
  { term: "Prey / pursuer", text: "The two sides of a chase — the one running and the one chasing." },
  { term: "Game Runner", text: "This game's name for the referee. In solo play there is not one; the oracles take that job." },
];
