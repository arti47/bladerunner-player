// combat.js — local combat tracker (CLAUDE.md Phase 4; rules §3.12).
// Ten initiative cards #1–10 drawn once at combat start; combatants act low→high;
// the order persists across Rounds. PCs (from Store) and NPC adversaries (bestiary
// in data-npcs.js) share the field. Local-only for Phase 4 — Phase 5 (sync.js)
// mirrors this to Firebase with two-way vitals sync.
import { el, clear, titleCase, uid } from "./core.js";
import * as D from "../data.js";
import { NPCS } from "../data-npcs.js";
import { Store, Combat } from "./store.js";
import { maxHealth, reclampVitals } from "./derived.js";
import { modal, showToast, confirmModal } from "./ui.js";
import { Sync } from "./sync.js";
import { rollCombatAttack, rollCombatSkill, armorForCombatant as armorFor, rollCritOnCombatant } from "./roller.js";
import { renderChaseCard } from "./chase.js";
import { Settings } from "./settings.js";
import { navigate } from "./router.js";

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
  // The way back to the solo loop, which sent you here.  [solo-flow audit]
  if (Settings.solo()) wrap.append(el("div", { class: "solo-return" },
    el("button", { class: "btn btn--sm btn--ghost", onClick: () => navigate("solo") }, "← Back to the solo case")));

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
    wrap.append(renderChaseCard(() => renderCombat(mount)));
    mount.append(wrap); return;
  }
  const ordered = state.active ? [...state.combatants].sort((a, b) => a.card - b.card) : state.combatants;
  const activeId = state.active ? ordered[state.turnIndex % ordered.length]?.id : null;
  const list = el("div", { class: "list" });
  for (const c of ordered) list.append(combatantCard(c, c.id === activeId, commit));
  wrap.append(list);
  wrap.append(renderChaseCard(() => renderCombat(mount)));
  mount.append(wrap);
}

function combatantCard(c, isTurn, commit) {
  const broken = c.health <= 0;
  const card = el("div", { class: "card combatant" + (isTurn ? " combatant--turn" : "") + (broken ? " combatant--broken" : "") });
  const armor = armorFor(c);
  card.append(el("div", { class: "combatant__top" },
    el("span", { class: "combatant__init" + (c.card ? "" : " combatant__init--none"), title: "Initiative card",
      onClick: () => editCard(c, commit) }, c.card ? `#${c.card}` : "—"),
    el("span", { class: "combatant__name" }, c.name, el("span", { class: "muted combatant__kind" }, ` · ${c.kind === "pc" ? "PC" : "NPC"}`)),
    el("button", { class: "btn btn--sm btn--ghost", "aria-label": `remove ${c.name}`, onClick: () => commit((s) => { s.combatants = s.combatants.filter((x) => x.id !== c.id); }) }, "✕")));
  card.append(el("div", { class: "combatant__vitals" },
    el("span", { class: "track__num track__num--health" }, `♥ ${c.health}/${c.maxHealth}`),
    armor ? el("span", { class: "pip", title: `${armor.name} — roll ${D.ARMOR_DICE}× d${D.LEVEL_DIE[armor.rating]} when hit` }, `🛡 ${armor.rating}`) : null,
    broken ? el("span", { class: "badge badge--danger" }, "Broken") : null,
    el("span", { class: "stepper__ctrl" },
      el("button", { class: "btn btn--sm", "aria-label": `damage ${c.name}`, onClick: () => damageCombatant(c, commit) }, "−"),
      el("button", { class: "btn btn--sm", "aria-label": `heal ${c.name}`, onClick: () => commit((s) => adjust(s, c.id, +1)) }, "+"))));
  // Conditions (§3.6) — these drive the attack engine's advantage/disadvantage.
  const chips = el("div", { class: "chips combatant__conds" });
  for (const cond of D.CONDITIONS) {
    if (cond.key.startsWith("broken")) continue; // derived from Health
    const on = !!(c.conditions || {})[cond.key];
    chips.append(el("button", { class: "chip chip--sm" + (on ? " chip--on" : ""), title: cond.text,
      onClick: () => commit((s) => {
        const t = s.combatants.find((x) => x.id === c.id);
        if (!t) return;
        t.conditions = { ...(t.conditions || {}) };
        if (on) delete t.conditions[cond.key]; else t.conditions[cond.key] = true;
      }) }, cond.name));
  }
  card.append(chips);
  for (const inj of c.criticalInjuries || [])
    card.append(el("div", { class: "muted sheet__note" }, `☠ ${inj.injury} — ${inj.effect}`));
  card.append(el("div", { class: "rec-actions combatant__actions" },
    el("button", { class: "btn btn--sm btn--roll", onClick: () => rollCombatAttack(c, commit) }, "⚔ Attack"),
    el("button", { class: "btn btn--sm", onClick: () => rollCombatSkill(c, commit) }, "🎲 Skill")));
  return card;
}

function adjust(state, id, delta) {
  const c = state.combatants.find((x) => x.id === id);
  if (c) c.health = Math.max(0, Math.min(c.maxHealth, c.health + delta));
  // keep a PC's own sheet in step with the tracker
  if (c?.kind === "pc" && c.charId) {
    const pc = Store.get(c.charId);
    if (pc) { pc.state.health = c.health; reclampVitals(pc); Store.save(pc); }
  }
}
// Damage taken while already Broken forces an automatic critical injury [§3.7].
function damageCombatant(c, commit) {
  const wasBroken = c.health <= 0;
  commit((s) => adjust(s, c.id, -1));
  if (wasBroken) {
    showToast(`${c.name} is Broken — further damage forces a critical injury.`, { kind: "warn" });
    rollCritOnCombatant(c, commit);
  }
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

// Does this combatant draw an extra initiative card and choose? (Fast Reflexes
// specialty, Synaptic Implants augmentation — both carry extraInitiativeCards.)
function extraCards(c) {
  if (c.kind !== "pc" || !c.charId) return 0;
  const pc = Store.get(c.charId);
  if (!pc) return 0;
  const owned = (pc.specialties || []).map((s) => (typeof s === "string" ? s : s?.key));
  let n = D.SPECIALTIES.filter((sp) => owned.includes(sp.key) && sp.effect?.extraInitiativeCards)
    .reduce((t, sp) => t + sp.effect.extraInitiativeCards, 0);
  const gearNames = (pc.inventory?.items || []).map((it) => (it.name || "").toLowerCase());
  for (const aug of D.AUGMENTATIONS)
    if (/initiative card/i.test(aug.text) && gearNames.some((g) => g.includes(aug.name.toLowerCase()))) n += 1;
  return n;
}
function drawInitiative(state) {
  const deck = Array.from({ length: INIT_CARDS }, (_, i) => i + 1);
  for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
  let next = 0;
  const drawn = [];
  state.combatants.forEach((c) => {
    const picks = [deck[next++ % INIT_CARDS]];
    for (let k = 0; k < extraCards(c); k++) picks.push(deck[next++ % INIT_CARDS]); // draw extra, keep the best (lowest acts first)
    c.card = Math.min(...picks);
    if (picks.length > 1) drawn.push(`${c.name}: ${picks.join("/")} → #${c.card}`);
  });
  state.active = true; state.round = 1; state.turnIndex = 0;
  showToast(drawn.length ? `Initiative drawn — ${drawn.join("; ")}` : "Initiative drawn — act from #1 upward.",
    { timeout: drawn.length ? 5000 : 2600 });
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
