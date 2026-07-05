// data-solo.js — Official SOLO MODE tables & oracle  [Blade Runner RPG: Solo Mode]
// Powers solo.js (the solo assistant). All tables extracted from the Solo Mode
// supplement; flavor paraphrased where prose. Only loaded when Solo Mode is on.

// Blade Runner Origin (solo character seed) — D12
export const ORIGIN = [
  "After a traumatic incident, your dreams invade your waking life — you're unsure what's real.",
  "Your vice has gotten the better of you before; to others, you're a liability.",
  "Your methods are unorthodox and reckless, but you always get results.",
  "You had a partner. The case went bad — they died, and you lost a friend.",
  "You reported a crooked cop. Others don't trust you.",
  "You have a knack for finding trouble and a reputation for collateral damage.",
  "An ongoing investigation into your recent actions makes you the department pariah.",
  "After a traumatic childhood, you've struggled all your life to make connections.",
  "You returned from off-world. Earth has changed — and so have you.",
  "A desperate gunfight left civilians bleeding in the street. You took the blame.",
  "Amid a sensational case, you drew too much media attention.",
  "You're part of the old guard; your methods seem dated to young Blade Runners.",
];

// Case Briefing tables — the Solo Mode's own "start a case" generator (p16).
// Roll each to assemble an opening briefing.
export const CASE_BRIEFING = {
  // Table 1: Assignment — D6 (group) × D10. 1–3 = first ten, 4–6 = second ten.
  assignment: [
    "Assault", "Black Market", "Blackmail", "Corporate Assassination", "Corporate Espionage",
    "Corporate Fraud", "Extortion", "Kidnapping", "Missing Person", "Murder",
    "Mysterious Death", "Police Corruption", "Political scandal", "Rebellion / Extremism", "Retirement Order",
    "Robbery", "Sabotage", "Smuggling / Trafficking", "Terrorism", "Vigilantism",
  ],
  // Table 2: Relevance (why it's an RDU case) — D12
  relevance: [
    "A Replicant is a victim.", "A Replicant is a key witness or accuser.", "A Replicant is a suspect.",
    "A Replicant is an accomplice.", "A Replicant is a consultant on the case.", "Involves Replicant tech.",
    "Involves animoid tech.", "Involves Human Supremacists.", "Involves the Replicant Underground.",
    "Involves Replicant sympathizers.", "Involves Wallace Corp interests.", "Involves a fellow Blade Runner.",
  ],
  // Table 3: Initial Complication — D12
  complication: [
    "Requires unusual discretion or secrecy.", "Heavy-handed corporate oversight.", "High-profile media scrutiny.",
    "A rival investigator or agency is also on the case.", "Compromised crime scene or evidence.",
    "Outside your usual jurisdiction or expertise.", "Classified or redacted details — above your pay grade.",
    "The previous investigator was killed or is missing.", "Involves a notorious criminal faction or person.",
    "Involves an influential or powerful person.", "A cold case.", "A time-sensitive deadline.",
  ],
  // Table 4: Personal Hook — D12
  hook: [
    "Involves an aspect of your key memory.", "Involves one of your old cases.", "Involves a past mistake or regret.",
    "Involves a fellow investigator or mentor.", "Involves a personal vice.", "Involves your strongly held principles.",
    "Involves a former lover.", "Involves someone you owe a debt or favor.", "Involves a death or loss from your past.",
    "Involves professional risk or opportunity.", "Involves a personal interest or obsession.", "Involves your key relationship.",
  ],
};

