// icons.js — the SVG icon sprite. Every label glyph in core.js ICON_GLYPHS maps
// to one symbol here. Drawn on a 24px grid, 1.8px stroke, round caps; a symbol
// that needs a solid area says fill="currentColor" on that path only. Mounted
// once at boot; <use href="#i-name"> references it from anywhere in the page.
const S = {
  dice: '<rect x="3.5" y="3.5" width="17" height="17" rx="4"/><circle cx="8.5" cy="8.5" r="1.3" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none"/><circle cx="15.5" cy="15.5" r="1.3" fill="currentColor" stroke="none"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  bolt: '<path d="M13 2.5L4.5 13.5H11l-1 8 8.5-11H12l1-8z"/>',
  pen: '<path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17z"/><path d="M14 7l3 3"/>',
  star: '<path d="M12 3.2l2.6 5.5 6 .8-4.4 4.2 1.1 6-5.3-2.9-5.3 2.9 1.1-6L3.4 9.5l6-.8z"/>',
  sparkle: '<path d="M12 3v5M12 16v5M3 12h5M16 12h5M6 6l2.5 2.5M15.5 15.5L18 18M18 6l-2.5 2.5M8.5 15.5L6 18"/>',
  pin: '<path d="M9 3.5h6l-1 5.5 3.5 3.5h-11L10 9z"/><path d="M12 12.5V21"/>',
  play: '<path d="M7.5 4.5v15l12-7.5z" fill="currentColor"/>',
  attack: '<path d="M4 4l10 10M20 4L10 14M7.5 16.5L4 20M16.5 16.5L20 20M5.5 13.5l5 5M18.5 13.5l-5 5"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  reroll: '<path d="M20 12a8 8 0 1 1-2.35-5.65"/><path d="M20 4v5h-5"/>',
  reset: '<path d="M4 12a8 8 0 1 0 2.35-5.65"/><path d="M4 4v5h5"/>',
  undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',
  skull: '<path d="M12 3a7.5 7.5 0 0 0-7.5 7.5c0 2.6 1.3 4.3 3 5.3V19h9v-3.2c1.7-1 3-2.7 3-5.3A7.5 7.5 0 0 0 12 3z"/><circle cx="9" cy="11" r="1.6" fill="currentColor" stroke="none"/><circle cx="15" cy="11" r="1.6" fill="currentColor" stroke="none"/><path d="M10.5 19v2M13.5 19v2"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M20 20l-4.8-4.8"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7"/>',
  scale: '<path d="M12 4v16M7.5 20h9M5 7h14"/><path d="M5 7l-3 7a3 3 0 0 0 6 0zM19 7l-3 7a3 3 0 0 0 6 0z"/>',
  bed: '<path d="M3 18V6M3 14h18v4M21 14v-1.5a3 3 0 0 0-3-3h-7V14"/><circle cx="7" cy="11" r="1.8"/>',
  warn: '<path d="M12 3.5L2.5 20h19z"/><path d="M12 10v4.5"/><circle cx="12" cy="17.2" r=".6" fill="currentColor"/>',
  examine: '<circle cx="9.5" cy="9.5" r="5.5"/><path d="M13.5 13.5L20 20"/><path d="M7 9.5h5M9.5 7v5"/>',
  talk: '<path d="M4 5h16v11H10l-5 4v-4H4z"/><path d="M8 10.5h.01M12 10.5h.01M16 10.5h.01"/>',
  call: '<path d="M6.5 3.5h3l1.8 4.6-2.3 1.4a10.5 10.5 0 0 0 5.5 5.5l1.4-2.3 4.6 1.8v3a2 2 0 0 1-2 2A15.5 15.5 0 0 1 4.5 5.5a2 2 0 0 1 2-2z"/>',
  place: '<path d="M12 21s-6.5-5.8-6.5-11a6.5 6.5 0 0 1 13 0c0 5.2-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.4"/>',
  target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1" fill="currentColor"/>',
  cab: '<path d="M5 11l2-5h10l2 5M3 11h18v6H3z"/><path d="M6 17v2M18 17v2M10 3.5h4"/><circle cx="7.5" cy="14" r="1" fill="currentColor"/><circle cx="16.5" cy="14" r="1" fill="currentColor"/>',
  push: '<path d="M4 19l5-5 3 3 8-8"/><path d="M14 9h6v6"/>',
  timer: '<circle cx="12" cy="13.5" r="7.5"/><path d="M12 13.5V9.5M9.5 2.5h5M12 2.5V6M18.5 6.5l1.5-1.5"/>',
  shield: '<path d="M12 3l8 3v6c0 4.8-3.4 8-8 9-4.6-1-8-4.2-8-9V6z"/>',
  cart: '<path d="M3 4h2.2l2.3 11h11L21 7.5H6.3"/><circle cx="9.5" cy="19.5" r="1.5"/><circle cx="17" cy="19.5" r="1.5"/>',
  person: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/><path d="M7 7.5h10"/>',
  clipboard: '<rect x="5" y="4.5" width="14" height="16.5" rx="2"/><path d="M9 3h6v3.5H9zM9 11h6M9 15h4"/>',
  book: '<path d="M4 4.5h6.5A2.5 2.5 0 0 1 13 7v13a2 2 0 0 0-2-2H4z"/><path d="M20 4.5h-4.5A2.5 2.5 0 0 0 13 7v13a2 2 0 0 1 2-2h5z"/>',
  heart: '<path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20z" fill="currentColor" stroke="none"/>',
  resolve: '<path d="M12 3l8.5 9L12 21l-8.5-9z"/><path d="M12 8.5l3.3 3.5-3.3 3.5L8.7 12z" fill="currentColor" stroke="none"/>',
  up: '<path d="M6 15l6-6 6 6"/>',
  down: '<path d="M6 9l6 6 6-6"/>',
  back: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  next: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  "dot-on": '<circle cx="12" cy="12" r="6.5" fill="currentColor"/>',
  "dot-off": '<circle cx="12" cy="12" r="6.5"/>',
  home: '<path d="M4 11l8-7 8 7"/><path d="M6 9.5V20h4.5v-5.5h3V20H18V9.5"/>',
  people: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.8a3.5 3.5 0 0 1 0 6.4M18 14a6 6 0 0 1 3.5 6"/>',
  library: '<path d="M4 4.5h6.5A2.5 2.5 0 0 1 13 7v13a2 2 0 0 0-2-2H4z"/><path d="M20 4.5h-4.5A2.5 2.5 0 0 0 13 7v13a2 2 0 0 1 2-2h5z"/><path d="M7 9h3M16 9h1.5"/>',
  solo: '<path d="M2 12s3.8-7 10-7 10 7 10 7-3.8 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  gm: '<rect x="3" y="4.5" width="18" height="15" rx="2"/><path d="M9.5 4.5v15M13 9h4.5M13 13h4.5"/>',
  settings: '<path d="M4 7h9M17 7h3M4 12h3M11 12h9M4 17h11M19 17h1"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="17" r="2"/>',
};

export function mountSprite(doc = document) {
  if (doc.getElementById("icon-sprite")) return;
  const wrap = doc.createElement("div");
  wrap.innerHTML = `<svg id="icon-sprite" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style="position:absolute;width:0;height:0;overflow:hidden">${
    Object.entries(S).map(([k, v]) => `<symbol id="i-${k}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${v}</symbol>`).join("")
  }</svg>`;
  doc.body.prepend(wrap.firstChild);
}
