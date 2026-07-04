// sheet.js — the full character sheet + in-play tracking UI (CLAUDE.md Phase 2).
// Live vitals clamped to true maxima, condition toggles, resource counters,
// attributes/skills/specialties display, faithful inventory (no encumbrance),
// flavor + notes + portrait. All mutations persist through Store immediately.
import { el, clear, titleCase, rollDie } from "./core.js";
import * as D from "../data.js";
import * as R from "./rules.js";
import { maxHealth, maxResolve, reclampVitals, isBrokenByDamage, isBrokenByStress } from "./derived.js";
import { Store } from "./store.js";
import { showToast, confirmModal, promptModal, modal, sectionTitle } from "./ui.js";
import { navigate } from "./router.js";
import { openSkillRoll, openWeaponPicker, proceduralRoll } from "./roller.js";
import { Sync, watchCharacter } from "./sync.js";

// Watch the active character for remote (party/GM) edits while it's on-screen.
let charWatch = { id: null, off: null };
function ensureCharWatch(ch, mount) {
  const linked = Sync.ready && Sync.inCampaign && ch.campaignId === Sync.campaignId;
  if (!linked) { if (charWatch.off) { charWatch.off(); charWatch = { id: null, off: null }; } return; }
  if (charWatch.id === ch.id) return;
  if (charWatch.off) charWatch.off();
  charWatch = { id: ch.id, off: watchCharacter(ch.id, (val) => {
    Store.applyRemote(val);
    if ((location.hash.slice(1) || "") === "sheet" && Store.getActiveId() === val.id) renderSheet(mount);
  }) };
}

// Conditions the player toggles by hand; broken states are auto-derived (§3.6).
const AUTO_CONDITIONS = ["broken_damage", "broken_stress"];

export function renderSheet(mount) {
  const ch = Store.getActive();
  clear(mount);
  if (!ch) {
    mount.append(el("section", { class: "screen" },
      el("h1", { class: "screen__title" }, "Character Sheet"),
      el("div", { class: "card" },
        el("p", { class: "muted" }, "No active character. Create one from the wizard."),
        el("button", { class: "btn btn--primary", onClick: () => navigate("wizard") }, "Create a Blade Runner"))));
    return;
  }

  // Persist a mutation and re-render in place.
  const commit = (mutate) => {
    mutate(ch);
    reclampVitals(ch);
    Store.save(ch);
    renderSheet(mount);
  };

  const rerender = () => renderSheet(mount);
  ensureCharWatch(ch, mount);
  const arch = R.archetype(ch.archetype);
  const y = R.years(ch.years);
  const wrap = el("section", { class: "screen sheet" });

  wrap.append(sheetHeader(ch, arch, y, commit));
  if (ch.state.dead) wrap.append(deceasedBanner());
  wrap.append(vitalsSection(ch, commit));
  wrap.append(criticalInjuriesSection(ch, commit, rerender));
  if (isBrokenByStress(ch) && !ch.state.dead) wrap.append(stressSection(ch, commit));
  wrap.append(resourcesSection(ch, commit));
  wrap.append(conditionsSection(ch, commit));
  wrap.append(attributesSection(ch));
  wrap.append(skillsSection(ch, arch, rerender));
  wrap.append(specialtiesSection(ch));
  wrap.append(inventorySection(ch, commit, rerender));
  wrap.append(recoverySection(ch, commit, rerender));
  wrap.append(advancementSection(ch, commit, rerender));
  wrap.append(identitySection(ch, commit));
  wrap.append(dangerZone(ch, mount));

  mount.append(wrap);
}

// ---- Header + portrait ----------------------------------------------------
function sheetHeader(ch, arch, y, commit) {
  const portrait = ch.identity.portraitUrl
    ? el("img", { class: "sheet__portrait", src: ch.identity.portraitUrl, alt: `Portrait of ${ch.name}` })
    : el("div", { class: "sheet__portrait sheet__portrait--empty", "aria-hidden": "true" }, "🕵");
  const fileInput = el("input", { type: "file", accept: "image/*", class: "visually-hidden", id: "portrait-file" });
  fileInput.addEventListener("change", () => {
    const f = fileInput.files?.[0];
    if (f) compressImage(f, 400, (dataUrl) => commit((c) => { c.identity.portraitUrl = dataUrl; }));
  });
  return el("div", { class: "card sheet__head" },
    el("label", { class: "sheet__portrait-wrap", for: "portrait-file", title: "Change portrait" }, portrait, fileInput),
    el("div", { class: "sheet__id" },
      el("div", { class: "card__title" }, ch.name),
      el("div", { class: "muted" }, `${titleCase(ch.nature)} · ${arch?.name || "—"} · ${y?.name || "—"}`),
      ch.identity.portraitUrl
        ? el("button", { class: "btn btn--sm btn--ghost", onClick: () => commit((c) => { c.identity.portraitUrl = ""; }) }, "Remove portrait")
        : null));
}

