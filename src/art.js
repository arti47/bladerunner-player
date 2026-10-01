// art.js — the app's illustrations: monoline neon SVG, drawn in code so they
// theme with the palette (currentColor + role tokens), work offline, and cost
// no image requests. Original drawings only — nothing traced from film art or
// logos (§12). Every graphic is decorative: aria-hidden, the text beside it
// carries the meaning.
import { el } from "./core.js";

const NS = "http://www.w3.org/2000/svg";
// Build an <svg> from trusted, static markup authored in this file.
function svg(viewBox, inner, cls) {
  const s = document.createElementNS(NS, "svg");
  s.setAttribute("viewBox", viewBox);
  s.setAttribute("class", cls);
  s.setAttribute("aria-hidden", "true");
  s.setAttribute("focusable", "false");
  s.innerHTML = inner;
  return s;
}
const STROKE = 'fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"';

// ---- archetype emblems ------------------------------------------------------
// A hexagonal badge with one motif per archetype. The frame is shared so the
// seven read as a set; the motif is what tells them apart.
const FRAME = '<path d="M24 3.5 42 13.75v20.5L24 44.5 6 34.25v-20.5z" opacity=".55"/><path d="M24 7.5 38.5 15.8v16.4L24 40.5 9.5 32.2V15.8z" opacity=".25"/>';
const MOTIF = {
  analyst:     '<circle cx="21.5" cy="21.5" r="6.5"/><path d="M26.3 26.3 32 32"/><path d="M18.5 21.5h6M21.5 18.5v6" opacity=".7"/>',
  cityspeaker: '<path d="M24 31V19"/><path d="M19.5 22.5a6.4 6.4 0 0 1 9 0M16.5 19.5a10.6 10.6 0 0 1 15 0"/><circle cx="24" cy="31" r="1.4" fill="currentColor" stroke="none"/>',
  doxie:       '<path d="M15.5 21c2.4-3 5.3-4.5 8.5-4.5s6.1 1.5 8.5 4.5c-2.4 3-5.3 4.5-8.5 4.5s-6.1-1.5-8.5-4.5z"/><path d="M24 25.5v6M20.5 31.5h7" opacity=".8"/>',
  enforcer:    '<path d="M24 15.5 31 18v5.5c0 4.2-2.9 7-7 8.2-4.1-1.2-7-4-7-8.2V18z"/><path d="M20.5 23.5 23 26l4.5-5"/>',
  fixer:       '<circle cx="20.5" cy="24" r="5"/><circle cx="27.5" cy="24" r="5"/><path d="M24 20.2v7.6" opacity=".6"/>',
  inspector:   '<path d="M15 26.5h18"/><path d="M18 26.5c0-5 1.5-9.5 6-9.5s6 4.5 6 9.5"/><path d="M19.5 20.5h9" opacity=".7"/>',
  skimmer:     '<rect x="17.5" y="17.5" width="13" height="13" rx="1.6"/><path d="M21 17.5v-3M27 17.5v-3M21 33.5v-3M27 33.5v-3M17.5 21h-3M17.5 27h-3M33.5 21h-3M33.5 27h-3"/><rect x="21.5" y="21.5" width="5" height="5" rx=".6" opacity=".7"/>',
  freeform:    '<path d="M24 17 31 24 24 31 17 24z"/><circle cx="24" cy="24" r="1.4" fill="currentColor" stroke="none"/>',
};
export function emblem(key, cls = "") {
  const motif = MOTIF[key] || MOTIF.freeform;
  return svg("0 0 48 48", `<g ${STROKE}>${FRAME}${motif}</g>`, `art emblem emblem--${MOTIF[key] ? key : "freeform"} ${cls}`.trim());
}

// ---- nature marks -------------------------------------------------------------
// Human: a fingerprint. Replicant: an iris with a serial ring — the thing a
// Voight-Kampff test looks into.
export function natureMark(nature, cls = "") {
  const inner = nature === "replicant"
    ? '<circle cx="12" cy="12" r="8.5" opacity=".5"/><circle cx="12" cy="12" r="4.2"/><circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none"/><path d="M12 2.2v1.6M12 20.2v1.6M2.2 12h1.6M20.2 12h1.6M5 5l1.1 1.1M17.9 17.9 19 19M19 5l-1.1 1.1M6.1 17.9 5 19" opacity=".7"/>'
    : '<path d="M7.5 18.5c-1.2-1.7-1.9-3.9-1.9-6.3a6.4 6.4 0 0 1 12.8 0c0 2.4-.4 4.4-1 6"/><path d="M10 19.5c-.9-1.6-1.4-3.4-1.4-5.4a3.4 3.4 0 0 1 6.8 0c0 1.9-.3 3.6-.9 5"/><path d="M12 14.2c0 2.1.4 4 1.1 5.6" /><path d="M8.2 6.3A8.5 8.5 0 0 1 20.4 10" opacity=".6"/>';
  return svg("0 0 24 24", `<g ${STROKE}>${inner}</g>`, `art nature-mark nature-mark--${nature === "replicant" ? "replicant" : "human"} ${cls}`.trim());
}

