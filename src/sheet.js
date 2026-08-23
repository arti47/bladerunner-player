// sheet.js — the full character sheet + in-play tracking UI (CLAUDE.md Phase 2).
// Live vitals clamped to true maxima, condition toggles, resource counters,
// attributes/skills/specialties display, faithful inventory (no encumbrance),
// flavor + notes + portrait. All mutations persist through Store immediately.
import { el, clear, titleCase, rollDie, uid } from "./core.js";
import * as D from "../data.js";
import * as R from "./rules.js";
import { maxHealth, maxResolve, reclampVitals, isBrokenByDamage, isBrokenByStress, downtimeLimitFor, applyInvestigationShift, applyDowntimeShift } from "./derived.js";
import { Store, RollLog } from "./store.js";
import { showToast, confirmModal, promptModal, modal, sectionTitle, rollLogCard } from "./ui.js";
import { navigate } from "./router.js";
import { Settings } from "./settings.js";
import { openSkillRoll, openWeaponPicker, proceduralRoll, openOpposedSkillRoll } from "./roller.js";
import { Sync, watchCharacter, uploadPortrait } from "./sync.js";

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

// ---- "How to use this" — per-section guidance ------------------------------
// The sheet is thirteen sections deep and assumes you know the game. Each entry
// is [what you press, when you press it and what happens]. Procedure only, no
// rules numbers (§10.2) — those live in the sections themselves.
const HOW = {
  "Vitals": [
    ["Health", "is physical punishment. − when you are hurt, + when you heal. At zero you are Broken and cannot act until you are patched up."],
    ["Resolve", "is mental pressure. It drops from stress, not wounds. At zero you break down and the sheet rolls the effect for you."],
    ["You rarely press these by hand", "— rolls, attacks and recovery move them on their own."],
  ],
  "Critical Injuries": [
    ["＋ Take a critical injury", "when a fight lands one on you. The app rolls the wound and, if it is lethal, walks the death saves and the patching-up."],
    ["Nothing here", "usually means nothing is wrong. Leave it alone."],
  ],
  "Resources": [
    ["Promotion", "is your standing in the department: earned on the job, spent on LAPD gear and new specialties."],
    ["Chinyen", "is street money for anything the department will not sign off on."],
    ["Humanity", "is earned for compassion and for touching your memories; it buys skill increases."],
    ["Solo play", "awards these from the checklists on the Solo ▸ Wrap tab."],
  ],
  "Conditions": [
    ["Tap one on", "when the fiction says so — you dived prone, you are behind cover, you took aim."],
    ["The engine reads them", "on your next roll, so you do not have to remember the modifier."],
    ["Broken", "is not in this list: it turns itself on when Health or Resolve hits zero."],
  ],
  "Attributes": [
    ["These never change in play", "— they were set at creation. They are here so you can see the die you roll."],
  ],
  "Skills": [
    ["Tap a skill to roll it", "— that is the main thing you do on this sheet. The app builds the dice and reads the result."],
    ["★ marks your key skills", "from your archetype: what your character is actually good at."],
    ["Not sure which to roll?", "Pick the one that matches what you are trying to do; the Rules Library says what each covers."],
  ],
  "Specialties": [
    ["These are your knacks", "— they bend a rule in your favour and the engine applies them for you where it can."],
    ["Buy more", "in the Advancement section with Promotion Points."],
  ],
  "Inventory": [
    ["＋ Add item", "for anything you pick up. No weight or slots to track — this game does not use them."],
    ["Equipped", "matters: attack rolls and armor only use what you are carrying ready."],
    ["🛒 Acquire gear", "buys from the catalog with Promotion or Chinyen Points and rolls for availability when the item is rare."],
  ],
  "Rest & Recovery": [
    ["▶ Investigation Shift", "when you spend a Shift working the case. Push past the limit and it costs you stress."],
    ["🛌 Downtime Shift", "when you take time off: you heal and the counter resets."],
    ["First aid", "patches up someone who is Broken. The once-per-Shift buttons are your gear and specialties doing their job."],
  ],
  "Advancement": [
    ["Between cases", "spend what you earned: Promotion Points buy a specialty, Humanity Points raise a skill one step."],
    ["Replicants", "take the Baseline Test here when it is due — the app tracks the consequences of failing."],
  ],
  "Roll Log": [
    ["Every roll you make", "lands here, newest last. Nothing to press unless you want to keep one."],
    ["📌", "copies a roll into this character's journal, so the moment survives the log's cap."],
  ],
  "Journal": [
    ["Write what happened", "in your own words — it is a diary, not a mechanic."],
    ["Solo players", "get more out of the case notes on Solo ▸ Notes; this is for the character's own story."],
  ],
  "Identity & Notes": [
    ["Key memory and relationship", "are mechanical: leaning on them in play earns Humanity, and the memory can buy you advantage on a roll."],
    ["Everything here is editable", "— tap a field, type, tap away."],
  ],
};

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

  if (Settings.solo()) wrap.append(backToSolo());
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
  wrap.append(rollLogSection(ch, commit, rerender));
  wrap.append(journalSection(ch, commit));
  wrap.append(identitySection(ch, commit));
  wrap.append(dangerZone(ch, mount));
  paintGuidance(wrap);

  mount.append(wrap);
}

