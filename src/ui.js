// ui.js — themed modal/toast/confirm/prompt primitives. No native alert/confirm.
// Accessible: focus trap, Escape, aria-modal, focus restore.
import { el, $, $$, clear, appendToNotes } from "./core.js";

let modalHost = null;
function host() {
  if (!modalHost) {
    modalHost = el("div", { id: "modal-host" });
    document.body.append(modalHost);
  }
  return modalHost;
}

export function showToast(message, { kind = "info", timeout = 2600 } = {}) {
  let region = $("#toast-region");
  if (!region) {
    region = el("div", { id: "toast-region", "aria-live": "polite", "aria-atomic": "true" });
    document.body.append(region);
  }
  const t = el("div", { class: `toast toast--${kind}`, role: "status" }, message);
  region.append(t);
  requestAnimationFrame(() => t.classList.add("toast--in"));
  setTimeout(() => { t.classList.remove("toast--in"); setTimeout(() => t.remove(), 200); }, timeout);
}

// Core modal. Returns { close }. `render(body, close)` fills the body.
export function modal({ title = "", render, dismissable = true, onClose } = {}) {
  const prevFocus = document.activeElement;
  const overlay = el("div", { class: "modal-overlay" });
  const dialog = el("div", { class: "modal", role: "dialog", "aria-modal": "true", "aria-label": title || "Dialog" });
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
  // focus first focusable
  requestAnimationFrame(() => {
    const f = dialog.querySelector("button, [href], input, select, textarea, [tabindex]");
    (f || dialog).focus?.();
  });
  return { close, dialog, body };
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
export function resultModal({ title, render, pinLine, onPin }) {
  modal({
    title,
    render(body, close) {
      if (typeof render === "function") render(body);
      const actions = el("div", { class: "modal__actions" });
      if (pinLine && typeof onPin === "function") {
        actions.append(el("button", { class: "btn btn--ghost", onClick: () => { onPin(pinLine); close(); } }, "📌 Pin to notes"));
      }
      actions.append(el("button", { class: "btn btn--primary", onClick: () => close() }, "OK"));
      body.append(actions);
    },
  });
}

// Segmented sub-nav (pill row) for swapping panels within a screen.
// segments: [{ key, label }]. Calls onSelect(key). Scrolls horizontally on overflow.
export function segmentNav({ segments = [], active, onSelect } = {}) {
  const row = el("div", { class: "segnav", role: "tablist", "aria-label": "Sections" });
  for (const s of segments) {
    const on = s.key === active;
    row.append(el("button", {
      class: "segnav__pill" + (on ? " segnav__pill--on" : ""),
      role: "tab", "aria-selected": on ? "true" : "false",
      onClick: () => { if (!on && typeof onSelect === "function") onSelect(s.key); },
    }, s.label));
  }
  return row;
}

// Collapsible "Roll Log" card. Entries are given newest-first (storage order)
// and rendered oldest-first so the whole screen reads top to bottom, like the
// notes below it; the list scrolls to the newest entry after render.
// Handlers: onPin(entry), onDelete(entry), onClear().
export function rollLogCard({ entries = [], onPin, onDelete, onClear, open = true, pinLabel = "Pin to notes", title = "Roll Log", head = null } = {}) {
  const card = el("div", { class: "card rolllog" });
  const details = el("details", { class: "rolllog__details", open: open || null });
  const summary = el("summary", { class: "rolllog__summary" },
    el("span", {}, title),
    el("span", { class: "rolllog__count muted" }, entries.length ? `${entries.length}` : "empty"));
  details.append(summary);

  if (head) details.append(head);
  const list = el("div", { class: "rolllog__list" });
  if (!entries.length) {
    list.append(el("p", { class: "muted rolllog__empty" }, "No rolls yet. Results you roll will collect here."));
  } else {
    for (const e of [...entries].reverse()) {
      const time = new Date(e.ts || Date.now()).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      list.append(el("div", { class: "rolllog__row" },
        el("span", { class: "rolllog__time muted" }, time),
        el("span", { class: "rolllog__label" }, e.label),
        el("span", { class: "rolllog__text" }, e.text),
        el("span", { class: "rolllog__row-actions" },
          onPin ? el("button", { class: "iconbtn", title: pinLabel, "aria-label": pinLabel, onClick: () => onPin(e) }, "📌") : null,
          onDelete ? el("button", { class: "iconbtn", title: "Remove entry", "aria-label": "Remove entry", onClick: () => onDelete(e) }, "✕") : null)));
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
