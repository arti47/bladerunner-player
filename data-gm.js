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
