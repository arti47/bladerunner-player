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
  { key: "solo", label: "Solo Mode", desc: "Official solo-play oracle and assistant." },
  { key: "gm", label: "GM Screen", desc: "Game Runner dashboard: party, combat, reference tables." },
  { key: "advanced", label: "Advanced Automation", desc: "Extra GM/automation helpers (time, events)." },
];
