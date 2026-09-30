// quick.js — the quick-roll button and the command palette (UX round 3).
// Two shortcuts into things the app already does: roll a skill from anywhere,
// and jump to any screen or tab by typing. Neither holds rules or state.
import { el, SOLO_KEY } from "./core.js";
import { modal } from "./ui.js";
import { Store } from "./store.js";
import { openSkillRoll } from "./roller.js";
import { navigate } from "./router.js";
import { Settings } from "./settings.js";
import * as D from "../data.js";

function pickSkill(ch) {
  modal({ title: "Quick roll", sheet: true, search: true, render(body, close) {
    body.append(el("p", { class: "muted small" }, "Tap a skill to roll it now. For advantage, disadvantage or your key memory, long-press the skill on the sheet."));
    for (const s of D.SKILLS) {
      const lv = ch.skills[s.key];
      body.append(el("button", { class: "picker__row picker__row--btn", onClick: () => { close(); openSkillRoll(ch, s.key, null, { quick: true }); } },
        el("strong", {}, s.name), el("span", { class: "muted" }, ` ${lv} · d${D.LEVEL_DIE[lv]}`)));
    }
  } });
}

// The floating dice button: shown on every screen while there is a living
// character, except the wizard (which is building one).
export function updateQuickRoll(route) {
  let fab = document.getElementById("quick-roll");
  if (!fab) {
    fab = el("button", { id: "quick-roll", class: "fab", "aria-label": "Quick roll — pick a skill", title: "Quick roll" }, "🎲");
    fab.addEventListener("click", () => { const ch = Store.getActive(); if (ch) pickSkill(ch); });
    document.body.append(fab);
  }
  const ch = Store.getActive();
  fab.hidden = !ch || !!ch.state?.dead || route === "wizard";
}

// Ctrl+K / ⌘K: a searchable list of every place and every skill roll.
const SOLO_TABS = [["play", "Play"], ["case", "Case"], ["shift", "Shift"], ["scene", "Scene"], ["board", "Case Board"], ["leads", "Leads"], ["wrap", "Wrap"], ["notes", "Notes"]];
function openSolo(panel) {
  try { const s = JSON.parse(localStorage.getItem(SOLO_KEY) || "{}"); s.panel = panel; localStorage.setItem(SOLO_KEY, JSON.stringify(s)); } catch { /* best-effort */ }
  navigate("solo");
}
function openPalette() {
  if (document.querySelector(".modal-overlay")) return;
  const ch = Store.getActive();
  const go = [["Home", "home"], ["Characters", "characters"], ["Character sheet", "sheet"], ["Combat tracker", "combat"], ["Rules Library", "rules"],
    ["How to Play", "tutorial"], ["Settings", "settings"], Settings.gm() ? ["GM screen", "gm"] : null].filter(Boolean);
  modal({ title: "Go to…", search: true, render(body, close) {
    const row = (label, hint, fn) => el("button", { class: "picker__row picker__row--btn palette__row", onClick: () => { close(); fn(); } },
      el("strong", {}, label), el("span", { class: "muted" }, ` ${hint}`));
    for (const [label, route] of go) body.append(row(label, "screen", () => navigate(route)));
    if (Settings.solo()) for (const [key, label] of SOLO_TABS) body.append(row(`Solo · ${label}`, "tab", () => openSolo(key)));
    if (ch && !ch.state?.dead) for (const s of D.SKILLS) body.append(row(`Roll ${s.name}`, `${ch.skills[s.key]} · d${D.LEVEL_DIE[ch.skills[s.key]]}`, () => openSkillRoll(ch, s.key, null, { quick: true })));
    requestAnimationFrame(() => body.querySelector(".picker-search")?.focus());
  } });
}
export function bindPalette() {
  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === "k") { e.preventDefault(); openPalette(); }
  });
}
