// board.js — the Case Board, a HOUSE AID for solo play (see data-house.js).
//
// A numbered board of clues and suspects with connections drawn between them.
// It holds no rules of its own: every number and procedure comes from
// data-house.js, and everything written ON a box is rolled from the official
// Solo Mode tables (Imagining Clues, the character generator, Cipher).
//
// It never awards points. When the board names a culprit it hands the case back
// to the book by offering to create a hypothesis — the Hypothesis Check on the
// Leads tab is what actually pays out.
//
// State lives in brp:board, separate from brp:solo so the board survives a
// note-clear; Solo's "Start a fresh case" wipes it explicitly.

import * as H from "../data-house.js";
import * as S from "../data-solo.js";
import { el, uid, rollDie } from "./core.js";
import { modal, showToast, confirmModal, promptModal } from "./ui.js";
import { rollColumn, rollGrouped, lookupRange } from "./rules.js";

const BOARD_KEY = "brp:board";
const EMPTY = { boxes: [], nextN: 1, checks: 0, solvedId: null };

export const Board = {
  get() {
    try {
      const raw = localStorage.getItem(BOARD_KEY);
      if (raw) {
        const b = { ...EMPTY, ...JSON.parse(raw) };
        b.boxes = (b.boxes || []).map((x) => ({ links: [], ...x }));
        return b;
      }
    } catch (e) {}
    return { ...EMPTY, boxes: [] };
  },
  save(b) { try { localStorage.setItem(BOARD_KEY, JSON.stringify(b)); } catch (e) {} },
  clear() { Board.save({ ...EMPTY, boxes: [] }); },
  // Bank a Discovery Check earned elsewhere (a successful investigative roll).
  earn(n = 1) { const b = Board.get(); b.checks = Math.max(0, (b.checks || 0) + n); Board.save(b); return b.checks; },
  checks() { return Board.get().checks || 0; },
};

// ---- pure board operations (exported for the regression harness) -----------

export const boxesOf = (b, kind) => b.boxes.filter((x) => x.kind === kind);
export const byId = (b, id) => b.boxes.find((x) => x.id === id) || null;
export const connectionsOf = (b, box) => (box?.links || []).length;
export const isFull = (b) => b.boxes.length >= H.BOX_MAX;

// A connection is only ever clue ↔ suspect, and never doubled.
export function canConnect(a, z) {
  if (!a || !z || a.id === z.id) return false;
  if (H.CONNECTS[a.kind] !== z.kind) return false;
  return !(a.links || []).includes(z.id);
}
export function connect(b, aId, zId) {
  const a = byId(b, aId), z = byId(b, zId);
  if (!canConnect(a, z)) return false;
  a.links.push(z.id);
  z.links.push(a.id);
  return true;
}
export function addBox(b, kind, name, detail = "") {
  if (isFull(b)) return null;
  const box = { id: uid(), n: b.nextN, kind, name, detail, links: [] };
  b.nextN += 1;
  b.boxes.push(box);
  return box;
}
export function removeBox(b, id) {
  const box = byId(b, id);
  if (!box) return false;
  for (const other of b.boxes) other.links = (other.links || []).filter((x) => x !== id);
  b.boxes = b.boxes.filter((x) => x.id !== id);
  if (b.solvedId === id) b.solvedId = null;
  return true;
}
// The suspect the evidence points hardest at (ties are left to the player).
export function leadingSuspect(b) {
  const ranked = boxesOf(b, "suspect").slice().sort((x, y) => connectionsOf(b, y) - connectionsOf(b, x));
  return ranked[0] || null;
}
export const isClincherByWeight = (b) => {
  const top = leadingSuspect(b);
  return !!top && connectionsOf(b, top) >= H.CLINCHER_CONNECTIONS;
};