// ---- Vitals (Health / Resolve) --------------------------------------------
function vitalsSection(ch, commit) {
  const hp = maxHealth(ch), rp = maxResolve(ch);
  const card = el("div", { class: "card" },
    sectionTitle("Vitals"),
    vitalTrack("Health", "health", ch.state.health, hp, "health", commit),
    vitalTrack("Resolve", "resolve", ch.state.resolve, rp, "resolve", commit));
  const badges = el("div", { class: "sheet__badges" });
  if (isBrokenByDamage(ch)) badges.append(el("span", { class: "badge badge--danger" }, "Broken (Damage) — no actions or skill rolls"));
  if (isBrokenByStress(ch)) badges.append(el("span", { class: "badge badge--danger" }, "Broken (Stress) — critical stress effect"));
  if (badges.childElementCount) card.append(badges);
  return card;
}
function vitalTrack(label, key, value, max, tone, commit) {
  const pips = el("div", { class: "track__pips", role: "img", "aria-label": `${label} ${value} of ${max}` });
  for (let i = 1; i <= max; i++) pips.append(el("span", { class: `dot dot--${tone}` + (i <= value ? " dot--full" : "") }));
  return el("div", { class: "track" },
    el("div", { class: "track__top" },
      el("span", { class: "track__label" }, label),
      el("span", { class: `track__num track__num--${tone}` }, `${value} / ${max}`)),
    pips,
    el("div", { class: "stepper__ctrl" },
      el("button", { class: "btn btn--sm", "aria-label": `decrease ${label}`, onClick: () => commit((c) => { c.state[key] = Math.max(0, c.state[key] - 1); }) }, "−"),
      el("button", { class: "btn btn--sm", "aria-label": `increase ${label}`, onClick: () => commit((c) => { c.state[key] = Math.min(max, c.state[key] + 1); }) }, "+"),
      el("button", { class: "btn btn--sm btn--ghost", onClick: () => commit((c) => { c.state[key] = max; }) }, "Full")));
}

// ---- Resources (Promotion / Chinyen / Humanity) ---------------------------
function resourcesSection(ch, commit) {
  const rows = el("div", { class: "res-grid" },
    counter("Promotion", "promotionPoints", ch, commit, "PP earned on the job — spend on gear & specialties."),
    counter("Chinyen", "chinyenPoints", ch, commit, "Black-market currency."),
    counter("Humanity", "humanityPoints", ch, commit, "Compassion points — spend to raise skills in Downtime."));
  const card = el("div", { class: "card" }, sectionTitle("Resources"), rows);
  if (ch.nature === "replicant")
    card.append(el("div", { class: "muted sheet__note" }, `Baseline Tests failed: ${ch.state.baselineFails || 0}`));
  return card;
}
function counter(label, key, ch, commit, hint) {
  return el("div", { class: "counter" },
    el("div", { class: "counter__val" }, ch.state[key] ?? 0),
    el("div", { class: "counter__label" }, label),
    el("div", { class: "stepper__ctrl" },
      el("button", { class: "btn btn--sm", "aria-label": `decrease ${label}`, onClick: () => commit((c) => { c.state[key] = Math.max(0, (c.state[key] || 0) - 1); }) }, "−"),
      el("button", { class: "btn btn--sm", "aria-label": `increase ${label}`, onClick: () => commit((c) => { c.state[key] = (c.state[key] || 0) + 1; }) }, "+")),
    hint ? el("div", { class: "muted counter__hint" }, hint) : null);
}

// ---- Conditions (manual toggles) ------------------------------------------
function conditionsSection(ch, commit) {
  const chips = el("div", { class: "chips" });
  for (const cond of D.CONDITIONS) {
    if (AUTO_CONDITIONS.includes(cond.key)) continue;
    const on = !!ch.state.conditions[cond.key];
    chips.append(el("button", { class: "chip" + (on ? " chip--on" : ""), title: cond.text,
      onClick: () => commit((c) => { if (on) delete c.state.conditions[cond.key]; else c.state.conditions[cond.key] = true; }) },
      cond.name));
  }
  const card = el("div", { class: "card" }, sectionTitle("Conditions"), chips);
  const active = D.CONDITIONS.filter((c) => !AUTO_CONDITIONS.includes(c.key) && ch.state.conditions[c.key]);
  for (const c of active) card.append(el("div", { class: "muted sheet__note" }, `${c.name}: ${c.text}`));
  return card;
}

