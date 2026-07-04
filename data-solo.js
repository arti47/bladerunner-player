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

// Cipher table — roll a Method and/or a Focus (each D6×D12 = 36 words)
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

// Location table — roll an Environment and a Place (each 36)
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
