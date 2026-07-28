// roller.js — the native dice engine (CLAUDE.md Phase 3; rules §3.1/§3.7/§3.12).
// Step dice: attribute die + skill die = Base Dice. 6+ = 1 success, 10+ = 2, 2+
// successes = critical. Advantage adds a third die of the LOWER die's type;
// disadvantage removes the lower die (keep the higher). Adv/disadv cancel 1:1 and
// the net is capped at one (Ch03). Push re-rolls every die not showing a 1; each 1
// in the final pool inflicts damage (STR/AGI) or stress (INT/EMP), and Replicants
// always take stress (Ch03/Ch04). All rolls read successes; crit dice read faces.
import { el, rollDie, successesFor, titleCase, outcomeSummary } from "./core.js";
import * as D from "../data.js";
import { NPCS } from "../data-npcs.js";
import * as R from "./rules.js";
import { Store, Combat, RollLog } from "./store.js";
import { modal, showToast } from "./ui.js";
import { reclampVitals, isBrokenByDamage } from "./derived.js";

const dsize = (lvl) => D.LEVEL_DIE[lvl];
const MANEUVER_DEFAULT = "C"; // no vehicle context: default Maneuverability for Driving

// ---- pure roll helpers ----------------------------------------------------
function makeDie(size) { const face = rollDie(size); return { size, face, succ: successesFor(face), bane: face === 1 }; }
// Build the pool for net advantage(+1)/none(0)/disadvantage(-1). [Ch03 p032]
function poolFor(attrSize, skillSize, net) {
  let sizes;
  if (net < 0) sizes = [Math.max(attrSize, skillSize)];                              // remove lower die
  else if (net > 0) sizes = [attrSize, skillSize, Math.min(attrSize, skillSize)];    // + die of lower type
  else sizes = [attrSize, skillSize];
  return sizes.map(makeDie);
}
// Push: re-roll every die that isn't a locked 1 and isn't already a success. [Ch03 p033]
function pushPool(dice) { return dice.map((d) => (d.bane || d.succ > 0 ? d : makeDie(d.size))); }
const sumSucc = (dice) => dice.reduce((n, d) => n + d.succ, 0);
const sumBane = (dice) => dice.reduce((n, d) => n + (d.bane ? 1 : 0), 0);

function logRoll({ label, text, charId = null, charName = null, source = "roll" }) {
  try { RollLog.add({ label, text, charId, charName, source }); } catch { /* storage best-effort */ }
}

// Auto advantage/disadvantage from the character's current state. [§3.6]
function autoFor(ch, skillKey) {
  let adv = 0, dis = 0;
  if (ch.state.conditions?.aiming && skillKey === "firearms") adv++;       // Aiming → next shot
  // Own conditions that bite on your own roll (Prone in close combat).
  for (const c of D.CONDITIONS)
    if (ch.state.conditions?.[c.key] && c.effect?.selfMeleeDisadvantage && skillKey === "hand_to_hand") dis++;
  for (const inj of ch.state.criticalInjuries || [])
    if ((inj.disadvantage || []).includes(skillKey)) dis++;               // crit-injury penalties
  if (ch.state.criticalStress?.skillDisadvantage) dis++;                  // "Shakes? Me Too" (#6)
  return { adv, dis };
}
// A critical-stress effect can forbid skill rolls entirely (Ch04). Blocks until 1
// Resolve is recovered (which clears the stress effect). Roleplay-only effects don't set it.
const stressBlocksRolls = (ch) => !!ch.state?.criticalStress?.noSkillRolls;
const stressBlocksPush = (ch) => !!ch.state?.criticalStress?.noPush;
const netOf = (adv, dis) => Math.sign(adv - dis); // cancel 1:1, cap at one (Ch03)
// Pushing is a player-character move — NPC rolls are never pushed. [Solo Mode p.010]
const canPush = (rc) => rc?.kind !== "npc";
// "If you FAIL a Base Dice roll, you can push the roll." [Ch01 p016 / Ch03]
// A roll that already succeeded is finished — no push, no bane risk.
const pushable = (dice) => !D.PUSH_FAILED_ROLLS_ONLY || sumSucc(dice) < 1;

// Aiming grants advantage to the NEXT single shot only, then is spent. [Ch08 Careful Aim]
function consumeAiming(ch, skillKey) {
  if (skillKey === "firearms" && ch?.state?.conditions?.aiming) {
    delete ch.state.conditions.aiming;
    Store.save(ch);
  }
}

// ---- armor  [Ch04 / §3.7] -------------------------------------------------
// The armor a combatant is wearing (one suit only — the best rated one carried
// and, for PCs, equipped). NPC gear names are matched against the armor table.
export function armorFor(rc) {
  const names = rc.kind === "pc"
    ? (rc.pc?.inventory?.items || []).filter((it) => it.equipped).map((it) => it.key || it.name)
    : (rc.gear || []);
  const worn = [];
  for (const n of names) {
    const key = String(n).toLowerCase();
    const a = D.ARMOR.find((x) => x.key === n || x.name.toLowerCase() === key || (key.length > 3 && x.name.toLowerCase().includes(key)));
    if (a && a.rating) worn.push(a);
  }
  if (!worn.length) return null;
  // Only one suit counts — keep the best rating (A is best).
  return worn.sort((x, y) => D.LEVELS.indexOf(x.rating) - D.LEVELS.indexOf(y.rating))[0];
}
// Roll the armor: ARMOR_DICE dice of the rating; each success stops 1 damage.
export function rollArmor(armor, damage) {
  const dice = Array.from({ length: D.ARMOR_DICE }, () => makeDie(dsize(armor.rating)));
  const stopped = sumSucc(dice) * D.ARMOR_DAMAGE_PER_SUCCESS;
  const final = Math.max(0, damage - stopped);
  return { dice, stopped, final, negatesCrit: final === 0 };
}
function armorBlock(res, armor) {
  return el("div", { class: "armor-block" },
    el("div", { class: "card__eyebrow" }, `Armor — ${armor.name} (${armor.rating})`),
    diceRow(res.dice),
    el("div", { class: "muted" }, res.stopped
      ? `Stops ${res.stopped} damage → ${res.final} gets through${res.negatesCrit ? " · critical injury negated" : ""}.`
      : "Stops nothing."));
}

// Target-state modifiers on an attack  [§3.6]. `target` is a combatant record.
function targetMods(target, melee) {
  const conds = target?.conditions || {};
  let adv = 0, dis = 0;
  const notes = [];
  for (const c of D.CONDITIONS) {
    if (!conds[c.key]) continue;
    const e = c.effect || {};
    if (melee && e.attackerMeleeAdvantage) { adv++; notes.push(`${c.name}: +1 to you`); }
    if (!melee && e.attackerRangedDisadvantage) { dis++; notes.push(`${c.name}: −1 to you`); }
  }
  return { adv, dis, notes };
}
// The attacker's own conditions (e.g. Prone in close combat).
function selfMods(source, melee) {
  const conds = source?.conditions || {};
  let dis = 0; const notes = [];
  for (const c of D.CONDITIONS) {
    if (!conds[c.key]) continue;
    if (melee && (c.effect || {}).selfMeleeDisadvantage) { dis++; notes.push(`${c.name}: −1`); }
  }
  return { dis, notes };
}
const cannotDefend = (target) => D.CONDITIONS.some((c) => (target?.conditions || {})[c.key] && (c.effect || {}).cannotDefend);

// Apply push risk to the roller's own character. [Ch04 p071]
function applyPushRisk(ch, attrKey, banes) {
  if (banes <= 0) return null;
  const stress = ch.nature === "replicant" || attrKey === "INT" || attrKey === "EMP";
  if (stress) ch.state.resolve = Math.max(0, ch.state.resolve - banes);
  else ch.state.health = Math.max(0, ch.state.health - banes);
  reclampVitals(ch);
  Store.save(ch);
  return { stress, banes };
}