// ---- Attributes -----------------------------------------------------------
function attributesSection(ch) {
  const grid = el("div", { class: "stat-grid" });
  for (const a of D.ATTRIBUTES) {
    const lv = ch.attributes[a.key];
    grid.append(el("div", { class: "stat", title: a.blurb },
      el("span", { class: "stat__name" }, a.name),
      el("span", { class: "stat__lv" }, lv),
      el("span", { class: "stat__die muted" }, `d${D.LEVEL_DIE[lv]}`)));
  }
  return el("div", { class: "card" }, sectionTitle("Attributes"), grid);
}

// ---- Skills (tap to roll) -------------------------------------------------
function skillsSection(ch, arch, rerender) {
  const list = el("div", { class: "skill-list" });
  for (const s of D.SKILLS) {
    const lv = ch.skills[s.key];
    const isKey = arch?.keySkills.includes(s.key);
    const trained = lv !== D.SKILL_START_LEVEL;
    list.append(el("button", { class: "skill skill--btn" + (trained ? " skill--trained" : ""), "aria-label": `Roll ${s.name}`,
      onClick: () => openSkillRoll(ch, s.key, rerender) },
      el("span", { class: "skill__name" }, s.name, isKey ? el("span", { class: "skill__key", title: "Key skill" }, " ★") : null),
      el("span", { class: "skill__attr muted" }, R.attrDisplay(s.attr)),
      el("span", { class: "skill__lv" }, `${lv} · d${D.LEVEL_DIE[lv]}`, el("span", { class: "skill__die-cta muted" }, " ⚄"))));
  }
  return el("div", { class: "card" }, sectionTitle("Skills"),
    el("p", { class: "muted sheet__note" }, "Tap a skill to roll its Base Dice."), list);
}

// ---- Specialties ----------------------------------------------------------
function specialtiesSection(ch) {
  const card = el("div", { class: "card" }, sectionTitle("Specialties"));
  const specs = (ch.specialties || []).map((s) => R.specialty(typeof s === "string" ? s : s?.key)).filter(Boolean);
  if (!specs.length) { card.append(el("p", { class: "muted" }, "None yet — learn specialties in play (5 PP, one Shift at the Training Grounds).")); return card; }
  for (const sp of specs)
    card.append(el("div", { class: "ability" }, el("div", { class: "ability__name" }, sp.name), el("div", { class: "muted ability__text" }, sp.text)));
  return card;
}

// ---- Inventory (faithful: item list + no encumbrance) ---------------------
function inventorySection(ch, commit, rerender) {
  const items = ch.inventory.items || [];
  const list = el("div", { class: "inv" });
  if (!items.length) list.append(el("p", { class: "muted" }, "No items."));
  items.forEach((it, i) => {
    list.append(el("div", { class: "inv__row" },
      el("button", { class: "inv__equip" + (it.equipped ? " inv__equip--on" : ""), title: it.equipped ? "Equipped" : "Stowed", "aria-label": "toggle equipped",
        onClick: () => commit((c) => { c.inventory.items[i].equipped = !c.inventory.items[i].equipped; }) }, it.equipped ? "●" : "○"),
      el("span", { class: "inv__name" }, it.name, it.signature ? el("span", { class: "inv__sig", title: "Signature item" }, " ✦") : null),
      el("button", { class: "btn btn--sm btn--ghost", "aria-label": `remove ${it.name}`,
        onClick: () => commit((c) => { c.inventory.items.splice(i, 1); }) }, "✕")));
  });
  const add = el("button", { class: "btn btn--sm", onClick: async () => {
    const name = await promptModal("Item name", { title: "Add item", okLabel: "Add" });
    if (name && name.trim()) commit((c) => { c.inventory.items.push({ name: name.trim(), equipped: false }); });
  } }, "＋ Add item");
  const attack = el("button", { class: "btn btn--sm btn--roll", onClick: () => openWeaponPicker(ch, rerender) }, "⚔ Roll an attack");
  return el("div", { class: "card" }, sectionTitle("Inventory"), list, el("div", { class: "inv__actions" }, add, attack));
}

