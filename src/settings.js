// settings.js — feature/content toggles + theme. Off by default (CLAUDE.md §8).
import { STORAGE_PREFIX } from "./core.js";

const KEY = STORAGE_PREFIX + "settings";
const DEFAULTS = {
  theme: "dark",        // "dark" | "light"
  solo: false,          // Solo Mode assistant
  gm: false,            // GM screen
  advanced: false,      // advanced/GM automation
};

function readAll() {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || "{}") }; }
  catch { return { ...DEFAULTS }; }
}
function writeAll(obj) { localStorage.setItem(KEY, JSON.stringify(obj)); }

export const Settings = {
  get(k) { return readAll()[k]; },
  set(k, v) { const all = readAll(); all[k] = v; writeAll(all); return v; },
  all() { return readAll(); },
  // convenience flags
  solo() { return !!readAll().solo; },
  gm() { return !!readAll().gm; },
  advanced() { return !!readAll().advanced; },
  theme() { return readAll().theme; },
  toggleTheme() { const t = readAll().theme === "dark" ? "light" : "dark"; this.set("theme", t); applyTheme(t); return t; },
};

export function applyTheme(theme = Settings.theme()) {
  document.documentElement.dataset.theme = theme;
}

export const TOGGLES = [
  { key: "solo", label: "Solo Mode", desc: "Playing on your own, with no one running the game? This adds a Solo tab where dice answer your questions and walk you through a case." },
  { key: "gm", label: "GM Screen", desc: "Running the game for other people? This adds a GM tab: build the case, watch the party's health, drop in adversaries." },
  { key: "advanced", label: "Advanced Automation", desc: "Extra helpers for experienced players. Leave it off to start." },
];
