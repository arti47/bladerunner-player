// data-gm.js — GM reference: Case File Generator + Disciplinary Actions  [Ch09]
// Powers the GM screen's rollable reference panel (Phase 6). Adventure-neutral
// generator prompts (mechanics/structure), not published case content.

// Case Table 1 — Theme (D10)
export const CASE_THEME = [
  { range: [1, 4], theme: "Replicant Crimes & Punishments", die: 10 },
  { range: [5, 6], theme: "Corporate Intrigues & Courtroom Dramas", die: 8 },
  { range: [7, 7], theme: "Organized & Underground Threats", die: 6 },
  { range: [8, 8], theme: "Political Machinations & Internal Affairs", die: 6 },
  { range: [9, 9], theme: "UN Assignments & Joint Investigations", die: 6 },
  { range: [10, 10], theme: "Monitored Entities & Technologies", die: 6 },
];

// Case Table 2 — Assignment, keyed by theme (die varies; index = roll-1)
export const CASE_ASSIGNMENT = {
  "Replicant Crimes & Punishments": [
    "A retirement order is filed for a counterfeit Nexus-8 chef who killed a five-star kitchen staff.",
    "A Replicant claims innocence — their owner ordered the unlawful acts and they were forced to obey.",
    "A Replicant accuses their employer of unlawfully murdering a Replicant co-worker.",
    "A Replicant mysteriously falls to their death at a Sea Wall construction site.",
    "A hostage situation erupts at the LAX Spaceport when a presumed-dead Nexus-8 is identified.",
    "An N-8 filed as retired is identified as an active leader of a radical Replicant Underground faction.",
    "A memory engineer has implanted memories that manipulate select Replicants to act out of character.",
    "A Replicant is arrested after defending themselves against a physically abusive employer.",
    "Human plant workers accuse a Replicant of sabotaging the reactor — triggering mob justice.",
    "A human refuses to believe their Replicant servant ran away and files a missing-persons report.",
  ],
  "Corporate Intrigues & Courtroom Dramas": [
    "A Replicant is the star witness in a high-profile murder trial.",
    "A top megacorp executive is revealed to be a Replicant — and didn't know it.",
    "A biotech firm steals a rival's patent by planting a Replicant spy in their ranks.",
    "A megacorp is accused of illegally producing Replicants to replace board stakeholders.",
    "An Independent Sentinel journalist seeks protection after uncovering a Wallace Corp conspiracy.",
    "A field retirement may not have been merited; the DA pursues Murder One against the human shooter.",
    "A tech CEO is kidnapped by apparent Replicant fugitives.",
    "A lethal virus is stolen from a high-security lab and released in a run-down neighborhood.",
  ],
  "Organized & Underground Threats": [
    "The UN Bureau of Investigation needs help apprehending an arms dealer trafficking Nexus counterfeits.",
    "A DNA Row bioengineer is accused of running an illegal salon that once helped N-8s flee the city.",
    "The RDU goes undercover into a gambling ring hosting underground Replicant death matches.",
    "Replicants are being kidnapped and sold on the black market.",
    "The Counter-Terrorism Bureau uncovers a Human Supremacist terror plot.",
    "A new extremist group is trying to radicalize Replicants into terrorists.",
  ],
  "Political Machinations & Internal Affairs": [
    "The Replicant Underground bombs an Empathy Movement protest.",
    "A gossip rag stumbles onto a real plot to assassinate a pro-Replicant UN delegate.",
    "The UN Colonization Defense Program reports an AWOL N-9 hiding in the city.",
    "Governor Phelan requests a security detail after an anonymous death threat.",
    "Internal Affairs investigates another Blade Runner for excessive force and abuse of power.",
    "An anti-Replicant politician is murdered — evidence points to the Underground, but it's too convenient.",
  ],
  "UN Assignments & Joint Investigations": [
    "UN Marshals order the RDU to apprehend a major drug trafficker harbored by the Underground.",
    "Joint case with Robbery: a major casino heist suggests Replicant involvement.",
    "Homicide requests special forensic assistance on a priority serial-murder case.",
    "The CBI requests a Doxie be present during interrogations in a major investigation.",
    "An earthquake enlists Replicant Blade Runners as emergency responders.",
    "Wallace Corp internal security investigates stolen lab samples and enlists the LAPD.",
  ],
  "Monitored Entities & Technologies": [
    "A digital companion is accused as an accessory to a string of bank robberies.",
    "A priceless real snow leopard runs free down Animoid Row after a smuggler's trade goes sour.",
    "A tech company unveils a new halo device with dangerous bio-hacking capabilities.",
    "An animoid owl with implanted memories of a dead Wallace bio-scientist goes missing.",
    "Someone is killing synthetic animals on Animoid Row.",
    "A computer engineer disappears and seemingly turns up as a DiJi ghost.",
  ],
};

