// combat.js — local combat tracker (CLAUDE.md Phase 4; rules §3.12).
// Ten initiative cards #1–10 drawn once at combat start; combatants act low→high;
// the order persists across Rounds. PCs (from Store) and NPC adversaries (bestiary
// in data-npcs.js) share the field. Local-only for Phase 4 — Phase 5 (sync.js)
// mirrors this to Firebase with two-way vitals sync.
import { el, clear, titleCase, uid } from "./core.js";
import * as D from "../data.js";
import { NPCS } from "../data-npcs.js";
import { Store, Combat } from "./store.js";
import { maxHealth } from "./derived.js";
import { modal, showToast, confirmModal } from "./ui.js";
import { Sync } from "./sync.js";
import { rollCombatAttack, rollCombatSkill } from "./roller.js";

const INIT_CARDS = D.INITIATIVE_CARDS; // 10

// Apply remote (shared) combat updates from other party members. Registered once.
let lastMount = null, remoteBound = false;
function bindRemoteCombat() {
  if (remoteBound || !Sync.enabled) return;
  remoteBound = true;
  Sync.onCombat((remote) => {
    if (!remote) return;
    Combat.applyRemote(remote);
    if ((location.hash.slice(1) || "") === "combat" && lastMount) renderCombat(lastMount);
  });
}

export function renderCombat(mount) {
  lastMount = mount;
  bindRemoteCombat();
  const state = Combat.get();
  clear(mount);
  const commit = (mutate) => { mutate(state); Combat.save(state); renderCombat(mount); };
  const wrap = el("section", { class: "screen" }, el("h1", { class: "screen__title" }, "Combat Tracker"));

  // ---- top controls -------------------------------------------------------
  const controls = el("div", { class: "card" });
  if (state.active) {
    controls.append(el("div", { class: "combat__status" },
      el("span", { class: "combat__round" }, `Round ${state.round}`),
      el("span", { class: "muted" }, `${state.combatants.length} combatant${state.combatants.length === 1 ? "" : "s"} · act low→high`)));
    controls.append(el("div", { class: "rec-actions" },
      el("button", { class: "btn btn--primary btn--sm", onClick: () => nextTurn(commit) }, "Next turn ›"),
      el("button", { class: "btn btn--sm", onClick: () => commit((s) => drawInitiative(s)) }, "Re-draw initiative"),
      el("button", { class: "btn btn--sm btn--danger", onClick: async () => { if (await confirmModal("End combat and clear the tracker?", { title: "End combat", okLabel: "End", danger: true })) { Combat.clear(); renderCombat(mount); } } }, "End combat")));
  } else {
    controls.append(el("p", { class: "muted" }, "Add combatants, then draw initiative to begin. Surprise/ambush → set a combatant to card #1."));
    controls.append(el("button", { class: "btn btn--primary btn--sm", disabled: !state.combatants.length || null, onClick: () => commit((s) => drawInitiative(s)) }, "⚄ Draw initiative & begin"));
  }
  const add = el("div", { class: "rec-actions" });
  add.append(el("button", { class: "btn btn--sm", onClick: () => addActivePc(commit) }, "＋ Add my character"));
  add.append(el("button", { class: "btn btn--sm", onClick: () => addNpc(commit) }, "＋ Add adversary"));
  controls.append(add);
  wrap.append(controls);

  // ---- combatant list -----------------------------------------------------
  if (!state.combatants.length) {
    wrap.append(el("div", { class: "card" }, el("p", { class: "muted" }, "No combatants yet.")));
    mount.append(wrap); return;
  }
  const ordered = state.active ? [...state.combatants].sort((a, b) => a.card - b.card) : state.combatants;
  const activeId = state.active ? ordered[state.turnIndex % ordered.length]?.id : null;
  const list = el("div", { class: "list" });
  for (const c of ordered) list.append(combatantCard(c, c.id === activeId, commit));
  wrap.append(list);
  mount.append(wrap);
}

