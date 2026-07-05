// core.js — foundational constants, DOM/util helpers, raw dice functions.
// No imports (per CLAUDE.md §6.1). Everything here is pure/stateless.

export const APP_NAME = "Blade Runner Player";
export const STORAGE_PREFIX = "brp:"; // localStorage key namespace

// ---- DOM helpers ----------------------------------------------------------
export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === "class") node.className = v;
    else if (k === "dataset") Object.assign(node.dataset, v);
    else if (k === "html") node.innerHTML = v;
    else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === "for") node.htmlFor = v;
    else node.setAttribute(k, v === true ? "" : v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    node.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return node;
}
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
export function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); return node; }

// ---- misc utils -----------------------------------------------------------
export const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
export const uid = () => (crypto?.randomUUID ? crypto.randomUUID() : "id-" + Math.random().toString(36).slice(2) + Date.now().toString(36));
export const titleCase = (s) => String(s).replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

// ---- RAW DICE  [Ch01/03] --------------------------------------------------
// Blade Runner uses step dice D6..D12. 6+ = one success, 10+ = two successes.
export const DIE_SIZES = [6, 8, 10, 12];
export function rollDie(size) { return 1 + Math.floor(Math.random() * size); }
export function successesFor(face) { return face >= 10 ? 2 : face >= 6 ? 1 : 0; }

// Roll an array of die sizes; return per-die results with success counts.
export function rollDice(sizes) {
  return sizes.map((size) => {
    const face = rollDie(size);
    return { size, face, successes: successesFor(face), isBane: face === 1 };
  });
}
export function totalSuccesses(dice) { return dice.reduce((n, d) => n + d.successes, 0); }
export function totalBanes(dice) { return dice.reduce((n, d) => n + (d.isBane ? 1 : 0), 0); }

// One-line outcome summary for the roll log: "Critical success · 2 successes · 1 bane".
export function outcomeSummary(succ, banes) {
  const base = succ >= 2 ? "Critical success" : succ >= 1 ? "Success" : "Failure";
  const s = `${base} · ${succ} success${succ === 1 ? "" : "es"}`;
  return banes ? `${s} · ${banes} bane${banes === 1 ? "" : "s"}` : s;
}