// Case Table 4 — Sector (D8)
export const CASE_SECTOR = [
  { range: [1, 1], sector: "Sector 1 — Entertainment District" },
  { range: [2, 2], sector: "Sector 2 — Arts District" },
  { range: [3, 3], sector: "Sector 4 — Industrial District" },
  { range: [4, 5], sector: "Sector 5 — Central" },
  { range: [6, 6], sector: "Sector 9 — Commercial District" },
  { range: [7, 7], sector: "Sector 12 — LAX" },
  { range: [8, 8], sector: "Beyond Downtown" },
];

// Case Table 6 — The Twist (D12)
export const CASE_TWIST = [
  "A rogue operative is connected to the case.",
  "The crime is a false-flag operation.",
  "There is a cover-up of an even greater crime.",
  "Someone is skillfully creating false evidence.",
  "One of the PCs is framed for a crime.",
  "A conspiracy is involved in the case.",
  "Someone innocent is being framed.",
  "A serial criminal stalks the streets.",
  "There is a mole in the LAPD connected to the case.",
  "An NPC is deranged and completely unpredictable.",
  "Another Blade Runner is secretly investigating the case.",
  "A player character's key relationship NPC is involved.",
];

// Disciplinary Actions (GM picks after a failed Connections roll on misconduct)  [p167]
export const DISCIPLINARY_ACTIONS = [
  "Temporary suspension without pay (lose 2 Chinyen Points).",
  "Extended suspension without pay (lose 2 Chinyen Points).",
  "Internal Affairs review for alleged neglect of duties.",
  "Internal Affairs psych evaluation or Baseline Test.",
  "Internal Affairs evaluation for termination.",
  "Criminal prosecution.",
];