// Attach the collapsed "how to use this" note to every section that has one.
function paintGuidance(wrap) {
  for (const cardEl of wrap.querySelectorAll(".card")) {
    const key = cardEl.querySelector(".sheet__section")?.textContent;
    if (!key || !HOW[key]) continue;
    cardEl.append(el("details", { class: "how" },
      el("summary", {}, "How to use this"),
      ...HOW[key].map(([what, when]) => el("p", { class: "how__line" },
        el("strong", {}, what), " ", el("span", { class: "muted" }, when)))));
  }
}

// ---- Header + portrait ----------------------------------------------------
function sheetHeader(ch, arch, y, commit) {
  const portrait = ch.identity.portraitUrl
    ? el("img", { class: "sheet__portrait", src: ch.identity.portraitUrl, alt: `Portrait of ${ch.name}` })
    : el("div", { class: "sheet__portrait sheet__portrait--empty", "aria-hidden": "true" }, "🕵");
  const fileInput = el("input", { type: "file", accept: "image/*", class: "visually-hidden", id: "portrait-file" });
  fileInput.addEventListener("change", () => {
    const f = fileInput.files?.[0];
    if (!f) return;
    compressImage(f, 400, async (dataUrl) => {
      // Shared characters put the portrait in Storage and mirror only the URL —
      // a base64 image in the character node would be re-sent on every save.
      let url = dataUrl;
      if (Sync.ready && Sync.inCampaign && ch.campaignId === Sync.campaignId) {
        const hosted = await uploadPortrait(ch.id, dataUrl).catch(() => null);
        if (hosted) url = hosted;
      }
      commit((c) => { c.identity.portraitUrl = url; });
    });
  });
  const head = el("div", { class: "card sheet__head" },
    el("label", { class: "sheet__portrait-wrap", for: "portrait-file", title: "Change portrait" }, portrait, fileInput),
    el("div", { class: "sheet__id" },
      el("div", { class: "card__title" }, ch.name),
      el("div", { class: "muted" }, `${titleCase(ch.nature)} · ${arch?.name || "—"} · ${y?.name || "—"}`),
      ch.identity.portraitUrl
        ? el("button", { class: "btn btn--sm btn--ghost", onClick: () => commit((c) => { c.identity.portraitUrl = ""; }) }, "Remove portrait")
        : null));
  // Secret Replicant (§3.5): the reveal switches on the full Replicant rules.
  if (ch.secretReplicant && ch.nature !== "replicant") {
    head.append(el("div", { class: "sheet__secret" },
      el("div", { class: "muted sheet__note" }, `Secret Replicant — ${D.SECRET_REPLICANT.note}`),
      el("button", { class: "btn btn--sm btn--danger", onClick: async () => {
        if (!(await confirmModal("Reveal that this Blade Runner is a Replicant? Max Health +2, max Resolve −2, and every push costs stress from now on.", { title: "Reveal Replicant", okLabel: "Reveal", danger: true }))) return;
        commit((c) => { c.nature = "replicant"; c.secretReplicant = false; (c.advancementLog ||= []).push("Revealed as a Replicant (+2 max Health, −2 max Resolve)."); });
        showToast("Revealed — Replicant rules now apply.", { kind: "warn", timeout: 4500 });
      } }, "Reveal Replicant identity")));
  }
  return head;
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
      el("span", { class: "stat__die muted" }, `d${D.LEVEL_DIE[lv]} · ${D.ATTR_LEVEL_DESC[lv]}`)));
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
      el("span", { class: "skill__lv", title: D.SKILL_LEVEL_DESC[lv] }, `${lv} · d${D.LEVEL_DIE[lv]}`, el("span", { class: "skill__die-cta muted" }, " ⚄"))));
  }
  return el("div", { class: "card" }, sectionTitle("Skills"),
    el("p", { class: "muted sheet__note" }, `Tap a skill to roll its Base Dice. ${D.LEVELS.map((l) => `${l} ${D.SKILL_LEVEL_DESC[l]}`).join(" · ")}.`), list,
    el("div", { class: "inv__actions" },
      el("button", { class: "btn btn--sm btn--roll", onClick: () => openOpposedSkillRoll(ch, rerender) }, "⚖ Opposed roll"),
      el("span", { class: "muted sheet__note" }, "Stealth vs Observation, Manipulation vs Insight, Interrogation vs Stamina, the Voight-Kampff test — only the initiator may push.")));
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
  const acquire = el("button", { class: "btn btn--sm", onClick: () => acquireGear(ch, commit, rerender) }, "⚖ Acquire gear");
  const sell = el("button", { class: "btn btn--sm btn--ghost", onClick: () => sellGear(ch, commit, rerender) }, "¥ Sell an item");
  const attack = el("button", { class: "btn btn--sm btn--roll", onClick: () => openWeaponPicker(ch, rerender) }, "⚔ Roll an attack");
  const armor = equippedArmor(ch);
  const card = el("div", { class: "card" }, sectionTitle("Inventory"), list);
  if (armor)
    card.append(el("div", { class: "muted sheet__note" },
      `Armor: ${armor.name} (${armor.rating}) — when hit, roll ${D.ARMOR_DICE}× d${D.LEVEL_DIE[armor.rating]}; each success stops 1 damage, and stopping it all negates the critical injury.` +
      (armor.disadvantage?.length ? ` Disadvantage to ${armor.disadvantage.map(R.skillName).join(", ")}.` : "")));
  card.append(el("div", { class: "inv__actions" }, add, acquire, sell, attack));
  return card;
}
// The one suit that counts — best-rated equipped armor  [§3.7].
function equippedArmor(ch) {
  const worn = (ch.inventory.items || []).filter((it) => it.equipped)
    .map((it) => D.ARMOR.find((a) => a.key === it.key || a.name.toLowerCase() === (it.name || "").toLowerCase()))
    .filter((a) => a && a.rating);
  return worn.sort((x, y) => D.LEVELS.indexOf(x.rating) - D.LEVELS.indexOf(y.rating))[0] || null;
}

