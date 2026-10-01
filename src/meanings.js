// meanings.js — the Meaning Tables (house aid, §3.19). Roll D100 on each of a
// table's two columns and read the pair as a prompt. Owns the roll, the house-aid
// card Solo and the GM screen share, and the small dialog the palette and the
// quick-roll button open. Holds no state; the words live in data-meanings.js.
import { el, rollDie, SOLO_KEY, appendToNotes } from "./core.js";
import { modal, showToast } from "./ui.js";
import { RollLog } from "./store.js";
import { Settings } from "./settings.js";
import { HOUSE_AID, MEANING_DIE, MEANINGS } from "../data-meanings.js";

const HOUSE_LABEL = HOUSE_AID ? "House aid" : "";

// { key, label, aName, bName, a, b, ra, rb, text }
export function rollMeaning(key) {
  const t = MEANINGS[key];
  const ra = rollDie(MEANING_DIE), rb = rollDie(MEANING_DIE);
  const a = t.colA[ra - 1], b = t.colB[rb - 1];
  return { key, label: t.label, aName: t.a, bName: t.b, a, b, ra, rb, text: `${a} + ${b}` };
}
export const meaningTables = () => Object.entries(MEANINGS).map(([key, t]) => ({ key, label: t.label, a: t.a, b: t.b }));
const resultNodes = (r) => [el("h3", { class: "roll-result roll-result--big" }, r.text),
  el("p", { class: "muted roll-center" }, `${r.aName} D${MEANING_DIE}=${r.ra}  |  ${r.bName} D${MEANING_DIE}=${r.rb}`)];

// The house-aid card for Solo ▸ Scene and GM ▸ Prep. `show` is the screen's own
// inline-result surface, so results land in this card with Reroll and Pin.
export function meaningCard({ card, btn, grid, show }) {
  const c = card("Meaning tables", "Stuck for an idea? Roll two words and read them together. Not from the rulebook — a house aid.");
  c.classList.add("card--house");
  c.prepend(el("div", { class: "roll-eyebrow step-eyebrow house-eyebrow" }, HOUSE_LABEL));
  c.append(grid(...meaningTables().map((t) => btn(`🎲 ${t.label}`, () => {
    const r = rollMeaning(t.key);
    show({ label: `Meaning · ${r.label}`, text: r.text, pin: `[Meaning · ${r.label}] ${r.text}`, title: `${r.label} — ${r.aName} × ${r.bName}`, render: (b) => b.append(...resultNodes(r)) });
  }))));
  return c;
}

// A dialog for rolling from anywhere (Ctrl+K, the quick-roll button).
export function openMeaningRoll(key) {
  let r = rollMeaning(key);
  RollLog.add({ source: "solo", label: `Meaning · ${r.label}`, text: r.text });
  modal({ title: `${r.label} — meaning`, render(body, close) {
    const out = el("div", { class: "meaning-out" });
    const paint = () => out.replaceChildren(el("div", { class: "roll-eyebrow house-eyebrow" }, HOUSE_LABEL), ...resultNodes(r));
    paint();
    body.append(out, el("div", { class: "modal__actions" },
      el("button", { class: "btn btn--roll", onClick: () => { r = rollMeaning(key); RollLog.add({ source: "solo", label: `Meaning · ${r.label}`, text: r.text }); paint(); } }, "↻ Reroll"),
      Settings.solo() ? el("button", { class: "btn btn--ghost", onClick: () => {
        try {
          const s = JSON.parse(localStorage.getItem(SOLO_KEY) || "{}");
          s.scratchpad = appendToNotes(s.scratchpad || "", `• [Meaning · ${r.label}] ${r.text}`);
          localStorage.setItem(SOLO_KEY, JSON.stringify(s));
          showToast("Pinned to the case notes.");
        } catch { showToast("Could not reach the case notes.", { kind: "warn" }); }
      } }, "📌 Pin to case notes") : null,
      el("button", { class: "btn btn--ghost", onClick: () => close() }, "Close")));
  } });
}
