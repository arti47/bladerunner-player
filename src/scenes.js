// scenes.js — the big pictures of guided play (radical redesign, 2026-10-07).
// Wide noir scenes drawn in code: a seeded skyline, a place-specific foreground,
// rain, and wet-street reflections — plus the city map you travel on. Original
// drawings only (§12): no film art, logos or real districts. Decorative: every
// figure is aria-hidden and the text beside it carries the meaning. The same
// seed always draws the same picture, so a place looks the same each visit.
import { placeKind } from "./art.js";

const NS = "http://www.w3.org/2000/svg";
function svg(viewBox, inner, cls) {
  const s = document.createElementNS(NS, "svg");
  s.setAttribute("viewBox", viewBox);
  s.setAttribute("class", cls);
  s.setAttribute("aria-hidden", "true");
  s.setAttribute("focusable", "false");
  s.setAttribute("preserveAspectRatio", "xMidYMid slice");
  s.innerHTML = inner;
  return s;
}
function hashOf(s = "") { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.codePointAt(0), 16777619) >>> 0; return h; }
// A small seeded generator — drawing must never consume Math.random (dice do).
function rng(seed) {
  let a = hashOf(seed) || 1;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const W = 360, H = 200, GROUND = 168;
const f = (n) => Math.round(n * 10) / 10;

// Far and mid skylines: blocks of random height, the mid row with lit windows.
function skylineLayers(r, { low = false } = {}) {
  let out = "";
  for (let x = -6; x < W; ) {
    const w = 12 + r() * 22, h = (low ? 30 : 55) + r() * (low ? 50 : 85);
    out += `<rect class="sc-far" x="${f(x)}" y="${f(GROUND - h)}" width="${f(w)}" height="${f(h)}"/>`;
    if (r() < 0.18) out += `<path class="sc-line" d="M${f(x + w / 2)} ${f(GROUND - h)}v-${f(8 + r() * 14)}"/>`;
    x += w - 1;
  }
  for (let x = -10; x < W; ) {
    const w = 22 + r() * 30, h = (low ? 20 : 34) + r() * (low ? 34 : 60);
    const y = GROUND - h;
    out += `<rect class="sc-mid" x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}"/>`;
    for (let wy = y + 6; wy < GROUND - 6; wy += 7)
      for (let wx = x + 4; wx < x + w - 4; wx += 6)
        if (r() < 0.16) out += `<rect class="${r() < 0.7 ? "sc-win" : "sc-winc"}" x="${f(wx)}" y="${f(wy)}" width="2.4" height="3"/>`;
    x += w + 2 + r() * 10;
  }
  return out;
}
function rain(r, n = 46) {
  let d = "";
  for (let i = 0; i < n; i++) { const x = r() * (W + 40) - 20, y = r() * H, l = 9 + r() * 12; d += `M${f(x)} ${f(y)}l-${f(l * 0.22)} ${f(l)}`; }
  return `<g class="sc-rain"><path d="${d}"/><path d="${d}" transform="translate(0 -${H})"/></g>`;
}
function ground(r) {
  let refl = "";
  for (let i = 0; i < 9; i++) { const x = r() * W; refl += `<path class="${r() < 0.5 ? "sc-refl-a" : "sc-refl-c"}" d="M${f(x)} ${GROUND + 4}v${f(8 + r() * 22)}"/>`; }
  return `<rect class="sc-ground" x="0" y="${GROUND}" width="${W}" height="${H - GROUND}"/>${refl}<path class="sc-curb" d="M0 ${GROUND}H${W}"/>`;
}
const neonSign = (x, y, w, h, tone) => `<rect class="sc-neon sc-neon--${tone}" x="${x}" y="${y}" width="${w}" height="${h}" rx="2"/>`;

// The foreground of each kind of place. Coordinates are on the 360×200 frame.
const NEAR = {
  street: (r) => `<path class="sc-near" d="M0 ${GROUND}V118h46v-14h30v64z"/><path class="sc-near" d="M300 ${GROUND}V96h60v72z"/>
    <path class="sc-line" d="M120 ${GROUND}V106M120 106h16"/><circle class="sc-lamp" cx="138" cy="108" r="3"/><path class="sc-cone" d="M138 110l-18 58h36z"/>
    ${neonSign(306, 104, 10, 40, "m")}${neonSign(20, 126, 22, 8, "c")}
    <path class="sc-near" d="M196 ${GROUND - 2}l6-14h40l10 8h14l3 6z"/><circle class="sc-tail" cx="268" cy="${GROUND - 6}" r="2"/>`,
  building: (r) => { let w = ""; for (let y = 70; y < 150; y += 14) for (let x = 120; x < 236; x += 18) w += `<rect class="${r() < 0.4 ? "sc-win" : "sc-dark"}" x="${x}" y="${y}" width="9" height="8"/>`;
    return `<rect class="sc-near" x="108" y="58" width="140" height="${GROUND - 58}"/>${w}<rect class="sc-door" x="168" y="146" width="20" height="22"/>
    <path class="sc-line" d="M248 80h14v22h-14M248 102h14v22h-14M248 124h14v22h-14"/>${neonSign(112, 62, 30, 6, "a")}`; },
  bar: (r) => `<rect class="sc-near" x="70" y="80" width="220" height="${GROUND - 80}"/><rect class="sc-glass" x="92" y="112" width="120" height="44"/>
    <path class="sc-shelf" d="M98 124h108M98 138h108"/><path class="sc-awn" d="M84 104h138l-8-10H92z"/>
    <path class="sc-neon sc-neon--m" d="M236 92h30l-15 18zM251 110v14M243 124h16"/>${neonSign(96, 86, 54, 8, "c")}
    <rect class="sc-door" x="226" y="132" width="22" height="36"/>`,
  clinic: (r) => `<rect class="sc-near sc-pale" x="96" y="72" width="168" height="${GROUND - 72}"/><path class="sc-neon sc-neon--c" d="M172 84h16v14h14v16h-14v14h-16v-14h-14v-16h14z"/>
    <rect class="sc-glass" x="150" y="136" width="60" height="32"/><path class="sc-line" d="M180 136v32"/><path class="sc-line" d="M108 88h40M212 88h40M108 104h40M212 104h40"/>`,
  dock: (r) => `<rect class="sc-water" x="0" y="146" width="${W}" height="${GROUND - 146}"/><path class="sc-wave" d="M0 152c20-4 40 4 60 0s40 4 60 0 40 4 60 0 40 4 60 0 40 4 60 0 40 4 60 0"/>
    <path class="sc-near" d="M40 146V60h8v86M48 64h110M150 64v26"/><path class="sc-line" d="M60 64l-12 16M80 64l-16 18"/><rect class="sc-crate" x="146" y="90" width="10" height="8"/>
    <rect class="sc-crate" x="200" y="118" width="46" height="28"/><rect class="sc-crate sc-crate--b" x="246" y="118" width="46" height="28"/><rect class="sc-crate" x="222" y="92" width="46" height="26"/>
    ${neonSign(300, 96, 8, 22, "a")}`,
  factory: (r) => `<path class="sc-near" d="M60 ${GROUND}V108l40 22v-22l40 22v-22l40 22v-22l40 22V70h16v${GROUND - 70}z"/>
    <rect class="sc-near" x="270" y="56" width="12" height="${GROUND - 56}"/><circle class="sc-smoke" cx="276" cy="46" r="8"/><circle class="sc-smoke" cx="286" cy="34" r="11"/><circle class="sc-smoke" cx="300" cy="20" r="14"/>
    <rect class="sc-win" x="86" y="140" width="22" height="6"/><rect class="sc-win" x="166" y="140" width="22" height="6"/>${neonSign(232, 120, 24, 6, "m")}`,
  tower: (r) => { let g = ""; for (let y = 34; y < GROUND; y += 10) g += `M150 ${y}h60`; for (let x = 160; x < 210; x += 10) g += `M${x} 30v${GROUND - 30}`;
    return `<path class="sc-near sc-tower" d="M150 ${GROUND}V34l30-22 30 22v${GROUND - 34}z"/><path class="sc-grid" d="${g}"/><circle class="sc-beacon" cx="180" cy="14" r="3"/>
    <rect class="sc-near" x="100" y="96" width="44" height="${GROUND - 96}"/><rect class="sc-near" x="216" y="110" width="50" height="${GROUND - 110}"/>${neonSign(222, 116, 38, 6, "c")}`; },
  shop: (r) => { let s = ""; for (let i = 0; i < 4; i++) { const x = 30 + i * 78; s += `<rect class="sc-near" x="${x}" y="118" width="66" height="${GROUND - 118}"/><path class="sc-awn sc-awn--${i % 2 ? "m" : "a"}" d="M${x - 4} 118h74l-6-14H${x + 2}z"/><circle class="sc-lantern" cx="${x + 33}" cy="98" r="4"/><rect class="sc-win" x="${x + 10}" y="130" width="46" height="14"/>`; }
    return `<path class="sc-line" d="M20 96C120 86 240 86 340 96"/>${s}`; },
  rooftop: (r) => `<path class="sc-near" d="M0 ${GROUND}V132h${W}v36z"/><path class="sc-line" d="M0 132h${W}M20 132v-10h60v10"/>
    <path class="sc-near" d="M250 132V96h40v36z"/><path class="sc-line" d="M256 96l14-12 14 12M270 84V60"/><circle class="sc-beacon" cx="270" cy="58" r="2.4"/>
    <path class="sc-line" d="M120 132V108M108 108h24"/>${neonSign(44, 112, 30, 6, "m")}`,
  transit: (r) => `<path class="sc-near" d="M0 112h${W}v10H0z"/><path class="sc-line" d="M40 122v46M150 122v46M260 122v46"/>
    <rect class="sc-train" x="64" y="84" width="200" height="28" rx="6"/>${[80, 110, 140, 170, 200, 230].map((x) => `<rect class="sc-win" x="${x}" y="92" width="18" height="9"/>`).join("")}
    <circle class="sc-head" cx="262" cy="104" r="3"/>${neonSign(300, 120, 30, 6, "c")}`,
  tunnel: (r) => `<path class="sc-near" d="M0 ${GROUND}V40h${W}v${GROUND - 40}H270V120a90 70 0 0 0-180 0v${GROUND - 120}z"/>
    <path class="sc-line" d="M120 ${GROUND}V126a60 46 0 0 1 120 0v42"/><path class="sc-line" d="M150 ${GROUND}V134a30 24 0 0 1 60 0v34"/>
    ${[110, 140, 170, 200, 230, 250].map((x, i) => `<circle class="sc-lamp" cx="${x}" cy="${74 + Math.abs(i - 2.5) * 6}" r="2"/>`).join("")}`,
  ruin: (r) => `<path class="sc-near" d="M40 ${GROUND}V90l20 14 12-26 16 20v${GROUND - 98}z"/><path class="sc-near" d="M220 ${GROUND}V104l16 10 10-18 22 22 12-8v${GROUND - 110}z"/>
    <path class="sc-near" d="M110 ${GROUND}l14-14 20 6 18-10 24 18z"/><path class="sc-line" d="M60 120h10M240 130h12"/>${neonSign(150, 108, 6, 20, "m")}`,
};
// Moments rather than places.
const MOMENT = {
  dispatch: (r) => `<rect class="sc-near" x="70" y="40" width="220" height="120" rx="8"/><rect class="sc-screen" x="82" y="52" width="196" height="96" rx="4"/>
    ${[64, 76, 88, 100, 112, 124].map((y, i) => `<rect class="sc-text" x="94" y="${y}" width="${60 + ((i * 47) % 110)}" height="4"/>`).join("")}
    <path class="sc-neon sc-neon--a" d="M250 70l12 6v12c0 8-6 13-12 15-6-2-12-7-12-15V76z"/><rect class="sc-near" x="160" y="160" width="40" height="8"/>`,
  travel: (r) => `<path class="sc-road" d="M140 ${GROUND}L176 104h8l36 64z"/><path class="sc-lane" d="M180 108v60"/>
    <path class="sc-near" d="M150 ${GROUND - 4}l8-14h44l8 14z"/><circle class="sc-head" cx="160" cy="${GROUND - 8}" r="3"/><circle class="sc-head" cx="200" cy="${GROUND - 8}" r="3"/>
    <path class="sc-cone sc-cone--head" d="M160 ${GROUND - 8}l-30 30h30zM200 ${GROUND - 8}l30 30h-30z"/>`,
  event: (r) => `${NEAR.street(r)}<path class="sc-near" d="M60 ${GROUND - 2}l6-14h44l10 8h12l3 6z"/><rect class="sc-strobe sc-strobe--r" x="76" y="${GROUND - 20}" width="10" height="4" rx="1"/><rect class="sc-strobe sc-strobe--b" x="88" y="${GROUND - 20}" width="10" height="4" rx="1"/>
    <ellipse class="sc-flash sc-flash--r" cx="81" cy="${GROUND - 18}" rx="60" ry="30"/><ellipse class="sc-flash sc-flash--b" cx="93" cy="${GROUND - 18}" rx="60" ry="30"/>`,
  interrogation: (r) => `<rect class="sc-near" x="0" y="0" width="${W}" height="${GROUND}"/><rect class="sc-glass" x="230" y="40" width="100" height="70"/>
    <path class="sc-line" d="M180 0v34"/><path class="sc-shade" d="M166 34h28l-6 8h-16z"/><path class="sc-cone" d="M168 42l-60 110h144L192 42z"/>
    <rect class="sc-table" x="110" y="130" width="140" height="10"/><path class="sc-line" d="M120 140v28M240 140v28"/><path class="sc-near sc-chair" d="M92 168v-50h14v24h10v26z"/>`,
  evidence: (r) => `<rect class="sc-near" x="0" y="0" width="${W}" height="${GROUND}"/><path class="sc-cone" d="M150 0l-70 150h200L210 0z"/><rect class="sc-table" x="40" y="146" width="280" height="22"/>
    <rect class="sc-bag" x="130" y="96" width="100" height="58" rx="4"/><path class="sc-line" d="M130 108h100"/><rect class="sc-tag" x="206" y="122" width="34" height="18" rx="2"/><path class="sc-line" d="M206 131h-12"/>`,
  solved: (r) => `<rect class="sc-near" x="0" y="0" width="${W}" height="${GROUND}"/><rect class="sc-table" x="20" y="150" width="320" height="18"/>
    <path class="sc-folder" d="M100 70h52l8 10h100v74H100z"/><text class="sc-stamp" x="180" y="122" text-anchor="middle" transform="rotate(-10 180 116)">CLOSED</text>`,
  dead: (r) => `<rect class="sc-ground" x="0" y="${GROUND - 40}" width="${W}" height="80"/>
    <path class="sc-chalk" d="M140 150c6-12 18-10 22-2l14-4 10-14 6 4-8 14 22 4 20-8 3 6-20 10-22 2-8 12 12 14-6 4-14-14-12 10-6-4 10-14z"/>
    <path class="sc-tape" d="M0 120L${W} 104"/><path class="sc-tape" d="M0 134L${W} 150"/>`,
  cold: (r) => `<path class="sc-line" d="M0 60c60-10 120 10 180 0s120-10 180 0" opacity=".3"/><g class="sc-spinner"><circle class="sc-head" cx="0" cy="0" r="2.6"/><path class="sc-line" d="M-10 0h8"/></g>`,
};
// One picture for a moment of play. `kind` is a moment name (dispatch, travel,
// …) or a place NAME the Location tables rolled; `seed` keeps it stable.
export function sceneKindFor(placeOrMoment) {
  return MOMENT[placeOrMoment] || NEAR[placeOrMoment] ? placeOrMoment : placeKind(placeOrMoment);
}
export function bigScene(kind, seed = "", cls = "") {
  const k = sceneKindFor(kind);
  const r = rng(`${k}:${seed}`);
  const indoor = ["interrogation", "evidence", "solved", "dispatch"].includes(k);
  const sky = `<rect class="sc-sky" x="0" y="0" width="${W}" height="${H}"/><ellipse class="sc-glow sc-glow--${["a", "c", "m"][Math.floor(r() * 3)]}" cx="${f(60 + r() * 240)}" cy="40" rx="150" ry="80"/>`;
  const fg = (MOMENT[k] || NEAR[k] || NEAR.street)(r);
  const inner = indoor
    ? `${sky}${fg}`
    : `${sky}${skylineLayers(r, { low: k === "rooftop" })}${ground(r)}${fg}${rain(r)}`;
  return svg(`0 0 ${W} ${H}`, inner, `scene scene--${k} ${cls}`.trim());
}

// ---- The city map ------------------------------------------------------------
// A made-up grid of blocks, a river and a freeway (never a real city), with a
// pin for each place on offer, a dimmer pin for each place already visited and
// a marker where you are. Pins only point at choices the card lists as buttons.
export function cityMap({ options = [], visited = [], here = null, seed = "", onPick } = {}) {
  const r = rng(`map:${seed}`);
  const MW = 360, MH = 220, CW = 40, CH = 36, cols = 9, rows = 6;
  let blocks = "";
  const free = [];
  for (let gy = 0; gy < rows; gy++) for (let gx = 0; gx < cols; gx++) {
    const x = gx * CW + 4, y = gy * CH + 6;
    if (r() < 0.12) { blocks += `<rect class="map-park" x="${x}" y="${y}" width="${CW - 8}" height="${CH - 10}" rx="3"/>`; }
    else blocks += `<rect class="map-block" x="${x + f(r() * 2)}" y="${y + f(r() * 2)}" width="${CW - 8}" height="${CH - 10}" rx="1.5"/>`;
    if (gx > 0 && gx < cols - 1 && gy > 0 && gy < rows - 1) free.push([x + (CW - 8) / 2, y + (CH - 10) / 2]);
  }
  const ry = 60 + r() * 100;
  const river = `<path class="map-river" d="M-10 ${f(ry)}C90 ${f(ry - 40 + r() * 80)} 200 ${f(ry - 40 + r() * 80)} 370 ${f(ry - 20 + r() * 40)}"/>`;
  const fx = 60 + r() * 240;
  const freeway = `<path class="map-road" d="M${f(fx)} -10C${f(fx + 40)} 80 ${f(fx - 60)} 140 ${f(fx + 20)} 230"/><path class="map-lane" d="M${f(fx)} -10C${f(fx + 40)} 80 ${f(fx - 60)} 140 ${f(fx + 20)} 230"/>`;
  // Each name gets a stable cell; a clash moves to the next free one.
  const taken = new Set();
  const spot = (name) => {
    let i = hashOf(`${seed}|${name}`) % free.length;
    for (let n = 0; n < free.length && taken.has(i); n++) i = (i + 1) % free.length;
    taken.add(i);
    return free[i];
  };
  const short = (s) => (s.length > 16 ? s.slice(0, 15) + "…" : s);
  let pins = "";
  const at = here ? spot(here) : [MW / 2, MH / 2];
  for (const v of visited.filter((v) => v !== here && !options.includes(v))) {
    const [x, y] = spot(v);
    pins += `<g class="map-pin map-pin--visited" transform="translate(${f(x)} ${f(y)})"><circle r="4"/><text y="14" text-anchor="middle">${esc(short(v))}</text></g>`;
  }
  options.forEach((o, i) => {
    const [x, y] = spot(o);
    pins += `<path class="map-trail" d="M${f(at[0])} ${f(at[1])}L${f(x)} ${f(y)}"/>`;
    pins += `<g class="map-pin map-pin--option" data-pick="${i}" transform="translate(${f(x)} ${f(y)})"><circle class="map-pin__pulse" r="12"/><path d="M0 2c-5-6-8-9-8-13a8 8 0 0 1 16 0c0 4-3 7-8 13z" transform="translate(0 -2)"/><circle class="map-pin__dot" cy="-13" r="2.6"/><text y="14" text-anchor="middle">${esc(short(o))}</text></g>`;
  });
  pins += `<g class="map-you" transform="translate(${f(at[0])} ${f(at[1])})"><circle r="6"/><circle class="map-you__ring" r="11"/></g>`;
  const s = svg(`0 0 ${MW} ${MH}`, `<rect class="map-bg" x="0" y="0" width="${MW}" height="${MH}"/>${river}${blocks}${freeway}${pins}<path class="map-compass" d="M342 18l5 12-5-3-5 3z"/>`, "citymap");
  s.setAttribute("preserveAspectRatio", "xMidYMid meet");
  if (onPick) for (const g of s.querySelectorAll("[data-pick]")) g.addEventListener("click", () => onPick(options[Number(g.dataset.pick)]));
  return s;
}
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
