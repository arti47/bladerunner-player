// chase.js — foot & vehicle chases (CLAUDE.md §3.12; data in data.js CHASE).
// Chases run mapless: distance is a Range Category, both sides secretly pick a
// maneuver, the Game Runner reveals a D12 obstacle, then maneuvers resolve —
// prey first, pursuer last. Rendered as a card on the Combat screen; state in
// `brp:chase` so a chase survives a reload.
import { el, uid, rollDie, STORAGE_PREFIX } from "./core.js";
import * as D from "../data.js";
import { showToast, sectionTitle, resultSlot, renderToHtml, modal } from "./ui.js";
import { RollLog, Store } from "./store.js";
import { openSkillRoll, proceduralRoll } from "./roller.js";

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
  return { active: false, env: "foot", round: 1, distIdx: RANGE_KEYS.indexOf("short"), obstacle: null, prey: null, pursuer: null,
    vehicles: { prey: null, pursuer: null }, hull: { prey: null, pursuer: null }, log: [] };
}
const vehicle = (key) => D.VEHICLES.find((v) => v.key === key) || null;
const SIDES = [["prey", "Prey"], ["pursuer", "Pursuer"]];

export function renderChaseCard(rerender) {
  const st = Chase.get();
  const commit = (mutate) => { mutate(st); Chase.save(st); rerender(); };
  const card = el("div", { class: "card" }, sectionTitle("Chase"));

  if (!st.active) {
    card.append(el("p", { class: "muted" }, "Someone is running and someone is chasing. Start this only when that happens — otherwise ignore the card."));
    card.append(el("details", { class: "how" },
      el("summary", {}, "How a chase runs"),
      el("p", { class: "how__line" }, el("strong", {}, "Prey and pursuer"), " ", el("span", { class: "muted" }, "are the two sides: the one running, and the one chasing.")),
      el("p", { class: "how__line" }, el("strong", {}, "1. Set the environment and distance"), " ", el("span", { class: "muted" }, "— on foot, in a car, or in a Spinner, and how far apart you start.")),
      el("p", { class: "how__line" }, el("strong", {}, "2. Each side picks a maneuver"), " ", el("span", { class: "muted" }, "for the round, without knowing the other's.")),
      el("p", { class: "how__line" }, el("strong", {}, "3. 🎲 Reveal obstacle"), " ", el("span", { class: "muted" }, "throws something in the way — traffic, a fence, a crowd.")),
      el("p", { class: "how__line" }, el("strong", {}, "4. Move the distance"), " ", el("span", { class: "muted" }, "closer or farther by who won the exchange, then take the next round. Close all the way and the prey is caught; open it far enough and they are gone."))));
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


  // ---- vehicles ------------------------------------------------------------
  // A vehicle chase runs on the machine's stats: Maneuverability is the die a
  // DRIVING roll uses, Hull is what gunfire chews through, Armor soaks it.
  // Without this the fleet was reference-only. [§3.12]
  if (st.env !== "foot") {
    const vcard = el("div", { class: "field" }, el("label", { class: "field__label" }, "Vehicles"));
    for (const [side, label] of SIDES) {
      const v = vehicle(st.vehicles?.[side]);
      const row = el("div", { class: "chase-veh" });
      const sel = el("select", { class: "input roll-select", "aria-label": `${label} vehicle` });
      sel.append(el("option", { value: "" }, `${label}: on foot / unstated`));
      for (const opt of D.VEHICLES) sel.append(el("option", { value: opt.key, selected: opt.key === st.vehicles?.[side] || null }, opt.name));
      sel.addEventListener("change", () => commit((x) => {
        x.vehicles = { ...(x.vehicles || {}), [side]: sel.value || null };
        const nv = vehicle(sel.value);
        x.hull = { ...(x.hull || {}), [side]: nv ? nv.hull : null };
      }));
      row.append(sel);
      if (v) {
        const hull = st.hull?.[side] ?? v.hull;
        row.append(el("div", { class: "chase-veh__stats muted" },
          `Maneuverability ${v.maneuverability} · Hull ${hull}/${v.hull}${v.armor ? ` · Armor ${v.armor}` : " · no armor"}`));
        const bump = (d) => commit((x) => {
          const cur = x.hull?.[side] ?? v.hull;
          const next = Math.max(0, Math.min(v.hull, cur + d));
          x.hull = { ...(x.hull || {}), [side]: next };
          if (next === 0) showToast(`${label}'s ${v.name} is wrecked.`, { kind: "warn" });
        });
        row.append(el("div", { class: "rec-actions" },
          el("button", { class: "btn btn--sm btn--ghost", onClick: () => bump(-1), "aria-label": `${label} hull down` }, "− Hull"),
          el("button", { class: "btn btn--sm btn--ghost", onClick: () => bump(+1), "aria-label": `${label} hull up` }, "＋ Hull"),
          el("button", { class: "btn btn--sm btn--roll", onClick: () => driveRoll(v) }, "🎲 Driving"),
          el("button", { class: "btn btn--sm btn--roll", onClick: () => vehicleWeapon(side, v) }, "⚔ Vehicle weapon")));
      }
      vcard.append(row);
    }
    card.append(vcard);
  }

  // DRIVING rolls off the vehicle's Maneuverability rather than the default.
  function driveRoll(v) {
    const ch = Store.getActive();
    if (!ch) { showToast("No active character to roll for.", { kind: "warn" }); return; }
    openSkillRoll(ch, "driving", rerender, { maneuver: v.maneuverability });
  }

  // Shooting from a vehicle: FIREARMS, then the damage lands on the other side's
  // Hull (armor is applied by the Game Runner — the book leaves vehicle armor to
  // narration rather than the personal-armor dice).
  function vehicleWeapon(side, v) {
    const ch = Store.getActive();
    if (!ch) { showToast("No active character to roll for.", { kind: "warn" }); return; }
    const other = side === "prey" ? "pursuer" : "prey";
    modal({
      title: `${v.name} — open fire`,
      render(body, close) {
        const list = el("div", { class: "picker" });
        for (const w of D.VEHICLE_WEAPONS) {
          list.append(el("button", { class: "picker__row picker__row--btn", onClick: () => {
            close();
            if (typeof w.damage !== "number") { showToast(`${w.name}: ${w.note || "no direct damage"}`, { timeout: 5000 }); return; }
            proceduralRoll(ch, {
              skillKey: "firearms", title: `${w.name} — ${v.name}`,
              note: `Damage ${w.damage}${w.fullAuto ? " · full auto" : ""}${w.note ? ` — ${w.note}` : ""}. Hits land on the ${other === "prey" ? "prey" : "pursuer"}'s Hull.`,
              onResult: ({ successes }) => {
                if (successes < 1) { showToast("Missed."); rerender(); return; }
                const dmg = w.damage + (successes - 1);
                commit((x) => {
                  const tv = vehicle(x.vehicles?.[other]);
                  if (!tv) { showToast(`Hit for ${dmg} — no vehicle recorded for the ${other}.`, { kind: "warn" }); return; }
                  const cur = x.hull?.[other] ?? tv.hull;
                  const next = Math.max(0, cur - dmg);
                  x.hull = { ...(x.hull || {}), [other]: next };
                  x.log.unshift({ id: uid(), text: `R${x.round} ${w.name} hit for ${dmg} — ${tv.name} Hull ${next}/${tv.hull}` });
                  showToast(next === 0 ? `${tv.name} is wrecked.` : `Hit for ${dmg} — Hull ${next}/${tv.hull}.`, { kind: next === 0 ? "warn" : "info" });
                });
              },
            });
          } },
            el("span", {}, el("strong", {}, w.name), " — ",
              el("span", { class: "muted" }, `${typeof w.damage === "number" ? `Damage ${w.damage}` : "Special"}${w.critDie ? ` · Crit D${w.critDie}` : ""}${w.fullAuto ? " · full auto" : ""}`))));
        }
        body.append(list, el("div", { class: "modal__actions" }, el("button", { class: "btn btn--ghost", onClick: () => close() }, "Cancel")));
      },
    });
  }

  // 2 — obstacle. The roll lands inline under the button (same surface as the
  // Solo/GM oracles) instead of a modal you have to dismiss mid-chase.
  const rollObstacle = () => {
    const table = D.CHASE.obstacles[st.env];
    const roll = rollDie(table.length);
    const text = table[roll - 1];
    commit((s) => { s.obstacle = { roll, text, die: table.length }; s.log.unshift({ id: uid(), text: `R${s.round} obstacle: ${text}` }); });
    try { RollLog.add({ label: "Chase obstacle", text: `D${table.length}=${roll} · ${text}`, source: "combat" }); } catch {}
  };
  card.append(el("div", { class: "rec-actions" },
    el("button", { class: "btn btn--sm btn--roll", onClick: rollObstacle }, "🎲 Reveal obstacle")));
  if (st.obstacle) {
    card.append(resultSlot({
      title: `Obstacle — ${st.obstacle.roll} (D${st.obstacle.die || D.CHASE.obstacles[st.env].length})`,
      html: renderToHtml((b) => b.append(el("p", { class: "roll-prose" }, st.obstacle.text))),
      onReroll: rollObstacle,
      onDismiss: () => commit((s) => { s.obstacle = null; }),
    }));
  }

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
