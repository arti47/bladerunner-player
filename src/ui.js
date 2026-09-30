// ui.js — themed modal/toast/confirm/prompt primitives. No native alert/confirm.
// Accessible: focus trap, Escape, aria-modal, focus restore.
import { el, $, $$, clear, appendToNotes } from "./core.js";
import { Settings } from "./settings.js";

let modalHost = null;
function host() {
  if (!modalHost) {
    modalHost = el("div", { id: "modal-host" });
    document.body.append(modalHost);
  }
  return modalHost;
}

// `action: { label, onClick }` adds a button to the toast (used by the
// "new version" prompt). `timeout: 0` keeps the toast up until it is dismissed
// — an actionable toast must not vanish before it can be pressed.
export function showToast(message, { kind = "info", timeout = 2600, action = null } = {}) {
  let region = $("#toast-region");
  if (!region) {
    region = el("div", { id: "toast-region", "aria-live": "polite", "aria-atomic": "true" });
    document.body.append(region);
  }
  const t = el("div", { class: `toast toast--${kind}`, role: "status" }, el("span", { class: "toast__msg" }, message));
  const dismiss = () => { t.classList.remove("toast--in"); setTimeout(() => t.remove(), 200); };
  if (action?.label) {
    t.classList.add("toast--action");
    t.append(el("button", { class: "toast__btn", onClick: () => { dismiss(); action.onClick?.(); } }, action.label));
    t.append(el("button", { class: "toast__close", "aria-label": "Dismiss", onClick: dismiss }, "\u2715"));
  }
  region.append(t);
  requestAnimationFrame(() => t.classList.add("toast--in"));
  if (timeout > 0) setTimeout(dismiss, timeout);
  return { dismiss };
}

// Screen-reader announcement through the one polite live region in the shell
// (the screen mount itself is NOT live — a re-render would read the whole page).
export function announce(text) {
  const live = document.getElementById("live");
  if (!live || !text) return;
  live.textContent = "";
  requestAnimationFrame(() => { live.textContent = String(text); });
}

// Core modal. Returns { close }. `render(body, close)` fills the body.
// `sheet: true` presents a long list as a bottom sheet on a phone (a centred box
// on wider screens); `search: true` adds a filter over its rows.
export function modal({ title = "", render, dismissable = true, onClose, sheet = false, search = false } = {}) {
  const prevFocus = document.activeElement;
  const overlay = el("div", { class: "modal-overlay" + (sheet ? " modal-overlay--sheet" : "") });
  const dialog = el("div", { class: "modal" + (sheet ? " modal--sheet" : ""), role: "dialog", "aria-modal": "true", "aria-label": title || "Dialog" });
  const header = title ? el("div", { class: "modal__header" }, el("h2", { class: "modal__title" }, title)) : null;
  const body = el("div", { class: "modal__body" });
  if (header) dialog.append(header);
  dialog.append(body);
  overlay.append(dialog);
  host().append(overlay);

  function close(result) {
    overlay.remove();
    document.removeEventListener("keydown", onKey, true);
    if (typeof onClose === "function") onClose(result);
    if (prevFocus && prevFocus.focus) try { prevFocus.focus(); } catch {}
  }
  function onKey(e) {
    if (e.key === "Escape" && dismissable) { e.preventDefault(); close(); }
    if (e.key === "Tab") trapFocus(e, dialog);
  }
  document.addEventListener("keydown", onKey, true);
  if (dismissable) overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });

  if (typeof render === "function") render(body, close);
  if (search) body.prepend(searchFilter(body));
  // focus first focusable
  requestAnimationFrame(() => {
    // On a touch screen, do not open the keyboard by focusing a picker's search.
    const touch = !!window.matchMedia?.("(pointer: coarse)").matches;
    const f = dialog.querySelector(touch ? "button, [href], input:not(.picker-search), select, textarea, [tabindex]" : "button, [href], input, select, textarea, [tabindex]");
    (f || dialog).focus?.();
  });
  return { close, dialog, body };
}