// ---- shared result rendering ----------------------------------------------
function diceRow(dice) {
  const row = el("div", { class: "dice" });
  for (const d of dice) {
    const cls = d.bane ? "die die--bane" : d.succ === 2 ? "die die--crit" : d.succ === 1 ? "die die--succ" : "die";
    row.append(el("span", { class: cls, title: `d${d.size}` }, d.face));
  }
  return row;
}
function outcomeLine(succ, banes) {
  const ok = succ >= 1, crit = succ >= 2;
  return el("div", { class: "roll-outcome" },
    el("span", { class: "roll-outcome__main " + (ok ? "is-succ" : "is-fail") }, ok ? (crit ? "Critical success" : "Success") : "Failure"),
    el("span", { class: "muted" }, `${succ} success${succ === 1 ? "" : "es"}${banes ? ` · ${banes} bane${banes === 1 ? "" : "s"}` : ""}`));
}

// ---- skill roll -----------------------------------------------------------
export function openSkillRoll(ch, skillKey, onDone) {
  if (isBrokenByDamage(ch)) { showToast("Broken (Damage) — no actions or skill rolls.", { kind: "warn" }); return; }
  if (stressBlocksRolls(ch)) { showToast(`Critical stress (${ch.state.criticalStress.name}) — no skill rolls until you recover Resolve.`, { kind: "warn" }); return; }
  const sk = R.skill(skillKey);
  const isManeuver = sk.attr === "MANEUVER";
  const st = { maneuver: MANEUVER_DEFAULT, adv: 0, dis: 0, keyMemory: false, phase: "config", dice: null, pushed: false, note: null };
  const attrKey = isManeuver ? "MANEUVER" : sk.attr;
  const auto = () => autoFor(ch, skillKey);
  const attrLevel = () => (isManeuver ? st.maneuver : ch.attributes[sk.attr]);

  modal({
    title: `Roll — ${sk.name}`,
    render(body, close) {
      const paint = () => { body.replaceChildren(); (st.phase === "config" ? config : result)(body, close); };
      const config = (b) => {
        const a = auto();
        // The badge must include every source the roll itself uses — key memory included.
        const advTotal = a.adv + st.adv + (st.keyMemory ? 1 : 0), disTotal = a.dis + st.dis;
        const net = netOf(advTotal, disTotal);
        b.append(el("p", { class: "muted" }, `Base Dice: ${R.attrDisplay(attrKey)} d${dsize(attrLevel())} + ${sk.name} d${dsize(ch.skills[skillKey])}.`));
        if (isManeuver) b.append(maneuverPicker(st, paint));
        b.append(advControls(st, a, paint));
        if (a.adv || a.dis) b.append(el("div", { class: "muted roll-auto" }, autoNote(ch, skillKey, a)));
        b.append(el("label", { class: "picker__row" },
          checkbox(st.keyMemory, () => { st.keyMemory = !st.keyMemory; paint(); }),
          el("span", {}, el("strong", {}, "Use key memory"), " — ", el("span", { class: "muted" }, "advantage (once per session; +1 stress if you still fail after pushing)"))));
        b.append(netBadge(net));
        b.append(el("div", { class: "modal__actions" },
          el("button", { class: "btn btn--ghost", onClick: () => close() }, "Cancel"),
          el("button", { class: "btn btn--primary", onClick: () => {
            const km = st.keyMemory ? 1 : 0;
            const n = netOf(a.adv + st.adv + km, a.dis + st.dis);
            st.dice = poolFor(dsize(attrLevel()), dsize(ch.skills[skillKey]), n);
            consumeAiming(ch, skillKey); // spend the aim on this shot
            logRoll({ label: sk.name, text: outcomeSummary(sumSucc(st.dice), sumBane(st.dice)), charId: ch.id, charName: ch.name, source: "sheet" });
            st.phase = "result"; paint();
          } }, "⚄ Roll")));
      };
      const result = (b) => {
        const succ = sumSucc(st.dice), banes = sumBane(st.dice);
        b.append(diceRow(st.dice));
        b.append(outcomeLine(succ, banes));
        if (st.note) b.append(el("div", { class: "roll-risk" }, st.note));
        const actions = el("div", { class: "modal__actions" });
        if (!st.pushed && pushable(st.dice) && !stressBlocksPush(ch)) actions.append(el("button", { class: "btn btn--roll", onClick: () => {
          st.dice = pushPool(st.dice); st.pushed = true;
          const nb = sumBane(st.dice), ns = sumSucc(st.dice);
          const risk = applyPushRisk(ch, attrKey, nb);
          let msg = risk ? `Push: ${risk.banes} ${risk.stress ? "stress" : "damage"} taken.` : "Push: no banes.";
          if (st.keyMemory && ns < 1) { ch.state.resolve = Math.max(0, ch.state.resolve - 1); reclampVitals(ch); Store.save(ch); msg += " Key memory failed: +1 stress."; }
          logRoll({ label: `${sk.name} (push)`, text: outcomeSummary(ns, nb), charId: ch.id, charName: ch.name, source: "sheet" });
          st.note = msg; paint();
        } }, "↻ Push the roll"));
        actions.append(el("button", { class: "btn btn--primary", onClick: () => close() }, "Done"));
        b.append(actions);
      };
      paint();
    },
    onClose: () => onDone && onDone(),
  });
}

// ---- opposed skill roll  [§3.1/§3.4] --------------------------------------
// Stealth↔Observation, Manipulation↔Insight, Interrogation↔Stamina, the
// Voight-Kampff test, and anything else the table calls for. Both sides roll
// Base Dice; most successes wins; a tie goes to the side being opposed. Only the
// initiator may push.
export function openOpposedSkillRoll(ch, onDone) {
  if (isBrokenByDamage(ch)) { showToast("Broken (Damage) — no actions or skill rolls.", { kind: "warn" }); return; }
  if (stressBlocksRolls(ch)) { showToast(`Critical stress (${ch.state.criticalStress.name}) — no skill rolls until you recover Resolve.`, { kind: "warn" }); return; }
  const st = { mine: "manipulation", theirSkillKey: "insight", theirAttr: "C", theirSkill: "C",
    adv: 0, dis: 0, theirAdv: 0, theirDis: 0, phase: "config", mineDice: null, theirDice: null, pushed: false, note: null };

  modal({
    title: "Opposed roll",
    render(body, close) {
      const paint = () => { body.replaceChildren(); (st.phase === "config" ? config : result)(body, close); };
      const config = (b) => {
        const sk = R.skill(st.mine);
        const a = autoFor(ch, st.mine);
        b.append(el("div", { class: "field" }, el("label", { class: "field__label" }, "Your skill"),
          el("div", { class: "chips" }, ...D.SKILLS.filter((s) => s.attr !== "MANEUVER").map((s) =>
            el("button", { class: "chip chip--sm" + (st.mine === s.key ? " chip--on" : ""), onClick: () => { st.mine = s.key; paint(); } }, s.name)))));
        b.append(el("p", { class: "muted" }, `${R.attrDisplay(sk.attr)} d${dsize(ch.attributes[sk.attr])} + ${sk.name} d${dsize(ch.skills[st.mine])}`));
        b.append(advControls(st, a, paint));
        if (a.adv || a.dis) b.append(el("div", { class: "muted roll-auto" }, autoNote(ch, st.mine, a)));
        b.append(el("hr"));
        b.append(el("div", { class: "field" }, el("label", { class: "field__label" }, "Opposing skill"),
          el("div", { class: "chips" }, ...D.SKILLS.filter((s) => s.attr !== "MANEUVER").map((s) =>
            el("button", { class: "chip chip--sm" + (st.theirSkillKey === s.key ? " chip--on" : ""), onClick: () => { st.theirSkillKey = s.key; paint(); } }, s.name)))));
        b.append(levelPicker("Their attribute", st.theirAttr, (lv) => { st.theirAttr = lv; paint(); }));
        b.append(levelPicker("Their skill", st.theirSkill, (lv) => { st.theirSkill = lv; paint(); }));
        b.append(stepRow("Their advantages", st.theirAdv, () => { if (st.theirAdv > 0) st.theirAdv--; paint(); }, () => { st.theirAdv++; paint(); }));
        b.append(stepRow("Their disadvantages", st.theirDis, () => { if (st.theirDis > 0) st.theirDis--; paint(); }, () => { st.theirDis++; paint(); }));
        b.append(netBadge(netOf(a.adv + st.adv, a.dis + st.dis)));
        b.append(el("div", { class: "modal__actions" },
          el("button", { class: "btn btn--ghost", onClick: () => close() }, "Cancel"),
          el("button", { class: "btn btn--primary", onClick: () => {
            st.mineDice = poolFor(dsize(ch.attributes[sk.attr]), dsize(ch.skills[st.mine]), netOf(a.adv + st.adv, a.dis + st.dis));
            st.theirDice = poolFor(dsize(st.theirAttr), dsize(st.theirSkill), netOf(st.theirAdv, st.theirDis));
            consumeAiming(ch, st.mine);
            logRoll({ label: `Opposed — ${sk.name} vs ${R.skillName(st.theirSkillKey)}`,
              text: `${sumSucc(st.mineDice)}–${sumSucc(st.theirDice)}`, charId: ch.id, charName: ch.name, source: "sheet" });
            st.phase = "result"; paint();
          } }, "⚄ Roll opposed")));
      };
      const result = (b) => {
        const mine = sumSucc(st.mineDice), theirs = sumSucc(st.theirDice);
        b.append(el("div", { class: "card__eyebrow" }, `You — ${R.skillName(st.mine)} (${mine})`));
        b.append(diceRow(st.mineDice));
        b.append(el("div", { class: "card__eyebrow" }, `Them — ${R.skillName(st.theirSkillKey)} (${theirs})`));
        b.append(diceRow(st.theirDice));
        b.append(el("div", { class: "roll-outcome" },
          el("span", { class: "roll-outcome__main " + (mine > theirs ? "is-succ" : "is-fail") },
            mine > theirs ? "You win the opposition" : "They hold"),
          el("span", { class: "muted" }, mine === theirs ? "Tied — a tie goes to the side being opposed." : `${mine} vs ${theirs}`)));
        if (st.note) b.append(el("div", { class: "roll-risk" }, st.note));
        const actions = el("div", { class: "modal__actions" });
        // Only the initiator may push an opposed roll. [§3.1]
        if (!st.pushed && mine <= theirs && !stressBlocksPush(ch)) actions.append(el("button", { class: "btn btn--roll", onClick: () => {
          st.mineDice = pushPool(st.mineDice); st.pushed = true;
          const risk = applyPushRisk(ch, R.skill(st.mine).attr, sumBane(st.mineDice));
          st.note = risk ? `Push: ${risk.banes} ${risk.stress ? "stress" : "damage"} taken.` : "Push: no banes.";
          logRoll({ label: `Opposed — ${R.skillName(st.mine)} (push)`, text: `${sumSucc(st.mineDice)}–${theirs}`, charId: ch.id, charName: ch.name, source: "sheet" });
          paint();
        } }, "↻ Push (initiator only)"));
        actions.append(el("button", { class: "btn btn--primary", onClick: () => close() }, "Done"));
        b.append(actions);
      };
      paint();
    },
    onClose: () => onDone && onDone(),
  });
}
function levelPicker(label, value, onPick) {
  return el("div", { class: "field" }, el("label", { class: "field__label" }, label),
    el("div", { class: "chips" }, ...D.LEVELS.map((lv) =>
      el("button", { class: "chip" + (value === lv ? " chip--on" : ""), onClick: () => onPick(lv) }, `${lv} · d${dsize(lv)}`))));
}

