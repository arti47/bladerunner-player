// quick.js — the quick-roll button and the command palette (UX round 3).
// Two shortcuts into things the app already does: roll a skill from anywhere,
// and jump to any screen or tab by typing. Neither holds rules or state.
import { el, icon, SOLO_KEY } from "./core.js";
import { modal } from "./ui.js";
import { Store } from "./store.js";
import { openSkillRoll } from "./roller.js";
import { navigate } from "./router.js";
import { Settings } from "./settings.js";
import * as D from "../data.js";
import * as R from "./rules.js";

// A skill's marks: ★ for an archetype key skill, a dot for any skill trained
// above the baseline — so the list says which rolls are your strong ones.
function skillMarks(ch, s) {
  const key = !!R.archetype(ch.archetype)?.keySkills?.includes(s.key);
  const trained = ch.skills[s.key] && ch.skills[s.key] !== "D";
  return el("span", { class: "muted palette__hint" },
    key ? el("span", { class: "palette__key", title: "Key skill" }, "★ ") : null,
    `${ch.skills[s.key]} · d${D.LEVEL_DIE[ch.skills[s.key]]}`,
    trained && !key ? el("span", { class: "palette__trained", title: "Trained" }, " •") : null);
}

function pickSkill(ch) {
  modal({ title: "Quick roll", sheet: true, search: true, render(body, close) {
    body.append(el("p", { class: "muted small" }, "Tap a skill to roll it now. For advantage, disadvantage or your key memory, long-press the skill on the sheet."));
    for (const s of D.SKILLS) {
      body.append(el("button", { class: "picker__row picker__row--btn quick__row", onClick: () => { close(); openSkillRoll(ch, s.key, null, { quick: true }); } },
        el("span", { class: "palette__icon" }, icon("dice")), el("strong", {}, s.name), skillMarks(ch, s)));
    }
  } });
}

// The floating dice button: shown on every screen while there is a living
// character, except the wizard (which is building one). It steps aside while
// you scroll down (back on the way up), on a panel with its own sticky
// next-step bar, and under a dialog (CSS).
let lastY = 0;
function bindFabScroll(fab) {
  addEventListener("scroll", () => {
    const y = scrollY;
    if (Math.abs(y - lastY) < 8) return;
    fab.classList.toggle("fab--away", y > lastY && y > 80);
    lastY = y;
  }, { passive: true });
}
export function updateQuickRoll(route) {
  let fab = document.getElementById("quick-roll");
  if (!fab) {
    fab = el("button", { id: "quick-roll", class: "fab", "aria-label": "Quick roll — pick a skill", title: "Quick roll" }, "🎲");
    fab.addEventListener("click", () => { const ch = Store.getActive(); if (ch) pickSkill(ch); });
    document.body.append(fab);
    bindFabScroll(fab);
  }
  fab.classList.remove("fab--away");
  lastY = 0;
  const ch = Store.getActive();
  fab.hidden = !ch || !!ch.state?.dead || route === "wizard";
}

// Ctrl+K / ⌘K: a searchable list of every place and every skill roll. The last
// few picks come first ("Recent", per device).
const SOLO_TABS = [["play", "Play", "play"], ["case", "Case", "clipboard"], ["shift", "Shift", "timer"], ["scene", "Scene", "place"], ["board", "Case Board", "link"],
  ["leads", "Leads", "search"], ["wrap", "Wrap", "check"], ["notes", "Notes", "pen"]];
const RECENT_KEY = "brp:palette";
const RECENT_MAX = 5;
function recents() { try { return JSON.parse(localStorage.getItem(RECENT_KEY) || "{}").recent || []; } catch { return []; } }
function remember(id) {
  try { localStorage.setItem(RECENT_KEY, JSON.stringify({ recent: [id, ...recents().filter((x) => x !== id)].slice(0, RECENT_MAX) })); } catch { /* best-effort */ }
}
function openSolo(panel) {
  try { const s = JSON.parse(localStorage.getItem(SOLO_KEY) || "{}"); s.panel = panel; localStorage.setItem(SOLO_KEY, JSON.stringify(s)); } catch { /* best-effort */ }
  navigate("solo");
}
function openPalette() {
  if (document.querySelector(".modal-overlay")) return;
  const ch = Store.getActive();
  const go = [["Home", "home", "home"], ["Characters", "characters", "people"], ["Character sheet", "sheet", "person"], ["Combat tracker", "combat", "attack"],
    ["Rules Library", "rules", "library"], ["How to Play", "tutorial", "book"], ["Settings", "settings", "settings"],
    Settings.gm() ? ["GM screen", "gm", "gm"] : null].filter(Boolean);
  const items = [];
  for (const [label, route, ic] of go) items.push({ id: `screen:${route}`, label, hint: "screen", ic, fn: () => navigate(route) });
  if (Settings.solo()) for (const [key, label, ic] of SOLO_TABS) items.push({ id: `solo:${key}`, label: `Solo · ${label}`, hint: "tab", ic, fn: () => openSolo(key) });
  if (ch && !ch.state?.dead) for (const s of D.SKILLS) items.push({ id: `roll:${s.key}`, label: `Roll ${s.name}`, skill: s, ic: "dice", fn: () => openSkillRoll(ch, s.key, null, { quick: true }) });
  modal({ title: "Go to…", search: true, render(body, close) {
    const row = (it, recent = false) => el("button", { class: "picker__row picker__row--btn palette__row" + (recent ? " palette__row--recent" : ""), onClick: () => { remember(it.id); close(); it.fn(); } },
      el("span", { class: "palette__icon" }, icon(it.ic)), el("strong", {}, it.label),
      it.skill ? skillMarks(ch, it.skill) : el("span", { class: "muted palette__hint" }, it.hint));
    const recent = recents().map((id) => items.find((it) => it.id === id)).filter(Boolean);
    if (recent.length) {
      body.append(el("div", { class: "palette__head" }, "Recent"));
      for (const it of recent) body.append(row(it, true));
      body.append(el("div", { class: "palette__head" }, "Everything"));
    }
    for (const it of items) body.append(row(it));
    requestAnimationFrame(() => body.querySelector(".picker-search")?.focus());
  } });
}
export function bindPalette() {
  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === "k") { e.preventDefault(); openPalette(); }
  });
}