// ---- Acquiring gear (§3.11) ------------------------------------------------
// Pay the Cost in Promotion Points (LAPD) or Chinyen Points (black market), then
// roll CONNECTIONS. Double payment = advantage. A failed roll costs the Shift,
// not the points.
function acquireGear(ch, commit, rerender) {
  const catalog = R.acquirableItems();
  modal({ title: "Acquire gear", render(body, close) {
    body.append(el("p", { class: "muted" }, `Promotion ${ch.state.promotionPoints} · Chinyen ${ch.state.chinyenPoints}. Cost is paid in points, then you roll ${R.skillName(D.ACQUISITION.skill)}.`));
    const cats = [...new Set(catalog.map((i) => i.cat))];
    for (const cat of cats) {
      const group = el("details", { class: "rules__group" }, el("summary", {}, cat));
      for (const item of catalog.filter((i) => i.cat === cat)) {
        group.append(el("button", { class: "list__row", onClick: () => { close(); chooseSource(ch, item, commit, rerender); } },
          el("span", { class: "list__main" }, item.name),
          el("span", { class: "list__sub muted" }, `${item.avail} · cost ${item.cost}`)));
      }
      body.append(group);
    }
    body.append(el("div", { class: "modal__actions" }, el("button", { class: "btn btn--ghost", onClick: () => close() }, "Cancel")));
  } });
}
// Selling on the black market  [Ch08 p207] — half the Cost, rounded up; a buyer
// for Premium or rarer goods needs a CONNECTIONS roll.
function sellGear(ch, commit, rerender) {
  const catalog = R.acquirableItems();
  const owned = (ch.inventory.items || []).map((it, i) => {
    const entry = catalog.find((c) => c.key === it.key || c.name.toLowerCase() === (it.name || "").toLowerCase());
    return { i, it, entry, price: entry ? R.sellPrice(entry.cost) : null };
  });
  modal({ title: "Sell an item", render(body, close) {
    body.append(el("p", { class: "muted" }, D.ACQUISITION.selling.note));
    if (!owned.length) { body.append(el("p", { class: "muted" }, "Nothing in your inventory.")); }
    const list = el("div", { class: "picker" });
    for (const row of owned) {
      const price = row.price;
      list.append(el("button", { class: "list__row", disabled: price == null || null, onClick: () => {
        close();
        const payout = () => commit((c) => {
          c.inventory.items.splice(row.i, 1);
          c.state[D.ACQUISITION.selling.currency] = (c.state[D.ACQUISITION.selling.currency] || 0) + price;
          (c.advancementLog ||= []).push(`Sold ${row.it.name} (+${price} ¥).`);
        });
        if (R.needsConnectionsRoll(row.entry.avail)) {
          proceduralRoll(ch, { skillKey: D.ACQUISITION.skill, title: `Sell ${row.it.name}`,
            note: `Finding a buyer for ${row.entry.avail} goods takes a Connections roll. Payout ${price} ¥.`,
            onResult: ({ successes }) => {
              if (successes >= 1) { payout(); showToast(`Sold ${row.it.name} for ${price} ¥.`); }
              else { showToast("No buyer this time — the item stays with you.", { kind: "warn" }); }
              rerender();
            } });
        } else {
          payout();
          showToast(`Sold ${row.it.name} for ${price} ¥.`);
          rerender();
        }
      } },
        el("span", { class: "list__main" }, row.it.name),
        el("span", { class: "list__sub muted" }, price == null
          ? "No listed Cost — the Game Runner sets the price."
          : `${row.entry.avail} · sells for ${price} ¥${R.needsConnectionsRoll(row.entry.avail) ? " (needs a buyer)" : ""}`)));
    }
    body.append(list);
    body.append(el("div", { class: "modal__actions" }, el("button", { class: "btn btn--ghost", onClick: () => close() }, "Cancel")));
  } });
}