// ---- procedural roll (death save, stabilize, first aid, baseline) ---------
// Preset advantage/disadvantage, controllable push, resolves via onResult with
// { successes, banes, pushed }. Does NOT block on Broken (death saves are allowed
// while Broken — the caller sets allowPush=false in that case). [Ch04 p071/075]
export function proceduralRoll(ch, { skillKey, title, adv = 0, dis = 0, allowPush = true, note = null, onResult }) {
  const sk = R.skill(skillKey);
  const attrLv = ch.attributes[sk.attr] || "C";
  const net = netOf(adv, dis);
  const st = { dice: null, pushed: false, msg: null };
  modal({
    title: title || `Roll — ${sk.name}`,
    render(body, close) {
      const paint = () => { body.replaceChildren(); view(body, close); };
      const view = (b) => {
        if (!st.dice) {
          b.append(el("p", { class: "muted" }, `${sk.name}: ${R.attrDisplay(sk.attr)} d${dsize(attrLv)} + d${dsize(ch.skills[skillKey])}.`));
          if (note) b.append(el("div", { class: "roll-auto muted" }, note));
          b.append(netBadge(net));
          b.append(el("div", { class: "modal__actions" },
            el("button", { class: "btn btn--ghost", onClick: () => close() }, "Cancel"),
            el("button", { class: "btn btn--primary", onClick: () => { st.dice = poolFor(dsize(attrLv), dsize(ch.skills[skillKey]), net); logRoll({ label: title || sk.name, text: outcomeSummary(sumSucc(st.dice), sumBane(st.dice)), charId: ch.id, charName: ch.name, source: "sheet" }); paint(); } }, "⚄ Roll")));
          return;
        }
        b.append(diceRow(st.dice));
        b.append(outcomeLine(sumSucc(st.dice), sumBane(st.dice)));
        if (st.msg) b.append(el("div", { class: "roll-risk" }, st.msg));
        const actions = el("div", { class: "modal__actions" });
        if (allowPush && !st.pushed && pushable(st.dice)) actions.append(el("button", { class: "btn btn--roll", onClick: () => {
          st.dice = pushPool(st.dice); st.pushed = true;
          const risk = applyPushRisk(ch, sk.attr, sumBane(st.dice));
          st.msg = risk ? `Push: ${risk.banes} ${risk.stress ? "stress" : "damage"} taken.` : "Push: no banes.";
          logRoll({ label: `${title || sk.name} (push)`, text: outcomeSummary(sumSucc(st.dice), sumBane(st.dice)), charId: ch.id, charName: ch.name, source: "sheet" });
          paint();
        } }, "↻ Push"));
        actions.append(el("button", { class: "btn btn--primary", onClick: () => { close(); onResult && onResult({ successes: sumSucc(st.dice), banes: sumBane(st.dice), pushed: st.pushed }); } }, "Apply result"));
        b.append(actions);
      };
      paint();
    },
  });
}

// ---- attack roll ----------------------------------------------------------
function matchWeapon(item, allWeapons) {
  if (!item) return null;
  const lower = (item.name || "").toLowerCase().trim();
  let w = allWeapons.find((x) => (item.key && x.key === item.key) || x.name?.toLowerCase() === lower);
  if (!w && (lower.includes("pk-d") || lower.includes("blaster"))) {
    w = allWeapons.find((x) => x.key === "pkd_44");
  }
  if (!w && (lower.includes(".357") || lower.includes("subcompact") || lower.includes("revolver") || lower.includes("magnum"))) {
    w = allWeapons.find((x) => x.key === "subcompact_357");
  }
  if (!w && lower) {
    w = allWeapons.find((x) => x.name.toLowerCase().includes(lower) || lower.includes(x.name.toLowerCase()));
  }
  return w || null;
}