// Session/milestone self-award checklists (once per milestone; +1 each)
export const HUMANITY_CHECKLIST = [
  "Took a personal risk to help another person — human or Replicant.",
  "Connected to someone, human or Replicant, on a personal level.",
  "Learned something significant about someone's life.",
  "Tried to talk someone down from committing a crime.",
  "Learned something that made you view the world differently.",
  "Refused to upload evidence to the LAPD Mainframe to protect someone.",
  "Refused to follow orders you felt were wrong.",
  "Used or interacted with your key memory.",
  "Interacted with your key relationship.",
  "Played one or more scenes of Downtime.",
  "Failed a Baseline Test (Replicants only).",
];
export const PROMOTION_GAIN = [
  "Found one or more clues that led to real progress.",
  "Revealed and reported one or more fugitive Nexus-8 Replicants to the RDU.",
  "Apprehended one or more suspects or fugitives.",
  "Stopped one or more serious crimes.",
  "Uploaded at least one piece of important evidence to the LAPD Mainframe.",
  "Saved the life of another law officer or performed a heroic action.",
  "Reported law-officer misconduct with backing evidence.",
  "Took a Baseline Test and passed (Replicants only).",
];
export const PROMOTION_LOSE = [
  "Failed to apprehend a wanted fugitive when you had the chance.",
  "Abused your authority or acted unbecoming of a law officer.",
  "Ignored or directly violated an order.",
  "Lost LAPD equipment assigned to you.",
  "Harmed or killed an innocent suspect or bystander.",
  "Let the case draw negative media exposure or controversy.",
  "Exposed confidential case information to the media.",
  "Accused Wallace Corp of anything (with or without evidence).",
  "Failed a Baseline Test (Replicants only).",
];

// Scene Check — roll 1 D8 Base Die
export const SCENE_CHECK = [
  { range: [1, 1], result: "Complicated", detail: "Beyond any skill rolls, may need extra time, a different approach, more resources, added risk, or a disadvantage." },
  { range: [2, 5], result: "Challenging", detail: "Requires one or more skill rolls to proceed." },
  { range: [6, 7], result: "Routine", detail: "Probably no skill roll needed." },
  { range: [8, 8], result: "Favorable", detail: "Probably no roll — and any roll is made with an advantage." },
];

// Question Check — roll 1 D10 Base Die (odds adjust: high prob = 2 dice keep best; low = keep worst)
export const QUESTION_CHECK = [
  { range: [1, 1], result: "Extreme No", detail: "A definitive no, or a no with a nasty twist." },
  { range: [2, 5], result: "No" },
  { range: [6, 9], result: "Yes" },
  { range: [10, 10], result: "Extreme Yes", detail: "A definitive yes, or a yes with a twist." },
];
export const QUESTION_ODDS_NOTE = "High-probability yes: roll 2 Base Dice, keep the highest (≈75%). Low-probability yes: keep the lowest (≈25%).";

// Scene Categories — D12 (with suggested skills)
export const SCENE_CATEGORIES = [
  { name: "Confront", detail: "Overcome a potentially violent confrontation.", skills: ["manipulation", "mobility", "driving", "hand_to_hand", "firearms"] },
  { name: "Canvass", detail: "Survey an area or community.", skills: ["connections", "observation", "insight"] },
  { name: "Consult", detail: "Seek expert insight or an outside perspective.", skills: ["connections", "manipulation", "tech", "medical_aid"] },
  { name: "Examine", detail: "Analyze evidence closely for details.", skills: ["observation", "tech", "medical_aid"] },
  { name: "Infiltrate", detail: "Enter a location covertly to gather information.", skills: ["connections", "manipulation", "stealth", "tech", "observation"] },
  { name: "Pursue", detail: "Chase a person or vehicle.", skills: ["mobility", "driving", "observation", "hand_to_hand"] },
  { name: "Question", detail: "Interview or interrogate a person.", skills: ["connections", "insight", "manipulation", "tech"] },
  { name: "Research", detail: "Gather data or correlate findings.", skills: ["tech", "medical_aid"] },
  { name: "Search", detail: "Inspect a location for clues.", skills: ["observation", "tech", "force"] },
  { name: "Surveil", detail: "Observe a location or person over time.", skills: ["observation", "stealth", "stamina"] },
  { name: "Survive", detail: "Overcome a physical danger or harsh environment.", skills: ["force", "stamina", "mobility", "driving", "medical_aid"] },
  { name: "Trail", detail: "Follow a person or vehicle.", skills: ["stealth", "observation", "mobility", "driving"] },
];