// ---- Identity / flavor / notes --------------------------------------------
function identitySection(ch, commit) {
  const card = el("div", { class: "card" }, sectionTitle("Identity & Notes"));
  card.append(flavorField("Key memory", ch.identity.keyMemory, (v) => commit((c) => { c.identity.keyMemory = v; })));
  card.append(flavorField("Key relationship", ch.identity.keyRelationship, (v) => commit((c) => { c.identity.keyRelationship = v; })));
  card.append(flavorField("Appearance", ch.identity.appearance, (v) => commit((c) => { c.identity.appearance = v; })));
  card.append(flavorField("Signature item", ch.identity.signatureItem, (v) => commit((c) => { c.identity.signatureItem = v; })));
  card.append(flavorField("Home", ch.identity.home, (v) => commit((c) => { c.identity.home = v; })));
  card.append(flavorField("Notes", ch.notes, (v) => commit((c) => { c.notes = v; }), true));
  return card;
}
// Debounced-on-blur editable field: commit (and re-render) only when focus leaves.
function flavorField(label, value, onSave, big = false) {
  const input = el(big ? "textarea" : "input", { class: "input", rows: big ? 4 : null });
  input.value = value || "";
  if (!big) input.type = "text";
  input.addEventListener("blur", () => { if (input.value !== (value || "")) onSave(input.value); });
  return el("div", { class: "field" }, el("label", { class: "field__label" }, label), input);
}

// ---- Danger zone ----------------------------------------------------------
function dangerZone(ch, mount) {
  return el("div", { class: "card" },
    el("button", { class: "btn btn--sm", onClick: () => navigate("combat") }, "⚔ Combat tracker"),
    el("div", { class: "sheet__danger" },
      el("button", { class: "btn btn--ghost", onClick: () => navigate("characters") }, "Switch character"),
      el("button", { class: "btn btn--danger", onClick: async () => {
        if (await confirmModal(`Delete ${ch.name}? This cannot be undone.`, { title: "Delete character", okLabel: "Delete", danger: true })) {
          Store.remove(ch.id);
          showToast(`${ch.name} deleted.`);
          navigate("characters");
        }
      } }, "Delete character")));
}