export function openWeaponPicker(ch, onDone) {
  if (isBrokenByDamage(ch)) { showToast("Broken (Damage) — no actions or skill rolls.", { kind: "warn" }); return; }
  if (stressBlocksRolls(ch)) { showToast(`Critical stress (${ch.state.criticalStress.name}) — no skill rolls until you recover Resolve.`, { kind: "warn" }); return; }
  const allWeapons = D.WEAPONS || [...(D.WEAPONS_MELEE || []), ...(D.WEAPONS_RANGED || [])];
  const armedWeapons = [];
  const inventoryWeapons = [];
  for (const item of ch.inventory?.items || []) {
    const w = matchWeapon(item, allWeapons);
    if (w) {
      const wCopy = { ...w, equipped: !!item.equipped };
      if (item.equipped) {
        if (!armedWeapons.some((x) => x.key === w.key)) armedWeapons.push(wCopy);
      } else {
        if (!inventoryWeapons.some((x) => x.key === w.key) && !armedWeapons.some((x) => x.key === w.key)) {
          inventoryWeapons.push(wCopy);
        }
      }
    }
  }
  const unarmed = allWeapons.find((x) => x.key === "unarmed") || { key: "unarmed", name: "Unarmed Strike", type: "crushing", damage: 1, critDie: "STR" };
  if (!armedWeapons.length && !inventoryWeapons.length) {
    armedWeapons.push({ ...unarmed, equipped: true });
  } else if (!armedWeapons.some((x) => x.key === "unarmed") && !inventoryWeapons.some((x) => x.key === "unarmed")) {
    armedWeapons.push({ ...unarmed, equipped: true });
  }

  modal({
    title: "Choose a weapon",
    render(body, close) {
      const list = el("div", { class: "picker" });
      if (armedWeapons.length) {
        body.append(el("div", { class: "card__eyebrow" }, "Armed & Ready (Equipped)"));
        for (const w of armedWeapons) {
          list.append(el("button", { class: "list__row list__row--armed", onClick: () => { close(); openAttackRoll(ch, w, onDone); } },
            el("span", { class: "list__main" }, w.name, el("span", { class: "badge", style: "margin-left: .5rem; font-size: 0.75em; background: var(--cyan); color: var(--bg);" }, "● Armed")),
            el("span", { class: "list__sub muted" }, weaponLine(w))));
        }
      }
      if (inventoryWeapons.length) {
        body.append(el("div", { class: "card__eyebrow", style: "margin-top: 0.75rem;" }, "Stowed Inventory Weapons"));
        for (const w of inventoryWeapons) {
          list.append(el("button", { class: "list__row", onClick: () => { close(); openAttackRoll(ch, w, onDone); } },
            el("span", { class: "list__main" }, w.name),
            el("span", { class: "list__sub muted" }, weaponLine(w))));
        }
      }
      if (armedWeapons.length || inventoryWeapons.length) body.append(list);

      const group = (label, wList) => {
        const box = el("details", { class: "rules__group", open: !armedWeapons.length && label === "Ranged" });
        box.append(el("summary", {}, label));
        for (const w of wList) box.append(el("button", { class: "list__row", onClick: () => { close(); openAttackRoll(ch, w, onDone); } },
          el("span", { class: "list__main" }, w.name),
          el("span", { class: "list__sub muted" }, weaponLine(w))));
        return box;
      };
      body.append(group("Ranged", D.WEAPONS_RANGED));
      body.append(group("Close combat", D.WEAPONS_MELEE));
      body.append(group("Thrown / explosives", D.EXPLOSIVES.filter((e) => e.thrown)));
    },
    onClose: () => onDone && onDone(),
  });
}

export function openAttackRoll(ch, weapon, onDone) {
  if (isBrokenByDamage(ch)) { showToast("Broken (Damage) — no actions or skill rolls.", { kind: "warn" }); return; }
  if (stressBlocksRolls(ch)) { showToast(`Critical stress (${ch.state.criticalStress.name}) — no skill rolls until you recover Resolve.`, { kind: "warn" }); return; }
  const melee = D.WEAPONS_MELEE.some((w) => w.key === weapon.key);
  const skillKey = melee ? "hand_to_hand" : "firearms";
  const sk = R.skill(skillKey);
  const st = { adv: 0, dis: 0, phase: "config", dice: null, pushed: false, note: null, crit: null };

  modal({
    title: `Attack — ${weapon.name}`,
    render(body, close) {
      const paint = () => { body.replaceChildren(); (st.phase === "config" ? config : result)(body, close); };
      const config = (b) => {
        const a = autoFor(ch, skillKey);
        const net = netOf(a.adv + st.adv, a.dis + st.dis);
        b.append(el("p", { class: "muted" }, `${melee ? "Close combat" : "Ranged"} · ${sk.name}: ${R.attrDisplay(sk.attr)} d${dsize(ch.attributes[sk.attr])} + d${dsize(ch.skills[skillKey])}. ${weaponLine(weapon)}`));
        if (melee) b.append(el("div", { class: "muted roll-auto" }, "Close combat is opposed in play — resolve the defender in the combat tracker. This rolls your side."));
        b.append(advControls(st, a, paint));
        if (a.adv || a.dis) b.append(el("div", { class: "muted roll-auto" }, autoNote(ch, skillKey, a)));
        b.append(netBadge(net));
        b.append(el("div", { class: "modal__actions" },
          el("button", { class: "btn btn--ghost", onClick: () => close() }, "Cancel"),
          el("button", { class: "btn btn--primary", onClick: () => {
            const n = netOf(a.adv + st.adv, a.dis + st.dis);
            st.dice = poolFor(dsize(ch.attributes[sk.attr]), dsize(ch.skills[skillKey]), n);
            consumeAiming(ch, skillKey); // spend the aim on this shot
            logRoll({ label: `Attack — ${weapon.name}`, text: outcomeSummary(sumSucc(st.dice), sumBane(st.dice)), charId: ch.id, charName: ch.name, source: "sheet" });
            st.phase = "result"; paint();
          } }, "⚄ Attack")));
      };
      const result = (b) => {
        const succ = sumSucc(st.dice), banes = sumBane(st.dice);
        b.append(diceRow(st.dice));
        b.append(outcomeLine(succ, banes));
        if (succ >= 1) b.append(damageBlock(ch, weapon, succ));
        if (st.note) b.append(el("div", { class: "roll-risk" }, st.note));
        const actions = el("div", { class: "modal__actions" });
        if (!st.pushed && pushable(st.dice) && !stressBlocksPush(ch)) actions.append(el("button", { class: "btn btn--roll", onClick: () => {
          st.dice = pushPool(st.dice); st.pushed = true;
          const risk = applyPushRisk(ch, sk.attr, sumBane(st.dice));
          st.note = risk ? `Push: ${risk.banes} ${risk.stress ? "stress" : "damage"} taken.` : "Push: no banes.";
          logRoll({ label: `Attack — ${weapon.name} (push)`, text: outcomeSummary(sumSucc(st.dice), sumBane(st.dice)), charId: ch.id, charName: ch.name, source: "sheet" });
          paint();
        } }, "↻ Push the roll"));
        actions.append(el("button", { class: "btn btn--primary", onClick: () => close() }, "Done"));
        b.append(actions);
      };
      paint();
    },
    onClose: () => onDone && onDone(),
  });
}

// Damage + guided critical-injury roll for a hit. [§3.7]
// `succ` is the effective success count (for opposed rolls, the margin over the
// defender). `showDamageLine=false` lets opposed melee suppress the duplicate
// damage figure it already prints in the outcome line.
function damageBlock(ch, weapon, succ, { showDamageLine = true, onApplyCrit = null, blocked = false } = {}) {
  const box = el("div", { class: "dmg" });
  if (weapon.damage == null || typeof weapon.damage !== "number") {
    box.append(el("div", { class: "dmg__val" }, weapon.note || "Special effect — see weapon.")); return box;
  }
  const dmg = weapon.damage + Math.max(0, succ - 1); // +1 per extra success
  if (showDamageLine) box.append(el("div", { class: "dmg__val" }, `Damage to target: ${dmg}`, el("span", { class: "muted" }, ` (base ${weapon.damage}${succ > 1 ? ` +${succ - 1}` : ""})`)));
  const canCrit = succ >= 2 && weapon.critDie && (weapon.type === "piercing" || weapon.type === "crushing");
  if (!canCrit) return box;
  if (blocked) { // armor stopped all the damage — no critical injury [Ch04]
    box.append(el("div", { class: "muted" }, "Armor absorbed the hit — no critical injury."));
    return box;
  }
  const size = weapon.critDie === "STR" ? dsize(ch.attributes.STR) : weapon.critDie;
  const killer = (ch.specialties || []).some((s) => (s === "killer" || s?.key === "killer"));
  const nDice = 1 + Math.max(0, succ - 2) + (killer ? 1 : 0); // extra successes/Killer = extra crit dice, choose
  const crits = el("div", { class: "crit-picks" });
  const rollCrit = el("button", { class: "btn btn--sm btn--roll" }, `Roll critical injury (${nDice}× d${size}, choose)`);
  rollCrit.addEventListener("click", () => {
    crits.replaceChildren();
    for (let i = 0; i < nDice; i++) {
      const face = rollDie(size);
      const entry = R.critEntry(weapon.type, face);
      const row = el("div", { class: "crit-pick" },
        el("span", { class: "crit-pick__roll" }, `d${size}=${face}`),
        el("span", {}, el("strong", {}, entry?.injury || "—"),
          entry ? el("span", { class: "muted" }, ` — ${entry.effect}${entry.instantKill ? " (instant kill)" : entry.lethal ? ` (lethal, ${entry.deathSave || "—"} save)` : ""}`) : null));
      if (onApplyCrit && entry) {
        row.append(el("button", { class: "btn btn--sm btn--danger", onClick: () => onApplyCrit(entry, weapon.type, face) }, "Apply"));
      }
      crits.append(row);
    }
  });
  box.append(rollCrit, crits);
  return box;
}