// Critical Success (out of combat) — D8, with a bonus effect
export const CRITICAL_SUCCESS = [
  { name: "Observant", text: "Notice something unexpected or reveal an opportunity.", bonus: "If you act on it, advantage on your next skill roll this scene." },
  { name: "Confident", text: "Commit to your current course.", bonus: "Recover 1 lost Resolve." },
  { name: "Unnoticed", text: "Act with quiet or subtlety.", bonus: "Advantage on a Stealth roll this scene." },
  { name: "Intimidating", text: "Make an NPC falter.", bonus: "That NPC has disadvantage on their next roll this scene." },
  { name: "Impressive", text: "Impress an NPC in the scene.", bonus: "Once this scene, advantage on Manipulation vs that NPC." },
  { name: "Helpful", text: "An NPC benefits from your action.", bonus: "That NPC gains advantage on their next roll this scene." },
  { name: "Quick", text: "Act faster than expected.", bonus: "Advantage on your next skill roll this scene." },
  { name: "Lucky", text: "Catch a break.", bonus: "Advantage on any skill rolls this scene." },
];

// NPC Skill Level — D8 (streamlined matched dice)
export const NPC_SKILL_LEVEL = [
  { range: [1, 1], name: "Unskilled (D/D)", dice: "D6/D6" },
  { range: [2, 5], name: "Competent (C/C)", dice: "D8/D8" },
  { range: [6, 7], name: "Experienced (B/B)", dice: "D10/D10" },
  { range: [8, 8], name: "Expert (A/A)", dice: "D12/D12" },
];
export const NPC_SKILL_DEFAULT = "Competent (C/C)";

// NPC Tactics — D8 (Solo Mode: Combat & Chases, p.013). Informs an NPC's
// overarching combat strategy when the right action isn't obvious.
export const NPC_TACTICS = [
  { range: [1, 1], name: "Reckless", behavior: "Closes the distance, throws caution to the wind, deals as much damage as possible." },
  { range: [2, 4], name: "Strategic", behavior: "Moves decisively, picks high-value targets, surrounds and flanks." },
  { range: [5, 7], name: "Careful", behavior: "Hangs back, sticks to cover, coordinates with allies, takes the shot when it counts." },
  { range: [8, 8], name: "Cowardly", behavior: "Stays hidden, flees if given the chance, lashes out when cornered." },
];

// NPC Chase Maneuvers — D8 (Solo Mode: Combat & Chases). Roll to secretly
// determine an NPC's maneuver each Round; pursuer and prey read different columns.
export const NPC_CHASE_MANEUVERS = [
  { range: [1, 1], pursuer: "Stand and shoot", prey: "Stand and shoot" },
  { range: [2, 5], pursuer: "Pursue", prey: "Flee" },
  { range: [6, 7], pursuer: "Cut off", prey: "Block or hide" },
  { range: [8, 8], pursuer: "Stand and shoot", prey: "Stand and shoot" },
];

// Escalating Base-Die tracks (Countdown Timer & Hypotheses): D6→D8→D10→D12→D12/D6→…→D12/D12
export const ESCALATION_STEPS = ["D6", "D8", "D10", "D12", "D12/D6", "D12/D8", "D12/D10", "D12/D12"];
export const COUNTDOWN_TIMER = {
  start: "D6",
  onNoTrigger: "Upgrade one step (D6→D8→D10→D12, then add a 2nd die D12/D6 … up to D12/D12).",
  onTrigger: "Reset to D6.",
  note: "Roll the timer die(s) as Base Dice each check; the event triggers on a failure (no successes) — then roll the Countdown Event Table.",
};
export const HYPOTHESIS = {
  newRating: "D6",
  minorStart: "D10 or D12",
  onMoreLikely: "Upgrade one step (D6→D8→D10→D12, then D12/D6 … up to D12/D12).",
  onContradicted: "Downgrade one step; remove a secondary D6; never below a single D6 (or clear it).",
  reviewCadence: "Review at the end of each Shift.",
};