// Pick a box at random with the smallest die that reaches the board. `accept`
// decides which boxes the roll may land on — skipping forward past any it may
// not, which is how a clue-to-clue result is resolved. A roll past the last box
// is not re-rolled: the caller decides (the UI asks the player to choose).
export function matrixRoll(b, accept = null) {
  const die = H.matrixDie(b.boxes.length);
  const face = rollDie(die);
  const ordered = b.boxes.slice().sort((x, y) => x.n - y.n);
  if (face > ordered.length) return { die, face, box: null, overflow: true };
  let i = ordered.findIndex((x) => x.n >= face);
  if (i < 0) i = 0;
  for (let step = 0; step < ordered.length; step++) {
    const cand = ordered[(i + step) % ordered.length];
    if (!accept || accept(cand)) return { die, face, box: cand, overflow: false };
  }
  return { die, face, box: null, overflow: false };
}

// The discovery roll: D100 + boxes already on the board.
export function discoveryRoll(b) {
  const face = rollDie(H.DISCOVERY_ROLL.die);
  const total = face + (H.DISCOVERY_ROLL.addBoxCount ? b.boxes.length : 0);
  const outcome = lookupRange(H.DISCOVERY_OUTCOMES, total) || H.DISCOVERY_OUTCOMES[0];
  return { face, total, outcome };
}
// An outcome the board cannot honour degrades rather than being re-rolled.
export function resolvableEffect(b, effect) {
  const clues = boxesOf(b, "clue"), suspects = boxesOf(b, "suspect");
  const need = {
    "clue+link": suspects.length > 0,
    "suspect+link": clues.length > 0,
    link: clues.some((c) => suspects.some((s) => canConnect(c, s))),
    clincher: suspects.length > 0,
  };
  if (effect in need && !need[effect]) return H.DISCOVERY_FALLBACK;
  if ((effect === "clue" || effect === "suspect" || effect === "clue+link" || effect === "suspect+link") && isFull(b))
    return H.DISCOVERY_FALLBACK;
  return effect;
}

// ---- content, rolled from the official Solo Mode tables --------------------

export function rollClue() {
  const meaning = S.CLUE_MEANING[rollDie(8) - 1];
  const desc = rollGrouped(S.CLUE_EVIDENCE_DESCRIPTOR).entry;
  const type = rollGrouped(S.CLUE_EVIDENCE_TYPE).entry;
  return { name: `${desc.result} ${type}`, detail: `${desc.detail} Meaning: ${meaning}.` };
}
export function rollSuspect() {
  const sphere = rollGrouped(S.CHARACTER_SPHERE).entry;
  const trait = rollGrouped(S.CHARACTER_TRAIT).entry;
  const nat = lookupRange(S.NPC_NATURE, rollDie(10));
  const skill = lookupRange(S.NPC_SKILL_LEVEL, rollDie(8));
  return { name: `${trait} ${sphere} contact`, detail: `${nat.result}. ${skill.name} (${skill.dice}).` };
}
// Two words to interpret when you would rather write the box yourself.
export function rollPrompt() {
  const m = rollColumn(S.CIPHER_METHOD), f = rollColumn(S.CIPHER_FOCUS);
  return `${m.entry} × ${f.entry}`;
}

// ---- the panel -------------------------------------------------------------
// ctx supplies the Solo screen's own builders so the board looks native:
//   { card, btn, grid, show, rerender, onPromote }