// Write a rolled critical injury onto a combatant (PC character record or the
// NPC's tracker entry).  [§3.7]
export function applyCritToCombatant(target, entry, type, face, commit) {
  const inj = { id: "inj-" + Date.now(), injury: entry.injury, type, roll: face, lethal: !!entry.lethal,
    deathSave: entry.deathSave || null, instantKill: !!entry.instantKill, healing: entry.healing,
    effect: entry.effect, disadvantage: entry.disadvantage || [], flag: entry.flag || null, stabilized: false };
  if (target.kind === "pc" && target.charId) {
    const pc = Store.get(target.charId);
    if (pc) {
      pc.state.criticalInjuries = [...(pc.state.criticalInjuries || []), inj];
      if (entry.instantKill) { pc.state.dead = true; pc.state.health = 0; }
      reclampVitals(pc); Store.save(pc);
    }
  }
  commit((s) => {
    const t = s.combatants.find((x) => x.id === target.id);
    if (!t) return;
    t.criticalInjuries = [...(t.criticalInjuries || []), inj];
    if (entry.instantKill) t.health = 0;
  });
  showToast(`${target.name}: ${entry.injury}${entry.instantKill ? " — killed outright" : ""}`, { kind: "warn", timeout: 4500 });
}

// ---- small UI bits --------------------------------------------------------
function advControls(st, auto, paint) {
  return el("div", { class: "adv-ctrl" },
    stepRow("Advantages", auto.adv + st.adv, () => { if (st.adv > -auto.adv) st.adv--; paint(); }, () => { st.adv++; paint(); }),
    stepRow("Disadvantages", auto.dis + st.dis, () => { if (st.dis > -auto.dis) st.dis--; paint(); }, () => { st.dis++; paint(); }));
}
function stepRow(label, val, dec, inc) {
  return el("div", { class: "adv-row" },
    el("span", {}, label),
    el("span", { class: "stepper__ctrl" },
      el("button", { class: "btn btn--sm", "aria-label": `decrease ${label}`, onClick: dec }, "−"),
      el("span", { class: "adv-row__val" }, val),
      el("button", { class: "btn btn--sm", "aria-label": `increase ${label}`, onClick: inc }, "+")));
}
function maneuverPicker(st, paint) {
  const sel = el("div", { class: "chips" });
  for (const lv of D.LEVELS) sel.append(el("button", { class: "chip" + (st.maneuver === lv ? " chip--on" : ""), onClick: () => { st.maneuver = lv; paint(); } }, `${lv} · d${dsize(lv)}`));
  return el("div", { class: "field" }, el("label", { class: "field__label" }, "Vehicle Maneuverability"), sel);
}
function netBadge(net) {
  const txt = net > 0 ? "Net: Advantage (+1 die)" : net < 0 ? "Net: Disadvantage (remove lower die)" : "Net: even (two Base Dice)";
  return el("div", { class: "net-badge" + (net > 0 ? " net-badge--adv" : net < 0 ? " net-badge--dis" : "") }, txt);
}
function autoNote(ch, skillKey, a) {
  const parts = [];
  if (a.adv && ch.state.conditions?.aiming && skillKey === "firearms") parts.push("Aiming: +1 advantage");
  for (const c of D.CONDITIONS)
    if (ch.state.conditions?.[c.key] && c.effect?.selfMeleeDisadvantage && skillKey === "hand_to_hand") parts.push(`${c.name}: −1`);
  for (const inj of ch.state.criticalInjuries || []) if ((inj.disadvantage || []).includes(skillKey)) parts.push(`${inj.injury}: −1`);
  if (ch.state.criticalStress?.skillDisadvantage) parts.push(`${ch.state.criticalStress.name}: −1`);
  return "Auto from state — " + (parts.join("; ") || "none");
}
function checkbox(on, onChange) { const i = el("input", { type: "checkbox", checked: on || null }); i.addEventListener("change", onChange); return i; }
function weaponLine(w) {
  const rng = w.minRange ? `${titleCase(w.minRange)}–${titleCase(w.maxRange)}` : w.maxRange ? `≤${titleCase(w.maxRange)}` : "—";
  const crit = w.critDie ? ` · Crit ${w.critDie === "STR" ? "STR" : "d" + w.critDie}` : "";
  return `${w.damage != null ? "Dmg " + w.damage : "Special"}${crit}${w.type ? " · " + titleCase(w.type) : ""} · ${rng}${w.fullAuto ? " · full-auto" : ""}`;
}

// ---- in-combat rolling helpers for PCs & NPCs -----------------------------
function resolveCombatant(c) {
  const allWeapons = D.WEAPONS || [...(D.WEAPONS_MELEE || []), ...(D.WEAPONS_RANGED || [])];
  if (c.kind === "pc") {
    const pc = Store.get(c.charId);
    if (pc) {
      const armedWeapons = [];
      const inventoryWeapons = [];
      for (const item of pc.inventory?.items || []) {
        const w = matchWeapon(item, allWeapons);
        if (w) {
          const wCopy = { ...w, equipped: !!item.equipped };
          if (item.equipped) {
            if (!armedWeapons.some((x) => x.key === w.key)) armedWeapons.push(wCopy);
          } else {
            if (!inventoryWeapons.some((x) => x.key === w.key) && !armedWeapons.some((x) => x.key === w.key)) {
              inventoryWeapons.push(wCopy);
            }
          }
        }
      }
      const unarmed = allWeapons.find((x) => x.key === "unarmed") || { key: "unarmed", name: "Unarmed Strike", type: "crushing", damage: 1, critDie: "STR" };
      if (!armedWeapons.length && !inventoryWeapons.length) {
        armedWeapons.push({ ...unarmed, equipped: true });
      } else if (!armedWeapons.some((x) => x.key === "unarmed") && !inventoryWeapons.some((x) => x.key === "unarmed")) {
        armedWeapons.push({ ...unarmed, equipped: true });
      }
      const weapons = [...armedWeapons, ...inventoryWeapons];
      return { pc, kind: "pc", name: c.name, id: c.id, nature: pc.nature, attributes: pc.attributes, skills: pc.skills, armedWeapons, inventoryWeapons, weapons, gear: (pc.inventory?.items || []).map((it) => it.name) };
    }
  }
  const npc = NPCS.find((n) => n.key === c.npcKey) || { attrs: { STR: "C", AGI: "C", INT: "C", EMP: "C" }, skills: {}, gear: [] };
  const attributes = { STR: npc.attrs?.STR || "C", AGI: npc.attrs?.AGI || "C", INT: npc.attrs?.INT || "C", EMP: npc.attrs?.EMP || "C" };
  const skills = {};
  for (const sk of D.SKILLS) skills[sk.key] = npc.skills?.[sk.key] || "D";
  const weapons = [];
  for (const gName of npc.gear || []) {
    const w = matchWeapon({ name: gName }, allWeapons);
    if (w && !weapons.some((existing) => existing.key === w.key)) weapons.push({ ...w, equipped: true });
  }
  const unarmed = allWeapons.find((x) => x.key === "unarmed") || { key: "unarmed", name: "Unarmed Strike", type: "crushing", damage: 1, critDie: "STR" };
  if (!weapons.length) weapons.push({ ...unarmed, equipped: true });
  else if (!weapons.some((x) => x.key === "unarmed")) weapons.push({ ...unarmed, equipped: true });
  return { pc: null, kind: "npc", name: c.name, id: c.id, nature: c.nature || "human", attributes, skills, armedWeapons: weapons, inventoryWeapons: [], weapons, gear: npc.gear || [] };
}

// Armor worn by a tracker combatant (used by the combat card + attack flows).
export function armorForCombatant(c) {
  try { return armorFor(resolveCombatant(c)); } catch { return null; }
}