// ---- Critical injuries + guided death procedure (§3.7) --------------------
function deceasedBanner() {
  return el("div", { class: "card" }, el("div", { class: "badge badge--danger deceased" }, "☠ DECEASED — this Blade Runner has died. Create a new one from the wizard."));
}
function criticalInjuriesSection(ch, commit, rerender) {
  const card = el("div", { class: "card" }, sectionTitle("Critical Injuries"));
  const injuries = ch.state.criticalInjuries || [];
  if (!injuries.length) card.append(el("p", { class: "muted" }, "No critical injuries."));
  for (const inj of injuries) {
    const row = el("div", { class: "injury" });
    const lethalTxt = inj.instantKill ? " · instant kill" : inj.lethal ? ` · lethal (${inj.deathSave} save)` : "";
    row.append(el("div", { class: "injury__head" },
      el("span", { class: "injury__name" }, inj.injury),
      el("span", { class: "muted injury__meta" }, `${titleCase(inj.type || "")}${lethalTxt} · heals ${inj.healing}`)));
    row.append(el("div", { class: "muted injury__fx" }, inj.effect + (inj.stabilized ? " — stabilized" : "")));
    if (inj.lethal && !inj.instantKill && !inj.stabilized && !ch.state.dead) {
      row.append(el("div", { class: "injury__acts" },
        el("button", { class: "btn btn--sm btn--roll", onClick: () => deathSave(ch, inj, commit, rerender) }, "Death save (STAMINA)"),
        el("button", { class: "btn btn--sm", onClick: () => stabilize(ch, inj, commit, rerender) }, "Stabilize (MEDICAL AID)")));
    }
    row.append(el("button", { class: "btn btn--sm btn--ghost injury__rm", "aria-label": "remove injury",
      onClick: () => commit((c) => { c.state.criticalInjuries = c.state.criticalInjuries.filter((x) => x.id !== inj.id); }) }, "Healed ✕"));
    card.append(row);
  }
  if (!ch.state.dead) card.append(el("button", { class: "btn btn--sm", onClick: () => takeCritinjury(ch, commit, rerender) }, "＋ Take a critical injury"));
  return card;
}
function deathSave(ch, inj, commit, rerender) {
  const broken = isBrokenByDamage(ch);
  proceduralRoll(ch, {
    skillKey: "stamina", title: "Death Save — STAMINA", allowPush: !broken,
    note: broken ? "Broken — you cannot push this death save." : "Success: you linger and save again next interval. Failure: you die.",
    onResult: ({ successes }) => {
      if (successes >= 1) { showToast(`Survived — make another death save next ${inj.deathSave}.`); rerender(); }
      else { commit((c) => { c.state.dead = true; }); showToast("The death save failed — your Blade Runner dies.", { kind: "error", timeout: 5000 }); }
    },
  });
}
function stabilize(ch, inj, commit, rerender) {
  const advGear = itemsInclude(ch, ["surgeon", "hospital", "emergency medical"]) ? 1 : 0; // advanced gear = advantage
  const selfDis = isBrokenByDamage(ch) ? 0 : 1; // self-stabilize (not Broken) = disadvantage
  proceduralRoll(ch, {
    skillKey: "medical_aid", title: "Stabilize — MEDICAL AID", adv: advGear, dis: selfDis,
    note: `Takes one ${inj.deathSave}. Success raises the interval a category; a treated Shift-crit ends the death saves.`,
    onResult: ({ successes }) => {
      if (successes >= 1) commit((c) => {
        const t = c.state.criticalInjuries.find((x) => x.id === inj.id);
        if (t.deathSave === "round") { t.deathSave = "shift"; showToast("Stabilized up to a Shift interval."); }
        else { t.stabilized = true; showToast("Stabilized — no further death saves needed."); }
      });
      else { showToast("Stabilize failed — try again after another death save.", { kind: "warn" }); rerender(); }
    },
  });
}
function takeCritinjury(ch, commit, rerender) {
  const st = { type: "piercing", die: 12 };
  modal({
    title: "Take a critical injury", render(body, close) {
      const paint = () => { body.replaceChildren(); view(body); };
      const view = (b) => {
        b.append(el("p", { class: "muted" }, "Roll the attacker's Crit Die on the damage-type table (blunt weapons use the attacker's Strength die)."));
        b.append(el("div", { class: "field" }, el("label", { class: "field__label" }, "Damage type"),
          el("div", { class: "chips" }, ...["piercing", "crushing"].map((t) =>
            el("button", { class: "chip" + (st.type === t ? " chip--on" : ""), onClick: () => { st.type = t; paint(); } }, titleCase(t))))));
        b.append(el("div", { class: "field" }, el("label", { class: "field__label" }, "Crit Die"),
          el("div", { class: "chips" }, ...[6, 8, 10, 12].map((d) =>
            el("button", { class: "chip" + (st.die === d ? " chip--on" : ""), onClick: () => { st.die = d; paint(); } }, `d${d}`)))));
        b.append(el("div", { class: "modal__actions" },
          el("button", { class: "btn btn--ghost", onClick: () => close() }, "Cancel"),
          el("button", { class: "btn btn--primary", onClick: () => {
            const face = rollDie(st.die);
            const e = R.critEntry(st.type, face);
            close();
            commit((c) => {
              c.state.criticalInjuries.push({ id: "inj-" + Date.now(), injury: e.injury, type: st.type, roll: face,
                lethal: !!e.lethal, deathSave: e.deathSave || null, instantKill: !!e.instantKill, healing: e.healing,
                effect: e.effect, disadvantage: e.disadvantage || [], flag: e.flag || null, stabilized: false });
              if (e.instantKill) c.state.dead = true;
            });
            showToast(`d${st.die}=${face} → ${e.injury}${e.instantKill ? " (instant kill)" : e.lethal ? " (lethal)" : ""}`, { kind: e.lethal ? "warn" : "info", timeout: 4500 });
          } }, "⚄ Roll injury")));
      };
      paint();
    },
  });
}

// ---- Broken by stress (§3.6/Ch04) -----------------------------------------
function stressSection(ch, commit) {
  const card = el("div", { class: "card" }, sectionTitle("Broken by Stress"));
  if (!ch.state.criticalStress) {
    card.append(el("p", { class: "muted" }, "Stress has met or exceeded your Resolve. Roll one Empathy Base Die for a critical stress effect (a 1 also permanently lowers your max Resolve)."));
    card.append(el("button", { class: "btn btn--sm btn--roll", onClick: () => {
      const size = D.LEVEL_DIE[ch.attributes.EMP];
      const face = rollDie(size);
      const table = ch.nature === "replicant" ? D.CRITICAL_STRESS_REPLICANT : D.CRITICAL_STRESS_HUMAN;
      const eff = table[Math.min(face, 6) - 1];
      commit((c) => {
        c.state.criticalStress = { name: eff.name, text: eff.text, noSkillRolls: !!eff.noSkillRolls, skillDisadvantage: !!eff.skillDisadvantage, noPush: !!eff.noPush };
        if (face === 1) { c.state.permanentResolveLoss = (c.state.permanentResolveLoss || 0) + 1; if (maxResolve(c) <= 0) c.state.dead = true; } // lost final Resolve → retire (§3.8)
      });
      const retired = face === 1 && maxResolve(ch) - 1 <= 0;
      showToast(`EMP d${size}=${face} → ${eff.name}${retired ? " · lost your final Resolve — retired" : face === 1 ? " · −1 max Resolve (permanent)" : ""}`, { kind: "warn", timeout: 5000 });
    } }, "⚄ Roll critical stress effect"));
  } else {
    card.append(el("div", { class: "ability" }, el("div", { class: "ability__name" }, ch.state.criticalStress.name), el("div", { class: "muted ability__text" }, ch.state.criticalStress.text)));
    card.append(el("div", { class: "muted sheet__note" }, "Clears once you recover at least 1 Resolve (take a Downtime Shift)."));
  }
  return card;
}