// Cipher table (Solo Mode pp.15–16) — roll a Method and/or a Focus.
// TWO-TIER roll: D6 picks a block (1–2, 3–4, 5–6), then D12 picks the entry
// within that block. The flat arrays below are in block order (3 blocks × 12).
export const CIPHER_METHOD = [
  "Abandon", "Aid", "Attack", "Betray", "Bribe", "Capture", "Change", "Chase", "Command", "Conceal", "Conspire", "Control",
  "Create", "Deceive", "Defy", "Demand", "Destroy", "Discover", "Endure", "Escape", "Fight", "Flee", "Hunt", "Infiltrate",
  "Investigate", "Manipulate", "Persuade", "Preserve", "Protect", "Resist", "Reveal", "Sabotage", "Sacrifice", "Search", "Seduce", "Threaten",
];
export const CIPHER_FOCUS = [
  "Authority", "Connection", "Corruption", "Crime", "Death", "Dream", "Duty", "Fear", "Freedom", "Greed", "Guilt", "Hate",
  "Hope", "Identity", "Justice", "Law", "Life", "Location", "Loss", "Love", "Loyalty", "Memory", "Obsession", "Passion",
  "Power", "Rebellion", "Secret", "Surveillance", "Technology", "Temptation", "Time", "Trust", "Truth", "Vice", "Victim", "Violence",
];

// Location table (Solo Mode p.20) — roll an Environment and/or a Place.
// TWO-TIER roll: D6 picks a block (1–2, 3–4, 5–6), then D12 picks the entry.
// Flat arrays in block order (3 blocks × 12).
export const LOCATION_ENVIRONMENT = [
  "Abandoned", "Bleak", "Blocked", "Breached", "Chaotic", "Claustrophobic", "Cluttered", "Confined", "Crowded", "Damaged", "Dangerous", "Dark",
  "Decaying", "Empty", "Familiar", "Garish", "Hazy", "Hidden", "Isolated", "Large", "Lavish", "Luxurious", "Maze-like", "Neon-lit",
  "Noisy", "Open", "Rain-soaked", "Ruined", "Safe", "Secret", "Silent", "Simple", "Small", "Stinking", "Subsurface", "Towering",
];
export const LOCATION_PLACE = [
  "Alley", "Apartment", "Arcade", "Bank", "Bar", "Bazaar", "Casino", "Clinic", "Club", "Construction site", "Data Center", "Dock",
  "Facility", "Factory", "Garage", "Headquarters", "Home", "Hospital", "Hotel", "Lab", "Library", "Lobby", "Monument", "Municipal building",
  "Nightclub", "Office", "Restaurant", "Rooftop", "Ruin", "Safehouse", "Shop", "Street", "Transit hub", "Tunnel", "Viaduct", "Warehouse",
];