// ---- portrait placeholder ------------------------------------------------------
// No photo yet: a coat-collared silhouette in a colour taken from the name, with
// the initials — so two characters without photos still look different.
const TONES = ["amber", "cyan", "magenta", "resolve", "ok"];
export function toneFor(name = "") {
  let h = 0;
  for (const ch of String(name)) h = (h * 31 + ch.codePointAt(0)) >>> 0;
  return TONES[h % TONES.length];
}
export function initialsOf(name = "") {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] || "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
}
// A generated noir portrait (round 5): hat, hair, collar and one detail are
// picked by a stable hash of the name, nudged by the archetype, and drawn as a
// dark silhouette with a neon rim in the name's colour. The initials sit in a
// corner tag, never across the face. Invented shapes only (§12).
const HATS = {
  none: "",
  fedora: '<path d="M15.5 21.5h33l-3.5-2.6h-3.4l-1.8-6.4c-2.6-2.4-10.6-2.4-13.2 0l-1.8 6.4h-3.4z" class="pp__hat"/>',
  cap: '<path d="M21.5 20.5c0-6 4.6-9.5 10.5-9.5s10.5 3.5 10.5 9.5zM41 20.5h8.5" class="pp__hat"/>',
  hood: '<path d="M17.5 46c-2.5-8-2.5-19 2.5-27 3.4-5.4 8-7.5 12-7.5s8.6 2.1 12 7.5c5 8 5 19 2.5 27" class="pp__hood"/>',
  visor: '<path d="M21 25.5h22v4.5H21z" class="pp__visor"/>',
};
const HAIR = {
  short: '<path d="M22.6 24.5c-.6-7.4 3.6-11.6 9.4-11.6s10 4.2 9.4 11.6c-1.6-3.6-5-5.4-9.4-5.4s-7.8 1.8-9.4 5.4z" class="pp__hair"/>',
  long: '<path d="M22.4 25c-1.4-8.4 3.4-13 9.6-13s11 4.6 9.6 13l1.4 17c-2.4-1.8-4-4-4.6-7-1.6-5.6-1.6-9.4-2.4-12.4-1.4 2-3.6 2.6-6.8 2.6s-4.6-.6-5.6-2.6c-.8 3-.8 6.8-2.4 12.4-.6 3-2.2 5.2-4.6 7z" class="pp__hair"/>',
  bob: '<path d="M21.6 31c-1.6-11 3.4-18 10.4-18s12 7 10.4 18c-1.2-4.6-2.2-8.8-4-10.6-1.6 1-3.8 1.4-6.4 1.4s-4.8-.4-6.4-1.4c-1.8 1.8-2.8 6-4 10.6z" class="pp__hair"/>',
  shaved: '<path d="M23.2 21.6c1.6-4.8 4.8-7.2 8.8-7.2s7.2 2.4 8.8 7.2" class="pp__line"/>',
  bun: '<circle cx="32" cy="11.5" r="3.6" class="pp__hair"/><path d="M22.8 24c0-6.6 4-10.8 9.2-10.8s9.2 4.2 9.2 10.8c-1.8-3-5-4.6-9.2-4.6s-7.4 1.6-9.2 4.6z" class="pp__hair"/>',
};
const COATS = {
  trench: '<path d="M7 64c1.6-11.6 9.8-18.4 25-18.4S55.4 52.4 57 64z" class="pp__coat"/><path d="M21.5 45.8 32 56l10.5-10.2-3.6-4.4L32 49.6l-6.9-8.2z" class="pp__collar"/>',
  turtleneck: '<path d="M9 64c1.6-10.6 9.2-16.6 23-16.6S53.4 53.4 55 64z" class="pp__coat"/><path d="M26 39.5h12v8H26z" class="pp__collar"/>',
  lapels: '<path d="M8 64c1.6-11 9.6-17.4 24-17.4S54.4 53 56 64z" class="pp__coat"/><path d="M26.4 46.8 32 64l5.6-17.2M28 47l4 6 4-6" class="pp__line"/>',
  jacket: '<path d="M8.5 64c1.6-11 9.4-17 23.5-17s21.9 6 23.5 17z" class="pp__coat"/><path d="M32 47v17M24 49l2 15M40 49l-2 15" class="pp__line"/>',
};
const DETAILS = {
  none: "",
  glasses: '<path d="M24.6 27.4h5.6v3.4h-5.6zM33.8 27.4h5.6v3.4h-5.6zM30.2 28.6h3.6" class="pp__line"/>',
  scar: '<path d="M36.6 24.4l2.8 7.4" class="pp__line pp__accent"/>',
  earring: '<circle cx="42.2" cy="32.6" r="1.3" class="pp__accent-fill"/>',
  smoke: '<path d="M37 36.6h6" class="pp__line"/><path d="M44.6 35.4c1.8-2 .2-3.6 1.8-5.6s.2-3.6 1.6-5.4" class="pp__smoke"/>',
  implant: '<path d="M23.2 27.2h-2.4v5.2h2.4" class="pp__line pp__accent"/>',
};
// Archetype nudges: which picks are likelier for the job (keys from data.js).
const LEANS = {
  analyst: { hat: ["none", "visor"], detail: ["glasses", "implant"] },
  cityspeaker: { hat: ["hood", "cap"], coat: ["jacket"] },
  doxie: { hair: ["long", "bob", "bun"], coat: ["lapels"] },
  enforcer: { hair: ["shaved", "short"], coat: ["jacket"], detail: ["scar"] },
  fixer: { coat: ["lapels"], detail: ["smoke", "earring"] },
  inspector: { hat: ["fedora"], coat: ["trench"] },
  skimmer: { hat: ["cap", "none"], coat: ["turtleneck"] },
};
function portraitParts(name, arch) {
  const h = hashOf(name), lean = LEANS[arch] || {};
  const choose = (set, key, shift) => {
    const all = Object.keys(set), pref = lean[key] || [];
    const pool = (h >>> shift) % 3 === 0 || !pref.length ? all : pref;   // the archetype wins two times in three
    return pool[(h >>> (shift + 2)) % pool.length];
  };
  const hat = choose(HATS, "hat", 0), hair = hat === "hood" ? "short" : choose(HAIR, "hair", 5);
  return { hat, hair, coat: choose(COATS, "coat", 10), detail: choose(DETAILS, "detail", 15) };
}
export function portraitPlaceholder(name, cls = "", arch = "") {
  const p = portraitParts(name, arch);
  const box = el("span", { class: `art portrait-ph portrait-ph--${toneFor(name)} ${cls}`.trim(), "aria-hidden": "true",
    dataset: { hat: p.hat, hair: p.hair, coat: p.coat, detail: p.detail } });
  box.append(svg("0 0 64 64",
    `${p.hat === "hood" ? HATS.hood : ""}${COATS[p.coat]}<path d="M27.4 38h9.2v9.4h-9.2z" class="pp__skin"/><ellipse cx="32" cy="27.6" rx="9.6" ry="11.4" class="pp__skin"/>${HAIR[p.hair]}${p.hat !== "hood" ? HATS[p.hat] : ""}${DETAILS[p.detail]}`,
    "portrait-ph__art pp"));
  box.append(el("span", { class: "portrait-ph__initials" }, initialsOf(name)));
  return box;
}

