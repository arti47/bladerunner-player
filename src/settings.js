// settings.js — feature/content toggles + theme. Off by default (CLAUDE.md §8).
import { STORAGE_PREFIX } from "./core.js";

const KEY = STORAGE_PREFIX + "settings";
const DEFAULTS = {
  theme: "dark",        // "dark" | "light" | "system" (dark is primary, §0.7)
  solo: false,          // Solo Mode assistant
  gm: false,            // GM screen
  advanced: false,      // advanced/GM automation
  guidance: true,       // "How to use this" notes on the sheet / Solo / GM (on for a new install)
  rain: true,           // falling rain behind the dark theme (owner decision: on by default)
  haptics: true,        // a short buzz when dice land / damage lands (devices that vibrate)
  diceSound: false,     // a dice clatter on every roll (owner decision: off by default)
  textSize: "100",      // "100" | "115" | "130" — scales every rem in the stylesheet
  veteran: false,       // Rookie (default) shows the game; Veteran shows every tool at once
  ambient: false,       // ambient rain sound behind play (off by default)
};

function readAll() {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || "{}") }; }
  catch { return { ...DEFAULTS }; }
}
function writeAll(obj) { localStorage.setItem(KEY, JSON.stringify(obj)); }

export const Settings = {
  get(k) { return readAll()[k]; },
  set(k, v) { const all = readAll(); all[k] = v; writeAll(all); if (k === "guidance") applyGuidance(); if (k === "rain") applyRain(); if (k === "textSize") applyTextSize(); if (k === "veteran") applyInterface(); if (k === "ambient") window.dispatchEvent(new Event("brp:ambient")); return v; },
  all() { return readAll(); },
  // convenience flags
  solo() { return !!readAll().solo; },
  gm() { return !!readAll().gm; },
  advanced() { return !!readAll().advanced; },
  guidance() { return readAll().guidance !== false; },
  rain() { return readAll().rain !== false; },
  haptics() { return readAll().haptics !== false; },
  diceSound() { return !!readAll().diceSound; },
  veteran() { return !!readAll().veteran; },
  ambient() { return !!readAll().ambient; },
  textSize() { return TEXT_SIZES.includes(String(readAll().textSize)) ? String(readAll().textSize) : "100"; },
  theme() { return readAll().theme; },
  setTheme(t) { this.set("theme", THEMES.includes(t) ? t : "dark"); applyTheme(); return t; },
};

export const THEMES = ["dark", "light", "system"];
export const TEXT_SIZES = ["100", "115", "130"];

// Guidance is one switch for every "How to use this" note in the app — the
// stylesheet hides them all when the root says off, so no screen re-renders.
// Rain is a root attribute too: the stylesheet shows the layer only in the dark
// theme, and never under prefers-reduced-motion.
export function applyRain() {
  document.documentElement.dataset.rain = Settings.rain() ? "on" : "off";
}
// Text size is a root attribute the stylesheet turns into the root font size;
// every size and space in the token scale is in rem, so the whole UI follows.
export function applyTextSize() {
  document.documentElement.dataset.text = Settings.textSize();
}
// Rookie / Veteran: one root attribute. Rookie (every new install) keeps the
// game on screen and the toolbox one tap away; Veteran shows every tool at once.
export function applyInterface() {
  document.documentElement.dataset.ui = Settings.veteran() ? "veteran" : "rookie";
}
export function applyGuidance() {
  document.documentElement.dataset.guidance = Settings.guidance() ? "on" : "off";
}

// "system" follows the OS live; the attribute always carries the resolved
// theme so the stylesheet only ever needs two token blocks. The browser chrome
// colour (theme-color) tracks whatever the page background resolves to.
const systemDark = () => !window.matchMedia || window.matchMedia("(prefers-color-scheme: dark)").matches;
export function resolveTheme(theme = Settings.theme()) {
  return theme === "system" ? (systemDark() ? "dark" : "light") : theme === "light" ? "light" : "dark";
}
let watching = false;
export function applyTheme(theme = Settings.theme()) {
  const root = document.documentElement;
  root.dataset.theme = resolveTheme(theme);
  const bg = getComputedStyle(root).getPropertyValue("--bg").trim();
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta && bg) meta.setAttribute("content", bg);
  if (!watching && window.matchMedia) {
    watching = true;
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", () => {
      if (Settings.theme() === "system") applyTheme();
    });
  }
}

export const TOGGLES = [
  { key: "veteran", group: "interface", label: "Veteran interface", desc: "Every tool on screen at once: Solo tabs, vitals buttons, table tools." },
  { key: "solo", group: "modes", label: "Solo Mode", desc: "Play alone — the dice run the case." },
  { key: "gm", group: "modes", label: "GM Screen", desc: "Run the game for other people." },
  { key: "advanced", group: "modes", label: "Advanced Automation", desc: "Extra helpers for experienced players." },
  { key: "rain", group: "appearance", label: "Rain", desc: "Rain behind the dark theme." },
  { key: "haptics", group: "feel", label: "Haptics", desc: "A buzz when dice or damage land." },
  { key: "diceSound", group: "feel", label: "Dice sound", desc: "A clatter on every roll." },
  { key: "ambient", group: "feel", label: "Rain sound", desc: "Soft rain under play." },
  { key: "guidance", group: "feel", label: "Guidance", desc: "The (i) how-to notes on every card." },
];
