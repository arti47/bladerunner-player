// settings.js — feature/content toggles + theme. Off by default (CLAUDE.md §8).
import { STORAGE_PREFIX } from "./core.js";

const KEY = STORAGE_PREFIX + "settings";
const DEFAULTS = {
  theme: "dark",        // "dark" | "light" | "system" (dark is primary, §0.7)
  solo: false,          // Solo Mode assistant
  gm: false,            // GM screen
  advanced: false,      // advanced/GM automation
  guidance: true,       // "How to use this" notes on the sheet / Solo / GM (on for a new install)
};

function readAll() {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || "{}") }; }
  catch { return { ...DEFAULTS }; }
}
function writeAll(obj) { localStorage.setItem(KEY, JSON.stringify(obj)); }

export const Settings = {
  get(k) { return readAll()[k]; },
  set(k, v) { const all = readAll(); all[k] = v; writeAll(all); if (k === "guidance") applyGuidance(); return v; },
  all() { return readAll(); },
  // convenience flags
  solo() { return !!readAll().solo; },
  gm() { return !!readAll().gm; },
  advanced() { return !!readAll().advanced; },
  guidance() { return readAll().guidance !== false; },
  theme() { return readAll().theme; },
  setTheme(t) { this.set("theme", THEMES.includes(t) ? t : "dark"); applyTheme(); return t; },
};

export const THEMES = ["dark", "light", "system"];

// Guidance is one switch for every "How to use this" note in the app — the
// stylesheet hides them all when the root says off, so no screen re-renders.
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
  { key: "solo", label: "Solo Mode", desc: "Playing on your own, with no one running the game? This adds a Solo tab where dice answer your questions and walk you through a case." },
  { key: "gm", label: "GM Screen", desc: "Running the game for other people? This adds a GM tab: build the case, watch the party's health, drop in adversaries." },
  { key: "advanced", label: "Advanced Automation", desc: "Extra helpers for experienced players. Leave it off to start." },
  { key: "guidance", label: "Guidance", desc: "Show the \u201cHow to use this\u201d notes on the sheet, Solo and GM screens. Turn off once you know your way round." },
];