// ---- ring gauges ----------------------------------------------------------------
// One segment per point, so a 5-Health character reads as five, not a percentage.
export function ringGauge(value, max, tone, label) {
  const n = Math.max(1, max), r = 15, c = 2 * Math.PI * r, gap = n > 1 ? 2.2 : 0, seg = c / n - gap;
  let rings = "";
  for (let i = 0; i < n; i++) {
    const on = i < value;
    rings += `<circle cx="20" cy="20" r="${r}" class="ring__seg${on ? " ring__seg--on" : ""}" stroke-dasharray="${seg.toFixed(2)} ${(c - seg).toFixed(2)}" stroke-dashoffset="${(-(i * (seg + gap))).toFixed(2)}"/>`;
  }
  const wrap = el("span", { class: `ring ring--${tone}`, role: "img", "aria-label": `${label} ${value} of ${max}` });
  wrap.append(svg("0 0 40 40", `<g transform="rotate(-90 20 20)">${rings}</g>`, "ring__svg"),
    el("span", { class: "ring__num", "aria-hidden": "true" }, String(value)));
  wrap.append(el("span", { class: "ring__label", "aria-hidden": "true" }, label));
  return wrap;
}

// ---- chase: the distance as a track ---------------------------------------------
// Five stops (the Range Categories); the pursuer sits one stop in from the left
// edge and the prey `dist` stops further on. Off the left end = caught, off the
// right = escaped — the same thresholds the chase card states.
export function rangeTrack(ranges, distIdx) {
  const n = ranges.length, W = 300, pad = 18, step = (W - pad * 2) / (n - 1);
  const x = (i) => pad + Math.max(-0.6, Math.min(n - 0.4, i)) * step;
  let marks = "";
  ranges.forEach((r, i) => {
    marks += `<circle cx="${pad + i * step}" cy="22" r="3" class="track-art__stop${i <= distIdx ? " track-art__stop--span" : ""}"/>`;
  });
  const pursuer = `<g class="track-art__pursuer" transform="translate(${x(0)} 22)"><path d="M-6 -9 6 0 -6 9z"/></g>`;
  const prey = `<g class="track-art__prey" transform="translate(${x(distIdx)} 22)"><circle r="7"/><circle r="2.2" class="track-art__dot"/></g>`;
  const wrap = el("div", { class: "track-art", role: "img", "aria-label": `Distance: ${ranges[distIdx]?.name || (distIdx < 0 ? "caught" : "escaped")}` });
  wrap.append(svg(`0 0 ${W} 44`, `<line x1="${pad}" y1="22" x2="${W - pad}" y2="22" class="track-art__line"/><line x1="${pad}" y1="22" x2="${x(distIdx)}" y2="22" class="track-art__gap"/>${marks}${pursuer}${prey}`, "track-art__svg"),
    el("div", { class: "track-art__labels", "aria-hidden": "true" }, ...ranges.map((r, i) => el("span", { class: i === distIdx ? "on" : "" }, r.name))));
  return wrap;
}

// ---- countdown: the escalation ladder ----------------------------------------------
// Every step of the timer in order, the current one lit, so "a miss escalates"
// is something you can see.
export function timerLadder(steps, current) {
  const at = steps.indexOf(current);
  return el("ol", { class: "ladder", "aria-label": `Timer at ${current}, step ${at + 1} of ${steps.length}` },
    ...steps.map((s, i) => el("li", { class: "ladder__step" + (i < at ? " ladder__step--past" : i === at ? " ladder__step--now" : "") }, s)));
}

// ---- case files: a rubber stamp --------------------------------------------------------
export function stamp(text, tone = "amber") {
  return el("span", { class: `stamp stamp--${tone}`, "aria-hidden": "true" }, text);
}

// ---- atmosphere: a skyline for the app bar ---------------------------------------------
// A generic night skyline — towers, a spire, a few lit windows, a distant
// airship light. Invented shapes, no recognisable city or film frame.
export function skyline(cls = "") {
  const towers = "M0 40V28h8v-6h6v10h5V18h7v8h4V12h3v-4h2v4h3v16h6V22h9v-6h5v14h4V20l4-4 4 4v20h5V26h7v-8h6v4h5V10h2V4h1v6h2v18h6V20h8v10h4V16h9v8h5V30h7V14h3l3-5 3 5v12h6V24h8v-6h6v12h4V20h7v20";
  const inner = `<path d="${towers}" class="skyline__towers"/>
    <g class="skyline__lights"><rect x="21" y="22" width="1.6" height="1.6"/><rect x="43" y="26" width="1.6" height="1.6"/><rect x="73" y="24" width="1.6" height="1.6"/><rect x="103" y="30" width="1.6" height="1.6"/><rect x="132" y="22" width="1.6" height="1.6"/><rect x="161" y="28" width="1.6" height="1.6"/><rect x="196" y="20" width="1.6" height="1.6"/></g>
    <circle cx="150" cy="7" r="1.2" class="skyline__beacon"/><path d="M122 6h14" class="skyline__ship"/>
    <g class="skyline__spinner"><path d="M-9 12h6"/><circle cx="0" cy="12" r="1.3"/></g>`;
  return svg("0 0 220 40", inner, `art skyline ${cls}`.trim());
}

// ---- explainer diagrams (tutorial) ------------------------------------------------------
// Drawn from the same die markup the roll dialog uses, with every number passed
// in from the data layer by the caller (§10.2) — the diagram states no rule.
function miniDie(size, face, state = "") {
  return el("span", { class: `die die--d${size}${state ? " die--" + state : ""} diagram__die`, dataset: { face: String(face) } },
    el("span", { class: "die__face" }, String(face)), el("span", { class: "die__size" }, `d${size}`));
}
const arrow = () => el("span", { class: "diagram__arrow", "aria-hidden": "true" }, "→");