// Roll a critical injury onto a combatant — used when damage lands on someone
// who is already Broken (§3.7), and available manually from the tracker.
export function rollCritOnCombatant(c, commit) {
  const st = { type: "piercing", die: 12 };
  modal({
    title: `Critical injury — ${c.name}`,
    render(body, close) {
      const paint = () => { body.replaceChildren(); view(body); };
      const view = (b) => {
        b.append(el("p", { class: "muted" }, "Roll the attacker's Crit Die on the damage-type table (blunt weapons use the attacker's Strength die)."));
        b.append(el("div", { class: "field" }, el("label", { class: "field__label" }, "Damage type"),
          el("div", { class: "chips" }, ...["piercing", "crushing"].map((t) =>
            el("button", { class: "chip" + (st.type === t ? " chip--on" : ""), onClick: () => { st.type = t; paint(); } }, titleCase(t))))));
        b.append(el("div", { class: "field" }, el("label", { class: "field__label" }, "Crit Die"),
          el("div", { class: "chips" }, ...D.DIE_SIZES.map((d) =>
            el("button", { class: "chip" + (st.die === d ? " chip--on" : ""), onClick: () => { st.die = d; paint(); } }, `d${d}`)))));
        b.append(el("div", { class: "modal__actions" },
          el("button", { class: "btn btn--ghost", onClick: () => close() }, "Cancel"),
          el("button", { class: "btn btn--primary", onClick: () => {
            const face = rollDie(st.die);
            const entry = R.critEntry(st.type, face);
            close();
            applyCritToCombatant(c, entry, st.type, face, commit);
            logRoll({ label: `Critical injury — ${c.name}`, text: `d${st.die}=${face} · ${entry.injury}`, charId: c.charId || null, charName: c.name, source: "combat" });
          } }, "⚄ Roll injury")));
      };
      paint();
    },
  });
}

export function rollCombatSkill(c, commit) {
  if (c.health <= 0) { showToast(`${c.name} is Broken — skill rolls blocked.`, { kind: "warn" }); return; }
  const rc = resolveCombatant(c);
  modal({
    title: `Combat Skill — ${c.name}`,
    render(body, close) {
      body.append(el("p", { class: "muted" }, "Choose a skill to roll for this combatant:"));
      const list = el("div", { class: "picker" });
      for (const sk of D.SKILLS) {
        const attrLv = rc.attributes[sk.attr] || "C";
        const skLv = rc.skills[sk.key] || "D";
        list.append(el("button", { class: "list__row", onClick: () => {
          close();
          openCombatSkillExecute(c, rc, sk, attrLv, skLv, commit);
        } },
          el("span", { class: "list__main" }, sk.name),
          el("span", { class: "list__sub muted" }, `${sk.attr} d${dsize(attrLv)} + d${dsize(skLv)}`)));
      }
      body.append(list);
      body.append(el("div", { class: "modal__actions" }, el("button", { class: "btn btn--ghost", onClick: () => close() }, "Cancel")));
    }
  });
}

function openCombatSkillExecute(c, rc, sk, attrLv, skLv, commit) {
  const st = { adv: 0, dis: 0, phase: "config", dice: null, pushed: false, note: null };
  modal({
    title: `${sk.name} — ${c.name}`,
    render(body, close) {
      const paint = () => { body.replaceChildren(); (st.phase === "config" ? config : result)(body, close); };
      const config = (b) => {
        b.append(el("p", { class: "muted" }, `${sk.name}: ${R.attrDisplay(sk.attr)} d${dsize(attrLv)} + d${dsize(skLv)}.`));
        b.append(advControls(st, { adv: 0, dis: 0 }, paint));
        const net = netOf(st.adv, st.dis);
        b.append(netBadge(net));
        b.append(el("div", { class: "modal__actions" },
          el("button", { class: "btn btn--ghost", onClick: () => close() }, "Cancel"),
          el("button", { class: "btn btn--primary", onClick: () => {
            st.dice = poolFor(dsize(attrLv), dsize(skLv), net);
            logRoll({ label: `${sk.name} — ${c.name}`, text: outcomeSummary(sumSucc(st.dice), sumBane(st.dice)), charId: rc.pc?.id || null, charName: c.name, source: "combat" });
            st.phase = "result"; paint();
          } }, "⚄ Roll")));
      };
      const result = (b) => {
        const succ = sumSucc(st.dice), banes = sumBane(st.dice);
        b.append(diceRow(st.dice));
        b.append(outcomeLine(succ, banes));
        if (st.note) b.append(el("div", { class: "roll-risk" }, st.note));
        const actions = el("div", { class: "modal__actions" });
        if (!st.pushed && canPush(rc) && pushable(st.dice)) actions.append(el("button", { class: "btn btn--roll", onClick: () => {
          st.dice = pushPool(st.dice); st.pushed = true;
          const nb = sumBane(st.dice);
          if (rc.kind === "pc" && rc.pc) {
            const risk = applyPushRisk(rc.pc, sk.attr, nb);
            st.note = risk ? `Push: ${risk.banes} ${risk.stress ? "stress" : "damage"} taken.` : "Push: no banes.";
            commit((s) => { const tgt = s.combatants.find((x) => x.id === c.id); if (tgt) tgt.health = rc.pc.state.health; });
          } else if (rc.kind === "npc" && (sk.attr === "STR" || sk.attr === "AGI") && nb > 0) {
            st.note = `Push: ${nb} damage taken to Health.`;
            commit((s) => { const tgt = s.combatants.find((x) => x.id === c.id); if (tgt) tgt.health = Math.max(0, tgt.health - nb); });
          } else {
            st.note = nb > 0 ? `Push: ${nb} stress banes ignored for NPC.` : "Push: no banes.";
          }
          paint();
        } }, "↻ Push the roll"));
        actions.append(el("button", { class: "btn btn--primary", onClick: () => close() }, "Done"));
        b.append(actions);
      };
      paint();
    }
  });
}

export function rollCombatAttack(c, commit) {
  if (c.health <= 0) { showToast(`${c.name} is Broken — attack rolls blocked.`, { kind: "warn" }); return; }
  const rc = resolveCombatant(c);
  modal({
    title: `Combat Attack — ${c.name}`,
    render(body, close) {
      body.append(el("p", { class: "muted" }, "Select weapon to attack with:"));
      const list = el("div", { class: "picker" });
      if (rc.armedWeapons && rc.armedWeapons.length) {
        body.append(el("div", { class: "card__eyebrow" }, "Armed & Ready (Equipped)"));
        for (const w of rc.armedWeapons) list.append(weaponPickRow(w, c, rc, commit, close, true));
      } else if (rc.weapons && rc.weapons.length) {
        body.append(el("div", { class: "card__eyebrow" }, "Ready Weapons"));
        for (const w of rc.weapons) list.append(weaponPickRow(w, c, rc, commit, close, false));
      }
      if (rc.inventoryWeapons && rc.inventoryWeapons.length) {
        body.append(el("div", { class: "card__eyebrow", style: "margin-top: 0.75rem;" }, "Stowed Inventory Weapons"));
        for (const w of rc.inventoryWeapons) list.append(weaponPickRow(w, c, rc, commit, close, false));
      }
      const group = (label, wList) => {
        const box = el("details", { class: "rules__group" });
        box.append(el("summary", {}, label));
        for (const w of wList) box.append(weaponPickRow(w, c, rc, commit, close, false));
        return box;
      };
      body.append(list);
      body.append(group("All Ranged Weapons", D.WEAPONS_RANGED));
      body.append(group("All Melee Weapons", D.WEAPONS_MELEE));
      body.append(el("div", { class: "modal__actions" }, el("button", { class: "btn btn--ghost", onClick: () => close() }, "Cancel")));
    }
  });
}

function weaponPickRow(w, c, rc, commit, close, isArmed = false) {
  const badge = isArmed ? el("span", { class: "badge", style: "margin-left: .5rem; font-size: 0.75em; background: var(--cyan); color: var(--bg);" }, "● Armed") : null;
  return el("button", { class: "list__row" + (isArmed ? " list__row--armed" : ""), onClick: () => {
    close();
    const melee = D.WEAPONS_MELEE.some((x) => x.key === w.key);
    if (melee) openOpposedMelee(c, rc, w, commit);
    else openRangedAttack(c, rc, w, commit);
  } },
    el("span", { class: "list__main" }, w.name, badge),
    el("span", { class: "list__sub muted" }, weaponLine(w)));
}