// Case Table 3 — Main NPCs. Roll D3+3 NPCs for a case. Each: D8 type, then a D6 on
// each of occupation / quirk / first name / last name.  [Ch09]
// A case carries D3+3 main NPCs (roll the count, then roll each one).  [Ch09]
export const CASE_MAIN_NPC_COUNT = { die: 3, bonus: 3, text: "D3+3 main NPCs (4–6)" };
export const CASE_MAIN_NPCS = [
  { type: "Corporate",
    occupation: ["Corporate Agent", "Lab Worker", "Administrator", "Manager", "Security Officer", "Liaison Officer"],
    quirk: ["Secret allegiance", "Serial liar", "Constant flirt", "Overuses perfume", "Twitching eye", "Sarcastic"],
    firstName: ["Alexia", "Rami", "Clara", "Maximilian", "Priya", "Sandor"],
    lastName: ["Reisch", "Shalhoub", "Stratton", "Voldokov", "Singh", "Pentecost"] },
  { type: "Security",
    occupation: ["Cop", "Security Guard", "Bouncer", "Mercenary", "Soldier", "Bodyguard"],
    quirk: ["Overly sentimental", "High-strung", "Always chewing on something", "Constant comedian", "Drug user", "Aloof"],
    firstName: ["Prei", "Magda", "Wade", "Kilo", "Alexander", "Luna"],
    lastName: ["Haden", "Leyoun", "Kawasaki", "Bharat", "Marsten", "Farahani"] },
  { type: "Entertainment",
    occupation: ["Actor", "Singer", "Poet", "Dancer", "Celeb", "Designer"],
    quirk: ["Fast talker", "Oily skin", "Instantly likable", "Moves constantly", "Patronizing", "Glamorous"],
    firstName: ["Ariana", "Joshua", "Dot", "Gabor", "Ava", "Seo-joon"],
    lastName: ["Polokov", "Izzo", "McMillan", "Nanjiani", "Rodriguez", "Jeong"] },
  { type: "Street",
    occupation: ["Food Worker", "Maintenance Worker", "Scavenger", "Street Rat", "Cultist", "Store Owner"],
    quirk: ["Smelly", "Grubby clothes", "Fidgety", "Full of attitude", "Whispers", "Eccentric"],
    firstName: ["Vladislav", "Rhea", "Harley", "Dara", "Radhi", "Cass"],
    lastName: ["Lang", "Mandell", "Beck", "Yang", "Molo", "Ibrahim"] },
  { type: "Crime",
    occupation: ["Gang Member", "Hitman", "Hustler", "Burglar", "Drug Dealer", "Syndicate Member"],
    quirk: ["Ruthless", "Limps", "Extravagant haircut", "Plain", "Suspicious", "Tattooed"],
    firstName: ["Aurora", "Niko", "Rue", "Luca", "Jean", "Haru"],
    lastName: ["Zhao", "Mercer", "Hoskins", "De Vries", "Wozniak", "Giordano"] },
  { type: "Science",
    occupation: ["Student", "Scholar", "Researcher", "Scientist", "Analyst", "Biochemist"],
    quirk: ["Tired", "Touchy", "Intense", "Bald", "Booming voice", "Wiry"],
    firstName: ["Saidah", "Constance", "Reinhard", "Ivana", "Bwana", "Eve"],
    lastName: ["Linton", "Sawadogo", "Meier", "Leck", "Siddiqi", "Ricci"] },
  { type: "Tech",
    // Source prints "Mechanic" at both 3 and 5 (kept faithfully).
    occupation: ["Technician", "Bioengineer", "Mechanic", "Engineer", "Mechanic", "Programmer"],
    quirk: ["Corpulent", "Mumbling", "Impatient", "Bejeweled", "Dry wit", "Arrogant"],
    firstName: ["Bill", "Kat", "Amar", "Alejandro", "Eitan", "Mei"],
    lastName: ["Banks", "Atwood", "Mirai", "Morales", "Chakrabarti", "Teng"] },
  { type: "Other",
    occupation: ["Clerk", "Journalist", "TV Host", "Cityspeaker", "Kid", "Politician"],
    quirk: ["Overly eager", "Brusque", "Elegant", "Old", "Fashionable", "Argumentative"],
    firstName: ["Feng", "Shira", "Sanjay", "Dmitry", "Libby", "Nombeko"],
    lastName: ["Wyman", "da Silva", "Kamarr", "Kebede", "Esposito", "Koslovski"] },
];

// ---------------------------------------------------------------------------
// Case Table 5 — The Clues  [Ch09]
// D8 for the clue type; types with a sub-table roll the listed die on `detail`.
// ---------------------------------------------------------------------------
export const CASE_CLUES = [
  { range: [1, 2], type: "Witness", detailDie: null, detail: [], note: "Roll on the NPC table for the witness." },
  { range: [3, 3], type: "Forensic Evidence", detailDie: 6, detail: ["Ballistics", "Toxicology", "DNA", "Fingerprints", "Autopsy", "Blood"] },
  { range: [4, 4], type: "Recording", detailDie: 6, detail: ["Security camera", "Security camera", "Photo", "Photo", "Voice", "Voice"] },
  { range: [5, 5], type: "Documents", detailDie: 6, detail: ["ID card", "Ticket", "Brochure", "Legal document", "Note", "Letter"] },
  { range: [6, 6], type: "Rumors", detailDie: 6, detail: ["In the street", "In the street", "In the department", "In the department", "In the media", "In the media"] },
  { range: [7, 7], type: "Anonymous Tip", detailDie: 6, detail: ["Call", "Call", "Note", "Note", "Messenger", "Messenger"] },
  { range: [8, 8], type: "Item", detailDie: 6, detail: ["Gun", "Clothing", "Statuette", "Jewelry", "Vehicle", "Data disc / memory cube"] },
];

