// chase.js — foot & vehicle chases (CLAUDE.md §3.12; data in data.js CHASE).
// Chases run mapless: distance is a Range Category, both sides secretly pick a
// maneuver, the Game Runner reveals a D12 obstacle, then maneuvers resolve —
// prey first, pursuer last. Rendered as a card on the Combat screen; state in
// `brp:chase` so a chase survives a reload.
import { el, uid, rollDie, STORAGE_PREFIX } from "./core.js";
import * as D from "../data.js";
import { showToast, sectionTitle, resultModal } from "./ui.js";
import { RollLog } from "./store.js";

const KEY = STORAGE_PREFIX + "chase";
const ENVIRONMENTS = [
  { key: "foot", name: "On foot" },
  { key: "ground", name: "Ground vehicle" },
  { key: "aerial", name: "Aerial (Spinner)" },
];
// Distance runs across the standard range categories; the GR sets the start,
// max Long — beyond Extreme the prey is away, at Engaged they are caught.
const RANGE_KEYS = D.RANGES.map((r) => r.key);

export const Chase = {
  get() {
    try { const c = JSON.parse(localStorage.getItem(KEY) || "null"); return c || blank(); }
    catch { return blank(); }
  },
  save(st) { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch {} return st; },
  clear() { try { localStorage.removeItem(KEY); } catch {} },
};
function blank() {
  return { active: false, env: "foot", round: 1, distIdx: RANGE_KEYS.indexOf("short"), obstacle: null, prey: null, pursuer: null, log: [] };
}

export function renderChaseCard(rerender) {
  const st = Chase.get();
  const commit = (mutate) => { mutate(st); Chase.save(st); rerender(); };
  const card = el("div", { class: "card" }, sectionTitle("Chase"));

  if (!st.active) {
    card.append(el("p", { class: "muted" }, "Foot and vehicle chases run without a map: pick maneuvers in secret, reveal an obstacle, then resolve — prey first, pursuer last."));
    card.append(el("div", { class: "field" }, el("label", { class: "field__label" }, "Environment"),
      el("div", { class: "chips" }, ...ENVIRONMENTS.map((e) =>
        el("button", { class: "chip" + (st.env === e.key ? " chip--on" : ""), onClick: () => commit((s) => { s.env = e.key; }) }, e.name)))));
    card.append(el("div", { class: "field" }, el("label", { class: "field__label" }, "Starting distance"),
      el("div", { class: "chips" }, ...D.RANGES.map((r, i) =>
        el("button", { class: "chip" + (st.distIdx === i ? " chip--on" : ""), disabled: r.key === "extreme" || null, title: r.desc,
          onClick: () => commit((s) => { s.distIdx = i; }) }, r.name)))));
    card.append(el("div", { class: "muted sheet__note" }, D.CHASE.distance));
    card.append(el("button", { class: "btn btn--primary btn--sm", onClick: () => commit((s) => { Object.assign(s, blank(), { active: true, env: s.env, distIdx: s.distIdx }); showToast("Chase started."); }) }, "▶ Start the chase"));
    return card;
  }

  const dist = D.RANGES[st.distIdx];
  card.append(el("div", { class: "combat__status" },
    el("span", { class: "combat__round" }, `Round ${st.round}`),
    el("span", { class: "muted" }, `${ENVIRONMENTS.find((e) => e.key === st.env).name} · distance ${dist ? dist.name : st.distIdx < 0 ? "Engaged or less" : "beyond Extreme"}`)));

  // 1 — maneuvers (both sides choose; the app just records the choice)
  const maneuverRow = (side) => {
    const legal = D.CHASE.maneuvers.filter((m) => m.who === "both" || m.who === side);
    return el("div", { class: "field" },
      el("label", { class: "field__label" }, side === "prey" ? "Prey maneuver" : "Pursuer maneuver"),
      el("div", { class: "chips" }, ...legal.map((m) =>
        el("button", { class: "chip" + (st[side] === m.name ? " chip--on" : ""), title: m.text,
          onClick: () => commit((s) => { s[side] = s[side] === m.name ? null : m.name; }) }, m.name))));
  };
  card.append(maneuverRow("prey"), maneuverRow("pursuer"));
  for (const side of ["prey", "pursuer"]) {
    const m = D.CHASE.maneuvers.find((x) => x.name === st[side]);
    if (!m) continue;
    const skill = st.env === "foot" ? m.skill : (m.vehicleSkill || m.skill);
    card.append(el("div", { class: "muted sheet__note" },
      `${side === "prey" ? "Prey" : "Pursuer"} — ${m.name}${skill ? ` (${skillName(skill)})` : ""}: ${m.text}`));
  }

  // 2 — obstacle
  card.append(el("div", { class: "rec-actions" },
    el("button", { class: "btn btn--sm btn--roll", onClick: () => {
      const table = D.CHASE.obstacles[st.env];
      const roll = rollDie(table.length);
      const text = table[roll - 1];
      commit((s) => { s.obstacle = { roll, text }; s.log.unshift({ id: uid(), text: `R${s.round} obstacle: ${text}` }); });
      try { RollLog.add({ label: "Chase obstacle", text: `D${table.length}=${roll} · ${text}`, source: "combat" }); } catch {}
      resultModal({ title: `Chase obstacle — ${roll} (D${table.length})`, render: (b) => b.append(el("p", { class: "roll-prose" }, text)) });
    } }, "🎲 Reveal obstacle")));
  if (st.obstacle) card.append(el("div", { class: "notice" }, `Obstacle #${st.obstacle.roll}: ${st.obstacle.text}`));

  // 3 — resolve: move the distance, then advance the round
  card.append(el("div", { class: "field" }, el("label", { class: "field__label" }, "Distance"),
    el("div", { class: "rec-actions" },
      el("button", { class: "btn btn--sm", onClick: () => commit((s) => { s.distIdx = Math.max(-1, s.distIdx - 1); flagOutcome(s); }) }, "− Closer (pursuer)"),
      el("button", { class: "btn btn--sm", onClick: () => commit((s) => { s.distIdx = Math.min(RANGE_KEYS.length, s.distIdx + 1); flagOutcome(s); }) }, "+ Farther (prey)"))));
  card.append(el("div", { class: "muted sheet__note" }, `Caught: ${D.CHASE.caught}`));
  card.append(el("div", { class: "muted sheet__note" }, `Escape: ${D.CHASE.escape}`));

  card.append(el("div", { class: "rec-actions" },
    el("button", { class: "btn btn--primary btn--sm", onClick: () => commit((s) => { s.round++; s.obstacle = null; s.prey = null; s.pursuer = null; showToast(`Chase round ${s.round}.`); }) }, "Next round ›"),
    el("button", { class: "btn btn--sm btn--danger", onClick: () => { Chase.clear(); rerender(); } }, "End chase")));

  const proc = el("details", { class: "rules__group" }, el("summary", {}, "Chase procedure"));
  D.CHASE.procedure.forEach((line, i) => proc.append(el("div", { class: "muted sheet__note" }, `${i + 1}. ${line}`)));
  card.append(proc);
  return card;
}

function flagOutcome(s) {
  if (s.distIdx < 0) showToast(`Caught — ${D.CHASE.caught}`, { kind: "warn", timeout: 5000 });
  else if (s.distIdx >= RANGE_KEYS.length) showToast(`The prey is away — ${D.CHASE.escape}`, { kind: "warn", timeout: 5000 });
}
const skillName = (key) => D.SKILLS.find((s) => s.key === key)?.name || key;