function openRangedAttack(c, rc, w, commit) {
  const skKey = "firearms";
  const sk = R.skill(skKey);
  const attrLv = rc.attributes.AGI || "C";
  const skLv = rc.skills[skKey] || "D";
  const enemies = Combat.get().combatants.filter((x) => x.id !== c.id && x.health > 0);
  const st = { adv: 0, dis: 0, aiming: false, fullAuto: false, phase: "config", dice: null, pushed: false, note: null,
    targetId: enemies[0]?.id || null, armorRes: null, applied: false };
  const targetOf = () => Combat.get().combatants.find((x) => x.id === st.targetId) || null;

  modal({
    title: `Ranged Attack — ${w.name}`,
    render(body, close) {
      const paint = () => { body.replaceChildren(); (st.phase === "config" ? config : result)(body, close); };
      const config = (b) => {
        b.append(el("p", { class: "muted" }, `${c.name} · ${sk.name}: AGI d${dsize(attrLv)} + d${dsize(skLv)}. ${weaponLine(w)}`));
        if (enemies.length) b.append(targetPicker(st, enemies, paint));
        const tm = targetMods(targetOf(), false);
        b.append(el("label", { class: "picker__row" },
          checkbox(st.aiming, () => { st.aiming = !st.aiming; paint(); }),
          el("span", {}, el("strong", {}, "Aiming"), " — ", el("span", { class: "muted" }, "+1 advantage"))));
        if (w.fullAuto) {
          b.append(el("label", { class: "picker__row" },
            checkbox(st.fullAuto, () => { st.fullAuto = !st.fullAuto; paint(); }),
            el("span", {}, el("strong", {}, "Full Auto"), " — ", el("span", { class: "muted" }, "+1 advantage, +1 stress for PCs, spill extra hits to secondary targets"))));
        }
        b.append(advControls(st, { adv: 0, dis: 0 }, paint));
        if (tm.notes.length) b.append(el("div", { class: "muted roll-auto" }, "Target state — " + tm.notes.join("; ")));
        const autoAdv = (st.aiming ? 1 : 0) + (st.fullAuto ? 1 : 0) + tm.adv;
        const net = netOf(autoAdv + st.adv, st.dis + tm.dis);
        b.append(netBadge(net));
        b.append(el("div", { class: "modal__actions" },
          el("button", { class: "btn btn--ghost", onClick: () => close() }, "Cancel"),
          el("button", { class: "btn btn--primary", onClick: () => {
            if (st.fullAuto && rc.kind === "pc" && rc.pc) {
              rc.pc.state.resolve = Math.max(0, rc.pc.state.resolve - 1);
              reclampVitals(rc.pc); Store.save(rc.pc);
            }
            st.dice = poolFor(dsize(attrLv), dsize(skLv), net);
            logRoll({ label: `Ranged ${w.name} — ${c.name}`, text: outcomeSummary(sumSucc(st.dice), sumBane(st.dice)), charId: rc.pc?.id || null, charName: c.name, source: "combat" });
            st.phase = "result"; paint();
          } }, "⚄ Attack")));
      };
      const result = (b) => {
        const succ = sumSucc(st.dice), banes = sumBane(st.dice);
        b.append(diceRow(st.dice));
        b.append(outcomeLine(succ, banes));
        if (succ >= 1) {
          const target = targetOf();
          const raw = typeof w.damage === "number" ? w.damage + Math.max(0, succ - 1) : 1;
          let final = raw;
          if (target) {
            const armor = armorFor(resolveCombatant(target));
            if (armor) {
              if (!st.armorRes) st.armorRes = rollArmor(armor, raw);
              b.append(armorBlock(st.armorRes, armor));
              final = st.armorRes.final;
            }
          }
          b.append(damageBlock(rc.pc || { attributes: rc.attributes, specialties: [] }, w, succ,
            { showDamageLine: !st.armorRes,   // the armor block already reports what gets through
              blocked: !!st.armorRes?.negatesCrit,
              onApplyCrit: target ? (entry, type, face) => applyCritToCombatant(target, entry, type, face, commit) : null }));
          if (target) b.append(applyDamageRow(target, final, commit, st));
        }
        if (st.note) b.append(el("div", { class: "roll-risk" }, st.note));
        const actions = el("div", { class: "modal__actions" });
        if (!st.pushed && canPush(rc) && pushable(st.dice)) actions.append(el("button", { class: "btn btn--roll", onClick: () => {
          st.dice = pushPool(st.dice); st.pushed = true; st.armorRes = null; // new damage → re-roll armor
          const nb = sumBane(st.dice);
          if (rc.kind === "pc" && rc.pc) {
            const risk = applyPushRisk(rc.pc, "AGI", nb);
            st.note = risk ? `Push: ${risk.banes} ${risk.stress ? "stress" : "damage"} taken.` : "Push: no banes.";
            commit((s) => { const tgt = s.combatants.find((x) => x.id === c.id); if (tgt) tgt.health = rc.pc.state.health; });
          } else if (rc.kind === "npc" && nb > 0) {
            st.note = `Push: ${nb} damage taken to Health.`;
            commit((s) => { const tgt = s.combatants.find((x) => x.id === c.id); if (tgt) tgt.health = Math.max(0, tgt.health - nb); });
          } else {
            st.note = "Push: no banes.";
          }
          paint();
        } }, "↻ Push the roll"));
        actions.append(el("button", { class: "btn btn--primary", onClick: () => close() }, "Done"));
        b.append(actions);
      };
      paint();
    }
  });
}

function targetPicker(st, enemies, paint) {
  const chips = el("div", { class: "chips" });
  for (const e of enemies) {
    const conds = Object.keys(e.conditions || {}).filter((k) => e.conditions[k]).length;
    chips.append(el("button", { class: "chip" + (st.targetId === e.id ? " chip--on" : ""),
      onClick: () => { st.targetId = e.id; st.armorRes = null; paint(); } },
      `${e.name} ♥${e.health}${conds ? " ⚑" : ""}`));
  }
  return el("div", { class: "field" }, el("label", { class: "field__label" }, "Target"), chips);
}

// One-tap damage application, armor already accounted for. Damage taken while
// Broken (0 Health) forces a critical injury  [§3.7].
function applyDamageRow(target, dmg, commit, st) {
  const box = el("div", { class: "card card--target-dmg" });
  box.append(el("div", { class: "card__eyebrow" }, "Apply Damage to Target"));
  if (dmg <= 0) { box.append(el("p", { class: "muted" }, "No damage gets through.")); return box; }
  const btn = el("button", { class: "btn btn--sm btn--danger", disabled: st.applied || null, onClick: () => {
    const wasBroken = (Combat.get().combatants.find((x) => x.id === target.id)?.health ?? 1) <= 0;
    commit((s) => {
      const t = s.combatants.find((x) => x.id === target.id);
      if (t) t.health = Math.max(0, t.health - dmg);
    });
    if (target.kind === "pc" && target.charId) {
      const pc = Store.get(target.charId);
      if (pc) { pc.state.health = Math.max(0, pc.state.health - dmg); reclampVitals(pc); Store.save(pc); }
    }
    st.applied = true;
    btn.disabled = true;
    showToast(wasBroken
      ? `Applied ${dmg} damage to ${target.name} — already Broken: roll a critical injury.`
      : `Applied ${dmg} damage to ${target.name}.`, { kind: wasBroken ? "warn" : "info" });
  } }, `Apply ${dmg} dmg → ${target.name} (♥ ${target.health})`);
  box.append(el("div", { class: "rec-actions" }, btn));
  return box;
}