// ---- Rest & Recovery (§3.8) -----------------------------------------------
function recoverySection(ch, commit, rerender) {
  const card = el("div", { class: "card" }, sectionTitle("Rest & Recovery"));
  const limit = downtimeLimit(ch);
  card.append(el("div", { class: "muted sheet__note" }, `Shifts since Downtime: ${ch.state.shiftsSinceDowntime || 0} / ${limit} before stress.`));
  const rows = el("div", { class: "rec-actions" });
  rows.append(el("button", { class: "btn btn--sm", disabled: ch.state.dead || null, onClick: () => downtimeShift(ch, commit, false) }, "Downtime Shift"));
  rows.append(el("button", { class: "btn btn--sm", disabled: ch.state.dead || null, onClick: () => downtimeShift(ch, commit, true) }, "Downtime + medical care"));
  rows.append(el("button", { class: "btn btn--sm btn--ghost", disabled: ch.state.dead || null, onClick: () => investigationShift(ch, commit) }, "Investigation Shift"));
  card.append(rows);
  if (isBrokenByDamage(ch) && !ch.state.dead)
    card.append(el("button", { class: "btn btn--sm btn--roll", onClick: () => firstAid(ch, commit, rerender) }, "First Aid (MEDICAL AID) — revive the Broken"));
  // once-per-shift stress/health heals from specialties & consumables
  const heals = onceHeals(ch);
  if (heals.length) {
    const hwrap = el("div", { class: "chips" });
    for (const h of heals) {
      const used = ch.state.shiftUses?.[h.key];
      hwrap.append(el("button", { class: "chip" + (used ? " choice--disabled" : ""), disabled: used || null,
        onClick: () => commit((c) => { applyHeal(c, h); (c.state.shiftUses ||= {})[h.key] = true; showToast(`${h.label}: ${h.desc}`); }) }, `${h.label}${used ? " ✓" : ""}`));
    }
    card.append(el("div", { class: "muted sheet__note" }, "Once per Shift:"), hwrap);
  }
  return card;
}
function downtimeLimit(ch) { return (ch.specialties || []).some((s) => s === "married_to_the_job" || s?.key === "married_to_the_job") ? D.SPECIALTIES.find((x) => x.key === "married_to_the_job").effect.downtimeGrace : D.RECOVERY.downtimeShiftsBeforeStress; }
function downtimeShift(ch, commit, care) {
  commit((c) => {
    const hp = D.RECOVERY.downtimeHealthPerShift[c.nature] + (care ? D.RECOVERY.medicalCareBonusHealth : 0);
    c.state.health = Math.min(maxHealth(c), c.state.health + hp);
    c.state.resolve = Math.min(maxResolve(c), c.state.resolve + 1); // +1 Resolve/Shift, all natures
    c.state.shiftsSinceDowntime = 0;
    c.state.shiftUses = {};
    if (c.state.resolve >= 1) c.state.criticalStress = null;
  });
  showToast(`Downtime Shift: +${D.RECOVERY.downtimeHealthPerShift[ch.nature] + (care ? 1 : 0)} Health, +1 Resolve.`);
}
function investigationShift(ch, commit) {
  commit((c) => {
    c.state.shiftsSinceDowntime = (c.state.shiftsSinceDowntime || 0) + 1;
    c.state.shiftUses = {};
    if (c.state.shiftsSinceDowntime > downtimeLimit(c)) { c.state.resolve = Math.max(0, c.state.resolve - 1); }
  });
  const over = (ch.state.shiftsSinceDowntime || 0) + 1 > downtimeLimit(ch);
  showToast(over ? "Investigation Shift — over the limit: +1 stress." : "Investigation Shift logged.");
}
function firstAid(ch, commit, rerender) {
  const advGlue = itemsInclude(ch, ["glue"]) ? 1 : 0;
  proceduralRoll(ch, { skillKey: "medical_aid", title: "First Aid — MEDICAL AID", adv: advGlue,
    note: "On a success, the Broken character regains Health equal to your successes.",
    onResult: ({ successes }) => {
      if (successes >= 1) { commit((c) => { c.state.health = Math.min(maxHealth(c), c.state.health + successes); }); showToast(`First aid: +${successes} Health.`); }
      else { showToast("First aid failed.", { kind: "warn" }); rerender(); }
    } });
}
// Available once-per-Shift heals from owned specialties + carried consumables.
function onceHeals(ch) {
  const out = [];
  const specHeals = { hip_flask: "swig", origami: "fold a figure", smokes: "light up" };
  for (const [key, how] of Object.entries(specHeals))
    if ((ch.specialties || []).some((s) => s === key || s?.key === key)) out.push({ key, label: D.SPECIALTIES.find((x) => x.key === key).name, desc: "heal 1 stress (" + how + ")", resolve: 1 });
  if (itemsInclude(ch, ["medchecker"])) out.push({ key: "medchecker", label: "MedChecker", desc: "heal 1 Health & 1 Resolve", health: 1, resolve: 1 });
  if (itemsInclude(ch, ["instant fix"])) out.push({ key: "instant_fix", label: "Instant Fix", desc: "heal 1 Health", health: 1 });
  if (itemsInclude(ch, ["soviet happy"])) out.push({ key: "soviet_happy", label: "Soviet Happy", desc: "heal 1 Resolve", resolve: 1 });
  return out;
}
function applyHeal(c, h) {
  if (h.health) c.state.health = Math.min(maxHealth(c), c.state.health + h.health);
  if (h.resolve) { c.state.resolve = Math.min(maxResolve(c), c.state.resolve + h.resolve); if (c.state.resolve >= 1) c.state.criticalStress = null; }
}