function chooseSource(ch, item, commit, rerender) {
  const st = { source: D.ACQUISITION.sources[0].key, double: false, cost: R.costOf(item.cost) ?? 1 };
  modal({ title: `Acquire — ${item.name}`, render(body, close) {
    const paint = () => { body.replaceChildren(); view(body); };
    const view = (b) => {
      b.append(el("p", { class: "muted" }, `${item.avail} · listed cost ${item.cost}${R.costOf(item.cost) === null ? " (Game Runner's call — set it below)" : ""}`));
      b.append(el("div", { class: "field" }, el("label", { class: "field__label" }, "Where from"),
        el("div", { class: "chips" }, ...D.ACQUISITION.sources.map((s) =>
          el("button", { class: "chip" + (st.source === s.key ? " chip--on" : ""), onClick: () => { st.source = s.key; paint(); } }, s.name)))));
      const src = D.ACQUISITION.sources.find((s) => s.key === st.source);
      const pay = st.cost * (st.double ? 2 : 1);
      const have = ch.state[src.currency] || 0;
      b.append(el("div", { class: "stepper" },
        el("span", { class: "stepper__label" }, "Cost"),
        el("span", { class: "stepper__ctrl" },
          el("button", { class: "btn btn--sm", "aria-label": "decrease cost", onClick: () => { st.cost = Math.max(0, st.cost - 1); paint(); } }, "−"),
          el("span", { class: "stepper__val" }, st.cost),
          el("button", { class: "btn btn--sm", "aria-label": "increase cost", onClick: () => { st.cost++; paint(); } }, "+"))));
      b.append(el("label", { class: "picker__row" },
        (() => { const i = el("input", { type: "checkbox", checked: st.double || null }); i.addEventListener("change", () => { st.double = !st.double; paint(); }); return i; })(),
        el("span", {}, el("strong", {}, "Pay double"), " — ", el("span", { class: "muted" }, "advantage on the roll"))));
      const tier = R.availabilityTier(item.avail);
      const needsRoll = R.needsConnectionsRoll(item.avail);
      b.append(el("div", { class: "net-badge" + (have >= pay ? "" : " net-badge--dis") }, `Pays ${pay} ${src.symbol} — you have ${have}`));
      if (tier) b.append(el("div", { class: "muted sheet__note" },
        `${tier.key}: ${tier.time}${tier.cost !== "—" ? `, typical cost ${tier.cost}` : ""}. ` +
        (needsRoll ? D.ACQUISITION.failureNote : "No Connections roll needed at this availability — it is simply bought.")));
      const buy = (c) => {
        c.state[src.currency] = Math.max(0, (c.state[src.currency] || 0) - pay);
        c.inventory.items.push({ key: item.key, name: item.name, equipped: false });
        (c.advancementLog ||= []).push(`Acquired ${item.name} (−${pay} ${src.symbol}).`);
      };
      b.append(el("div", { class: "modal__actions" },
        el("button", { class: "btn btn--ghost", onClick: () => close() }, "Cancel"),
        needsRoll
          ? el("button", { class: "btn btn--primary", disabled: have < pay || null, onClick: () => {
              close();
              proceduralRoll(ch, {
                skillKey: D.ACQUISITION.skill, title: `${item.name} — ${src.name}`,
                adv: st.double && D.ACQUISITION.doublePaymentAdvantage ? 1 : 0,
                note: `${pay} ${src.symbol} on the table. ${tier ? tier.time + " to arrive." : ""}`,
                onResult: ({ successes }) => {
                  if (successes >= 1) {
                    commit(buy);
                    showToast(`Acquired ${item.name} for ${pay} ${src.symbol}.`);
                  } else {
                    commit((c) => { c.state.shiftsSinceDowntime = (c.state.shiftsSinceDowntime || 0) + 1; });
                    showToast(D.ACQUISITION.failureNote, { kind: "warn", timeout: 4000 });
                  }
                  rerender();
                },
              });
            } }, "⚄ Roll Connections")
          : el("button", { class: "btn btn--primary", disabled: have < pay || null, onClick: () => {
              close();
              commit(buy);
              showToast(`Bought ${item.name} for ${pay} ${src.symbol}.`);
              rerender();
            } }, `Buy for ${pay} ${src.symbol}`)));
    };
    paint();
  } });
}

