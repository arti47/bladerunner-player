// router.js — bottom-nav routing + conditional tab gating (CLAUDE.md §5/§8).
// Routes not yet implemented render a themed placeholder so the app always boots
// with zero console errors. Real modules replace these as phases land.
import { el, clear, $ } from "./core.js";
import { Settings } from "./settings.js";
import { renderHome, renderCharacters, renderRules, renderSettings } from "./screens.js";
import { renderWizard } from "./wizard.js";
import { renderSheet } from "./sheet.js";
import { renderCombat } from "./combat.js";
import { renderSolo } from "./solo.js";
import { renderGm } from "./gm.js";

const mount = () => $("#screen");

// Bottom-nav tabs. `gate` hides the tab unless it returns true.
const TABS = [
  { route: "home", label: "Home", icon: "◉" },
  { route: "characters", label: "Chars", icon: "☰" },
  { route: "rules", label: "Rules", icon: "❖" },
  { route: "solo", label: "Solo", icon: "◐", gate: () => Settings.solo() },
  { route: "gm", label: "GM", icon: "▣", gate: () => Settings.gm() },
  { route: "settings", label: "More", icon: "⚙" },
];

// Route table. Placeholders for phases not yet built.
const ROUTES = {
  home: renderHome,
  characters: renderCharacters,
  rules: renderRules,
  settings: renderSettings,
  wizard: (m) => renderWizard(m, { restart: true }),
  sheet: renderSheet,
  combat: renderCombat,
  solo: (m) => renderSolo(m, () => render("solo")),
  gm: (m) => renderGm(m, () => render("gm")),
};

function placeholder(m, title, sub) {
  clear(m);
  m.append(el("section", { class: "screen" },
    el("h1", { class: "screen__title" }, title),
    el("div", { class: "card" }, el("p", { class: "muted" }, sub))));
}
export function navigate(route) {
  if (location.hash.slice(1) !== route) { location.hash = route; return; }
  render(route);
}

function render(route) {
  const fn = ROUTES[route] || ROUTES.home;
  fn(mount());
  updateNav(route);
  window.scrollTo(0, 0);
}

function updateNav(active) {
  const nav = $("#nav");
  if (!nav) return;
  clear(nav);
  for (const t of TABS) {
    if (t.gate && !t.gate()) continue;
    const btn = el("button", {
      class: "nav__btn" + (t.route === active ? " nav__btn--active" : ""),
      onClick: () => navigate(t.route),
      "aria-current": t.route === active ? "page" : null,
      "aria-label": t.label,
    }, el("span", { class: "nav__icon" }, t.icon), el("span", { class: "nav__label" }, t.label));
    nav.append(btn);
  }
}

export function startRouter() {
  window.addEventListener("hashchange", () => render(location.hash.slice(1) || "home"));
  render(location.hash.slice(1) || "home");
}