// Attribute die + skill die → successes.
export function dicePoolDiagram({ attr, skill, success, double }) {
  // Example faces: the attribute die lands a double if it can, the skill die just misses.
  const aFace = attr.size >= double ? double : success, sFace = Math.max(1, success - 2);
  const count = aFace >= double ? 2 : 1;
  return el("figure", { class: "diagram", "aria-label": `Example: a d${attr.size} and a d${skill.size}; ${success}+ is one success, ${double}+ is two.` },
    el("div", { class: "diagram__row" },
      el("span", { class: "diagram__cell" }, miniDie(attr.size, aFace, count === 2 ? "crit" : "succ"), el("small", {}, `Attribute ${attr.level}`)),
      el("span", { class: "diagram__plus", "aria-hidden": "true" }, "+"),
      el("span", { class: "diagram__cell" }, miniDie(skill.size, sFace), el("small", {}, `Skill ${skill.level}`)),
      arrow(),
      el("span", { class: "diagram__result" }, el("b", {}, String(count)), el("small", {}, count === 1 ? "success" : "successes"))),
    el("figcaption", {}, el("span", { class: "tag tag--sm tag--adv" }, `${success}+ = 1`), " ", el("span", { class: "tag tag--sm tag--adv" }, `${double}+ = 2`), " ", el("span", { class: "tag tag--sm" }, "one is enough")));
}

// A failed roll → push → the 1 stays locked and costs.
export function pushDiagram({ bane, size = 8 }) {
  return el("figure", { class: "diagram", "aria-label": `Pushing: every die not showing ${bane} and not already a success is rolled again; each ${bane} left costs you.` },
    el("div", { class: "diagram__row" },
      el("span", { class: "diagram__cell" }, el("span", { class: "diagram__pair" }, miniDie(size, 3), miniDie(size, bane)), el("small", {}, "Failure")),
      el("span", { class: "diagram__cell diagram__push" }, el("span", { class: "i-wrap" }, "↻"), el("small", {}, "Push")),
      el("span", { class: "diagram__cell" }, el("span", { class: "diagram__pair" }, miniDie(size, 7, "succ"), miniDie(size, bane, "bane")), el("small", {}, "1 success · 1 bane"))),
    el("figcaption", {}, `The ${bane} was locked — it costs 1 damage or 1 stress.`));
}