// ---- Identity / flavor / notes --------------------------------------------
function identitySection(ch, commit) {
  const card = el("div", { class: "card" }, sectionTitle("Identity & Notes"));
  card.append(flavorField("Key memory", ch.identity.keyMemory, (v) => commit((c) => { c.identity.keyMemory = v; })));
  card.append(flavorField("Key relationship", ch.identity.keyRelationship, (v) => commit((c) => { c.identity.keyRelationship = v; })));
  // People Person grants a second key relationship with the same rules effects.
  if ((ch.specialties || []).some((s) => s === "people_person" || s?.key === "people_person"))
    card.append(flavorField("Second key relationship (People Person)", ch.identity.keyRelationship2 || "", (v) => commit((c) => { c.identity.keyRelationship2 = v; })));
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

// Solo sends you here to roll; this is the way back. Bottom-nav only was a
// one-way door in the middle of the loop.  [solo-flow audit]
function backToSolo() {
  return el("div", { class: "solo-return" },
    el("button", { class: "btn btn--sm btn--ghost", onClick: () => navigate("solo") }, "← Back to the solo case"));
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
          el("div", { class: "chips" }, ...D.DIE_SIZES.map((d) =>
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
const downtimeLimit = (ch) => downtimeLimitFor(ch);   // §3.8 transitions live in derived.js
function downtimeShift(ch, commit, care) {
  let r;
  commit((c) => { r = applyDowntimeShift(c, care); });
  showToast(`Downtime Shift: +${r.health} Health, +${r.resolve} Resolve.`);
}
function investigationShift(ch, commit) {
  let r;
  commit((c) => { r = applyInvestigationShift(c); });
  showToast([r.overLimit ? "Investigation Shift — over the limit: +1 stress." : "Investigation Shift logged.",
    r.brokenHeal ? `Broken and alone: +${r.brokenHeal} Health.` : ""].filter(Boolean).join(" "));
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
  // Signature item: interacting with it heals 1 stress, once per session [Ch02 p034].
  if ((ch.identity.signatureItem || "").trim())
    out.push({ key: "signature_item", label: `Signature item (${ch.identity.signatureItem})`, desc: `heal ${D.SIGNATURE_ITEM_HEAL.resolve} stress`, resolve: D.SIGNATURE_ITEM_HEAL.resolve });
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
  card.append(milestoneRow(ch, commit, rerender));
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


// ---- Case / session milestones + Promotion Point losses --------------------
// Wires the specialty effects that only fire at those beats: Cashflow (+1
// Chinyen per Case File), Sycophant (+1 Promotion Point per session), and
// Protected (a CONNECTIONS roll that shaves a Promotion Point loss).
const hasSpecialty = (ch, key) => (ch.specialties || []).some((s) => s === key || s?.key === key);
function specialtyEffect(key) { return D.SPECIALTIES.find((s) => s.key === key)?.effect || {}; }

function milestoneRow(ch, commit, rerender) {
  const row = el("div", { class: "rec-actions" });
  const cash = specialtyEffect("cashflow").chinyenPerCase;
  const syco = specialtyEffect("sycophant").promotionPerSession;
  if (hasSpecialty(ch, "cashflow"))
    row.append(el("button", { class: "btn btn--sm", onClick: () => commit((c) => {
      c.state.chinyenPoints = (c.state.chinyenPoints || 0) + cash;
      (c.advancementLog ||= []).push(`New Case File — Cashflow (+${cash} Chinyen).`);
      showToast(`Cashflow: +${cash} Chinyen for the new case.`);
    }) }, `New Case File (+${cash} ¥)`));
  if (hasSpecialty(ch, "sycophant"))
    row.append(el("button", { class: "btn btn--sm", onClick: () => commit((c) => {
      c.state.promotionPoints = (c.state.promotionPoints || 0) + syco;
      (c.advancementLog ||= []).push(`End of session — Sycophant (+${syco} PP).`);
      showToast(`Sycophant: +${syco} Promotion Point.`);
    }) }, `End of session (+${syco} PP)`));
  row.append(el("button", { class: "btn btn--sm btn--ghost", onClick: () => losePromotion(ch, commit, rerender) }, "− Lose Promotion Points"));
  if (hasSpecialty(ch, "counselor"))
    row.append(el("button", { class: "btn btn--sm", disabled: ch.state.shiftUses?.counselor || null,
      onClick: () => counselAnother(ch, commit, rerender) }, "Counsel another character"));
  return row;
}

// Losing Promotion Points for misconduct. With Protected, roll CONNECTIONS —
// each success reduces the loss by one (minimum zero).  [§3.10]
function losePromotion(ch, commit, rerender) {
  const st = { amount: 1 };
  modal({ title: "Lose Promotion Points", render(body, close) {
    const paint = () => { body.replaceChildren(); view(body); };
    const view = (b) => {
      b.append(el("p", { class: "muted" }, `Misconduct costs Promotion Points (minimum 0). You have ${ch.state.promotionPoints}.`));
      b.append(el("div", { class: "stepper" },
        el("span", { class: "stepper__label" }, "Points lost"),
        el("span", { class: "stepper__ctrl" },
          el("button", { class: "btn btn--sm", "aria-label": "decrease loss", onClick: () => { st.amount = Math.max(1, st.amount - 1); paint(); } }, "−"),
          el("span", { class: "stepper__val" }, st.amount),
          el("button", { class: "btn btn--sm", "aria-label": "increase loss", onClick: () => { st.amount++; paint(); } }, "+"))));
      const protectedBy = hasSpecialty(ch, "protected");
      b.append(el("div", { class: "muted sheet__note" }, protectedBy
        ? D.SPECIALTIES.find((x) => x.key === "protected").text
        : "A Connections roll or a disciplinary action follows the loss (Game Runner's call)."));
      b.append(el("div", { class: "modal__actions" },
        el("button", { class: "btn btn--ghost", onClick: () => close() }, "Cancel"),
        protectedBy
          ? el("button", { class: "btn btn--primary", onClick: () => {
              close();
              proceduralRoll(ch, { skillKey: "connections", title: "Protected — CONNECTIONS",
                note: `Each success reduces the ${st.amount}-point loss by one.`,
                onResult: ({ successes }) => {
                  const lost = Math.max(0, st.amount - successes);
                  commit((c) => {
                    c.state.promotionPoints = Math.max(0, (c.state.promotionPoints || 0) - lost);
                    (c.advancementLog ||= []).push(`Misconduct: −${lost} PP (Protected shaved ${st.amount - lost}).`);
                  });
                  showToast(`Protected: lost ${lost} of ${st.amount} Promotion Points.`, { kind: "warn" });
                  rerender();
                } });
            } }, "⚄ Roll Connections")
          : el("button", { class: "btn btn--danger", onClick: () => {
              close();
              commit((c) => {
                c.state.promotionPoints = Math.max(0, (c.state.promotionPoints || 0) - st.amount);
                (c.advancementLog ||= []).push(`Misconduct: −${st.amount} PP.`);
              });
              showToast(`Lost ${st.amount} Promotion Point${st.amount === 1 ? "" : "s"}.`, { kind: "warn" });
            } }, `Lose ${st.amount}`)));
    };
    paint();
  } });
}

// Counselor: once per Shift, heal 1 stress on ANOTHER character.  [Ch03]
function counselAnother(ch, commit, rerender) {
  const others = Store.list().filter((c) => c.id !== ch.id && !c.state.dead);
  modal({ title: "Counsel another character", render(body, close) {
    body.append(el("p", { class: "muted" }, D.SPECIALTIES.find((x) => x.key === "counselor").text));
    if (!others.length) {
      body.append(el("p", { class: "muted" }, "No other characters on this device."));
      body.append(el("div", { class: "modal__actions" }, el("button", { class: "btn btn--ghost", onClick: () => close() }, "Close")));
      return;
    }
    const list = el("div", { class: "picker" });
    for (const other of others) {
      list.append(el("button", { class: "list__row", onClick: () => {
        close();
        const target = Store.get(other.id);
        target.state.resolve = Math.min(maxResolve(target), target.state.resolve + 1);
        if (target.state.resolve >= 1) target.state.criticalStress = null;
        Store.save(target);
        commit((c) => { (c.state.shiftUses ||= {}).counselor = true; });
        showToast(`${other.name} heals 1 stress.`);
        rerender();
      } },
        el("span", { class: "list__main" }, other.name),
        el("span", { class: "list__sub muted" }, `Resolve ${other.state.resolve}/${maxResolve(other)}`)));
    }
    body.append(list);
    body.append(el("div", { class: "modal__actions" }, el("button", { class: "btn btn--ghost", onClick: () => close() }, "Cancel")));
  } });
}

// ---- Roll Log (global store, filtered per character) ----------------------
let rollLogScope = "char"; // "char" | "all" — persists across sheet re-renders
function rollLogSection(ch, commit, rerender) {
  const card = el("div", { class: "card" }, sectionTitle("Roll Log"));
  card.append(el("div", { class: "chips" },
    scopeChip("This character", rollLogScope === "char", () => { rollLogScope = "char"; rerender(); }),
    scopeChip("All rolls", rollLogScope === "all", () => { rollLogScope = "all"; rerender(); })));
  const all = RollLog.list();
  const entries = (rollLogScope === "char" ? all.filter((e) => e.charId === ch.id) : all)
    .slice(0, 30)
    .map((e) => (rollLogScope === "all" && e.charName ? { ...e, label: `${e.charName} · ${e.label}` } : e));
  card.append(rollLogCard({
    entries,
    pinLabel: "Pin to this character's journal",
    onPin: (e) => commit((c) => { (c.journal ||= []).unshift({ id: uid(), ts: Date.now(), text: `[${e.label}] ${e.text}` }); showToast("Pinned to journal."); }),
    onDelete: (e) => { RollLog.remove(e.id); rerender(); },
    onClear: async () => { if (await confirmModal("Clear the entire roll log?", { title: "Clear roll log", danger: true })) { RollLog.clear(); rerender(); } },
  }));
  return card;
}
function scopeChip(label, on, onClick) { return el("button", { class: "chip" + (on ? " chip--on" : ""), onClick }, label); }

// ---- Journal (per character) ----------------------------------------------
function journalSection(ch, commit) {
  const card = el("div", { class: "card" }, sectionTitle("Journal"));
  const entries = ch.journal || [];
  card.append(el("button", { class: "btn btn--sm", onClick: async () => {
    const text = await promptModal("Journal entry", { title: "New journal entry", okLabel: "Add" });
    if (text && text.trim()) commit((c) => { (c.journal ||= []).unshift({ id: uid(), ts: Date.now(), text: text.trim() }); });
  } }, "＋ Add entry"));
  if (!entries.length) { card.append(el("p", { class: "muted sheet__note" }, "No journal entries yet. Add your own, or pin a roll from the Roll Log.")); return card; }
  for (const e of entries) {
    card.append(el("div", { class: "journal__entry" },
      el("div", { class: "journal__head" },
        el("span", { class: "muted journal__ts" }, new Date(e.ts).toLocaleString()),
        el("button", { class: "btn btn--sm btn--ghost", "aria-label": "delete entry", onClick: () => commit((c) => { c.journal = (c.journal || []).filter((x) => x.id !== e.id); }) }, "✕")),
      el("div", { class: "journal__text" }, e.text)));
  }
  return card;
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