// Case Table 7 — The Final Confrontation  [Ch09]. D10 on each column.
export const CASE_FINALE_LOCATION = [
  "Abandoned apartment complex", "On top of the Sea Wall", "Tunnels beneath the city",
  "A dilapidated ballroom", "The depths of a corporate HQ", "A mansion outside the city",
  "The roof of a building", "A forgotten secret facility", "A ruin out in the Kipple",
  "In the shadow of a huge monument",
];
export const CASE_FINALE_ENVIRONMENT = [
  "In pouring rain", "Thunder", "In blazing heat", "In the freezing cold", "Intense colors",
  "Overgrown", "Bitter wind", "Power outage", "Red dust", "Fog",
];

// Case Table 8 — Mood Pieces  [Ch09]. D8 on each column, roll one or all three.
export const CASE_MOOD = {
  weather: ["Acidic fog", "Heavy rain", "Drizzle", "Drizzle", "Freezing cold", "Heatwave", "Smog", "Rays of light through heavy clouds"],
  screen: ["A geisha eating candy", "“A new life awaits you in the off-world colonies”", "Weather forecast", "News report", "Sports event", "Wallace Corp ad", "Travel ad to an exotic location", "Digital companion ad"],
  passingBy: ["A police Spinner with flashing lights", "A chanting religious group", "A political demonstration", "Drunk youths", "Tired workers on their way home", "A corporate vehicle with escorts", "A street sweeper vehicle", "Street kids looking for trouble"],
};