// ---------------------------------------------------------------------------
// IMAGINING CLUES  [Solo Mode p.18] — assemble a clue from three tables.
// ---------------------------------------------------------------------------
// Clue Table 1: Meaning — D8 (flat).
export const CLUE_MEANING = [
  "Involves your personal experiences or memories",
  "Contradicts a previous fact or clue",
  "Affirms a previous fact or clue",
  "Connects to a known location",
  "Connects to a new location",
  "Connects to a known person",
  "Connects to an unknown or mysterious person",
  "Is mysterious, but intriguing",
];
// Clue Table 2: Evidence Descriptor — TWO-TIER: D6 block (1–3, 4–6) then D10.
export const CLUE_EVIDENCE_DESCRIPTOR = {
  secondDie: 10, blockRanges: [[1, 3], [4, 6]],
  blocks: [
    [
      { result: "Altered", detail: "It is modified from its original form or function." },
      { result: "Contradictory", detail: "It conflicts with a previously understood aspect of the case." },
      { result: "Corrupted", detail: "It has been tampered with or degraded." },
      { result: "Counterfeit", detail: "It is forged or faked." },
      { result: "Disguised", detail: "It hides its true nature or purpose." },
      { result: "Disturbed", detail: "It is displaced or disarranged." },
      { result: "Familiar", detail: "It shares characteristics with another piece of evidence." },
      { result: "Flawed", detail: "It is marred by damage or defect." },
      { result: "Hidden", detail: "It is purposely concealed." },
      { result: "Marked", detail: "It bears a message or symbol." },
    ],
    [
      { result: "Misplaced", detail: "It is in the wrong place or environment." },
      { result: "Missing", detail: "It should be here, but is not." },
      { result: "Obvious", detail: "It is readily apparent." },
      { result: "Partial", detail: "It is incomplete or fragmented." },
      { result: "Replaced", detail: "It is swapped for something else." },
      { result: "Residual", detail: "It is a trace of something left behind." },
      { result: "Ruined", detail: "It is destroyed or broken." },
      { result: "Sensitive", detail: "It relates to or exposes protected information." },
      { result: "Subtle", detail: "It is unremarkable or inconspicuous." },
      { result: "Unexpected", detail: "It should not be here." },
    ],
  ],
};
// Clue Table 3: Evidence Type — TWO-TIER: D6 block (1–3, 4–6) then D12.
export const CLUE_EVIDENCE_TYPE = {
  secondDie: 12, blockRanges: [[1, 3], [4, 6]],
  blocks: [
    ["Ammunition", "Body", "Book/magazine", "Container", "Credentials", "Device", "Document", "Furnishing", "Garment", "ID card", "Jewelry", "Key"],
    ["Map", "Marking/stain", "Memento", "Message", "Note", "Photograph", "Print/track", "Recording", "Substance", "Symbol/logo", "Tool", "Weapon"],
  ],
};

// ---------------------------------------------------------------------------
// CHARACTER (NPC) GENERATOR  [Solo Mode p.19] — Sphere + Trait.
// ---------------------------------------------------------------------------
// Character Table 1: Sphere — TWO-TIER: D6 block (1–3, 4–6) then D8.
export const CHARACTER_SPHERE = {
  secondDie: 8, blockRanges: [[1, 3], [4, 6]],
  blocks: [
    ["Commerce", "Craftsmanship", "Crime", "Entertainment", "Espionage", "Ideology", "Labor", "Law"],
    ["Media", "Medicine", "Politics", "Science", "Security", "Street life", "Technology", "Warfare"],
  ],
};
// Character Table 2: Trait — TWO-TIER: D6 block (1–2, 3–4, 5–6) then D12.
export const CHARACTER_TRAIT = {
  secondDie: 12, blockRanges: [[1, 2], [3, 4], [5, 6]],
  blocks: [
    ["Aged", "Aggressive", "Alluring", "Aloof", "Argumentative", "Arrogant", "Athletic", "Charming", "Curt", "Demanding", "Desperate", "Eccentric"],
    ["Evasive", "Fearful", "Fidgety", "Flirty", "Forlorn", "Glamorous", "Gruff", "Harried", "Helpful", "High-strung", "Inquisitive", "Intimidating"],
    ["Passive", "Polished", "Ruthless", "Scarred", "Secretive", "Suspicious", "Tattooed", "Uncanny", "Unkempt", "Unserious", "Violent", "Youthful"],
  ],
};