// The Investigation Procedure as a loop: numbered stops round a circle.
export function loopDiagram(steps) {
  const n = steps.length, R = 58, cx = 80, cy = 80;
  let nodes = "", labels = "";
  steps.forEach((s, i) => {
    const a = (-90 + (360 / n) * i) * Math.PI / 180, x = cx + R * Math.cos(a), y = cy + R * Math.sin(a);
    nodes += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="11" class="loop__node"/><text x="${x.toFixed(1)}" y="${(y + 4).toFixed(1)}" class="loop__num">${s.step}</text>`;
  });
  // A chevron on the ring halfway between the first two stops, pointing clockwise.
  const ha = (-90 + 180 / n) * Math.PI / 180, hx = cx + R * Math.cos(ha), hy = cy + R * Math.sin(ha);
  const deg = (-90 + 180 / n) + 90;
  const head = `<path d="M-4 -5 L3 0 L-4 5" transform="translate(${hx.toFixed(1)} ${hy.toFixed(1)}) rotate(${deg.toFixed(1)})" class="loop__head"/>`;
  const fig = el("figure", { class: "diagram diagram--loop", "aria-label": `The ${n} steps of a Shift, in a loop: ${steps.map((s) => s.title).join(", ")}.` });
  fig.append(svg("0 0 160 160", `<circle cx="${cx}" cy="${cy}" r="${R}" class="loop__ring"/>${head}${nodes}<text x="${cx}" y="${cy - 2}" class="loop__mid">one</text><text x="${cx}" y="${cy + 11}" class="loop__mid">Shift</text>`, "loop"));
  fig.append(el("ol", { class: "loop__list" }, ...steps.map((s) => el("li", {}, s.title))));
  return fig;
}

// The Range Categories as a plain band, near to far.
export function rangeBands(ranges) {
  return el("figure", { class: "diagram", "aria-label": `Ranges, near to far: ${ranges.map((r) => r.name).join(", ")}.` },
    el("div", { class: "bands" }, ...ranges.map((r, i) => el("span", { class: "bands__band", style: `--i:${i}` }, r.name))));
}

// ---- ID card (round 3) -------------------------------------------------------
// A badge number and a barcode strip derived from the character's id. Purely
// decorative: the same id always gives the same number and the same bars.
function hashOf(s = "") { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.codePointAt(0), 16777619) >>> 0; return h; }
export function badgeNumber(id) { return `BR-${String(hashOf(id) % 9000 + 1000)}`; }
export function barcode(id, cls = "") {
  let h = hashOf(id), x = 0, bars = "";
  while (x < 118) { h = Math.imul(h, 1103515245) + 12345 >>> 0; const w = 1 + (h >>> 29) % 3, gap = 1 + (h >>> 26) % 3; bars += `<rect x="${x}" y="0" width="${w}" height="22"/>`; x += w + gap; }
  return svg("0 0 120 22", bars, `art barcode ${cls}`.trim());
}

// ---- Avatars for people who are not player characters ---------------------------
// The same name-coloured placeholder the roster uses, small, for suspects,
// NPC combatants, leads and the party list.
export function avatar(name, cls = "", arch = "") { return portraitPlaceholder(name, `avatar ${cls}`.trim(), arch); }

// ---- Panel watermarks (round 3) ----------------------------------------------------
// One faint monoline drawing per Solo/GM panel, in the first card's corner.
const SCENES = {
  play: `<rect x="10" y="18" width="60" height="44" rx="6"/><path d="M34 30v20l16-10z"/><path d="M18 18l6-8M34 18l6-8M50 18l6-8"/>`,
  case: `<path d="M8 22h22l6 6h36v36H8z"/><path d="M8 34h64"/><path d="M20 46h26M20 54h18"/>`,
  shift: `<path d="M8 60c10-18 22-6 30-22s18-20 34-24"/><circle cx="14" cy="54" r="3"/><circle cx="40" cy="36" r="3"/><path d="M64 10c-5 0-9 4-9 9 0 7 9 15 9 15s9-8 9-15c0-5-4-9-9-9z"/><circle cx="64" cy="19" r="3"/>`,
  scene: `<path d="M18 70V14h34v56"/><path d="M52 14l14 8v44l-14 4"/><circle cx="44" cy="44" r="2"/><path d="M6 70h68"/>`,
  board: `<rect x="8" y="10" width="64" height="56" rx="3"/><circle cx="24" cy="26" r="3"/><circle cx="56" cy="30" r="3"/><circle cx="36" cy="52" r="3"/><path d="M24 26l32 4-20 22z"/>`,
  leads: `<circle cx="32" cy="32" r="16"/><path d="M44 44l18 18"/><path d="M8 66c14-6 20 4 34-2s18-10 30-6" stroke-dasharray="3 4"/>`,
  wrap: `<path d="M50 12a24 24 0 1 0 16 36A20 20 0 0 1 50 12z"/><circle cx="24" cy="54" r="10"/><path d="M24 48v6l4 3"/>`,
  notes: `<rect x="16" y="8" width="44" height="60" rx="3"/><path d="M16 18h-5M16 30h-5M16 42h-5M16 54h-5"/><path d="M26 22h24M26 32h24M26 42h16"/><path d="M58 50l10-10 4 4-10 10-6 2z"/>`,
  prep: `<path d="M8 22h22l6 6h36v36H8z"/><path d="M20 46h26M20 54h18"/>`,
  fight: `<circle cx="40" cy="40" r="22"/><circle cx="40" cy="40" r="10"/><path d="M40 8v14M40 58v14M8 40h14M58 40h14"/>`,
};
export function sceneArt(key, cls = "") {
  const inner = SCENES[key] || SCENES.play;
  return svg("0 0 80 80", `<g ${STROKE}>${inner}</g>`, `art scene-art ${cls}`.trim());
}

// ---- Large empty states ----------------------------------------------------------------
const EMPTIES = {
  character: `<circle cx="60" cy="38" r="14"/><path d="M32 96c2-18 14-28 28-28s26 10 28 28"/><path d="M54 30c2-4 10-4 12 0s-6 6-6 10M60 46v1" />`,
  case: `<path d="M14 34h32l8 8h52v50H14z"/><path d="M14 52h92" opacity=".6"/><path d="M50 72h20" stroke-dasharray="3 4"/>`,
  board: `<rect x="12" y="16" width="96" height="72" rx="4"/><circle cx="60" cy="40" r="4"/><path d="M60 44v18"/><rect x="46" y="62" width="28" height="18" rx="2" stroke-dasharray="3 3"/>`,
  fight: `<circle cx="60" cy="52" r="28"/><circle cx="60" cy="52" r="12" stroke-dasharray="3 4"/><path d="M60 14v14M60 76v14M22 52h14M84 52h14"/>`,
  journal: `<path d="M34 14h44a6 6 0 0 1 6 6v66H40a6 6 0 0 1-6-6z"/><path d="M34 80a6 6 0 0 1 6-6h44"/><path d="M46 30h26M46 40h26M46 50h16" stroke-dasharray="3 4"/><path d="M92 26l8-8 6 6-8 8-8 2z"/>`,
  inventory: `<path d="M24 44l36-16 36 16-36 16z"/><path d="M24 44v32l36 16 36-16V44M60 60v32"/><path d="M24 44l-8-14 36-14 8 12M96 44l8-14-36-14-8 12" opacity=".6"/>`,
  leads: `<circle cx="52" cy="46" r="20"/><path d="M66 60l20 20"/><path d="M10 88c18-10 26 4 44-4s26-12 56-8" stroke-dasharray="3 5"/><path d="M46 46h12M52 40v12" opacity=".6"/>`,
  star: `<path d="M60 14l10 22 24 3-18 16 5 24-21-12-21 12 5-24-18-16 24-3z"/><circle cx="60" cy="48" r="8" stroke-dasharray="2 3"/>`,
  dice: `<rect x="22" y="34" width="34" height="34" rx="6"/><circle cx="32" cy="44" r="2" fill="currentColor"/><circle cx="46" cy="58" r="2" fill="currentColor"/><path d="M78 24l20 14-8 24H66l-8-24z"/><path d="M78 24v38" opacity=".5"/>`,
};
export function emptyScene(kind, cls = "") {
  return svg("0 0 120 100", `<g ${STROKE}>${EMPTIES[kind] || EMPTIES.case}</g>`, `art empty-scene ${cls}`.trim());
}

// ---- Places (round 4) --------------------------------------------------------------------
// A small drawing on each destination card, chosen by the place word the
// Location table rolled ("Neon-lit Bar" → the bar sign). Words the table does
// not use (a place typed by the player) fall back to the street.
const PLACES = {
  street:   `<path d="M6 42h36"/><path d="M14 42V12h8"/><path d="M22 12c3 0 4 2 4 4"/><path d="M23 17h6" opacity=".7"/><path d="M30 42l4-18M40 42l-2-18" opacity=".45"/>`,
  building: `<rect x="12" y="8" width="18" height="34"/><path d="M30 18h8v24h-8"/><path d="M17 14h3M22 14h3M17 21h3M22 21h3M17 28h3M22 28h3"/><path d="M18 42v-6h6v6"/>`,
  bar:      `<path d="M14 10h20l-10 13z"/><path d="M24 23v13M17 36h14"/><path d="M29 14l5-6" opacity=".7"/><circle cx="36" cy="7" r="1.6"/>`,
  clinic:   `<rect x="8" y="12" width="32" height="28" rx="3"/><path d="M24 18v16M16 26h16"/><path d="M18 12V8h12v4"/>`,
  dock:     `<path d="M6 30h36"/><path d="M12 30V14l18-6v22"/><path d="M30 8l8 8" /><path d="M38 16v6"/><path d="M6 38c4-3 8 3 12 0s8 3 12 0 8 3 12 0" opacity=".6"/>`,
  factory:  `<path d="M6 42V22l10 6v-6l10 6v-6l10 6V10h6v32z"/><path d="M12 36h4M22 36h4M32 36h4" opacity=".7"/>`,
  tower:    `<path d="M18 42V12l6-6 6 6v30"/><path d="M12 42V24h6M30 24h6v18"/><path d="M22 18h4M22 25h4M22 32h4"/><path d="M8 42h32"/>`,
  shop:     `<path d="M8 18h32l-3-8H11z"/><path d="M8 18c0 3 4 3 4 0 0 3 4 3 4 0 0 3 4 3 4 0 0 3 4 3 4 0 0 3 4 3 4 0 0 3 4 3 4 0 0 3 4 3 4 0"/><path d="M11 22v20h26V22"/><path d="M20 42v-10h8v10"/>`,
  rooftop:  `<path d="M6 30h36"/><path d="M10 30V42M38 30V42"/><path d="M28 30V20h8v10"/><path d="M32 20v-6" /><circle cx="14" cy="12" r="3" opacity=".6"/><path d="M18 22h4" opacity=".6"/>`,
  transit:  `<rect x="12" y="8" width="24" height="26" rx="5"/><path d="M12 22h24"/><circle cx="18" cy="28" r="1.6"/><circle cx="30" cy="28" r="1.6"/><path d="M16 34l-4 8M32 34l4 8M14 38h20"/>`,
  tunnel:   `<path d="M6 42V26a18 18 0 0 1 36 0v16"/><path d="M14 42V28a10 10 0 0 1 20 0v14" opacity=".6"/><path d="M24 34v8" stroke-dasharray="2 3"/>`,
  ruin:     `<path d="M8 42h32"/><path d="M12 42V18l6 4 4-8v28"/><path d="M28 42V24l4 3 4-5v20" opacity=".7"/><path d="M16 34l-4-2M34 34l2 3" opacity=".5"/>`,
};
const PLACE_WORDS = [
  ["bar", /\b(bar|nightclub|club|casino|arcade|restaurant)\b/i],
  ["clinic", /\b(clinic|hospital|lab)\b/i],
  ["dock", /\bdock\b/i],
  ["factory", /\b(factory|warehouse|construction|garage|facility)\b/i],
  ["tower", /\b(bank|office|headquarters|municipal|library|monument|data center)\b/i],
  ["shop", /\b(shop|bazaar)\b/i],
  ["rooftop", /\brooftop\b/i],
  ["transit", /\b(transit|viaduct)\b/i],
  ["tunnel", /\btunnel\b/i],
  ["ruin", /\bruin\b/i],
  ["building", /\b(apartment|home|hotel|safehouse|lobby)\b/i],
];
function placeKind(name) { return (PLACE_WORDS.find(([, re]) => re.test(name || "")) || ["street"])[0]; }
export function placeArt(name, cls = "") {
  const kind = placeKind(name);
  const s = svg("0 0 48 48", `<g ${STROKE}>${PLACES[kind]}</g>`, `art place-art place-art--${kind} ${cls}`.trim());
  return s;
}

// ---- Countdown dial (round 4) ----------------------------------------------------------
// The escalation ladder bent into a dial: one arc per step, the current one lit,
// a needle on it. The ladder list stays beside it for reading.
export function countdownDial(steps, current) { return stepDial(steps, current, "Countdown timer"); }
// The same dial for anything rated on a ladder of dice (a lead's rating, the timer).
export function stepDial(steps, current, label, cls = "") {
  const at = Math.max(0, steps.indexOf(current));
  const n = steps.length, cx = 40, cy = 40, r = 30, start = -210, sweep = 240, gap = 4;
  const seg = (sweep - gap * (n - 1)) / n;
  const pt = (deg, rr = r) => { const a = (deg * Math.PI) / 180; return [cx + rr * Math.cos(a), cy + rr * Math.sin(a)]; };
  let arcs = "";
  for (let i = 0; i < n; i++) {
    const a0 = start + i * (seg + gap), a1 = a0 + seg;
    const [x0, y0] = pt(a0), [x1, y1] = pt(a1);
    arcs += `<path d="M${x0.toFixed(1)} ${y0.toFixed(1)}A${r} ${r} 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)}" class="dial__seg${i < at ? " dial__seg--past" : i === at ? " dial__seg--now" : ""}"/>`;
  }
  const mid = start + at * (seg + gap) + seg / 2;
  const [nx, ny] = pt(mid, r - 10);
  const inner = `${arcs}<line x1="${cx}" y1="${cy}" x2="${nx.toFixed(1)}" y2="${ny.toFixed(1)}" class="dial__needle"/><circle cx="${cx}" cy="${cy}" r="3" class="dial__hub"/>`;
  const wrap = el("div", { class: `dial ${cls}`.trim(), role: "img", "aria-label": `${label} at ${current}, step ${at + 1} of ${n}` });
  wrap.append(svg("0 0 80 64", inner, "dial__svg"), el("span", { class: "dial__die", "aria-hidden": "true" }, current));
  return wrap;
}

// ---- Weapons (round 5) ----------------------------------------------------------------
// A side silhouette per kind of weapon, picked from the weapon's own fields (melee or
// ranged, its damage type, its reach, thrown or placed) — no weapon is named here.
const WEAPON_ART = {
  pistol: '<path d="M5 8.5h28l2 2h6v4.5H22.5l-2.4 7h-6.4l2.2-7H5z"/><path d="M19 15c.4 2 1.6 3 3.4 3" opacity=".7"/>',
  rifle: '<path d="M2 9.5h33l2.4-2.4H46v4.6h-6.4l-2.2 2.2H21.6l-3.2 6.4h-5.6l2.4-6.4H8.4L2 15.8z"/><path d="M24 6.6h8" opacity=".7"/>',
  blade: '<path d="M14 15.6 42 9.4l4 3.2-4 3H14z"/><path d="M14 10.6v8.6M6 13.2h8v4H6z"/>',
  baton: '<path d="M4 10.6h36.4a2.4 2.4 0 0 1 0 4.8H4z"/><path d="M8 10.6v4.8M12 10.6v4.8M16 10.6v4.8" opacity=".7"/>',
  fist: '<path d="M14 6h17a4 4 0 0 1 4 4v8a4 4 0 0 1-4 4H14a3 3 0 0 1-3-3V9a3 3 0 0 1 3-3z"/><path d="M19 6v6M24 6v6M29 6v6M11 15h8" opacity=".7"/>',
  spray: '<path d="M18 8h10v14H18z"/><path d="M20 5h6v3h-6zM26 6.4h5M33 4l3-2M33 6.4h4M33 9l3 2" opacity=".8"/>',
  grenade: '<circle cx="24" cy="15" r="6.4"/><path d="M21 8.4h6V6h-6zM27 7.2l5 3.4M17.6 15h12.8" opacity=".8"/>',
  charge: '<path d="M8 8h22v12H8z"/><path d="M30 11h6l3-4M30 16h8l4 3M13 12h12M13 16h7" opacity=".8"/>',
  cannon: '<path d="M4 12h30v6H4zM34 13h10v4H34z"/><circle cx="12" cy="20" r="2.6"/><circle cx="24" cy="20" r="2.6"/>',
};
function weaponKind(w = {}) {
  const k = `${w.key || ""} ${w.name || ""}`.toLowerCase();
  if (w.blastPower || /grenade|gas|bang|charge|explosive|missile/.test(k)) return w.thrown ? "grenade" : (/missile|cannon/.test(k) ? "cannon" : "charge");
  if (/autocannon|cannon/.test(k)) return "cannon";
  if (/unarmed|knuckle/.test(k)) return "fist";
  if (/spray/.test(k)) return "spray";
  if (!w.maxRange && !w.minRange) return w.type === "piercing" ? "blade" : "baton";
  return ["long", "extreme"].includes(w.maxRange) || /rifle|gauge/.test(k) ? "rifle" : "pistol";
}
export function weaponArt(w, cls = "") {
  const kind = weaponKind(w);
  return svg("0 0 48 24", `<g ${STROKE}>${WEAPON_ART[kind]}</g>`, `art weapon-art weapon-art--${kind} ${cls}`.trim());
}

// ---- Vitals as signals (round 5) --------------------------------------------------------
// Health as a heartbeat that flattens as it drops; Resolve as a steady wave that
// jitters as it drops. Two copies side by side so the line can scroll forever.
// Decorative: the track beside it states the numbers.
export function vitalWave(kind, value, max) {
  const f = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0, mid = 14, W = 120;
  let d = `M0 ${mid}`;
  if (kind === "health") {
    const f2 = f > 0 ? 0.35 + 0.65 * f : 0;   // a weak pulse still reads as a pulse; only zero is flat
    for (let s = 0; s < W * 2; s += 40)
      d += ` L${s + 12} ${mid} L${s + 15} ${(mid - 3 * f2).toFixed(1)} L${s + 18} ${mid} L${s + 21} ${(mid + 4 * f2).toFixed(1)} L${s + 24} ${(mid - 12 * f2).toFixed(1)} L${s + 27} ${(mid + 8 * f2).toFixed(1)} L${s + 30} ${mid} L${s + 40} ${mid}`;
  } else {
    const shake = (1 - f) * 5;
    for (let x = 2; x <= W * 2; x += 2) {
      const j = ((((x % W) * 7919) % 13) / 13 - 0.5) * shake;   // periodic, so the loop has no seam
      d += ` L${x} ${(mid + Math.sin((x / W) * Math.PI * 6) * 6 * Math.max(f, 0.15) + j).toFixed(1)}`;
    }
  }
  const s = svg(`0 0 ${W} 28`, `<g class="wave__run"><path d="${d}" class="wave__line"/></g>`,
    `art wave wave--${kind}${f === 0 ? " wave--flat" : f <= 0.34 ? " wave--low" : ""}`);
  s.setAttribute("preserveAspectRatio", "none");   // fill the track's width; the stroke does not scale
  return s;
}

// ---- Dice and grades (round 5) ----------------------------------------------------------
// A die drawn as its own silhouette; a grade drawn as a meter from worst to best.
const DIE_SHAPES = {
  6: '<rect x="5" y="5" width="22" height="22" rx="3"/>',
  8: '<path d="M16 3 29 16 16 29 3 16z"/>',
  10: '<path d="M16 2.5 29 13 16 29.5 3 13z"/>',
  12: '<path d="M16 2.5 28.8 11.8 23.9 26.8H8.1L3.2 11.8z"/>',
};
export function dieShape(size, cls = "") {
  return svg("0 0 32 32", `<g ${STROKE}>${DIE_SHAPES[size] || DIE_SHAPES[6]}</g>`, `art die-shape die-shape--d${size} ${cls}`.trim());
}
// `order` runs worst → best (e.g. D, C, B, A); one segment lit per step reached.
export function levelMeter(level, order, label = "") {
  const at = order.indexOf(level);
  return el("span", { class: "lvmeter", role: "img", "aria-label": `${label ? label + " " : ""}grade ${level}, ${at + 1} of ${order.length}` },
    ...order.map((_, i) => el("span", { class: "lvmeter__seg" + (i <= at ? " lvmeter__seg--on" : "") })));
}

// ---- The Shift clock (round 5) ---------------------------------------------------------
// The day as an arc of `perDay` Shifts (from data.js), the current one lit, a sun
// over the day half and a moon over the night half. Decorative beside "Shift N".
export function shiftClock(shiftNo, perDay, cls = "") {
  const n = Math.max(1, perDay), at = ((Math.max(1, shiftNo) - 1) % n), cx = 20, cy = 20, r = 14;
  let segs = "";
  for (let i = 0; i < n; i++) {
    const a0 = Math.PI + (i * Math.PI * 2) / n + 0.08, a1 = Math.PI + ((i + 1) * Math.PI * 2) / n - 0.08;
    const p = (a) => `${(cx + r * Math.cos(a)).toFixed(1)} ${(cy + r * Math.sin(a)).toFixed(1)}`;
    segs += `<path d="M${p(a0)}A${r} ${r} 0 0 1 ${p(a1)}" class="sclock__seg${i === at ? " sclock__seg--now" : i < at ? " sclock__seg--past" : ""}"/>`;
  }
  const mid = Math.PI + ((at + 0.5) * Math.PI * 2) / n, night = at >= n / 2;
  const bx = cx + 7 * Math.cos(mid), by = cy + 7 * Math.sin(mid);
  const body = night ? `<path d="M${(bx + 2).toFixed(1)} ${(by - 3).toFixed(1)}a3.4 3.4 0 1 0 0 6 2.6 2.6 0 0 1 0-6z" class="sclock__moon"/>`
    : `<circle cx="${bx.toFixed(1)}" cy="${by.toFixed(1)}" r="2.6" class="sclock__sun"/>`;
  return svg("0 0 40 40", `${segs}${body}`, `art sclock ${night ? "sclock--night" : ""} ${cls}`.trim());
}

// ---- Tutorial spot art (round 5) ---------------------------------------------------------
// A small comic-panel drawing for each tutorial card, picked by words in its title.
const SPOTS = [
  [/roleplay|what is|what a/i, '<path d="M8 10h20v14c0 7-4.4 12-10 12S8 31 8 24z"/><path d="M13 19h3M21 19h3M13 27c2.4 2 7.6 2 10 0"/><path d="M34 14h22v13c0 7-4.9 11-11 11s-11-4-11-11z"/><path d="M39 22h3M48 22h3M40 32c2.4-2 7.6-2 10 0"/>'],
  [/app does|this app/i, '<rect x="20" y="4" width="24" height="40" rx="4"/><path d="M28 8h8"/><rect x="26" y="18" width="12" height="12" rx="2"/><circle cx="30" cy="22" r="1" fill="currentColor"/><circle cx="34" cy="26" r="1" fill="currentColor"/>'],
  [/own|solo|alone|loop/i, '<path d="M14 44V8h12"/><path d="M26 8c3 0 4 2 4 4"/><path d="M28 13l-6 10h12z" opacity=".5"/><circle cx="42" cy="22" r="4"/><path d="M36 44l2-12h8l2 12M40 32l-2 6"/>'],
  [/board|discovery|clincher|matrix/i, '<rect x="6" y="6" width="52" height="36" rx="2"/><circle cx="18" cy="16" r="2"/><circle cx="44" cy="14" r="2"/><circle cx="30" cy="32" r="2"/><path d="M18 16l26-2-14 18z" stroke-dasharray="2 2"/>'],
  [/fight|combat|chase/i, '<circle cx="32" cy="24" r="16"/><circle cx="32" cy="24" r="6"/><path d="M32 2v10M32 36v10M10 24h10M44 24h10"/>'],
  [/downtime|recover|rest|between/i, '<path d="M6 36V18M6 30h52v6M58 36v-8c0-4-3-6-7-6H24v8"/><circle cx="15" cy="24" r="4"/><path d="M46 8h6l-6 6h6" opacity=".7"/>'],
  [/point|advance|cost|gear|sell/i, '<path d="M32 4l8 6 10-1 2 10 7 7-7 7-2 10-10-1-8 6-8-6-10 1-2-10-7-7 7-7 2-10 10 1z"/><path d="M32 16l2.6 5.4 6 .8-4.4 4 1 6-5.2-2.8-5.2 2.8 1-6-4.4-4 6-.8z"/>'],
  [/sheet|character|create|wizard|choose/i, '<rect x="6" y="8" width="52" height="32" rx="3"/><path d="M6 15h52" opacity=".6"/><rect x="11" y="19" width="14" height="16" rx="2"/><path d="M30 22h20M30 28h14M30 34h18"/>'],
  [/table|session|prep|game runner|gm/i, '<ellipse cx="32" cy="26" rx="22" ry="8"/><path d="M14 31v11M50 31v11"/><circle cx="12" cy="14" r="3"/><circle cx="52" cy="14" r="3"/><circle cx="32" cy="10" r="3"/>'],
  [/case|shift|lead|hypothes|start to finish/i, '<path d="M6 12h18l5 5h29v27H6z"/><path d="M6 22h52" opacity=".6"/><path d="M16 32h20M16 38h12"/>'],
  [/turn|roll|dice|cheat|vital|condition/i, '<rect x="8" y="12" width="22" height="22" rx="4"/><circle cx="14" cy="18" r="1.4" fill="currentColor"/><circle cx="24" cy="28" r="1.4" fill="currentColor"/><path d="M44 8l14 10-6 16H36l-6-16z"/><path d="M44 8v26" opacity=".5"/>'],
];
export function spotArt(title = "", cls = "") {
  const hit = SPOTS.find(([re]) => re.test(title));
  const inner = hit ? hit[1] : '<path d="M4 44V30h8v-8h6v22M18 44V18h10v26M28 44V26h8v18M36 44V12h10v32M46 44V28h12v16"/>';
  return svg("0 0 64 48", `<g ${STROKE}>${inner}</g>`, `art spot-art ${cls}`.trim());
}

// ---- Years on the Force as a service timeline (round 5) --------------------------------
// One stop per row of the table (names and spans from data.js), the chosen one lit.
export function yearsTimeline(rows, currentKey) {
  const wrap = el("div", { class: "ytl", role: "img", "aria-label": `Years on the Force: ${rows.find((r) => r.key === currentKey)?.name || "not chosen"}` });
  rows.forEach((r) => wrap.append(el("span", { class: "ytl__stop" + (r.key === currentKey ? " ytl__stop--on" : ""), "aria-hidden": "true" },
    el("span", { class: "ytl__dot" }), el("span", { class: "ytl__name" }, r.name), el("span", { class: "ytl__yrs" }, `${r.years} yrs`))));
  return wrap;
}