// ---- Advancement (§3.10) --------------------------------------------------
function advancementSection(ch, commit, rerender) {
  const card = el("div", { class: "card" }, sectionTitle("Advancement"));
  const acts = el("div", { class: "rec-actions" });
  acts.append(el("button", { class: "btn btn--sm", disabled: (ch.state.promotionPoints < D.SPECIALTY_LEARN_COST_PP) || null, onClick: () => learnSpecialty(ch, commit) }, `Learn specialty (${D.SPECIALTY_LEARN_COST_PP} PP)`));
  acts.append(el("button", { class: "btn btn--sm", onClick: () => raiseSkill(ch, commit) }, "Raise a skill (Humanity)"));
  if (ch.nature === "replicant") acts.append(el("button", { class: "btn btn--sm btn--roll", onClick: () => baselineTest(ch, commit, rerender) }, "Baseline Test (INSIGHT)"));
  card.append(acts);
  card.append(el("div", { class: "muted sheet__note" }, "Specialties: 5 PP, one Shift at the Training Grounds (Downtime). Skill raises cost Humanity (D→C 5, C→B 10, B→A 15) and only in Downtime."));
  const log = (ch.advancementLog || []).slice(-4).reverse();
  if (log.length) { const l = el("div", { class: "adv-log" }); for (const e of log) l.append(el("div", { class: "muted adv-log__row" }, e)); card.append(l); }
  return card;
}
function learnSpecialty(ch, commit) {
  const owned = (ch.specialties || []).map((s) => (typeof s === "string" ? s : s?.key));
  const available = D.SPECIALTIES.filter((sp) => {
    const times = owned.filter((k) => k === sp.key).length;
    return sp.maxTimes ? times < sp.maxTimes : times < 1;
  });
  modal({ title: "Learn a specialty (5 PP)", render(body, close) {
    body.append(el("p", { class: "muted" }, "Spend 5 Promotion Points (one Downtime Shift at the Training Grounds)."));
    const list = el("div", { class: "picker" });
    for (const sp of available) list.append(el("button", { class: "list__row", onClick: () => {
      close();
      commit((c) => { c.state.promotionPoints -= D.SPECIALTY_LEARN_COST_PP; c.specialties.push(sp.key); reclampVitals(c); (c.advancementLog ||= []).push(`Learned ${sp.name} (−5 PP).`); });
      showToast(`Learned ${sp.name}.`);
    } }, el("span", { class: "list__main" }, sp.name), el("span", { class: "list__sub muted" }, sp.text)));
    body.append(list);
    body.append(el("div", { class: "modal__actions" }, el("button", { class: "btn btn--ghost", onClick: () => close() }, "Cancel")));
  } });
}
function raiseSkill(ch, commit) {
  modal({ title: "Raise a skill (Humanity)", render(body, close) {
    body.append(el("p", { class: "muted" }, `Humanity available: ${ch.state.humanityPoints}. One step, Downtime only. Attributes can't rise.`));
    const list = el("div", { class: "picker" });
    for (const s of D.SKILLS) {
      const lv = ch.skills[s.key];
      if (lv === "A") continue;
      const cost = R.skillIncreaseCost(lv);
      const afford = ch.state.humanityPoints >= cost;
      list.append(el("button", { class: "list__row", disabled: !afford || null, onClick: () => {
        close();
        commit((c) => { c.state.humanityPoints -= cost; c.skills[s.key] = R.stepLevel(c.skills[s.key], +1); reclampVitals(c); (c.advancementLog ||= []).push(`${s.name} ${lv}→${c.skills[s.key]} (−${cost} Humanity).`); });
        showToast(`${s.name} raised to ${R.stepLevel(lv, +1)}.`);
      } }, el("span", { class: "list__main" }, `${s.name} ${lv} → ${R.stepLevel(lv, +1)}`), el("span", { class: "list__sub muted" }, `${cost} Humanity${afford ? "" : " — not enough"}`)));
    }
    body.append(list);
    body.append(el("div", { class: "modal__actions" }, el("button", { class: "btn btn--ghost", onClick: () => close() }, "Cancel")));
  } });
}
function baselineTest(ch, commit, rerender) {
  const full = ch.state.resolve >= maxResolve(ch);
  const low = ch.state.resolve < maxResolve(ch) / 2;
  proceduralRoll(ch, { skillKey: "insight", title: "Baseline Test — INSIGHT", adv: full ? 1 : 0, dis: low ? 1 : 0,
    note: `Advantage at full Resolve; disadvantage below half max. Takes a Shift at the LAPD (not Downtime).${full ? " [full Resolve → advantage]" : low ? " [low Resolve → disadvantage]" : ""}`,
    onResult: ({ successes }) => {
      if (successes >= 1) { commit((c) => { c.state.promotionPoints += 1; c.state.baselineFails = 0; (c.advancementLog ||= []).push("Passed a Baseline Test (+1 PP)."); }); showToast("Baseline passed: +1 Promotion Point."); }
      else commit((c) => {
        c.state.humanityPoints += 1;
        c.state.promotionPoints = Math.max(0, c.state.promotionPoints - 1);
        c.state.baselineFails = (c.state.baselineFails || 0) + 1;
        let penalty;
        if (c.state.baselineFails === 1) penalty = "Verbal warning.";
        else if (c.state.baselineFails === 2) { c.state.resolve = maxResolve(c); c.state.permanentResolveLoss = (c.state.permanentResolveLoss || 0) + 1; c.state.criticalStress = null; penalty = "Recalibration: all stress healed, −1 max Resolve (permanent)."; if (maxResolve(c) <= 0) { c.state.dead = true; penalty += " Lost final Resolve — retired."; } }
        else { c.state.dead = true; penalty = "Immediate retirement."; }
        (c.advancementLog ||= []).push(`Failed a Baseline Test (+1 Humanity, −1 PP). ${penalty}`);
        showToast(`Baseline failed (#${c.state.baselineFails}): ${penalty}`, { kind: "warn", timeout: 5000 });
      });
      rerender();
    } });
}

// ---- helpers --------------------------------------------------------------
// Case-insensitive substring match of any needle against carried item names.
function itemsInclude(ch, needles) {
  const names = (ch.inventory.items || []).map((it) => (it.name || "").toLowerCase());
  return needles.some((n) => names.some((nm) => nm.includes(n.toLowerCase())));
}

// Downscale an image to maxDim (longest side) and hand back a JPEG data URL.
function compressImage(file, maxDim, cb) {
  const img = new Image();
  const url = URL.createObjectURL(file);
  img.onload = () => {
    const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
    const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
    const canvas = el("canvas");
    canvas.width = w; canvas.height = h;
    canvas.getContext("2d").drawImage(img, 0, 0, w, h);
    URL.revokeObjectURL(url);
    try { cb(canvas.toDataURL("image/jpeg", 0.8)); }
    catch { showToast("Could not process that image.", { kind: "error" }); }
  };
  img.onerror = () => { URL.revokeObjectURL(url); showToast("Could not load that image.", { kind: "error" }); };
  img.src = url;
}