function combatantCard(c, isTurn, commit) {
  const broken = c.health <= 0;
  const card = el("div", { class: "card combatant" + (isTurn ? " combatant--turn" : "") + (broken ? " combatant--broken" : "") });
  card.append(el("div", { class: "combatant__top" },
    el("span", { class: "combatant__init" + (c.card ? "" : " combatant__init--none"), title: "Initiative card",
      onClick: () => editCard(c, commit) }, c.card ? `#${c.card}` : "—"),
    el("span", { class: "combatant__name" }, c.name, el("span", { class: "muted combatant__kind" }, ` · ${c.kind === "pc" ? "PC" : "NPC"}`)),
    el("button", { class: "btn btn--sm btn--ghost", "aria-label": `remove ${c.name}`, onClick: () => commit((s) => { s.combatants = s.combatants.filter((x) => x.id !== c.id); }) }, "✕")));
  card.append(el("div", { class: "combatant__vitals" },
    el("span", { class: "track__num track__num--health" }, `♥ ${c.health}/${c.maxHealth}`),
    broken ? el("span", { class: "badge badge--danger" }, "Broken") : null,
    el("span", { class: "stepper__ctrl" },
      el("button", { class: "btn btn--sm", "aria-label": `damage ${c.name}`, onClick: () => commit((s) => adjust(s, c.id, -1)) }, "−"),
      el("button", { class: "btn btn--sm", "aria-label": `heal ${c.name}`, onClick: () => commit((s) => adjust(s, c.id, +1)) }, "+"))));
  card.append(el("div", { class: "rec-actions combatant__actions" },
    el("button", { class: "btn btn--sm btn--roll", onClick: () => rollCombatAttack(c, commit) }, "⚔ Attack"),
    el("button", { class: "btn btn--sm", onClick: () => rollCombatSkill(c, commit) }, "🎲 Skill")));
  return card;
}

function adjust(state, id, delta) {
  const c = state.combatants.find((x) => x.id === id);
  if (c) c.health = Math.max(0, Math.min(c.maxHealth, c.health + delta));
}
function editCard(c, commit) {
  modal({ title: `Initiative — ${c.name}`, render(body, close) {
    body.append(el("p", { class: "muted" }, "Set the initiative card (Surprise/Ambush → #1; Fast Reflexes → pick the better of a fresh draw)."));
    const grid = el("div", { class: "init-grid" });
    for (let i = 1; i <= INIT_CARDS; i++) grid.append(el("button", { class: "chip" + (c.card === i ? " chip--on" : ""), onClick: () => { close(); commit((s) => { const t = s.combatants.find((x) => x.id === c.id); t.card = i; }); } }, `#${i}`));
    body.append(grid);
    body.append(el("div", { class: "modal__actions" }, el("button", { class: "btn btn--ghost", onClick: () => close() }, "Cancel")));
  } });
}

function drawInitiative(state) {
  const deck = Array.from({ length: INIT_CARDS }, (_, i) => i + 1);
  for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
  state.combatants.forEach((c, idx) => { c.card = deck[idx % INIT_CARDS] ?? idx + 1; });
  state.active = true; state.round = 1; state.turnIndex = 0;
  showToast("Initiative drawn — act from #1 upward.");
}
function nextTurn(commit) {
  commit((s) => {
    const n = s.combatants.length;
    s.turnIndex = (s.turnIndex ?? 0) + 1;
    if (s.turnIndex >= n) { s.turnIndex = 0; s.round += 1; showToast(`Round ${s.round}.`); }
  });
}

// ---- adding combatants ----------------------------------------------------
function addActivePc(commit) {
  const pc = Store.getActive();
  if (!pc) { showToast("No active character — create one first.", { kind: "warn" }); return; }
  commit((s) => {
    if (s.combatants.some((c) => c.charId === pc.id)) { showToast(`${pc.name} is already in combat.`, { kind: "warn" }); return; }
    s.combatants.push({ id: uid(), charId: pc.id, kind: "pc", name: pc.name, nature: pc.nature, health: pc.state.health, maxHealth: maxHealth(pc), card: null });
  });
}
function addNpc(commit) {
  modal({ title: "Add adversary", render(body, close) {
    body.append(el("p", { class: "muted" }, "Typical NPCs from the core bestiary. Add as many as the scene needs."));
    const list = el("div", { class: "picker" });
    for (const n of NPCS) list.append(el("button", { class: "list__row", onClick: () => {
      close();
      commit((s) => s.combatants.push({ id: uid(), kind: "npc", npcKey: n.key, name: n.name, nature: n.nature, health: n.health, maxHealth: n.health, card: null }));
      showToast(`${n.name} added.`);
    } }, el("span", { class: "list__main" }, n.name),
      el("span", { class: "list__sub muted" }, `STR ${n.attrs.STR} AGI ${n.attrs.AGI} · Health ${n.health} · ${(n.gear || []).join(", ") || "—"}`)));
    body.append(list);
    body.append(el("div", { class: "modal__actions" }, el("button", { class: "btn btn--ghost", onClick: () => close() }, "Cancel")));
  } });
}