// Case Table 4 (continued) — locations by sector  [Ch09].
// Roll D6 for the area, then D6 for the place within it.
export const SECTOR_LOCATIONS = {
  "Sector 1 — Entertainment District": [
    { range: [1, 2], area: "Nightclub Row", places: ["The Snake Pit", "The Snake Pit", "Early Q", "Early Q", "Metropolis", "Metropolis"] },
    { range: [3, 4], area: "Red Light District", places: ["Happy Jack's Casino", "Happy Jack's Casino", "Paradise Evolution", "Paradise Evolution", "Kumite", "Kumite"] },
    { range: [5, 5], area: "Beauty Parlors", places: ["Bright Eyes Beauty Salon", "Bright Eyes Beauty Salon", "Aphrodite", "Aphrodite", "Roxbox", "Roxbox"] },
    { range: [6, 6], area: "Mid-City", places: ["Rag Row", "Rag Row", "Magazine Mile", "Magazine Mile", "A & B Sports Arena", "A & B Sports Arena"] },
  ],
  "Sector 2 — Arts District": [
    { range: [1, 2], area: "Hysteria Hall", places: ["Arcade", "Arcade", "Multiplex", "Multiplex", "Crazy Legs Larry Used Autos", "Crazy Legs Larry Used Autos"] },
    { range: [3, 4], area: "University of Los Angeles", places: ["University Library", "University Library", "Dean's Office", "Dean's Office", "Student Dorms", "Student Dorms"] },
    { range: [5, 6], area: "University of Los Angeles Medical Center", places: ["Medical Research Lab", "Medical Research Lab", "Coma Ward", "Coma Ward", "Hospital Basement", "Hospital Basement"] },
  ],
  "Sector 4 — Industrial District": [
    { range: [1, 1], area: "Wallace HQ", places: ["Reception Area", "Reception Area", "Wallace Records Library", "Memory Vaults", "Executive Suite", "Executive Suite"] },
    { range: [2, 2], area: "Chinatown", places: ["Ona Bar", "Ona Bar", "Shanghai Export & Import", "Shanghai Export & Import", "Hutong Alley", "Hutong Alley"] },
    { range: [3, 3], area: "DNA Row", places: ["MirrorWare Industries", "MirrorWare Industries", "Atinko Biowares", "Atinko Biowares", "Nekko Corporation", "Nekko Corporation"] },
    { range: [4, 4], area: "Hawker's Circle", places: ["Kingston Kitchen", "Runner Surplus", "Piss Alley", "Howey Lee's", "Karma Bar", "Kabukicho Arcade"] },
    { range: [5, 6], area: "Animoid Row", places: ["Van Ness Pet Hospital", "The Fish Ladies", "Runciters Zoological", "The Dragonfly", "Prawn Shop & Aquatic Emporium", "Abdul Ben Hassan's Reptiles"] },
  ],
  "Sector 5 — Central": [
    { range: [1, 1], area: "LAPD Headquarters", places: ["Rep-Detect Unit", "Armory", "Crime Lab", "Mainframe", "Morgue", "Training Grounds"] },
    { range: [2, 2], area: "City Hall", places: ["City Hall Grand Stairs", "LA Courthouse", "Press Area", "Independent Sentinel", "Mayor's Office", "District Attorney's Office"] },
    { range: [3, 4], area: "Little Tokyo Shopping District", places: ["White Dragon Noodle Bar", "Burger Burger Burger", "Shinjuku Alley", "Vending Mall", "Vending Mall", "Edo Megastore"] },
    { range: [5, 5], area: "Bar District", places: ["Naplopo", "Naplopo", "Bibi's Bar", "Bibi's Bar", "Level 44", "Level 44"] },
    { range: [6, 6], area: "LAPD Housing", places: ["Burt Jackson Block", "Burt Jackson Block", "Venderton Gardens", "Venderton Gardens", "Black'n'Blue Bar", "Black'n'Blue Bar"] },
  ],
  "Sector 9 — Commercial District": [
    { range: [1, 1], area: "Fashion District", places: ["Razdora Eatery", "Razdora Eatery", "Markova Ballroom", "Markova Ballroom", "Ogilvy's Auction", "Ogilvy's Auction"] },
    { range: [2, 2], area: "Financial District", places: ["LA Stock Exchange", "LA Stock Exchange", "Walton Gardens", "Walton Gardens", "Shaw Financial", "Shaw Financial"] },
    { range: [3, 4], area: "Grand Central Market", places: ["Wakasani's Seafood", "Wakasani's Seafood", "Mumbai Spice Co", "Mumbai Spice Co", "Walter & Knecht Antique Books", "Walter & Knecht Antique Books"] },
    { range: [5, 5], area: "LA Central Library", places: ["Grand Lobby", "Grand Lobby", "Newspaper Archive", "Newspaper Archive", "Special Collection Vault", "Special Collection Vault"] },
    { range: [6, 6], area: "Retirement Row", places: ["LA Viaduct", "LA Viaduct", "Abandoned Subway Station", "Abandoned Subway Station", "Crashed Spinner", "Crashed Spinner"] },
  ],
  "Sector 12 — LAX": [
    { range: [1, 3], area: "LAX", places: ["Off-World Spaceport Terminal", "Off-World Spaceport Terminal", "On-World Domestic Terminal", "Control Tower", "Customs Office", "Hotel Madison"] },
    { range: [4, 5], area: "Warehouse District", places: ["Logistics Hub D", "Logistics Hub D", "Maeve's Bar", "Maeve's Bar", "Container Crane 141", "Container Crane 141"] },
    { range: [6, 6], area: "Sea Wall Docks", places: ["LA Queen, smuggler ship", "LA Queen, smuggler ship", "Sea Wall Watch Station", "Sea Wall Watch Station", "Wreck of the Empress Sarah", "Wreck of the Empress Sarah"] },
  ],
  "Beyond Downtown": [
    { range: [1, 1], area: "The Energy Empire", places: ["Protein Farm", "Protein Farm", "Power Plant", "Power Plant", "Transport Hub", "Transport Hub"] },
    { range: [2, 2], area: "Los Angeles Hills", places: ["Refugee Camp", "Refugee Camp", "Low-Income Housing Project", "Low-Income Housing Project", "Abandoned Building Site", "Abandoned Building Site"] },
    { range: [3, 3], area: "Santa Barbara", places: ["De Vries Mansion", "De Vries Mansion", "Jenkins Family Estate", "Jenkins Family Estate", "Abandoned Resort", "Abandoned Resort"] },
    { range: [4, 4], area: "San Diego Trash Mesa", places: ["Labor Camp", "Labor Camp", "Off-Grid R&D Lab", "Off-Grid R&D Lab", "Scavenge Yard", "Scavenge Yard"] },
    { range: [5, 6], area: "The Kipple", places: ["Crashed Transport", "Crashed Transport", "Scavenger Camp", "Scavenger Camp", "Waste Processing Station", "Waste Processing Station"] },
  ],
};

