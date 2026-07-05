// store.js — local/cloud character persistence. Phase 0: localStorage only.
// Firebase cloud mirroring is layered in during Phase 5 (sync.js) behind
// FIREBASE_ENABLED; the API here stays stable.
import { STORAGE_PREFIX, uid } from "./core.js";
import { normalizeCharacter } from "./derived.js";
import { mirrorCharacter, mirrorCombat } from "./sync.js";

const KEY = STORAGE_PREFIX + "characters";
const ACTIVE = STORAGE_PREFIX + "activeCharacter";
const COMBAT = STORAGE_PREFIX + "combat";
const ROLLLOG = STORAGE_PREFIX + "rolllog";
const ROLLLOG_CAP = 150;

function readMap() {
  try { return JSON.parse(localStorage.getItem(KEY) || "{}"); }
  catch { return {}; }
}
function writeMap(map) { localStorage.setItem(KEY, JSON.stringify(map)); }

export const Store = {
  list() {
    const map = readMap();
    return Object.values(map).map(normalizeCharacter).sort((a, b) => a.name.localeCompare(b.name));
  },
  get(id) {
    const map = readMap();
    return map[id] ? normalizeCharacter(map[id]) : null;
  },
  save(character) {
    const ch = normalizeCharacter(character);
    if (!ch.id) ch.id = uid();
    const map = readMap();
    map[ch.id] = ch;
    writeMap(map);
    mirrorCharacter(ch);        // cloud push (no-op unless synced & in campaign)
    return ch;
  },
  // Apply a remote character snapshot locally WITHOUT re-mirroring (avoids loops).
  applyRemote(character) {
    const ch = normalizeCharacter(character);
    if (!ch.id) return null;
    const map = readMap();
    map[ch.id] = ch;
    writeMap(map);
    return ch;
  },
  remove(id) {
    const map = readMap();
    delete map[id];
    writeMap(map);
    if (this.getActiveId() === id) this.setActiveId(null);
  },
  getActiveId() { return localStorage.getItem(ACTIVE) || null; },
  setActiveId(id) { if (id) localStorage.setItem(ACTIVE, id); else localStorage.removeItem(ACTIVE); },
  getActive() { const id = this.getActiveId(); return id ? this.get(id) : null; },
};

// Global roll log — every dice roll across the app (sheet, combat, solo, GM)
// appends here newest-first, capped. Entries: { id, ts, source, charId?, charName?,
// label, text, pin? }. Local-only (not mirrored). The sheet filters by charId for a
// per-character view; Home shows the whole log.
export const RollLog = {
  list() { try { return JSON.parse(localStorage.getItem(ROLLLOG) || "[]"); } catch { return []; } },
  add(entry) {
    const list = this.list();
    list.unshift({ id: uid(), ts: Date.now(), source: "roll", ...entry });
    if (list.length > ROLLLOG_CAP) list.length = ROLLLOG_CAP;
    localStorage.setItem(ROLLLOG, JSON.stringify(list));
    return list[0];
  },
  remove(id) { localStorage.setItem(ROLLLOG, JSON.stringify(this.list().filter((e) => e.id !== id))); },
  clear() { localStorage.removeItem(ROLLLOG); },
};

// Local combat state (Phase 4). Phase 5 mirrors this to Firebase via sync.js.
export const Combat = {
  get() {
    try { const c = JSON.parse(localStorage.getItem(COMBAT) || "null"); return c || { active: false, round: 1, combatants: [] }; }
    catch { return { active: false, round: 1, combatants: [] }; }
  },
  save(state) { localStorage.setItem(COMBAT, JSON.stringify(state)); mirrorCombat(state); return state; },
  applyRemote(state) { localStorage.setItem(COMBAT, JSON.stringify(state)); return state; }, // no re-mirror
  clear() { localStorage.removeItem(COMBAT); mirrorCombat({ active: false, round: 1, combatants: [] }); },
};