export function renderBoardPanel(root, ctx) {
  const { card, btn, grid, show, rerender, onPromote } = ctx;
  const b = Board.get();
  const commit = () => { Board.save(b); rerender(); };

  const label = (box) => `${box.kind === "clue" ? "C" : "S"}${box.n}`;
  const noteLine = (box, extra = "") => `[Board ${label(box)}] ${box.name}${extra}`;

  // ---- the board itself
  const boardCard = card("Case Board", H.BOARD.blurb);
  boardCard.prepend(el("div", { class: "roll-eyebrow step-eyebrow" }, "House aid"));
  boardCard.append(el("p", { class: "muted small" },
    `${b.boxes.length}/${H.BOX_MAX} boxes · ${boxesOf(b, "clue").length} clues · ${boxesOf(b, "suspect").length} suspects`));

  if (!b.boxes.length) {
    boardCard.append(el("p", { class: "muted" }, "Empty board. Add the first clue or suspect below — roll one from the Solo tables, or write your own."));
  } else {
    boardCard.append(boxList("Suspects", boxesOf(b, "suspect")), boxList("Clues", boxesOf(b, "clue")));
  }

  boardCard.append(grid(
    btn("🎲 ＋ Clue", () => addRolled("clue"), "sm"),
    btn("🎲 ＋ Suspect", () => addRolled("suspect"), "sm"),
    btn("✍ ＋ Clue", () => addTyped("clue"), "sm ghost"),
    btn("✍ ＋ Suspect", () => addTyped("suspect"), "sm ghost"),
  ));
  boardCard.append(el("div", { class: "btn-row" },
    btn("🔗 Connect two boxes", () => connectFlow(), "sm ghost"),   // wrapped: btn passes the click event on
    btn("🎲 Prompt (Cipher)", () => {
      const words = rollPrompt();
      show({ label: "Board prompt", text: words, pin: `[Board] Prompt: ${words}`, title: "Two words to interpret",
        render: (bd) => bd.append(el("h3", { class: "roll-result roll-result--big" }, words)) });
    }, "sm ghost"),
    b.boxes.length ? btn("✕ Clear the board", async () => {
      if (await confirmModal("Wipe every clue, suspect and connection from the board? Your case notes are not touched.", { title: "Clear the board", danger: true, okLabel: "Wipe the board" })) {
        Board.clear(); showToast("Board cleared."); rerender();
      }
    }, "sm ghost") : null,
  ));
  root.append(boardCard);

  // ---- the discovery roll
  const checks = b.checks || 0;
  const disc = card("Discovery Check", H.DISCOVERY_ROLL.note);
  disc.prepend(el("div", { class: "roll-eyebrow step-eyebrow" }, "House aid"));
  disc.append(el("p", { class: checks ? "roll-result--ok" : "muted" },
    checks ? `${checks} check${checks === 1 ? "" : "s"} banked — earned by your investigative rolls.`
           : "None banked. Succeed on an investigative roll on your sheet and the result offers you one."));
  disc.append(grid(btn("🎲 Discovery Check", runDiscovery, "primary")));
  root.append(disc);

  // ---- the answer
  const solved = b.solvedId ? byId(b, b.solvedId) : null;
  const top = leadingSuspect(b);
  if (solved || (top && connectionsOf(b, top) >= H.CLINCHER_CONNECTIONS)) {
    const who = solved || top;
    const ans = card("The answer", H.PROMOTE.note);
    ans.prepend(el("div", { class: "roll-eyebrow step-eyebrow" }, "House aid"));
    ans.append(el("h3", { class: "roll-result roll-result--big" }, who.name),
      el("p", { class: "muted" }, solved
        ? `A clincher named ${label(who)}.`
        : `${label(who)} carries ${connectionsOf(b, who)} connections — the board says this is your culprit.`));
    ans.append(el("div", { class: "btn-row" }, btn("★ Promote to a hypothesis →", () => promote(who), "primary")));
    root.append(ans);
  }

  // ---- builders ------------------------------------------------------------

  // Declared as a function, not a const: the render body below calls boxList()
  // before these builders are reached, and a const would still be in its TDZ.
  function named(button, name) { button.setAttribute("aria-label", name); button.title = name; return button; }

  function boxList(title, list) {
    const wrap = el("div", { class: "board__group" }, el("div", { class: "roll-eyebrow" }, `${title} (${list.length})`));
    if (!list.length) { wrap.append(el("p", { class: "muted small" }, "None yet.")); return wrap; }
    for (const box of list.slice().sort((x, y) => x.n - y.n)) {
      const links = (box.links || []).map((id) => byId(b, id)).filter(Boolean);
      const row = el("div", { class: "board__box" + (b.solvedId === box.id ? " board__box--solved" : "") },
        el("div", { class: "board__head" },
          el("span", { class: "board__tag" }, label(box)),
          el("span", { class: "board__name" }, box.name),
          box.kind === "suspect" ? el("span", { class: "board__count", title: "connections" }, `🔗 ${links.length}`) : null),
        box.detail ? el("p", { class: "muted small board__detail" }, box.detail) : null,
        links.length ? el("p", { class: "muted small" }, `Connected: ${links.map(label).join(", ")}`) : null,
        el("div", { class: "btn-row" },
          // Icon-only buttons carry their own accessible name.
          named(btn("🔗", () => connectFlow(box), "sm ghost"), `Connect ${label(box)}`),
          box.kind === "suspect" ? named(btn("★", () => promote(box), "sm ghost"), `Promote ${label(box)} to a hypothesis`) : null,
          named(btn("📌", () => { ctx.pin(noteLine(box, box.detail ? ` — ${box.detail}` : "")); }, "sm ghost"), `Pin ${label(box)} to the case notes`),
          named(btn("✕", async () => {
            if (await confirmModal(`Take ${label(box)} “${box.name}” off the board?`, { title: "Remove box", danger: true, okLabel: "Remove" })) {
              removeBox(b, box.id); commit();
            }
          }, "sm ghost"), `Remove ${label(box)} from the board`)));
      wrap.append(row);
    }
    return wrap;
  }

  // ---- actions -------------------------------------------------------------

  async function guardFull() {
    if (!isFull(b)) return true;
    showToast(`The board holds ${H.BOX_MAX} boxes — retire one before adding another.`, { kind: "warn" });
    return false;
  }

  async function addRolled(kind) {
    if (!(await guardFull())) return;
    const rolled = kind === "clue" ? rollClue() : rollSuspect();
    const box = addBox(b, kind, rolled.name, rolled.detail);
    Board.save(b);
    show({ label: kind === "clue" ? "Board clue" : "Board suspect", text: `${label(box)} · ${box.name}`,
      pin: noteLine(box, ` — ${box.detail}`), title: `New ${kind} — ${label(box)}`,
      render: (bd) => bd.append(el("h3", { class: "roll-result" }, box.name), el("p", { class: "muted" }, box.detail)) });
  }

  async function addTyped(kind) {
    if (!(await guardFull())) return;
    const name = await promptModal(kind === "clue" ? "What is the clue?" : "Who is the suspect?", { title: `Add a ${kind}`, okLabel: "Add" });
    if (!name || !name.trim()) return;
    addBox(b, kind, name.trim());
    commit();
  }

  // Connect a box to a legal partner: roll the board for one, or pick.
  function connectFlow(from = null) {
    const partnersFor = (src) => b.boxes.filter((x) => canConnect(src, x));
    const start = from || b.boxes.find((x) => partnersFor(x).length);
    if (!start) { showToast("Nothing to connect yet — you need a clue and a suspect.", { kind: "warn" }); return; }
    const options = partnersFor(start);
    if (!options.length) { showToast(`${label(start)} is already connected to everything it can reach.`, { kind: "warn" }); return; }

    modal({
      title: `Connect ${label(start)} — ${start.name}`,
      render: (body, close) => {
        body.append(el("p", { class: "muted small" }, `Clues connect to suspects only. ${options.length} option${options.length === 1 ? "" : "s"}.`));
        const list = el("div", { class: "board__pick" });
        for (const o of options) {
          list.append(btn(`${label(o)} · ${o.name}`, () => {
            connect(b, start.id, o.id);
            close();
            showToast(`${label(start)} ↔ ${label(o)} connected.`);
            commit();
          }, "sm ghost"));
        }
        body.append(list, el("div", { class: "btn-row" },
          btn("🎲 Let the board decide", () => {
            const res = matrixRoll(b, (x) => canConnect(start, x));
            if (!res.box) { showToast(`D${res.die}→${res.face} landed past the board — pick one instead.`, { kind: "warn" }); return; }
            if (!connect(b, start.id, res.box.id)) { showToast("That link already exists — pick one instead.", { kind: "warn" }); return; }
            Board.save(b);
            close();
            show({ label: "Connection", text: `${label(start)} ↔ ${label(res.box)}`,
              pin: `[Board] ${label(start)} ${start.name} ↔ ${label(res.box)} ${res.box.name}`,
              title: `Connection — D${res.die}→${res.face}`,
              render: (bd) => bd.append(el("h3", { class: "roll-result" }, `${label(start)} ↔ ${label(res.box)}`),
                el("p", { class: "muted" }, `${start.name} — ${res.box.name}. Why are these two linked?`)) });
          }, "sm")));
      },
    });
  }

  async function runDiscovery() {
    if (!(b.checks > 0)) {
      const ok = await confirmModal("You have no banked Discovery Checks. Succeed on an investigative roll, or spend a scene searching. Roll anyway?",
        { title: "No check banked", okLabel: "Roll anyway" });
      if (!ok) return;
    } else { b.checks -= 1; }

    const before = b.boxes.length;
    const { face, total, outcome } = discoveryRoll(b);
    const effect = resolvableEffect(b, outcome.effect);
    const lines = [];
    let created = null, linked = null, clincher = false;

    if (effect === "clue" || effect === "clue+link" || effect === "suspect" || effect === "suspect+link" || effect === "clincher") {
      const kind = effect.startsWith("suspect") ? "suspect" : "clue";
      const rolled = kind === "clue" ? rollClue() : rollSuspect();
      created = addBox(b, kind, rolled.name, rolled.detail);
      lines.push(`${label(created)} — ${created.name}`, created.detail);
    }
    if (effect === "clue+link" || effect === "suspect+link" || effect === "clincher") {
      const res = matrixRoll(b, (x) => canConnect(created, x));
      if (res.box && connect(b, created.id, res.box.id)) {
        linked = res.box;
        lines.push(`Connects to ${label(res.box)} — ${res.box.name} (D${res.die}→${res.face}).`);
      }
    }
    if (effect === "link") {
      const clue = boxesOf(b, "clue").find((c) => boxesOf(b, "suspect").some((s) => canConnect(c, s)));
      const res = clue ? matrixRoll(b, (x) => canConnect(clue, x)) : { box: null };
      const target = res.box || (clue ? boxesOf(b, "suspect").find((s) => canConnect(clue, s)) : null);
      if (clue && target && connect(b, clue.id, target.id)) {
        linked = target;
        lines.push(`${label(clue)} — ${clue.name} turns out to connect to ${label(target)} — ${target.name}.`);
      }
    }
    if (effect === "clincher" && linked) { b.solvedId = linked.id; clincher = true; }
    // A suspect can also reach the threshold on connections alone.
    if (!clincher && isClincherByWeight(b)) { b.solvedId = leadingSuspect(b).id; clincher = true; }

    Board.save(b);
    const heading = effect === H.DISCOVERY_FALLBACK && outcome.effect !== H.DISCOVERY_FALLBACK
      ? "Nothing useful — the board had nothing to hang that on."
      : outcome.text;
    show({
      label: "Discovery Check",
      text: `D100→${face} +${before} = ${total} · ${clincher ? "CLINCHER" : effect}`,
      pin: `[Discovery] ${heading}${lines.length ? " " + lines.join(" ") : ""}`,
      title: `Discovery Check — ${face} + boxes = ${total}`,
      render: (bd) => {
        bd.append(el("h3", { class: "roll-result" + (clincher ? " roll-result--warn" : "") }, clincher ? "The clincher" : heading));
        if (clincher) bd.append(el("p", {}, heading));
        for (const line of lines) bd.append(el("p", { class: "muted" }, line));
        if (clincher && b.solvedId) bd.append(el("p", { class: "roll-result--ok" }, `${byId(b, b.solvedId).name} is your answer. Promote it to a hypothesis and test it.`));
      },
    });
  }

  async function promote(box) {
    const text = await promptModal("The theory to test:", { title: "Promote to a hypothesis", value: H.PROMOTE.template(box.name), okLabel: "Add to Leads" });
    if (!text || !text.trim()) return;
    onPromote(text.trim());
    showToast("Added to Leads — rate it, then run the Hypothesis Check.");
  }
}
