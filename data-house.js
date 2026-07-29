// data-house.js — HOUSE AIDS. Nothing in this file is Blade Runner RPG canon.
//
// Everything else in the data layer is extracted from the user's own Free League
// books (CLAUDE.md §10.8 limits the app to Core + official Solo Mode). This file
// is the one deliberate exception: optional table-side procedures that are NOT
// from the printing, kept apart so the canonical files stay clean and every
// surface that renders them can label them plainly as house aids.
//
// CASE BOARD — a clue-and-suspect board for solo play, following the procedure
// popularised by the "Mystery Matrix" in Mythic Magazine (Word Mill Games): a
// numbered board of clues and suspects, connections drawn only between the two
// kinds, a discovery roll that gets easier as the board fills, and a clincher
// that names the culprit. Only the procedure is implemented — none of that
// supplement's tables are reproduced. Where it calls for descriptor words, this
// app rolls the official Solo Mode tables instead (Cipher, Imagining Clues, the
// character generator), so the board fills with Blade Runner content.

export const BOARD = {
  name: "Case Board",
  houseAid: true,
  credit: "House aid — the board procedure follows the Mystery Matrix approach from Mythic Magazine (Word Mill Games). It is not part of the Blade Runner RPG.",
  blurb: "Pin your clues and suspects, connect them, and let the board tell you when a case has an answer.",
};

// The board holds this many boxes; adding past it means retiring one first.
export const BOX_MAX = 20;

// A connection is only ever clue ↔ suspect — never clue–clue or suspect–suspect.
export const CONNECTS = { clue: "suspect", suspect: "clue" };

// Picking a box at random: use the smallest die that reaches the box count.
// A roll past the last box is not wasted — you choose the likeliest box.
export const MATRIX_DICE = [4, 6, 8, 10, 12, 20];
export function matrixDie(boxes) {
  return MATRIX_DICE.find((d) => d >= boxes) ?? MATRIX_DICE[MATRIX_DICE.length - 1];
}

// A suspect this well connected is the answer, without waiting for a clincher.
export const CLINCHER_CONNECTIONS = 6;

// The discovery roll: D100 + the number of boxes already on the board, so a
// busy case converges. Each outcome is a machine-readable `effect` the board
// acts on; `text` is what the player reads.
export const DISCOVERY_ROLL = {
  die: 100,
  addBoxCount: true,
  note: "Earned by a successful investigative roll or a scene spent searching. Roll D100 and add the number of boxes on the board.",
};
export const DISCOVERY_OUTCOMES = [
  { min: 1, max: 15, effect: "nothing", text: "Nothing useful — the trail stays cold this time." },
  { min: 16, max: 35, effect: "clue", text: "A new clue, with nothing yet tying it to anyone." },
  { min: 36, max: 50, effect: "suspect", text: "A new name enters the case, unconnected so far." },
  { min: 51, max: 70, effect: "clue+link", text: "A new clue, and it points straight at someone already on the board." },
  { min: 71, max: 80, effect: "suspect+link", text: "A new suspect, tied at once to a clue you already hold." },
  { min: 81, max: 100, effect: "link", text: "No new evidence, but two things you already had turn out to be connected." },
  { min: 101, max: Infinity, effect: "clincher", text: "The clincher — this clue names your culprit." },
];
// An outcome the board cannot honour (a link with nothing to link to) degrades
// to the empty result rather than being re-rolled.
export const DISCOVERY_FALLBACK = "nothing";

// Which skills count as investigative work, so a successful roll on the sheet
// can offer the check. Keys match SKILLS in data.js.
export const DISCOVERY_SKILLS = ["observation", "tech", "medical_aid", "connections", "manipulation", "insight"];

// Promoting a suspect to a hypothesis hands the case back to the official
// economy: the Hypothesis Check (Solo Mode) is what actually pays out.
export const PROMOTE = {
  template: (name) => `${name} is behind this case`,
  note: "Rate it and test it with the book's own Hypothesis Check — the board never awards points itself.",
};