// Filter the rows of a picker as you type. Groups (<details>) open while a
// search is active and hide when nothing in them matches.
const PICK_ROWS = ".list__row, .picker__row, .picker__row--btn, .board__pick .btn, .choice";
function searchFilter(body) {
  const input = el("input", { class: "input picker-search", type: "search", placeholder: "Search…", "aria-label": "Filter this list", autocomplete: "off" });
  const count = el("span", { class: "picker-search__count muted", "aria-live": "polite" });
  input.addEventListener("input", () => {
    const q = input.value.trim().toLowerCase();
    let shown = 0;
    for (const row of body.querySelectorAll(PICK_ROWS)) {
      const hit = !q || row.textContent.toLowerCase().includes(q);
      row.hidden = !hit;
      if (hit) shown++;
    }
    for (const d of body.querySelectorAll("details")) {
      const any = [...d.querySelectorAll(PICK_ROWS)].some((r) => !r.hidden);
      d.hidden = !!q && !any;
      if (q && any) d.open = true;
    }
    count.textContent = q ? `${shown} match${shown === 1 ? "" : "es"}` : "";
  });
  return el("div", { class: "picker-search__wrap" }, input, count);
}

function trapFocus(e, container) {
  const items = $$("button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])", container)
    .filter((n) => !n.disabled && n.offsetParent !== null);
  if (!items.length) return;
  const first = items[0], last = items[items.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}

export function confirmModal(message, { title = "Confirm", okLabel = "OK", cancelLabel = "Cancel", danger = false } = {}) {
  return new Promise((resolve) => {
    let settled = false;
    modal({
      title,
      render(body, close) {
        body.append(el("p", { class: "modal__text" }, message));
        body.append(el("div", { class: "modal__actions" },
          el("button", { class: "btn btn--ghost", onClick: () => { settled = true; resolve(false); close(); } }, cancelLabel),
          el("button", { class: `btn ${danger ? "btn--danger" : "btn--primary"}`, onClick: () => { settled = true; resolve(true); close(); } }, okLabel),
        ));
      },
      onClose: () => { if (!settled) resolve(false); },
    });
  });
}

export function promptModal(message, { title = "Input", value = "", okLabel = "OK", placeholder = "" } = {}) {
  return new Promise((resolve) => {
    let settled = false;
    let input;
    modal({
      title,
      render(body, close) {
        body.append(el("label", { class: "modal__text", for: "prompt-input" }, message));
        input = el("input", { id: "prompt-input", class: "input", type: "text", value, placeholder });
        input.addEventListener("keydown", (e) => { if (e.key === "Enter") { settled = true; resolve(input.value); close(); } });
        body.append(input);
        body.append(el("div", { class: "modal__actions" },
          el("button", { class: "btn btn--ghost", onClick: () => { settled = true; resolve(null); close(); } }, "Cancel"),
          el("button", { class: "btn btn--primary", onClick: () => { settled = true; resolve(input.value); close(); } }, okLabel),
        ));
      },
      onClose: () => { if (!settled) resolve(null); },
    });
  });
}

// The header chip that shows or hides every "How to use this" note at once.
// It changes a root attribute only — the page does not re-render.
export function guidanceChip() {
  const on = Settings.guidance();
  const b = el("button", { class: "chip chip--sm guidance-chip" + (on ? " chip--on" : ""), "aria-pressed": on ? "true" : "false",
    title: "Show or hide the \u201cHow to use this\u201d notes" }, on ? "Guidance on" : "Guidance off");
  b.addEventListener("click", () => {
    const next = !Settings.guidance();
    Settings.set("guidance", next);
    b.classList.toggle("chip--on", next);
    b.setAttribute("aria-pressed", next ? "true" : "false");
    b.textContent = next ? "Guidance on" : "Guidance off";
    showToast(next ? "Guidance on — each card explains itself." : "Guidance hidden. Turn it back on here or in Settings.");
  });
  return b;
}

// A screen's one-line introduction, shown on the first visit and dismissable —
// it replaces the intro card that used to cost a third of the viewport.
export function introLine(text, onDismiss) {
  return el("p", { class: "intro-line" },
    el("span", { class: "intro-line__text" }, text),
    el("a", { class: "btn btn--sm btn--ghost", href: "#tutorial" }, "How to Play →"),
    el("button", { class: "btn btn--sm btn--ghost", "aria-label": "Dismiss this introduction", onClick: onDismiss }, "✕"));
}

// Case notes: a rendered read view by default (pinned rolls as tagged entries,
// case headers as headings), with Edit switching to the plain textarea. The
// stored text is exactly what it was — this is presentation only.
export function notesView({ value = "", onSave, rows = 10, placeholder = "", savedToast = "Notes saved." } = {}) {
  const box = el("div", { class: "notes" });
  const paintRead = () => {
    box.replaceChildren();
    const read = el("div", { class: "notes-read", tabindex: "0", "aria-label": "Case notes" });
    const text = String(value || "").trim();
    if (!text) read.append(el("p", { class: "muted" }, "No notes yet — pinned rolls and briefings land here, oldest at the top. Press Edit notes to write your own."));
    for (const raw of text ? text.split("\n") : []) {
      const line = raw.trim();
      if (!line) continue;
      let m;
      if ((m = line.match(/^=+\s*(.*?)\s*=+$/))) read.append(el("h3", { class: "notes-read__head" }, m[1]));
      else if (/^-{3,}$/.test(line)) read.append(el("hr", { class: "notes-read__rule" }));
      else if ((m = line.match(/^[•*-]?\s*\[([^\]]+)\]\s*(.*)$/))) read.append(el("div", { class: "notes-read__entry" },
        el("span", { class: "tag tag--sm notes-read__tag" }, m[1]), el("span", { class: "notes-read__text" }, m[2])));
      else read.append(el("p", { class: "notes-read__p" }, line.replace(/^[•*]\s*/, "")));
    }
    box.append(read, el("div", { class: "btn-row" }, el("button", { class: "btn btn--sm btn--ghost", onClick: paintEdit }, "✎ Edit notes")));
    requestAnimationFrame(() => { read.scrollTop = read.scrollHeight; });   // newest at the bottom
  };
  const paintEdit = () => {
    box.replaceChildren();
    const ta = el("textarea", { class: "input notes-area", rows, placeholder, "aria-label": "Case notes" });
    ta.value = value || "";
    const save = () => { if (ta.value !== value) { value = ta.value; onSave?.(value); showToast(savedToast); } };
    ta.addEventListener("blur", save);
    box.append(ta, el("div", { class: "btn-row" }, el("button", { class: "btn btn--sm btn--primary", onClick: () => { save(); paintRead(); } }, "✓ Done")));
    requestAnimationFrame(() => { ta.focus(); ta.scrollTop = ta.scrollHeight; });
  };
  paintRead();
  return box;
}

