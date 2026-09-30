// core.js — foundational constants, DOM/util helpers, raw dice functions.
// No imports (per CLAUDE.md §6.1). Everything here is pure/stateless.

export const STORAGE_PREFIX = "brp:"; // localStorage key namespace
// The tutorial remembers its open panel here. Shared so a feature screen can
// deep-link straight to the panel that documents it.
export const TUTORIAL_KEY = "brp:tutorial";
// The solo assistant's state, including which panel is open. Shared so the
// sheet can send you to a specific solo tab.
export const SOLO_KEY = "brp:solo";

// ---- icons -----------------------------------------------------------------
// Labels are written with a glyph prefix ("🎲 Roll it", "✕") because that reads
// well in source and in the notes. On screen, every glyph in this map becomes an
// SVG symbol from the sprite (src/icons.js): monochrome, currentColor, the same
// on every platform — so a label inherits the palette's role colours instead of
// a colour emoji's. A glyph is only swapped when it stands alone or leads/trails
// a label as its own word; "D→C" or "♥8" mid-text stays typography.
export const ICON_GLYPHS = {
  "🎲": "dice", "⚄": "dice", "✕": "close", "⚡": "bolt", "✍": "pen", "✎": "pen",
  "★": "star", "✦": "sparkle", "📌": "pin", "▶": "play", "⚔": "attack", "🔗": "link",
  "↻": "reroll", "⟲": "reset", "↺": "undo", "☠": "skull", "🔍": "search", "✔": "check",
  "✓": "check", "⚖": "scale", "🛌": "bed", "⚠": "warn", "🔬": "examine", "💬": "talk",
  "📞": "call", "📍": "place", "🎯": "target", "🚕": "cab", "😤": "push", "⏱": "timer",
  "🛡": "shield", "🛒": "cart", "🕵": "person", "📋": "clipboard", "📖": "book",
  "♥": "heart", "◈": "resolve", "▲": "up", "▼": "down", "←": "back", "→": "next",
  "●": "dot-on", "○": "dot-off", "◉": "home", "☰": "people", "❖": "library",
  "◐": "solo", "▣": "gm", "⚙": "settings",
};
const G = Object.keys(ICON_GLYPHS).sort((a, b) => b.length - a.length).map((g) => g.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
const RX_ONLY = new RegExp(`^\\s*(${G})\uFE0F?\\s*$`, "u");
const RX_LEAD = new RegExp(`^(${G})\uFE0F?\\s+`, "u");
const RX_TRAIL = new RegExp(`\\s+(${G})\uFE0F?$`, "u");
const RX_ANY = new RegExp(`(?<=^|[\\s>])(${G})\uFE0F?(?=[\\s<]|$)`, "gu");
const SVGNS = "http://www.w3.org/2000/svg";
export function icon(name, cls = "") {
  const svg = document.createElementNS(SVGNS, "svg");
  svg.setAttribute("class", `i i--${name}${cls ? " " + cls : ""}`);
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  const use = document.createElementNS(SVGNS, "use");
  use.setAttribute("href", `#i-${name}`);
  svg.append(use);
  return svg;
}
const iconMarkup = (name) => `<svg class="i i--${name}" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><use href="#i-${name}"></use></svg>`;
// Text with its label glyphs removed — for attributes, <option>s and anything
// else that cannot hold an SVG. Spoken names never include "game die".
// A glyph that carries meaning (★ marks a key attribute or skill) is spoken as
// words instead of being dropped.
const SPOKEN = { "★": "(key)" };
export function stripGlyphs(s) {
  s = String(s);
  for (const [g, w] of Object.entries(SPOKEN)) s = s.replace(new RegExp(`\\s*${g}\uFE0F?(?=\\s|$)`, "gu"), ` ${w}`);
  return s.replace(RX_ONLY, "").replace(RX_LEAD, "").replace(RX_TRAIL, "").trim() || s.trim();
}
function labelNodes(s) {
  let m = s.match(RX_ONLY);
  if (m) return [icon(ICON_GLYPHS[m[1]])];
  const out = [];
  let lead = null, trail = null;
  if ((m = s.match(RX_LEAD))) { lead = ICON_GLYPHS[m[1]]; s = s.slice(m[0].length); }
  if ((m = s.match(RX_TRAIL))) { trail = ICON_GLYPHS[m[1]]; s = s.slice(0, s.length - m[0].length); }
  // Keep one space between icon and word: flex parents collapse it, inline
  // parents (a status line, a tag) need it.
  if (lead) out.push(icon(lead));
  if (s) out.push(document.createTextNode(lead || trail ? (lead ? " " : "") + s.trim() + (trail ? " " : "") : s));
  if (trail) out.push(icon(trail));
  return out;
}
const TEXT_ONLY = new Set(["option", "textarea", "title", "script", "style"]);
const STRIP_ATTRS = new Set(["aria-label", "title", "placeholder", "alt"]);

// ---- DOM helpers ----------------------------------------------------------
export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === "class") node.className = v;
    else if (k === "dataset") Object.assign(node.dataset, v);
    else if (k === "html") node.innerHTML = String(v).replace(RX_ANY, (_, g) => iconMarkup(ICON_GLYPHS[g]));
    else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === "for") node.htmlFor = v;
    else node.setAttribute(k, v === true ? "" : STRIP_ATTRS.has(k) ? stripGlyphs(v) : v);
  }
  const plain = TEXT_ONLY.has(tag);
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    if (c.nodeType) { node.append(c); continue; }
    const s = String(c);
    if (plain) node.append(document.createTextNode(stripGlyphs(s)));
    else node.append(...labelNodes(s));
  }
  return node;
}
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
export function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); return node; }

// ---- misc utils -----------------------------------------------------------
export const uid = () => (crypto?.randomUUID ? crypto.randomUUID() : "id-" + Math.random().toString(36).slice(2) + Date.now().toString(36));
export const titleCase = (s) => String(s).replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

// ---- RAW DICE  [Ch01/03] --------------------------------------------------
// Blade Runner uses step dice D6..D12. 6+ = one success, 10+ = two successes.
export const DIE_SIZES = [6, 8, 10, 12];
export function rollDie(size) { return 1 + Math.floor(Math.random() * size); }
export function successesFor(face) { return face >= 10 ? 2 : face >= 6 ? 1 : 0; }

// Roll an array of die sizes; return per-die results with success counts.

// One-line outcome summary for the roll log: "Critical success · 2 successes · 1 bane".
// A 1 only costs anything on a PUSHED roll (§3.1), so banes are reported only
// when the roll was actually pushed — an unpushed 1 is just a low die.
export function outcomeSummary(succ, banes, pushed = false) {
  const base = succ >= 2 ? "Critical success" : succ >= 1 ? "Success" : "Failure";
  const s = `${base} · ${succ} success${succ === 1 ? "" : "es"}`;
  return pushed && banes ? `${s} · ${banes} bane${banes === 1 ? "" : "s"}` : s;
}

// ---- notes ----------------------------------------------------------------
// Case notes read top to bottom: the newest entry goes at the END, separated
// from what came before by a single blank line.
export function appendToNotes(existing, block) {
  const body = String(existing || "").replace(/\s+$/, "");
  const add = String(block || "").replace(/^\s+/, "").replace(/\s+$/, "");
  if (!add) return body ? body + "\n" : "";
  return (body ? body + "\n\n" : "") + add + "\n";
}
