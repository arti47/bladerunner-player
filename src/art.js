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
export function portraitPlaceholder(name, cls = "") {
  const box = el("span", { class: `art portrait-ph portrait-ph--${toneFor(name)} ${cls}`.trim(), "aria-hidden": "true" });
  box.append(svg("0 0 64 64",
    `<g ${STROKE}><circle cx="32" cy="25" r="9.5"/><path d="M13 60c1.5-11 9.5-17.5 19-17.5S49.5 49 51 60"/><path d="M24 43.5 32 52l8-8.5" opacity=".7"/><path d="M21.5 19.5c1.5-5 5.5-7.5 10.5-7.5s9 2.5 10.5 7.5M18 20h28" opacity=".6"/></g>`,
    "portrait-ph__art"));
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
    <circle cx="150" cy="7" r="1.2" class="skyline__beacon"/><path d="M122 6h14" class="skyline__ship"/>`;
  return svg("0 0 220 40", inner, `art skyline ${cls}`.trim());
}

// ---- explainer diagrams (tutorial) ------------------------------------------------------
// Drawn from the same die markup the roll dialog uses, with every number passed
// in from the data layer by the caller (§10.2) — the diagram states no rule.
function miniDie(size, face, state = "") {
  return el("span", { class: `die die--d${size}${state ? " die--" + state : ""} diagram__die` },
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