// Re-exported so the note-writing screens keep a single import surface.
export { appendToNotes };

export function sectionTitle(t) {
  return el("h2", { class: "sheet__section" }, t);
}

// ---- Shared roll surface (Solo & GM) --------------------------------------
// Oracle and generator rolls land INLINE, in the card that produced them, so a
// result stays on screen next to the button and beside the other cards' results
// (Solo/GM only — dice rolls in roller.js keep their own modal flow).
// `html` is the serialized result markup, produced by rendering the same node
// tree the modal used, so a stored result survives a reload.
export function resultSlot({ title, html, pinLine, onPin, onReroll, onDismiss, stamp }) {
  const box = el("div", { class: "result-slot", role: "status", "aria-live": "polite" });
  const head = el("div", { class: "result-slot__head" },
    el("span", { class: "result-slot__title" }, title || "Result"),
    stamp ? el("span", { class: "result-slot__time muted" }, new Date(stamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })) : null);
  box.append(head, el("div", { class: "result-slot__body", html: html || "" }));
  const actions = el("div", { class: "result-slot__actions" });
  if (typeof onReroll === "function") actions.append(el("button", { class: "btn btn--sm btn--roll", onClick: onReroll }, "\u21bb Reroll"));
  if (pinLine && typeof onPin === "function") actions.append(el("button", { class: "btn btn--sm btn--ghost", onClick: () => onPin(pinLine) }, "\u{1F4CC} Pin"));
  if (typeof onDismiss === "function") actions.append(el("button", { class: "btn btn--sm btn--ghost", onClick: onDismiss, "aria-label": "Dismiss this result" }, "\u2715"));
  box.append(actions);
  return box;
}