// The Core Rulebook's own Downtime event table  [Ch09] — D8, home vs street.
// (The Solo Mode book prints a different, expanded D12 table; both are official.)
export const DOWNTIME_EVENT_CORE = [
  { range: [1, 2], home: "Nothing out of the ordinary. Describe how the character spends the Shift.", street: "Nothing out of the ordinary. Describe how the character spends the Shift." },
  { range: [3, 3], home: "You relive your key memory in a dream, parts of it strange or distorted. This Shift heals no stress — the dream is a Stress Factor 2 event. If your INSIGHT roll to resist succeeds, the dream also hands you a clue.", street: "You spot a person or object from your key memory in the street. Stress Factor 1. If it is an NPC they may be hostile, and might chase or attack." },
  { range: [4, 4], home: "Your key relationship calls on the Vid-Phon. They want something — help, revenge, love, or just to talk. They may know something about the case.", street: "Your key relationship confronts you in the street, wanting something — help, revenge, love, or just to talk. They may know something about the case." },
  { range: [5, 5], home: "Soothing music, an old film, or time with a DiJi — heal an extra point of stress.", street: "Two thugs (STR B, AGI C, Hand-to-Hand C, Health 5) with clubs and knives mug you for a Chinyen Point or a piece of gear. Run and they give chase; Break one and the other flees. The mugging may be a setup." },
  { range: [6, 6], home: "Your key relationship buzzes at your door, claiming to be in trouble — or warning you that you are. It may be a setup tied to the case.", street: "A Doxie (EMP B, Manipulation B, Insight C) chats you up. It may lead to a romance, a conversation — or be a setup by someone involved in the case." },
  { range: [7, 7], home: "Deputy Chief Holden calls on the Vid-Phon wanting a progress report — and an opinion on the other Blade Runners.", street: "An animated advertisement enthralls you. Roll INSIGHT; fail and you cannot recover stress until you spend a Chinyen Point on the product." },
  { range: [8, 8], home: "An NPC from this or an earlier case calls. They have information to trade — for something.", street: "An NPC from this or an earlier case finds you in the street. They have information to trade — for something." },
];

// Awarding points at the table  [Ch09] — one point per bullet, per character.
export const PROMOTION_AWARDS = [
  "Found one or more clues that led to real progress in the investigation.",
  "Revealed and reported one or more fugitive Nexus-8 Replicants to the RDU.",
  "Apprehended one or more suspects or fugitives.",
  "Stopped one or more serious crimes from being committed.",
  "Uploaded at least one piece of important evidence to the LAPD Mainframe.",
  "Saved the life of another LAPD officer, or performed some other heroic action.",
  "Reported another character's misconduct with evidence to back the claim.",
  "Took a Baseline Test and passed (Replicants only).",
];
export const PROMOTION_LOSSES = [
  "Failed to apprehend a wanted fugitive when given the opportunity.",
  "Abused their authority or acted unbecoming of a law officer.",
  "Ignored or directly violated an order.",
  "Lost LAPD equipment assigned to them.",
  "Harmed or killed an innocent suspect or bystander.",
  "Let the case draw negative media exposure or public controversy.",
  "Exposed confidential case information to the media.",
  "Accused Wallace Corp of anything, with or without evidence.",
  "Failed a Baseline Test (Replicants only).",
];
export const HUMANITY_AWARDS = [
  "Took a personal risk to help another person — human or Replicant.",
  "Connected to someone, human or Replicant, on a personal level.",
  "Learned something significant about someone's life.",
  "Tried to talk someone down from committing a crime, successfully or not.",
  "Learned something that made them view the world differently.",
  "Refused to upload evidence to the LAPD Mainframe in order to protect someone.",
  "Refused to follow orders the character felt were wrong.",
  "Used their key memory or interacted with it in some way.",
  "Interacted with their key relationship.",
  "Played one or more scenes of Downtime.",
  "Failed a Baseline Test (Replicants only).",
];
// A character earning five or more Promotion Points in one session is awarded a
// distinction by Deputy Chief Holden.  [Ch09]
export const DISTINCTION_THRESHOLD = 5;