// ---------------------------------------------------------------------------
// HYPOTHESIS CHECK  [Solo Mode p.~22] — test a rated hypothesis.
// Roll one or two Base Dice per its rating (e.g. "D12/D6"); count successes as a
// skill roll (6+ = 1, 10+ = 2). Cannot be pushed. Rewards apply if it ends a case.
// ---------------------------------------------------------------------------
export const HYPOTHESIS_CHECK = {
  note: "Roll Base Dice equal to the hypothesis's rating. At least one success (6+) proves it out. This roll CANNOT be pushed.",
  crit: { name: "Critical Success", pp: 5, text: "Two or more successes — you tie the case up cleanly. Any remaining threads can wait for another day." },
  success: { name: "Success", pp: 3, text: "One success — the hypothesis proves out, but with a twist or complication. Wrapping up likely needs another scene or two." },
  failure: { name: "Failure", pp: -3, text: "No successes — you were mistaken, duped, or betrayed. End the case dramatically, or press on with a new hypothesis." },
  convincing: "Used to convince someone (not to end a case): a success grants advantage (a failure, disadvantage) to a related MANIPULATION or CONNECTIONS roll instead of changing Promotion Points.",
};

// Downtime Event table — D12, Home & Street columns
export const DOWNTIME_EVENT = [
  { home: "You dream of the current case.", street: "You glimpse someone/something involved in the current case." },
  { home: "You relive your key memory in a dream — with a crucial difference.", street: "You spot an element of your key memory in the streets." },
  { home: "Someone involved in the current case contacts or visits you.", street: "Someone involved in the current case confronts you." },
  { home: "Someone from an old case contacts or visits you.", street: "Someone from an old case confronts you." },
  { home: "You receive a cryptic message or delivery.", street: "A stranger delivers a message or warning." },
  { home: "You catch a device or person surveilling your home.", street: "You catch someone watching or following you." },
  { home: "Media reveals an unexpected aspect of the current case.", street: "An advertisement evokes an aspect of the current case." },
  { home: "Your key relationship or a connection needs something.", street: "You run into your key relationship/connection — they need something." },
  { home: "Cops swarm a nearby incident outside your home.", street: "You come upon a crime scene or the aftermath of an incident." },
  { home: "A noise or disturbance interrupts restless sleep.", street: "You're caught in a dangerous encounter or disturbance." },
  { home: "Time slips by without your awareness.", street: "You find yourself somewhere unfamiliar, barely remembering how you got there." },
  { home: "You find comfort in solitude. Heal an extra point of stress.", street: "You find comfort among the crowds. Heal an extra point of stress." },
];

// Countdown Event table — D12
export const COUNTDOWN_EVENT = [
  { name: "Accusation", examples: "Implicated or framed; secrets or misconduct revealed." },
  { name: "Betrayal", examples: "An ally's true motive surfaces; a traitor moves; sabotage from within." },
  { name: "Confrontation", examples: "Ambushed, pursued, snatched." },
  { name: "Development", examples: "New evidence, another victim, a witness comes forward." },
  { name: "Disaster", examples: "Violence erupts; a collision or explosion; mass casualties." },
  { name: "Diversion", examples: "False lead, wild goose chase, drawn into a trap." },
  { name: "Entanglement", examples: "Key relationship in danger; an old debt resurfaces; a vice causes trouble." },
  { name: "Interference", examples: "Bribe or coercion; access lost; taken off the case." },
  { name: "Loss", examples: "Evidence stolen/destroyed; a key person killed or missing; safehouse blown." },
  { name: "Pressure", examples: "Higher-ups push for progress; a new deadline; media coverage amps up." },
  { name: "Summons", examples: "Authority demands your presence; a witness/suspect has news; a connection wants to meet." },
  { name: "Threat", examples: "Cryptic message; home or vehicle ransacked; warned off the case." },
];

export const SOLO_SEQUENCE = [
  "Start a case (trust your gut / follow a thread / Case File Generator / Case Briefing tables).",
  "Play scenes: use a Scene Check when unsure; Question Checks for yes/no; Cipher & tables for open questions.",
  "Gather clues, follow leads, and track Hypotheses (die-rated) — review at each Shift's end.",
  "Advance the Countdown Timer; on a triggered event roll the Countdown Event Table.",
  "Award Promotion & Humanity Points at milestones via the checklists.",
];
