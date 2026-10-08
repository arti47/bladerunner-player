// router.js — bottom-nav routing + conditional tab gating (CLAUDE.md §5/§8).
// Routes not yet implemented render a themed placeholder so the app always boots
// with zero console errors. Real modules replace these as phases land.
import { el, clear, $, icon } from "./core.js";
import { modal } from "./ui.js";
import { Settings } from "./settings.js";
import { renderHome, renderCharacters, renderRules, renderSettings } from "./screens.js";
import { renderWizard } from "./wizard.js";
import { renderSheet } from "./sheet.js";
import { renderCombat } from "./combat.js";
import { renderSolo } from "./solo.js";
import { renderGm } from "./gm.js";
import { renderTutorial } from "./tutorial.js";
import { updateQuickRoll } from "./quick.js";

const mount = () => $("#screen");

// Bottom nav: three destinations and a menu (radical redesign, 2026-10-07).
// Case is the game itself — the guided solo case when Solo Mode is on, the
// lobby otherwise; Detective is your sheet; Files are your detectives and closed
// cases. Everything else (rules, tutorial, combat, GM, settings) sits in Menu.
const TABS = [
  { key: "case", label: "Case", icon: "case", route: () => (Settings.solo() ? "solo" : "home"), owns: ["solo", "home"] },
  { key: "detective", label: "Detective", icon: "badge", route: () => "sheet", owns: ["sheet", "wizard"] },
  { key: "files", label: "Files", icon: "folder", route: () => "characters", owns: ["characters"] },
  { key: "menu", label: "Menu", icon: "menu", menu: true, owns: ["rules", "tutorial", "combat", "gm", "settings"] },
];
const MENU = [
  { route: "home", label: "Home", icon: "home", sub: "Your detective and your case" },
  { route: "combat", label: "Combat tracker", icon: "attack", sub: "Initiative, wounds, chases" },
  { route: "rules", label: "Rules", icon: "library", sub: "Search any word" },
  { route: "tutorial", label: "How to play", icon: "book", sub: "Walkthroughs and cheat sheet" },
  { route: "gm", label: "GM screen", icon: "gm", sub: "Run the table", gate: () => Settings.gm() },
  { route: "settings", label: "Settings", icon: "settings", sub: "Look, feel, modes, account" },
];
function openMenu() {
  modal({ title: "Menu", sheet: true, render(body, close) {
    const list = el("div", { class: "menu-list" });
    for (const m of MENU) {
      if (m.gate && !m.gate()) continue;
      list.append(el("button", { class: "menu-item", onClick: () => { close(); navigate(m.route); } },
        el("span", { class: "menu-item__icon" }, icon(m.icon)),
        el("span", { class: "menu-item__text" }, el("strong", {}, m.label), el("span", { class: "muted small" }, m.sub))));
    }
    body.append(list);
  } });
}

// Route table. Placeholders for phases not yet built.
const ROUTES = {
  home: renderHome,
  characters: renderCharacters,
  rules: renderRules,
  settings: renderSettings,
  // No restart: an in-progress draft survives navigation and reload; the wizard
  // clears it itself on finish or on backing out of step 1. [playtest journal]
  wizard: (m) => renderWizard(m),
  sheet: renderSheet,
  combat: renderCombat,
  solo: (m) => renderSolo(m, () => render("solo")),
  gm: (m) => renderGm(m, () => render("gm")),
  tutorial: (m) => renderTutorial(m, () => render("tutorial")),
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

// Screens re-render themselves in place (a Solo roll, a sheet edit, a combat
// turn). Only jump to the top when the ROUTE actually changed — otherwise every
// in-screen update would yank the page away from whatever you just pressed.
let lastRoute = null;
function render(route) {
  updateQuickRoll(route);
  const fn = ROUTES[route] || ROUTES.home;
  const changed = route !== lastRoute;
  const y = window.scrollY;
  fn(mount());
  updateNav(route);
  lastRoute = route;
  if (changed) {
    window.scrollTo(0, 0);
    // A new screen fades in (CSS; nothing under reduced motion). The DOM is
    // already complete — the fade never delays a click or a query.
    const m = mount();
    m.classList.remove("screen--enter");
    void m.offsetWidth;
    m.classList.add("screen--enter");
  } else window.scrollTo(0, y);
}

function updateNav(active) {
  const nav = $("#nav");
  if (!nav) return;
  clear(nav);
  for (const t of TABS) {
    const on = t.owns.includes(active);
    const btn = el("button", {
      class: "nav__btn" + (on ? " nav__btn--active" : ""),
      onClick: () => (t.menu ? openMenu() : navigate(t.route())),
      "aria-current": on ? "page" : null,
      "aria-label": t.label,
      "aria-haspopup": t.menu ? "dialog" : null,
    }, el("span", { class: "nav__icon" }, icon(t.icon)), el("span", { class: "nav__label" }, t.label));
    nav.append(btn);
  }
}

// The nav's real height drives everything that must clear it (toasts, the
// wizard's sticky footer) — no hardcoded pixel guesses. [UX audit D4]
function measureNav() {
  const nav = $("#nav");
  if (!nav) return;
  const set = () => document.documentElement.style.setProperty("--nav-h", `${Math.ceil(nav.getBoundingClientRect().height)}px`);
  set();
  if (window.ResizeObserver) new ResizeObserver(set).observe(nav);
  else window.addEventListener("resize", set);
}

export function startRouter() {
  measureNav();
  window.addEventListener("hashchange", () => render(location.hash.slice(1) || "home"));
  render(location.hash.slice(1) || "home");
}