// Serialize a render(body) callback into markup for a result slot. Everything
// goes through el()/text nodes, so user-entered text is escaped on the way in.
export function renderToHtml(render) {
  const d = el("div");
  if (typeof render === "function") render(d);
  return d.innerHTML;
}

// A result modal that always offers "Pin to notes" (when a pin line + handler
// are given) alongside OK. `render(body)` fills the result content.
// Segmented sub-nav (pill row) for swapping panels within a screen.
// segments: [{ key, label }]. Calls onSelect(key). Scrolls horizontally on overflow.
// grid: true lays the pills out as a 4-column grid on a phone (no scrolling,
// nothing clipped) and as the usual single row on wider screens.
export function segmentNav({ segments = [], active, onSelect, grid = false } = {}) {
  const row = el("div", { class: "segnav" + (grid ? " segnav--grid" : ""), role: "tablist", "aria-label": "Sections" });
  for (const s of segments) {
    const on = s.key === active;
    row.append(el("button", {
      class: "segnav__pill" + (on ? " segnav__pill--on" : ""),
      role: "tab", "aria-selected": on ? "true" : "false",
      // A pill labelled with a term of art still has to say what it is for.
      "aria-label": s.hint ? `${s.label} — ${s.hint}` : null,
      title: s.hint || null,
      onClick: () => { if (!on && typeof onSelect === "function") onSelect(s.key); },
    }, s.label));
  }
  // Bring the active pill into view — a clipped active tab reads as "missing".
  requestAnimationFrame(() => {
    const on = row.querySelector(".segnav__pill--on");
    if (on && row.scrollWidth > row.clientWidth) row.scrollLeft = Math.max(0, on.offsetLeft - row.clientWidth / 2 + on.offsetWidth / 2);
  });
  return row;
}

// The outcome a log line reports, as a tone for its marker. Text is what every
// entry has (older entries carry no dice), so read it from there.
function outcomeTone(text = "") {
  if (/\bbane/.test(text)) return "bane";
  if (/^Critical/.test(text)) return "crit";
  if (/^Success|Wins|win the opposition/.test(text)) return "succ";
  if (/^Failure/.test(text)) return "fail";
  return "";
}