function openOpposedMelee(c, rc, w, commit) {
  const enemies = Combat.get().combatants.filter((x) => x.id !== c.id && x.health > 0);
  if (!enemies.length) {
    showToast("No active opponents in combat to oppose.", { kind: "warn" });
    return;
  }
  modal({
    title: `Opposed Melee — ${w.name}`,
    render(body, close) {
      body.append(el("p", { class: "muted" }, "Select target opponent for opposed Hand-to-Hand roll:"));
      const list = el("div", { class: "picker" });
      for (const e of enemies) {
        list.append(el("button", { class: "list__row", onClick: () => {
          close();
          const rEnemy = resolveCombatant(e);
          runOpposedMeleeModal(c, rc, w, e, rEnemy, commit);
        } },
          el("span", { class: "list__main" }, e.name),
          el("span", { class: "list__sub muted" }, `♥ ${e.health}/${e.maxHealth}`)));
      }
      body.append(list);
      body.append(el("div", { class: "modal__actions" }, el("button", { class: "btn btn--ghost", onClick: () => close() }, "Cancel")));
    }
  });
}

function runOpposedMeleeModal(c, rc, w, e, rEnemy, commit) {
  const st = { attAdv: 0, attDis: 0, defAdv: 0, defDis: 0, phase: "config", attDice: null, defDice: null, pushed: false, note: null, armorRes: null, applied: false };
  const attAttrLv = rc.attributes.STR || "C", attSkLv = rc.skills.hand_to_hand || "D";
  const defAttrLv = rEnemy.attributes.STR || "C", defSkLv = rEnemy.skills.hand_to_hand || "D";

  modal({
    title: `Opposed Combat: ${c.name} vs ${e.name}`,
    render(body, close) {
      const paint = () => { body.replaceChildren(); (st.phase === "config" ? config : result)(body, close); };
      const tm = targetMods(e, true);          // defender's state helps the attacker
      const sm = selfMods(c, true);            // attacker's own state (e.g. Prone)
      const noDefence = cannotDefend(e);       // Grappled / Broken defenders don't roll
      const config = (b) => {
        b.append(el("div", { class: "card__eyebrow" }, `Attacker: ${c.name} (${w.name})`));
        b.append(el("p", { class: "muted" }, `STR d${dsize(attAttrLv)} + Hand-to-Hand d${dsize(attSkLv)}`));
        b.append(stepRow("Attacker Adv", st.attAdv, () => { if (st.attAdv > 0) st.attAdv--; paint(); }, () => { st.attAdv++; paint(); }));
        b.append(stepRow("Attacker Dis", st.attDis, () => { if (st.attDis > 0) st.attDis--; paint(); }, () => { st.attDis++; paint(); }));
        if (tm.notes.length || sm.notes.length)
          b.append(el("div", { class: "muted roll-auto" }, "Auto from state — " + [...tm.notes, ...sm.notes].join("; ")));

        b.append(el("hr"));
        b.append(el("div", { class: "card__eyebrow" }, `Defender: ${e.name}`));
        b.append(el("p", { class: "muted" }, noDefence
          ? "Cannot defend — rolls no dice."
          : `STR d${dsize(defAttrLv)} + Hand-to-Hand d${dsize(defSkLv)}`));
        if (!noDefence) {
          b.append(stepRow("Defender Adv", st.defAdv, () => { if (st.defAdv > 0) st.defAdv--; paint(); }, () => { st.defAdv++; paint(); }));
          b.append(stepRow("Defender Dis", st.defDis, () => { if (st.defDis > 0) st.defDis--; paint(); }, () => { st.defDis++; paint(); }));
        }

        b.append(el("div", { class: "modal__actions" },
          el("button", { class: "btn btn--ghost", onClick: () => close() }, "Cancel"),
          el("button", { class: "btn btn--primary", onClick: () => {
            st.attDice = poolFor(dsize(attAttrLv), dsize(attSkLv), netOf(st.attAdv + tm.adv, st.attDis + sm.dis));
            st.defDice = noDefence ? [] : poolFor(dsize(defAttrLv), dsize(defSkLv), netOf(st.defAdv, st.defDis));
            logRoll({ label: `Opposed: ${c.name} vs ${e.name}`, text: `${sumSucc(st.attDice)}–${sumSucc(st.defDice)} (${w.name})`, charId: rc.pc?.id || null, charName: c.name, source: "combat" });
            st.phase = "result"; paint();
          } }, "⚄ Roll Opposed")));
      };
      const result = (b) => {
        const attSucc = sumSucc(st.attDice);
        const defSucc = sumSucc(st.defDice);

        b.append(el("div", { class: "card__eyebrow" }, `Attacker: ${c.name} (${attSucc} succ)`));
        b.append(diceRow(st.attDice));
        b.append(el("div", { class: "card__eyebrow" }, `Defender: ${e.name} (${defSucc} succ)`));
        b.append(diceRow(st.defDice));

        b.append(el("hr"));
        if (attSucc > defSucc) {
          const raw = (typeof w.damage === "number" ? w.damage : 1) + Math.max(0, attSucc - defSucc - 1);
          let dmg = raw;
          const armor = armorFor(rEnemy);
          if (armor) {
            if (!st.armorRes) st.armorRes = rollArmor(armor, raw);
            b.append(armorBlock(st.armorRes, armor));
            dmg = st.armorRes.final;
          }
          b.append(el("div", { class: "roll-outcome" }, el("span", { class: "roll-outcome__main is-succ" }, `${c.name} Wins!`), el("span", { class: "muted" }, `Hits for ${dmg} damage.`)));
          if (attSucc - defSucc >= 2 && w.critDie && (w.type === "piercing" || w.type === "crushing")) {
            // Crit dice/margin use the successes OVER the defender (§3.12); suppress
            // the duplicate damage line (already shown in the outcome above).
            b.append(damageBlock(rc.pc || { attributes: rc.attributes, specialties: [] }, w, attSucc - defSucc,
              { showDamageLine: false, blocked: !!st.armorRes?.negatesCrit,
                onApplyCrit: (entry, type, face) => applyCritToCombatant(e, entry, type, face, commit) }));
          }
          b.append(applyDamageRow(e, dmg, commit, st));
        } else if (defSucc > attSucc) {
          const defW = rEnemy.weapons[0] || { damage: 1 };
          const raw = (typeof defW.damage === "number" ? defW.damage : 1) + Math.max(0, defSucc - attSucc - 1);
          let dmg = raw;
          const attArmor = armorFor(rc);
          if (attArmor) {
            if (!st.armorRes) st.armorRes = rollArmor(attArmor, raw);
            b.append(armorBlock(st.armorRes, attArmor));
            dmg = st.armorRes.final;
          }
          b.append(el("div", { class: "roll-outcome" }, el("span", { class: "roll-outcome__main is-fail" }, `${e.name} Counter-Hits!`), el("span", { class: "muted" }, `Hits ${c.name} for ${dmg} damage.`)));
          b.append(applyDamageRow(c, dmg, commit, st));
        } else {
          b.append(el("div", { class: "roll-outcome" }, el("span", { class: "roll-outcome__main" }, "Standoff Tie"), el("span", { class: "muted" }, "Neither side lands a hit.")));
        }

        if (st.note) b.append(el("div", { class: "roll-risk" }, st.note));
        const actions = el("div", { class: "modal__actions" });
        // Only a failed roll may be pushed — in an opposed roll, that means the
        // attacker did not beat the defender. [Ch01 p016 / §3.12]
        if (!st.pushed && canPush(rc) && attSucc <= defSucc) actions.append(el("button", { class: "btn btn--roll", onClick: () => {
          st.attDice = pushPool(st.attDice); st.pushed = true; st.armorRes = null; // new margin → re-roll armor
          const nb = sumBane(st.attDice);
          if (rc.kind === "pc" && rc.pc) {
            const risk = applyPushRisk(rc.pc, "STR", nb);
            st.note = risk ? `Attacker Push: ${risk.banes} damage taken.` : "Attacker Push: no banes.";
            commit((s) => { const tgt = s.combatants.find((x) => x.id === c.id); if (tgt) tgt.health = rc.pc.state.health; });
          } else if (rc.kind === "npc" && nb > 0) {
            st.note = `Attacker Push: ${nb} damage taken to Health.`;
            commit((s) => { const tgt = s.combatants.find((x) => x.id === c.id); if (tgt) tgt.health = Math.max(0, tgt.health - nb); });
          } else {
            st.note = "Attacker Push: no banes.";
          }
          paint();
        } }, "↻ Attacker Push"));
        actions.append(el("button", { class: "btn btn--primary", onClick: () => close() }, "Done"));
        b.append(actions);
      };
      paint();
    }
  });
}