// One ⋯ per row: its actions open in a small menu pinned to the viewport (so a
// scrolling list never clips it), one menu open at a time, closed on scroll.
// items: [{ label, aria?, onClick, danger? }] — null entries are skipped.
export function rowMenu(name, items) {
  const menu = el("details", { class: "rowmenu" },
    el("summary", { class: "rowmenu__toggle", "aria-label": name, title: "Actions" }, "⋯"),
    el("div", { class: "rowmenu__list" }, ...items.filter(Boolean).map((it) =>
      el("button", { class: "iconbtn rowmenu__item" + (it.danger ? " rowmenu__item--danger" : "") + (it.cls ? ` ${it.cls}` : ""), "aria-label": it.aria || null,
        "aria-pressed": it.pressed == null ? null : it.pressed ? "true" : "false",
        onClick: () => { menu.open = false; it.onClick(); } }, ...splitLabel(it.label)))));
  menu.addEventListener("toggle", () => {
    if (!menu.open) return;
    document.querySelectorAll(".rowmenu[open]").forEach((m) => { if (m !== menu) m.open = false; });
    const pop = menu.querySelector(".rowmenu__list");
    const r = menu.querySelector("summary").getBoundingClientRect();
    const h = pop.offsetHeight;
    pop.style.right = `${Math.max(8, innerWidth - r.right)}px`;
    pop.style.top = `${r.bottom + 4 + h > innerHeight ? Math.max(8, r.top - 4 - h) : r.bottom + 4}px`;
    window.addEventListener("scroll", () => { menu.open = false; }, { once: true, capture: true });
  });
  return menu;
}
// "📌 Pin to case notes" → the glyph (becomes an icon) and the words in a span.
function splitLabel(label) {
  const m = String(label).match(/^(\S+)\s+(.*)$/u);
  return m && /[^\w]/u.test(m[1]) && !/[a-z]/i.test(m[1]) ? [m[1], el("span", {}, m[2])] : [el("span", {}, label)];
}

// Collapsible "Roll Log" card. Entries are given newest-first (storage order)
// and rendered oldest-first so the whole screen reads top to bottom, like the
// notes below it; the list scrolls to the newest entry after render.
// Handlers: onPin(entry), onDelete(entry), onClear().
export function rollLogCard({ entries = [], onPin, onDelete, onClear, open = true, pinLabel = "Pin to notes", title = "Roll Log", head = null, emptyHint = "" } = {}) {
  const card = el("div", { class: "card rolllog" });
  const details = el("details", { class: "rolllog__details", open: open || null });
  const summary = el("summary", { class: "rolllog__summary" },
    el("span", {}, title),
    el("span", { class: "rolllog__count muted" }, entries.length ? `${entries.length}` : "empty"));
  details.append(summary);

  if (head) details.append(head);
  const list = el("div", { class: "rolllog__list" });
  if (!entries.length) {
    list.append(el("p", { class: "muted rolllog__empty empty empty--dice" }, `No rolls yet. ${emptyHint}`.trim()));
  } else {
    for (const e of [...entries].reverse()) {
      const time = new Date(e.ts || Date.now()).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      const tone = outcomeTone(e.text);
      const menu = (onPin || onDelete) ? rowMenu(`Actions for ${e.label}`, [
        onPin ? { label: `📌 ${pinLabel}`, aria: pinLabel, onClick: () => onPin(e) } : null,
        onDelete ? { label: "✕ Remove entry", aria: "Remove entry", onClick: () => onDelete(e) } : null]) : null;
      list.append(el("div", { class: "rolllog__row" + (tone ? ` rolllog__row--${tone}` : "") },
        el("span", { class: "rolllog__time muted" }, time),
        el("span", { class: "rolllog__label" }, e.label),
        el("span", { class: "rolllog__text" }, e.text, Array.isArray(e.dice) && e.dice.length
          ? el("span", { class: "minidice", "aria-hidden": "true" }, ...e.dice.map(([size, face]) =>
              el("span", { class: "minidie" + (face === 1 ? " minidie--bane" : face >= 10 ? " minidie--crit" : face >= 6 ? " minidie--succ" : ""), title: `d${size}` }, String(face))))
          : null),
        el("span", { class: "rolllog__row-actions" }, menu)));
    }
  }
  details.append(list);
  // newest sits at the bottom — bring it into view
  requestAnimationFrame(() => { list.scrollTop = list.scrollHeight; });
  if (entries.length && onClear) {
    details.append(el("div", { class: "rolllog__foot" },
      el("button", { class: "btn btn--sm btn--ghost", onClick: () => onClear() }, "Clear log")));
  }
  card.append(details);
  return card;
}

export { el, $, $$, clear };
