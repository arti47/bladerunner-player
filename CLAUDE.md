# Blade Runner Player — Project CLAUDE.md (Canonical Spec)

> **To the AI reading this:** this file is the complete, self-contained build guide for
> **"Blade Runner Player"** — an installable, multiplayer player-character PWA for the
> **Blade Runner RPG** (Free League Publishing). All planning decisions have already been
> made with the user and are recorded in §0. Your job is to execute the three stages below,
> in order, starting from **Stage A** (nothing has been extracted or built yet).
>
> 1. **Stage A — Ingest & Extract (§2, §3):** systematically extract the System Profile
>    from the user's NotebookLM notebook. Never substitute training-data memory of the
>    game for the source — even if you know the game well, the printing wins.
> 2. **Stage B — Checkpoint (§4):** present one sign-off summary to the user.
> 3. **Stage C — Build (§5–§9):** rewrite this file with the completed System Profile,
>    then build phase by phase, autonomously, under the process rules in §10.
>
> Sections marked **LOCKED** are proven architecture from a fully built, rules-audited
> reference implementation — do not substitute or "improve" them.
> Sections marked **CONDITIONAL** apply only if the game actually has that subsystem.
> **This file is the living spec: every code change updates it in the same change (§10.1).**

---

## 0. Decisions already made (user-confirmed 2026-07-04 — do not re-ask)

| # | Decision | Value |
|---|---|---|
| 1 | Rulebook source | The user's **NotebookLM notebook** (see §2.1) is authoritative. No local PDFs. |
| 2 | Content scope | **Core Rulebook + Solo Mode only.** Case files (*Electric Dreams*, *Fiery Angels*) and *Replicant Rebellion* are **excluded entirely** — no expansion data files, no mining them for crunch. |
| 3 | Firebase | Build the full multiplayer layer per the LOCKED architecture. User will create the Firebase project when needed; app runs **local-only** until keys are dropped into `firebase-config.js`. Include Firebase setup instructions in `README.md`. |
| 4 | Use-case priority | Everything equally — follow the template's default phase order (§9) with no re-prioritization. |
| 5 | Hosting | **GitHub Pages.** Plan includes `git init`, GitHub repo, push-to-deploy (see §13). PWA installed on phone from the Pages URL. |
| 6 | App name | **"Blade Runner Player"** |
| 7 | Visual theme | Neo-noir cyberpunk: deep blacks / rain-slate grays, neon amber + cyan accents (touch of magenta), restrained scanline/terminal texture, retro-future display type. **Dark is the primary theme**; light mode is the secondary of the mandatory light/dark toggle. No copying of actual Blade Runner art, logos, or trade dress. |
| 8 | This session's scope | Planning only. Stage A extraction is **not started** — it is the takeover AI's first task. |

**Working directory:** this folder (`bladerunner/`). It is not yet a git repository.

### Checkpoint rulings (user-confirmed 2026-07-04, Stage B)
- **Creation tables:** include the FULL set — archetypes, specialties, key-memory (5 tables),
  AND flavor tables (appearance, name, home) — so "roll a random Blade Runner" works fully.
- **Inventory:** faithful to the book — a simple equipment list + Promotion Point and Chinyen
  Point counters. **No weight, no slots, no ammo counting, no encumbrance.**
- **Baseline Test & economy:** FULL automation — track Promotion + Humanity Points, run the
  Baseline Test (INSIGHT roll + pass/fail consequences), enforce the 5-PP specialty cost and
  the 5/10/15-HP skill-increase costs (Downtime only).
- **Pregens:** core book publishes none → **no `data-pregens.js`**; wizard is the only path.
- **Powers/magic:** none exist → **no `power-automation.js`**.
- **Setting boundary:** include rules chapters 01–04, 07, 08, 09; exclude Ch 05–06 (LA
  setting / factions) except as light flavor.

**Stage A extraction notes** (full working detail, cite when building data files) live at
`scratchpad/EXTRACTION.md` in the session scratch dir. Re-pull from the notebook to verify
any value: sources — Core `4143a6b6-facb-417e-a618-c09634297d93`, Solo
`ec3090dc-17ce-46ee-9023-f43c22d0341a`, notebook `d4b8a1c4-f067-4b33-b2f0-1c9283f81fce`.

---

## 1. What you are building

| | |
|---|---|
| **Game** | Blade Runner RPG (Free League) — core rules only (no setting/adventure content) |
| **Audience** | Players (player-facing tool with an opt-in GM screen — not a GM-first tool) |
| **Platforms** | Phone, browser, desktop — one installable PWA |
| **Core job** | Character **creation wizard** + full in-play **tracker** + native **dice engine** |
| **Multiplayer** | Multiple characters per device + real-time **shared party & combat tracker** |
| **Backend** | Firebase Realtime Database + Storage; offline-capable; runs with no keys in local mode |
| **Theme** | Neo-noir dark (per §0.7) + light/dark toggle |

**Mandatory scope (regardless of game):** creation wizard · full in-play character sheet ·
native dice engine · inventory & resources · searchable rules library · bestiary/NPC
compendium · Firebase multiplayer party with shared combat tracker · GM screen.

**Conditional scope for this project:**
- **Solo mode: PRESENT.** The notebook contains an official *Solo Mode* source — extract
  and build `solo.js` + `data-solo.js`.
- **Expansion content: ABSENT** by user decision (§0.2). No `data-<expansion>.js` files,
  no expansion toggles.
- **Power/spell automation: expected ABSENT** (Blade Runner is not a magic system), but
  confirm during Stage A — if the game has any comparable automatable subsystem, record it
  in §3.9 and decide at the checkpoint.

---

## 2. Stage A — Rulebook ingestion (NotebookLM)

### 2.1 The source

Everything comes from this NotebookLM notebook, accessed via the **notebooklm-mcp** MCP
server (tools are named `mcp__notebooklm-mcp__*`):

- **Notebook:** "Blade Runner RPG" — ID `d4b8a1c4-f067-4b33-b2f0-1c9283f81fce`
- **URL:** https://notebooklm.google.com/notebook/d4b8a1c4-f067-4b33-b2f0-1c9283f81fce

| Source | Source ID | In scope? |
|---|---|---|
| Core Rulebook.pdf | `4143a6b6-facb-417e-a618-c09634297d93` | ✅ Core — populates `data.js`, `data-monsters.js`, `data-npcs.js`, (`data-pregens.js` if pregens exist) |
| Solo Mode.pdf | `ec3090dc-17ce-46ee-9023-f43c22d0341a` | ✅ Solo — populates `data-solo.js` |
| Electric Dreams.pdf | `cb26f5b2-723e-4338-b262-08ee1fb87737` | ❌ Excluded (case file / adventure) |
| Fiery Angels.pdf | `7cd58cbd-48b5-4533-bb76-34da214d1624` | ❌ Excluded (case file / adventure) |
| Replicant Rebellion.pdf | `a5264ca5-684d-4b46-ac8e-ded86ba02fce` | ❌ Excluded (campaign module) |
| "Game Master Teaches Role-Playing Game" (note) | `4f41f38c-1ce0-473a-a281-b1b0b3e35b90` | ❌ Excluded (not rules canon) |

When querying, **always pass `source_ids`** restricted to the in-scope sources so answers
never silently blend in case-file content.

### 2.2 Extraction method (in order of preference)

1. **`source_get_content(source_id)` — primary.** Returns the raw indexed text of the PDF
   with no AI processing: **deterministic**, fast, and ideal for bulk extraction (skill
   lists, gear tables, NPC stat blocks). Pull the full raw text of the Core Rulebook and
   Solo Mode first, save them as working files in a scratch directory (never commit them),
   and extract from that text.
2. **`notebook_query(notebook_id, query, source_ids=[...])` — secondary.** Use for
   clarification when the raw text is ambiguous (e.g. table layouts mangled by PDF text
   extraction). Notebook answers are **non-deterministic**: corroborate any surprising or
   load-bearing value with a second, differently-phrased query before recording it.
3. If tools return auth errors, run `notebooklm-mcp-auth` in the terminal (Bash tool) —
   that is the automated re-authentication path.

Map the book's structure first (table of contents / chapter list), then extract section by
section against the §3 profile.

### 2.3 Hard rules for extraction

- Every number, list, table, formula, and procedure in the app comes **from the source**.
  If you cannot find a value, ask the user or mark the feature blocked — never fill gaps
  from memory of the game.
- **Extraction is complete, not sampled.** All skills, all specialties/talents, all gear,
  all NPC/adversary stat blocks in the core book go into the data files. For large
  categories, plan multiple data-extraction sub-phases in the roadmap — completeness is
  non-negotiable.
- **Paraphrase, don't copy.** Extract numbers and mechanics; rewrite all effect and flavor
  text concisely in your own words. Never reproduce rules prose verbatim. Exclude setting,
  adventure, and art content entirely (§12).
- Cite locations as you extract (chapter/section names, and page numbers where the raw
  text preserves them) in data-file comments so the audit (§11) can re-check values fast.

---

## 3. System Profile — COMPLETED (Stage A, verified against source)

> Canonical rules summary. Every number below is extracted from the Core Rulebook / Solo
> Mode. `data*.js` files are the single source of truth; this section is the human-readable
> spec. Full working detail (weapon/NPC stat lines, page cites) is in
> `scratchpad/EXTRACTION.md`. Where a slot says "enumerate in Phase 0", the mechanic is
> fully known but the complete item list must be pulled into the data file during build.

**3.1 Resolution — step-dice (Year Zero variant).** Roll **Base Dice** = attribute die +
skill die. Die by level: **A=D12, B=D10, C=D8, D=D6**. **Success = 6+** (one die); **10+ =
two successes**. ≥1 success = the action succeeds; extra successes = greater effect / more
damage. **Advantage** = add a third die (count all successes); **disadvantage** = remove the
lower Base Die. **Push** = re-roll a FAILED roll; each **1** rolled on a push inflicts 1
damage (if STR/AGI roll) or 1 stress (if INT/EMP roll). **Replicants suffer stress instead
of damage on ALL pushes.** Numerical rolls read face value (ignore successes); D3 = D6÷2
round up. Opposed rolls: only the attacker/initiator may push.

**3.2 Attributes.** STRENGTH, AGILITY, INTELLIGENCE, EMPATHY, scale A–D (A best). Start at
**C** in all four; apply attribute increases from the Years-on-Force table (one step each).
Archetype **key attribute must be B+**. May lower one attribute C→D to gain one extra
increase. **Replicants: +1 increase, must be STR or AGI.** Vehicles have a fifth attribute,
**MANEUVERABILITY** (governs DRIVING), not owned by characters.

**3.3 Derived (exact formulas).**
- **HEALTH = (STR die size + AGI die size) ÷ 4, round UP.** Replicant **+2**.
- **RESOLVE = (INT die size + EMP die size) ÷ 4, round UP.** Replicant **−2**.
- die sizes: D12=12, D10=10, D8=8, D6=6. (Pure functions in `derived.js`/`rules.js`.)

**3.4 Skills (13).** Baseline **D**; increases from Years-on-Force; archetype **key skills
must be C+**. STR: Hand-to-Hand Combat, Stamina, Force. AGI: Stealth, Mobility, Firearms.
INT: Observation, Medical Aid, Tech. EMP: Connections, Manipulation, Insight. MANEUVER:
Driving. Opposed pairs: Stealth↔Observation, Manipulation↔Insight, Interrogation↔Stamina.
Insight also = Replicant Baseline Test. Connections acquires gear (LAPD=Promotion Pts,
black market=Chinyen Pts) and moves between LA locations.

**3.5 Creation (15 steps).** ① Human/Replicant (D6: 1–3 Human, 4–6 Replicant). ② Archetype
(7; **Cityspeaker & Skimmer human-only, Doxie replicant-only**; separate D12 tables per
type; sets key attribute, key skills, specialty options, starting Chinyen die & signature
gear). ③ Years on Force (D12): Rookie(1–2, +4 attr/+8 skill/0 spec/Promotion **D3**/Chinyen
**−1**), Seasoned(3–6, +3/+10/1/**D6**/0), Veteran(7–10, +2/+12/2/**D8**/+1), Old-Timer(11–12,
+1/+14/3/**D10**/+2). **Starting Promotion Pts = roll the listed die. Starting Chinyen Pts =
roll the archetype's Chinyen die + the Years modifier.** Replicants are always Rookies AND
−1 Promotion, −1 Chinyen (min 0), plus the +1 STR/AGI attribute increase. ④ attributes ⑤
Health/Resolve ⑥ skills ⑦ specialties (count by Years; choose or roll archetype table) ⑧ key
memory (roll 5 tables) ⑨ key relationship (roll tables) ⑩ standard gear (Badge, PK-D Blaster
or .357 Subcompact, KIA, Detective Special Spinner) ⑪ signature item ⑫ appearance ⑬ name ⑭
home (Sector 5 default) ⑮ play. **Secret Replicant** option: on reveal, Health +2, Resolve
−2, Replicant rules apply.

**3.6 Conditions (auto-apply effects in the engine).** Broken-by-damage (0 Health: no
actions/skill rolls, further damage → auto crit), Broken-by-stress (stress ≥ Resolve →
critical-stress effect), Prone, In-cover, Grappled/Restrained (can't defend), Aiming
(advantage to next single shot), plus **every critical-injury effect** (skill disadvantages,
crawl-only, immobile) and **every critical-stress effect**. Each must modify the exact rolls
it names.

**3.7 Health, damage & death.** Two tracks (Health/Resolve). Damage = weapon Damage + 1 per
extra success; push-damage = 1 per 1. **Armor** rating A–D: when hit roll **2 dice** of that
type, each success −1 damage; if reduced to 0 the armor also negates the critical injury
(one suit only; wearing armor disadvantages listed skills). Riot/police shield: no rating,
disadvantages attackers from the front. **Critical injury** on a crit hit: roll the weapon's
**Crit Die** on the **Crushing** or **Piercing** d12 table (blunt weapons' Crit Die =
attacker STR die); extra successes = extra Crit Dice, choose. **Death procedure:** a lethal
crit forces a **STAMINA death save** each interval (Round → next turn, or Shift); Broken =
can't push the save. Fail = die; success = linger, save again. **Stabilize** with a MEDICAL
AID roll (takes the crit's interval; success bumps the interval up a category; a treated
Shift-crit ends the saves). Self-stabilize (not Broken) = disadvantage; Broken+lethal = two
MEDICAL AID rolls (heal + save), any order. **Instant-kill crits** (Crushing 12; Piercing 8,
10, 12): die immediately, no save. Crit tables (with lethal/interval/healing/effect) →
`data.js`; guided death UI in `sheet.js`.

**3.8 Rest & recovery.** Broken recovery: First Aid (MEDICAL AID, heal = successes; Glue =
advantage) or, alone, +1 Health after 1 Shift. **Downtime:** humans +1, Replicants +2
Health per Shift (+1 more with medical care/MedChecker); Health & Resolve heal same Shift.
Cadence: after **3 investigation Shifts** need 1 Downtime Shift or accrue stress (Married to
the Job specialty → 4). Resolve loss can be permanent over a campaign (max Resolve drops;
Resolve 0 = unfit to serve). Once-per-Shift stress-heal specialties (Hip Flask/Origami/
Smokes/Counselor) enforced.

**3.9 Powers / magic — NONE.** No spell/power subsystem. `power-automation.js` omitted.

**3.10 Advancement.** Two currencies. **Promotion Points:** earned doing the job; spend on
RDU gear (+ Connections roll) and specialties (**5 PP**, 1 Shift at Training Grounds); lost
for misconduct (min 0; loss → Connections roll or disciplinary action). **Humanity Points:**
session-end, for compassion; always +1 for interacting with key memory, key relationship, or
failing a Baseline Test; spend to raise a **skill** one step during Downtime: **D→C 5, C→B
10, B→A 15**; attributes can't rise. **Baseline Test (Replicants):** at 0 PP or when
required — INSIGHT roll, 1 Shift at LAPD (not Downtime); pass = +1 PP, fail = +1 HP +
escalating penalty by number failed. App fully automates all of this (per ruling).

**3.11 Inventory & wealth.** **No weight/slots/ammo/encumbrance.** Inventory = plain item
list + **Promotion Point** and **Chinyen Point** counters. Gear acquired via PP (LAPD) or
Chinyen (black market/private), each + a Connections roll (double payment = advantage; fail
= wasted time). Availability tiers Standard/Premium/Rare/Incidental; Cost = # points.
Weapon fields: Damage, Crit Die (type or "STR"), Damage Type (Piercing/Crushing), Min Range,
Max Range, Availability, Cost, full-auto flag. Enumerate ALL weapons/armor/gear/vehicles in
Phase 0 (7 close-combat + ~8–10 ranged + 5 armor/restraint + vehicles + general gear).

**3.12 Combat.** Zone maps; 5 ranges (Engaged, Short, Medium, Long, Extreme). **Initiative:
10 cards #1–10**, drawn once at start, act low→high, persists all combat; exchangeable;
Surprise/Ambush → auto #1; Fast Reflexes → extra card; NPC groups may share a card; hidden-
initiative variant re-draws each round. Turn = **1 action + 1 move + free actions**. Move =
1 zone or Short↔Engaged; Sprint (MOBILITY, +1 move/success) as action; leaving/passing an
active Engaged enemy → MOBILITY or provoke a **free attack**. Close combat = **opposed** roll
(winner even if defender hits; tie = miss; only attacker pushes); crit = 2 successes over
opponent. Ranged = straight FIREARMS roll; crit = 2 successes; range/cover/target-size/aim
modifiers; **full auto** (advantage, +1 stress, spill extra successes to secondary targets);
called shots; grapple; ambush. **Chases** (foot & vehicle) run mapless with maneuver &
obstacle tables (vehicles: Maneuverability/Hull/Armor, DRIVING). No ammo tracking. Enumerate
chase-maneuver/obstacle tables in Phase 0 → `combat.js`.

**3.13 Bestiary & NPCs.** No monster bestiary. NPC build: avg human = C all; typical
Replicant = B in STR/AGL; Replicant NPC = +1 STR/AGL, +2 Health. **14 Typical NPCs**
(Uniformed LAPD Officer, Blade Runner, Street Urchin, Street Thug, Street Hustler, Metrokab
Driver, Newsrag Reporter, Doxie, Replicant Sympathizer, Human Supremacist, Business
Executive, Corporate Killer, Lab Technician, Medical Doctor) each with attributes/skills/
Health/gear → `data-npcs.js`. `data-monsters.js` may hold the same NPC combatant blocks for
the combat tracker (or fold into npcs — keep one canonical list).

**3.14 Pregens — NONE** published → no `data-pregens.js`.

**3.15 Solo Mode — PRESENT** (`data-solo.js` + `solo.js`). Oracle/GM-emulator: Blade Runner
Origin table (D12); Promotion/Humanity self-award checklists; Countdown Event Timer
(escalating Base Dice D6→…→D12/D12, reset on trigger); Scene Check + Scene Categories (D12);
**Question Check** yes/no oracle (with Critical Success + interpretation); **Hypothesis
tracker** (die-rated leads, upgrade/downgrade) + **Hypothesis Check** (roll the rating as
Base Dice, no push; ≥2 succ = crit +5 PP, 1 = success +3 PP, 0 = fail −3 PP, or adv/dis on a
MANIPULATION/CONNECTIONS roll when convincing); NPC Skill Level table, NPC Tactics, NPC Chase
Maneuvers; **Imagining Clues** (Meaning D8, Evidence Descriptor D6→D10, Evidence Type D6→D12);
**Character/NPC generator** (Sphere D6→D8, Trait D6→D12); **Cipher** (Method/Focus, D6 block →
D12) and **Location** (Environment/Place, D6 block → D12) — both are **two-tier rolls**, not
uniform picks; Case Briefing tables; Downtime Event table; Countdown Event table. Every oracle
that groups by a D6 rolls the block first, then the scoped D10/D12 within it.

**3.16 GM tables.** Case File Generator (hook/crime, twist, Main NPCs D3+3, victims,
locations, complications), Disciplinary Action table, random street events. → GM screen
reference panel; enumerate in Phase 0.

---

## 4. Stage B — The Checkpoint (one user sign-off)

Before writing any application code, present a single, readable summary containing:

1. **System Profile digest** — each §3 slot in 1–3 sentences with the key numbers.
2. **Content inventory** — counts per category (skills, specialties, gear, NPCs, solo
   tables, pregens…) so the user sees the extraction scale, plus anything the source did
   not cover.
3. **Proposals** — concrete choices for anything §0 leaves open (e.g. exact palette
   values, rules-vs-setting chapter boundary, pregens present/absent).
4. **Ambiguity list** — every rules point where the book was unclear, with your proposed
   ruling for each. The user confirms or corrects; record rulings in this file.

After sign-off, build autonomously to completion. Ask further questions **only** for newly
discovered rules ambiguities — never for permission to continue.

---

## 5. Architecture — **LOCKED**

- **No build step.** Vanilla JS, native ES modules loaded directly by the browser
  (`<script type="module" src="src/main.js">`). Clone-and-run must always work.
- **Installable PWA:** `manifest.json`, `service-worker.js` (network-first, caches the app
  shell + all data files, versioned `CACHE_VERSION`), an SVG icon, and an in-app
  "Update available — reload" toast when the service worker detects new code.
- **Storage modes:** `localStorage` **local-only mode** works with zero configuration;
  dropping real keys into `firebase-config.js` (clearly marked placeholder block +
  `FIREBASE_ENABLED` flag) switches on cloud sync. Never commit real keys.
- **Firebase:** Realtime Database (bandwidth-priced, low-latency — right for hundreds of
  tiny vitals/condition writes) + Storage for portraits (client-side canvas compression to
  ~400px before upload).
- **Auth:** instant anonymous launch, no login wall; optional Google account linking in
  Settings for cross-device backup.
- **Roles from day one:** `members/{uid}.role: "player" | "gm"` in the schema **and** in
  `database.rules.json` (players read/write own sheet + shared combat; GM reads/writes
  all) — so the GM screen needs zero migration.
- **Campaigns:** memorable phrase join codes — theme them noir/cyberpunk (e.g.
  `neon-owl-sector`), same three-word mechanic.
- **Themed UI primitives:** no native `alert/confirm/prompt` — a shared `modal()` +
  `showToast/confirmModal/promptModal`, accessible (focus trap, Escape, `aria-modal`,
  focus restore) and sized to the visual viewport (mobile-toolbar safe).
- **Accessibility:** keyboard + screen-reader usable — `aria-live` roll results and
  vitals, labeled icon-only buttons, `aria-current` nav.
- **Responsive:** phone-first; zero horizontal overflow at 360px on every screen.

---

## 6. File structure — **LOCKED**

| File | Purpose |
|---|---|
| `index.html` | App shell: header, bottom nav, screen mount, module entry |
| `styles.css` | Neo-noir theme (dark primary + light) + all component styles |
| `data.js` | **Core rules library** — every §3 list/table/formula from the Core Rulebook |
| `data-monsters.js` | Adversary/bestiary stat blocks incl. attack behavior |
| `data-npcs.js` | Humanoid NPCs / archetypes / animals |
| `data-pregens.js` | Published pre-generated characters (CONDITIONAL on §3.14) |
| `data-solo.js` | Official Solo Mode tables (PRESENT for this project) |
| `data-gm.js` | GM reference: Case File Generator + disciplinary actions (project-specific) |
| `firebase-config.js` | Placeholder config + `FIREBASE_ENABLED` flag |
| `database.rules.json` | RTDB security rules (player/GM roles) |
| `manifest.json`, `service-worker.js`, `icon.svg` | PWA |
| `tests/` + `package.json` | Dev-only headless regression harness (`npm test`); dev-only `playwright-core`; `node_modules` gitignored; not in the SW app shell |
| `README.md` | Setup incl. Firebase steps, GitHub Pages deploy, and the personal-use licensing note (§12) |
| `CLAUDE.md` | This document — the project's living canonical spec |

*(No `data-<expansion>.js` files exist in this project — expansions excluded per §0.2.)*

### 6.1 `src/` module map — **LOCKED** responsibilities

One module per responsibility; explicit `import`/`export`, nothing smuggled through
`window`. Runtime cycles (sheet ↔ roller ↔ combat) are safe under ESM live bindings.

| Module | Responsibility |
|---|---|
| `core.js` | Foundational constants, DOM/util helpers, raw dice functions. No imports. |
| `ui.js` | Themed modals/toasts/confirm/prompt. |
| `rules.js` | Pure rules lookups over the data libraries (find ability, parse gear, build skills, requirement checks). |
| `derived.js` | Character-derived calculations (effective maxima, encumbrance, equipped gear, data normalization/migration). |
| `settings.js` | Feature toggles (solo, GM screen, advanced automation). |
| `store.js` | Local/cloud character persistence + combat mirroring + global roll log (`RollLog`). |
| `sync.js` | Firebase auth, campaigns, join codes, presence + theme. |
| `wizard.js` | Creation wizard + pregens (if §3.14 present). |
| `roller.js` | The dice engine: every roll type, push flows, damage applier. |
| `sheet.js` | The full character sheet + all in-play tracking UI. |
| `combat.js` | Shared combat tracker: initiative, turn state, combatant cards. |
| `solo.js` | Solo assistant — PRESENT (official Solo Mode). |
| `gm.js` | GM dashboard. |
| `screens.js` | Top-level screen renderers (home/rules/about) + party banner. |
| `router.js` | Bottom-nav routing + conditional tab gating. |
| `main.js` | Entry point / boot. |

*(`power-automation.js` omitted unless Stage A finds a §3.9 subsystem.)*

When adding or moving a `src/` file: update this file's tables **and** the service-worker
app-shell list, then bump `CACHE_VERSION` — in the same change.

---

## 7. Data model (Firebase) — **LOCKED** shape; field names follow the game

```
joinCodes/{code}: campaignId          // lookup index for three-word join codes

campaigns/{campaignId}
  meta:    { name, joinCode, createdAt, ownerUid }
  members/{uid}: { displayName, role: "player" | "gm", lastSeen }   // presence
  combat:  { active, round, turnIndex, combatants[] }               // mirror of local Combat, §3.12
  broadcast/{pushId}: { text, ts, from }                            // GM→players feed (reserved)

characters/{characterId}
  owner, campaignId
  identity:  { name, <§3.5 option fields>, appearance, <§3.10 identity fields>, portraitUrl }
  attributes:{ <§3.2 attributes> }
  derived:   { <§3.3 derived stats> }
  state:     { health, resolve, conditions{key:true}, criticalInjuries[], criticalStress{name,text}|null,
               promotionPoints, chinyenPoints, humanityPoints, baselineFails, shiftsSinceDowntime,
               shiftUses{key:true}, permanentResolveLoss, dead }   // v2 (Phase 4)
  skills:    { <name>: { level, specialty?, mark? } }              // shape per §3.4
  abilities: [ ... ]                                               // specialties/talents/features
  inventory: { items[] (weight/qty/equipped/quality per §3.11), tiny[], money{...} }
  companions:[ ... ]   effects:[ ... ]   notes: ""   advancementLog:[ ... ]
  journal:   [ { id, ts, text } ]                                  // v3 — timestamped journal entries
```

**Critical-injury entry** (`state.criticalInjuries[]`): `{ id, injury, type, roll, lethal,
deathSave: "round"|"shift"|null, instantKill, healing, effect, disadvantage[], flag,
stabilized }`. **Local combat** (Phase 4, pre-Firebase) is stored under `brp:combat` via
`store.js` `Combat`: `{ active, round, turnIndex, combatants[{ id, kind:"pc"|"npc", charId?,
npcKey?, name, nature, health, maxHealth, card } ] }`; Phase 5 mirrors this into
`campaigns/{id}/combat`.

**Global roll log** (local-only, not mirrored) is stored under `brp:rolllog` via `store.js`
`RollLog`: newest-first, capped 150, entries `{ id, ts, source:"sheet"|"combat"|"solo"|"gm",
charId?, charName?, label, text, pin? }`. Every dice roll in `roller.js` appends here; Solo/GM
oracle rolls also mirror in. The sheet filters by `charId` for a per-character view; Home shows
the whole log. Pinning a log row writes a `journal[]` entry on the active character.

Rules: every rules number the schema references lives in the data files; every schema
addition ships with a normalization path that back-fills defaults on old characters (never
crash on old data); every field addition is documented in this section **in the same
change**. Current `SCHEMA_VERSION = 3`.

---

## 8. Settings & toggle pattern — **LOCKED**

All optional surfaces follow one pattern: a flag in `settings.js`
(`Settings.<flag>() → !!get("<flag>")`, off by default), a toggle row in Settings & About
with a one-line description, every related UI checks the flag before rendering, and nav
tabs for gated modes are hidden by the router when off. Explicit user choice always beats
role-based defaults (store `true`/`false` distinctly from unset).

Toggles for this project: **solo mode** · **GM screen** · **advanced/GM automation** (if
built). No expansion toggles (§0.2).

---

## 9. Build roadmap — check items off as they complete

At Stage C start, replace §3 above with the **completed** System Profile (with checkpoint
rulings), make the file tables real, and keep this roadmap's checkboxes current.

Build strictly in order:

- [x] **Phase 0 — Foundations:** scaffold all §6 files ✅; neo-noir theme ✅; PWA shell
  (manifest/SW/icon) ✅; app shell with router + local storage ✅; core mechanical data
  library ✅. Boots with **zero console errors** (verified headless).
- [x] **Phase 0b — Complete data extraction:** full ranged weapons + explosives (data.js);
  general gear + augmentations; chase procedure/maneuvers/3 obstacle tables + vehicles +
  vehicle weapons; **data-solo.js** (origin, checklists, scene/question/critical-success
  oracles, scene categories, NPC skill level, hypothesis + countdown timer rules, Cipher
  36+36, Location 36+36, Downtime + Countdown event tables); **data-gm.js** (Case File
  Generator: theme/assignment/sector/twist + disciplinary actions); all flavor tables
  (archetype appearance/names ×7, memory-feel 12). Verified: Rules Library shows Weapons
  (23), Armor & Gear (18), Augmentations (8); search returns full weapon stats; **zero
  console errors**. Case Table 3 (Main NPCs) now COMPLETE — `CASE_MAIN_NPCS` in `data-gm.js`
  (8 types × D6 occupation/quirk/first/last, faithful to the printing incl. the duplicate
  "Mechanic") powers the GM Main NPC generator.
- [x] **Phase 1 — Creation Wizard:** `wizard.js` — 10-screen flow (nature → archetype →
  years → attributes → skills → specialties → key memory → key relationship → identity →
  review). Honest generation (D6/D12/D3 rolls + point rolls at finish), all §3.3
  derivations live, legality validation gates every step: attribute budget (with C→D
  refund + Replicant STR/AGI bonus rule), key-attribute B+, skill budget, key-skill C+,
  specialty count. Nature-filtered archetypes; Replicants forced to Rookie. Saves +
  activates the character. No pregens (§3.14). Creation helpers added to `rules.js`.
- [x] **Phase 2 — Core Tracker:** `sheet.js` — the live sheet wired at the `sheet` route.
  Vitals (Health/Resolve) as dot tracks + steppers clamped to true maxima with auto-derived
  Broken (Damage)/(Stress) badges; resource counters (Promotion/Chinyen/Humanity, min 0);
  manual condition toggles (Prone/In-Cover/Grappled/Aiming; Broken is auto-derived); read-only
  Attributes + Skills (die sizes, key-skill ★) and Specialties; faithful Inventory (item list
  + equipped toggle + add/remove, **no encumbrance** per §3.11); editable Identity & Notes
  (blur-to-save); portrait upload with client-side canvas downscale to 400px → JPEG data URL in
  `identity.portraitUrl`; Switch/Delete character (closing the earlier delete-UI gap). Every
  mutation persists through `Store` immediately (normalization/migration already in `derived.js`).
- [x] **Phase 3 — Dice Engine:** `roller.js` — native step-dice resolution (§3.1). Base
  Dice = attribute die + skill die; 6+ = 1 success, 10+ = 2, 2+ = critical. **Advantage**
  adds a third die of the *lower* die's type; **disadvantage** removes the lower die (keep
  the higher); adv/disadv cancel 1:1 and net is capped at one (verified against Core p032).
  **Push** re-rolls every die not showing a 1 (banes lock, successes kept); banes in the
  final pool inflict damage (STR/AGI) or stress (INT/EMP), Replicants always stress —
  applied to the roller's own vitals and persisted. Auto-applies state to the roll: Aiming →
  Firearms advantage, active critical-injury disadvantages; **Broken (Damage) blocks all
  skill rolls**. Wired into the sheet: tap any skill to roll (Driving prompts a
  Maneuverability die); "⚔ Roll an attack" picks any weapon → straight FIREARMS (ranged) or
  HAND-TO-HAND (close) roll, computes damage = weapon Damage + 1 per extra success, and on a
  crit rolls the real Crushing/Piercing d12 tables (crit-die count = 1 + extra successes +
  Killer specialty; "STR" crit die uses the attacker's Strength die; instant-kill entries
  flagged). Key-memory advantage option (+1 stress if you still fail after pushing). No
  fumble table exists in BR — push banes ARE the failure consequence. Opposed close-combat
  defence, Full Auto option (+1 adv, +1 stress for PCs), aiming, and applying damage to targets directly within the tracker are fully implemented in Phase 4.
- [x] **Phase 4 — In-Play Systems:** all four surfaces live on the sheet + a local combat
  tracker. **Guided death/critical-injury procedure** (`sheet.js`): "Take a critical injury"
  rolls the real Crushing/Piercing d12 table (choose type + Crit Die); lethal crits expose
  STAMINA **death saves** (no push while Broken; fail = die, success = linger) and MEDICAL
  AID **stabilize** (self = disadvantage, advanced gear = advantage; success raises the
  interval Round→Shift, a treated Shift-crit ends the saves); instant-kill entries kill
  outright → DECEASED banner. **Broken by stress**: rolls one Empathy Base Die on the
  human/Replicant critical-stress table (faces ≥6 map to entry 6; a rolled 1 also
  permanently lowers max Resolve — `state.permanentResolveLoss`, subtracted in `maxResolve`).
  **Recovery** (§3.8): Downtime Shift (human +1 / Replicant +2 Health, +1 Resolve, +1 more
  with medical care), Investigation Shift (accrues stress past the 3-Shift limit; 4 with
  Married to the Job), First Aid (MEDICAL AID, heal = successes, Glue = advantage), and
  once-per-Shift stress/Health heals from owned specialties + carried consumables (gated by
  `state.shiftUses`, reset each Shift). **Advancement** (§3.10): learn specialty (5 PP,
  respects `maxTimes`), raise skill with Humanity (D→C 5, C→B 10, B→A 15, one step), Baseline
  Test for Replicants (INSIGHT; advantage at full Resolve, disadvantage below half; pass +1
  PP & resets escalation; fail +1 Humanity −1 PP + warning→recalibration(−1 max Resolve, heal
  stress)→retirement) with an `advancementLog`. **Local combat tracker** (`combat.js` at the
  `combat` route, reachable from Home + the sheet; state in `store.js` `Combat`): 10
  initiative cards drawn once, act low→high, order persists; add the active PC and bestiary
  NPCs (data-npcs.js); per-combatant Health steppers, editable initiative card (Surprise →
  #1), **In-Combat Dice Rolling** (`⚔ Attack` and `🎲 Skill` buttons per combatant for both PC and NPC: interactive ranged/full-auto/aiming attacks with one-click "Apply Damage to Target", opposed close combat rolling attacker and defender dice simultaneously with counter-attack damage, and NPC STR/AGI push banes deducting Health), Next-turn/round advance, End combat. Sync deferred to Phase 5.
- [x] **Phase 5 — Multiplayer & Sync:** `sync.js` — the full Firebase layer, **loaded via
  dynamic `import()` only when `FIREBASE_ENABLED` is true**, so local-only mode never touches
  the network (verified: zero gstatic/CDN requests). Anonymous auth on launch + optional
  Google account linking; campaigns with themed three-word join codes (`neon-owl-sector`) via
  a `joinCodes/{code}→cid` index; party presence (members + `onDisconnect` lastSeen); role
  (`gm`|`player`) persisted and restored across reloads. Two-way mirroring: `store.js`
  `Store.save`/`Combat.save` push to RTDB (`mirrorCharacter`/`mirrorCombat`, no-ops unless
  synced & in-campaign), and the sheet (`watchCharacter`) + combat tracker (`Sync.onCombat`)
  pull remote edits with an echo-guard against self-writes; `applyRemote` writes locally
  without re-mirroring. Portraits upload to Storage (`uploadPortrait`). Settings gains an
  **Account & Campaign** panel (sign-in state, link Google, create/join/leave, join-code
  display, party list, "share character with the party"); Home shows a campaign banner.
  Security rules extended (`joinCodes`, character read = any campaign member). PWA
  update-toast was already wired in Phase 0. README documents the keyless-by-default model +
  Firebase setup. **App remains fully functional keyless/local-only** (verified). NOTE: the
  live Firebase paths are code-complete but not runtime-verified — the user supplies keys
  per §0.3; they must be exercised against a real project before relying on multiplayer.
  portraits, PWA update toast. (App must remain fully functional keyless/local-only.)
- [x] **Phase 6 — Conditional surfaces:** solo mode (official Solo Mode tables + assistant
  flow); GM screen (party panel, peek sheets, drop-in combatants, hand out damage/
  conditions, rollable §3.16 reference tables); advanced automation behind one shared
  toggle — only for subsystems the game actually has.
- [x] **Hardening (always):** committed regression-test harness (`tests/` + `package.json`,
  dev-only `playwright-core`, `npm test` = 35 checks: 24 Node unit + 11 headless smoke) ✅;
  a11y basics asserted in the harness ✅; full **rules-accuracy audit** (§11) closed across
  two passes (changelog brp-v20/v21) ✅. (A deeper manual screen-reader pass remains optional.)
- [ ] **Deploy:** GitHub Pages live (§13); PWA install verified on phone.

**Per-feature spec format (mandatory for every roadmap item):**
- **Rule:** the canonical mechanic with exact numbers (cited to the source).
- **Target:** file · module · function.
- **Behavior/UI:** what to build and where it appears.
- **Schema:** new fields — name · type · default · location (and §7 updated).
- **Acceptance:** how to confirm it works in a browser.

---

## 10. Process rules — **LOCKED**

1. **Living spec.** This CLAUDE.md is canonical. **Every code change updates it in the
   same change** — features, data model, file tables, roadmap checkboxes, changelog.
   A code change with a stale CLAUDE.md is incomplete.
2. **Single source of truth.** All rules data and numbers live in the `data*.js` files.
   Never hardcode a rules value in a `src/` module — if a table is missing, add it to the
   data layer first.
3. **Changelog table.** Every change appends a dated row to §14: what, why, root cause for
   fixes, verification performed, cache version.
4. **Verify in a real browser.** Every phase/feature is verified headless (Playwright,
   Firebase requests aborted) before being marked complete: the flow works end-to-end
   with **zero console errors**. "Syntax is valid" is not verification.
5. **Committed regression harness.** `npm test` boots the app headless and asserts at
   minimum: boot/wiring smoke (every tab, zero JS errors); §3.3 derivation invariants
   across generated + pregen characters; dice-engine invariants; inventory/encumbrance
   math; zero horizontal overflow at 360/390px on every screen; a11y basics; and every
   closed audit finding. Every bug fix adds a check that would catch its return.
6. **Cache discipline.** Any shipped-file change bumps `CACHE_VERSION`.
7. **Root-cause fixes.** Debug to the actual cause before editing; record cause + fix in
   the changelog. No symptom-patching.
8. **Scope guard.** Core rules + official Solo Mode only. No setting/adventure content, no
   case-file content. Nothing invented presented as official — any house convenience is
   explicitly labeled a house aid.
9. **Module discipline.** Respect §6.1 responsibilities; export/import explicitly; split a
   module that outgrows its job along the same lines.

---

## 11. Rules-accuracy audit — mandatory before "done"

Re-verify the finished app against the source:

- **Data values:** spot-check every category; fully check every formula and every
  creation table.
- **Engine behavior — audit hardest here:** gating, options, limits, and sequencing (push
  legality and costs, recovery once-per-X, critical-injury option choices, NPC attack
  counts, advantage stacking, restriction enforcement). In the reference project the data
  layer audited essentially flawless while nearly all real findings were engine behaviors
  that deviated from the book — expect the same.
- Document findings as a numbered work-list (**Rule / Target / Fix / Why**); close each
  with a regression check; record what was **verified clean** so future audits don't
  re-litigate it.
- Re-verification method: pull the app's value from the data files, query the notebook for
  the canonical value (`notebook_query`, in-scope `source_ids` only), compare; corroborate
  surprising answers with a second, differently-phrased query before editing.

---

## 12. Content & IP rules

- Extract **numbers and mechanics**; **paraphrase all effect/flavor text concisely —
  never copy rules prose verbatim.** No setting, adventure, art, or logo content.
- "Blade Runner" is a licensed, trademarked property. The app's theme *evokes* neo-noir
  cyberpunk generically (§0.7) — it must not reproduce film/game artwork, logos, or trade
  dress.
- The generated app is a **personal play aid** built from the user's own books. State in
  the README that if the user publishes or distributes it, licensing is their
  responsibility.
- **GitHub repo must be private** (the app derives from licensed rulebooks the user owns).
  GitHub Pages on a private repo requires deployment via GitHub Actions (see §13).

---

## 13. Deployment — GitHub Pages

1. `git init` in this folder; sensible `.gitignore` (`node_modules/`, scratch/raw-text
   working files, any real Firebase keys).
2. Create a **private** GitHub repo (`gh repo create`) — confirm the repo name with the
   user before creating anything on their account.
3. Pages from a private repo: deploy via the official `actions/deploy-pages` workflow
   (upload the repo root as the Pages artifact — there is no build step).
4. Verify the live URL loads with zero console errors, then install the PWA on the user's
   phone from that URL.
5. Firebase (when the user sets it up later): keys go in `firebase-config.js` locally —
   **never commit real keys**; document the local-override approach in `README.md`.

---

## 14. Changelog

| Date | Change | Why | Verification | Cache |
|---|---|---|---|---|
| 2026-07-04 | Project planned; CLAUDE.md instantiated from RPG-PLAYER-APP-TEMPLATE.md with all user decisions (§0). | Kickoff | n/a | n/a |
| 2026-07-04 | Stage A extraction complete (Core + Solo read cover-to-cover via NotebookLM); §3 replaced with verified System Profile; Years-on-Force Promotion/Chinyen reading corroborated by 2nd query. | Stage A | Extraction notes in scratchpad/EXTRACTION.md | n/a |
| 2026-07-04 | Stage B checkpoint signed off: full creation tables, faithful inventory (no ammo/encumbrance), full Baseline/economy automation, no pregens, no power automation. | Stage B | User confirmed | n/a |
| 2026-07-04 | Phase 0: scaffolded index.html, styles.css (neo-noir dark+light), data.js + data-npcs.js (core mechanical library), src/ modules (core, ui, rules, derived, settings, store, screens, router, main), manifest/service-worker/icon, firebase-config placeholder, database.rules.json. Home + Characters + searchable Rules Library + Settings live; router with gated Solo/GM tabs; localStorage persistence. | Phase 0 foundations | Headless (Claude Preview): boots, Home/Rules/Settings render, rules search works (7 groups, 13 skills), theme + solo-toggle gating verified, **zero console errors** | brp-v1 |
| 2026-07-04 | Phase 0b: completed data extraction — full ranged weapons + explosives + vehicles + chase system (data.js), general gear + augmentations, data-solo.js (full solo oracle), data-gm.js (case generator + disciplinary), archetype appearance/name tables + memory-feel. Rules Library index extended to gear/explosives/augmentations. | Complete, verified data before features | Headless: Weapons (23)/Armor & Gear (18)/Augmentations (8) render, "ender assault" search returns full stat line, data-solo/data-gm parse, **zero console errors** | brp-v2 |
| 2026-07-04 | Phase 1: creation wizard (src/wizard.js) + creation/legality helpers in rules.js; wired into router; wizard styles. Full 10-step flow with dice rolls and step validation. | Phase 1 | Headless full run: built Dutch Szalay (Human Enforcer Seasoned) — attrs STR A/AGI B allocated (budget 3/3 gated), skills 10/10, Enforcer key-attr/skill rules enforced, specialty rolled (Fast Reflexes), memory generated from tables, name rolled; saved with Health 6/Resolve 4, Promotion 3/Chinyen 2, standard gear, set active + shown on Home. Replicant path filters archetypes (Doxie in; Cityspeaker/Skimmer out) + forces Rookie. **Zero console errors** | brp-v4 |
| 2026-07-04 | Bug fixes before Phase 2: (a) service-worker fetch handler did `new URL(request)` (a Request never stringifies to a URL, so it threw on every fetch — runtime caching & offline fallback silently never ran); fixed to `new URL(request.url)`. (b) `validateAttributes` only checked the aggregate step budget, so a player could lower two attributes C→D and bank two extra increases; added a check that at most one attribute may sit below C (§3.2/Ch02). (c) Removed the stale "ranged list is a confirmed subset / TODO" comment in data.js (Ch08 lists completed in Phase 0b). | Root-cause fixes (SW never cached; illegal attr allocation allowed; stale doc) | Headless: app boots + sheet flow runs with **zero console errors** after fixes | brp-v5 |
| 2026-07-04 | Phase 2: `src/sheet.js` (live character sheet) wired at the `sheet` route, replacing the placeholder; sheet styles in styles.css; sheet.js added to SW app shell. Vitals dot-tracks + steppers clamped to maxima with auto Broken badges; Promotion/Chinyen/Humanity counters (min 0); manual condition toggles; read-only attributes/skills/specialties; faithful inventory (add/remove/equip, no encumbrance); blur-to-save identity & notes; portrait upload (canvas downscale→400px JPEG data URL); switch/delete character. Dev launch.json port moved 8777→8778 (other chat held 8777). No schema fields added (reuses existing state/identity/inventory). | Phase 2 Core Tracker | Headless (Claude Preview, 360px): seeded Enforcer renders all sections; Health/Resolve = 7/4 (STR A+AGI B+Tough; INT C+EMP C) correct; decrement clamps at 0 → Broken (Damage) badge; increment clamps at max 7; Humanity clamps at min 0; Prone toggle persists to localStorage; **no horizontal overflow at 360px**; **zero console errors** | brp-v5 |
| 2026-07-04 | Phase 3: `src/roller.js` (native dice engine) + sheet wiring (skills tap-to-roll; "⚔ Roll an attack" weapon picker) + roll-modal styles; roller.js added to SW app shell. Advantage/disadvantage/push mechanics re-verified against the raw Core text (scratchpad core-clean.txt lines 2802/2930/2932/2936): advantage = +die of the lower type; disadvantage = remove lower die; adv/dis cancel 1:1, capped at one; push re-rolls all non-1 dice, banes → damage (STR/AGI) / stress (INT/EMP), Replicants always stress. Auto adv from Aiming/crit-injuries; Broken blocks skill rolls. Attack damage = weapon Damage +1/extra success; crit at 2+ successes rolls the real Crushing/Piercing d12 tables (crit-dice = 1 + extra successes + Killer; "STR" crit die = attacker STR die). No schema fields added. | Phase 3 Dice Engine | Headless (Claude Preview, 360px), deterministic via Math.random overrides: Firearms w/ Aiming → auto-advantage, 3 dice incl. a d8 of the lower type; disadvantage → 1 die; forced-max attack (.44 Special, Killer) → 4 successes, Damage 5 (2 +3), 4× d12 crit → Piercing 12 "Shattered head" instant-kill; forced-bane INT (Tech) push → 2 stress, health unchanged (the apparent −1 in an earlier run was reclampVitals correcting an injected over-max health, not damage); Broken (Health 0) blocks skill rolls w/ toast; **no horizontal overflow at 360px**; **zero console errors** | brp-v6 |
| 2026-07-04 | Phase 4: in-play systems in `src/sheet.js` (guided death/critical-injury procedure, Broken-by-stress crit + permanent Resolve loss, Rest & Recovery, Advancement incl. Baseline Test) + `src/combat.js` (local combat tracker) + `Combat` store in store.js + combat access on Home/sheet + styles; combat.js added to SW app shell. Schema v2: `state.permanentResolveLoss/dead/shiftUses` + injury ids (back-filled in normalize; `maxResolve` subtracts permanent loss). Recovery/death/Baseline numbers re-sourced from the raw Core text (scratchpad lines 3672–3786, 4008–4070, 8590–8632). | Phase 4 In-Play Systems | Headless (Claude Preview, 360px), deterministic via Math.random: Replicant Doxie Health 8/Resolve 2 correct; learn specialty −5 PP (6→1); raise Firearms D→C −5 Humanity; Downtime (Replicant) +2 Health/+1 Resolve, clears stress crit, resets shifts; Broken-by-stress rolls EMP-die effect ("I've Seen Things"); take lethal Piercing-5 injury → STAMINA death save success=survive / fail=die+DECEASED banner; combat: add PC+NPC, draw init (act #2 before #8), Next-turn wraps to Round 2, damage clamps 5→3; Baseline fail #1 = +1 Humanity/−1 PP/verbal warning. **No horizontal overflow at 360px**; **zero console errors** | brp-v7 |
| 2026-07-04 | Phase 5: `src/sync.js` (Firebase auth/campaigns/join-codes/presence + character & combat mirroring, SDK via dynamic import behind FIREBASE_ENABLED) + store.js mirror/applyRemote hooks + sheet.js `watchCharacter` + combat.js `Sync.onCombat` + Settings Account & Campaign panel + Home party banner (screens.js) + main.js `initSync` + README.md + .gitignore; database.rules.json extended (joinCodes index, member-read on characters); sync.js + firebase-config.js added to SW app shell. Local combat store `applyRemote` added. | Phase 5 Multiplayer & Sync | Headless (Claude Preview, local-only): boot clean; **network shows only same-origin modules — zero gstatic/Firebase CDN requests** (SDK dynamic-import never fires when disabled); Settings shows "Cloud sync is off" panel; sheet renders all 11 sections with `ensureCharWatch` no-op; Home shows no party banner; **zero console errors**. Live Firebase paths code-complete but NOT runtime-verified (needs user keys per §0.3). | brp-v8 |
| 2026-07-04 | Bug fixes for Combat Tracker rolls and End Combat modal: (a) Added exported `WEAPONS` array combining `WEAPONS_MELEE` and `WEAPONS_RANGED` in `data.js` and robust lookup in `resolveCombatant` (previously `D.WEAPONS.find` threw a TypeError when clicking attack or skill buttons). (b) Fixed `confirmModal` and `promptModal` in `src/ui.js` where `onClose` was invoked by `close()` before action button resolution completed, causing every modal to resolve to `false`/`null`. (c) Bumped service worker cache to `brp-v9`. | Root-cause fixes for combat tracker buttons | Verified syntax and promise resolution; zero console errors | brp-v9 |
| 2026-07-04 | Armed weapons display & robust weapon matching: (a) Added `matchWeapon` helper in `src/roller.js` for fuzzy/robust matching of starting gear and inventory items against canonical weapon tables. (b) Updated `resolveCombatant` and weapon pickers in `src/roller.js` to partition weapons into `armedWeapons` (`equipped: true`) and `inventoryWeapons` (`equipped: false`), rendering an explicit "Armed & Ready (Equipped)" section with visual badges at the top of attack modals. (c) Updated starting inventory in `src/wizard.js` and `normalizeCharacter` in `src/derived.js` to assign exact weapon keys and set Badge and PK-D 5223 Blaster as equipped by default. (d) Bumped service worker cache to `brp-v10`. | Combat tracker & attack modal UI improvements | Verified syntax, weapon matching, and equipped filtering; zero console errors | brp-v10 |
| 2026-07-04 | Phase 6: Conditional surfaces — `src/solo.js` (Solo Mode Assistant mounted at `#solo` when enabled; oracle & scene checks, cipher/location generators, interactive countdown timer & hypothesis tracker, milestone checklists; state persisted to `brp:solo`) + `src/gm.js` (GM Screen mounted at `#gm` when enabled; Live Party Panel monitoring all PC vitals/conditions with one-click damage/stress/condition modifiers, Drop-in Combatant Generator injecting adversaries from `data-npcs.js` into active combat, rollable Case File & Disciplinary generator; state persisted to `brp:gm`). Wired into `src/router.js`; added to `service-worker.js` app shell; bumped cache to `brp-v11`. | Phase 6 Solo Mode & GM Screen | Headless: Solo Mode rolls scene/question checks, generates ciphers, and upgrades/triggers countdown timer; GM Screen renders party vitals, modifies health/resolve, drops NPCs into combat tracker, and generates case briefings. Zero console errors. | brp-v11 |
| 2026-07-04 | Solo/GM **phase-of-play reorganization** — segmented sub-nav (`segmentNav` in `src/ui.js`) swaps one panel into view, remembering the last panel per tab (`brp:solo.panel`/`brp:gm.panel`). **Solo:** Start · Scene · Track · Session · Log & Notes. **GM:** Party · Case · Combat · Log & Notes. New **Start-a-Case** panel (user-flagged gap): Trust-your-gut / Follow-a-thread seed a `=== NEW CASE ===` note; Solo **Case Briefing** generator (new `CASE_BRIEFING` tables in `data-solo.js`: Assignment D6×D10 / Relevance / Complication / Personal Hook) with a one-tap ⚡ full briefing → notes; the Core Case File Generator surfaced in Solo too; Origin Seed. GM Combat panel gains an "Open Combat Tracker →" shortcut. Buttons standardized via shared `card/grid/btn` builders + `.segnav/.panel` CSS. **Bug fixed in this pass:** the full-briefing handlers wrote the briefing to notes, then `record()` re-wrote a stale state snapshot and clobbered it — note-writers (`pinNote`/`prependNote`) and `record()` now mutate the same `st` object. Also: `node --check` parsed the ESM files as CommonJS and missed a stray `;` inside an object literal (blanked the whole app); now verifying with `node --input-type=module --check`. | User: Solo/GM felt messy + "Start a case" not actionable | Headless (Claude Preview, 375px): Solo 5 pills, Start panel builds full briefing into notes (Assignment line present) + logs it; Scene/Track/Session swap + persist across reload; GM 4 pills, party shows PP 5/¥ 3/HUM 1, Case full-briefing lands in notes, reopens to last panel (Case); pills scroll, no page overflow; **zero console errors** | brp-v17 |
| 2026-07-04 | **Rules-accuracy audit (§11) — pass 1 (dice engine + in-play systems).** Cross-checked `roller.js` and `sheet.js` recovery/advancement/death/Baseline against the raw Core text. **Two engine bugs fixed:** (F1) opposed close-combat crit in `runOpposedMeleeModal` passed `attSucc−defSucc+1` to `damageBlock`, inflating crit-dice by one (margin 2 → 2 dice, should be 1) and printing a "Damage to target" figure one higher than the damage actually applied — now passes the true margin and suppresses the duplicate line via a new `damageBlock(..., {showDamageLine})` param (§3.12: crit = 2 successes *over* opponent). (F2) **Aiming was never consumed** — `state.conditions.aiming` gave Firearms advantage on *every* shot; added `consumeAiming()` so the aim is spent on the next Firearms roll (Ch08 Careful Aim, §3.6 "next single shot"). **Verified clean** (no change needed): push re-roll/bane→damage-vs-stress/Replicant-always-stress, adv/disadv cancel+cap, Broken-by-damage blocks skill rolls, Downtime heal (+1/+2 Health, +1 Resolve, +1 care), 3-Shift stress cadence, First Aid gating, once-per-Shift consumables, death saves (no push while Broken)/stabilize interval bump, crit-stress EMP-die (6+ cap, 1→−1 max Resolve), Baseline advantage/disadvantage + fail ladder, specialty 5 PP + skill 5/10/15 Humanity. **Deferred minors** (logged, not yet fixed): per-effect "no skill rolls" gating for Broken-by-stress effects #3/#5; max-Resolve-0 retirement flag; key-memory/signature once-per-session enforcement. | §11 audit — engine behavior first | Headless (Claude Preview, fresh origin to defeat python-server heuristic caching): F2 — 1st Firearms shot = 3 dice + "Aiming: +1 advantage" then aiming CLEARED, 2nd shot = 2 dice/no auto; F1 — forced margin-4 opposed crit shows one "Hits for 4", crit "3× d10" (was 4), no duplicate damage line; **zero console errors** | brp-v20 |
| 2026-07-04 | **Rules-accuracy audit (§11) — pass 2 (combat tracker + data layer) & closed 2 deferred minors.** Audited `combat.js` initiative/turn logic — faithful to §3.12 (10 cards, low→high, order persists, wrap→round++); no bugs (minor UX note only: a combatant added mid-combat has `card:null` → sorts first until assigned). Data-layer spot-check all clean: crit instant-kill flags (Piercing 8/10/12, Crushing 12), lethal death-save intervals, `SKILL_INCREASE_COST_HP {D:5,C:10,B:15}`, `SPECIALTY_LEARN_COST_PP 5`, `RECOVERY` amounts, full Years-on-Force table (+4/+8/D3/−1 … +1/+14/D10/+2), archetype key-attr/skill + nature restrictions. **Closed minors:** (M1) critical-stress effects now enforce their mechanics — added `noSkillRolls`/`skillDisadvantage`/`noPush` flags to `CRITICAL_STRESS_HUMAN/REPLICANT` (data.js), carried into `state.criticalStress`, enforced in `roller.js` (block skill/attack rolls & weapon picker; #6 "Shakes? Me Too" = −1 disadvantage + no push; surfaced in the auto-note). (M2) losing your final Resolve (permanent loss → max Resolve 0, from a stress-crit 1 or a Baseline recalibration) now retires the character (`state.dead`, §3.8). Remaining deferred: key-memory/signature once-per-session (no session concept — documented house behavior). | §11 audit pass 2 + close M1/M2 | Headless (Claude Preview, fresh origin): noSkillRolls effect blocks Firearms with toast (no modal); "Shakes? Me Too" → net Disadvantage, 1 die, push button hidden, auto-note "Shakes? Me Too: −1"; **zero console errors** | brp-v21 |
| 2026-07-04 | Solo **Start-a-Case panel streamlined** (`src/solo.js` `panelStart` + `.solo-alt` CSS). Re-verified the Case Briefing tables against the Solo Mode source (scratchpad solo-clean.txt lines 722–870): the four tables (Assignment D6×D10, Relevance D12, Initial Complication D12, Personal Hook D12) are **faithful/verbatim** and the dual case-start method (Solo Briefing vs Core Case File Generator) is source-backed (p.14). Cleanup: collapsed 4 stacked cards → 3 (merged "Start a Case"+"Case Briefing" into one lead card with ⚡ full-briefing primary; demoted the Core generator to a collapsed `<details>` "Alternate: Core Case File Generator"; kept Origin as "Solo Blade Runner Origin"). **Removed the invented "Trust your gut / Follow a thread" labels** (not source terminology — the book's two methods are "Use the Case File Generator" / "Seek Inspiration"; §10.8) → replaced with one honest "✍ Blank case note" convenience. NOTE: SW cache was already at brp-v18 on takeover (an undocumented bump; changelog rows below misordered at v17/v15) — reconciled to v19 here. | User: Solo start page felt cluttered — verify vs source | Headless (Claude Preview, 375px): Start panel = 3 sections; Core generator collapsed by default, expands + rolls (Theme→modal); ⚡ full briefing writes to Case Notes + Roll Log; no 375px overflow; **zero console errors** | brp-v19 |
| 2026-07-04 | Solo/GM roll-flow overhaul + bug fixes. **Flow:** added a shared **Roll Log** (collapsible card near top, newest-first, capped 50, per-row pin/delete + clear) and a `resultModal` with a **📌 Pin to notes** action, both in `src/ui.js` (`rollLogCard`, `resultModal`). Every Solo/GM oracle/generator roll now logs a labeled one-liner AND shows its modal; pinning prepends `• [Label] result` to the screen's notes. Logs are per-screen (`brp:solo`/`brp:gm`, new `log[]` field). Tidied all roll buttons (inline styles → CSS classes: `.roll-grid/.roll-row/.roll-result/.rolllog*/.party-*`), added `--ok/--warn` theme tokens. **GM bug fixes (root cause):** party panel read wrong state keys (`state.promotion/chinyen/humanity` → `promotionPoints/chinyenPoints/humanityPoints`) and `identity.archetype` → top-level `archetype` (mapped to name via `rules.archetype`), so PP/¥/HUM showed 0 and "Unknown Archetype"; Rewards modal wrote the same wrong keys; Conditions modal listed non-BR conditions (starving/dehydrated/exhausted/freezing) → replaced with real `data.js` CONDITIONS (Prone/In-Cover/Grappled/Aiming); `Store.Combat.get()` was undefined (Combat is a separate export) → import `{ Store, Combat }` and use `Combat.get()/save()` so "Drop into Combat" no longer throws. | User: Solo/GM rolls felt messy (results vanished); + real GM bugs found while there | Headless (Claude Preview): Solo — Scene Check logs `D8→4 · Challenging`, modal has Pin, Cipher logs `Conceal × Technology`, pin-from-row writes `• [Cipher] …` to notes; GM — party panel shows Doxie/PP 2/¥ 1/HUM 3/♥6/7/◈2/3, Theme roll logs, Drop-into-Combat adds NPC (no throw), Rewards +1 writes `promotionPoints` 2→3 (no stray `promotion`), Conditions lists Prone/In-Cover/Grappled/Aiming; no 360px overflow; **zero console errors** | brp-v15 |
| 2026-07-04 | **Closed the Phase 0b Main NPCs data gap + GM generator.** Extracted the complete **Case Table 3 (Main NPCs)** from the raw Core text into `CASE_MAIN_NPCS` (`data-gm.js`): 8 types (Corporate/Security/Entertainment/Street/Crime/Science/Tech/Other), each a D6 occupation/quirk/first-name/last-name sub-table (all 6-length; kept the printing's duplicate "Mechanic" in the Tech row faithfully, and the mislabeled Science quirk normalized to 6 sequential entries). Added a **Main NPC generator** to the GM `Case` panel (`gm.js` `panelCase`): D8 type + 4× D6 → "Firstname Lastname — Occupation (Type); quirk", shown in a result modal, logged, and pinnable. Updated §9 Phase 0b roadmap line (gap closed). | Finish the known partial-data item before the NPC-name generator (user request) | Headless (Claude Preview, fresh 8787 origin, 375px): page module exposes `CASE_MAIN_NPCS` (8 types, all sub-tables ×6); clicking 🎲 Main NPC → "Nombeko Koslovski — Journalist (Other); quirk: Overly eager", log pin `[NPC] …` written; Solo Scene Check still logs `D8→5 · Challenging`; no 375px overflow; **zero console errors**. (Note: the failure seen mid-build was python http.server heuristic caching serving a stale `data-gm.js` on the old origin — resolved on a fresh origin; the code was always correct.) | brp-v22 |
| 2026-07-04 | **Committed regression harness (Hardening §10.5).** Added `package.json` (dev-only `playwright-core`, `type:module`, `npm test`) + `tests/unit.test.mjs` (24 Node checks: level/dice mapping, 13 skills, 7 archetypes w/ nature+key rules, Years-on-Force numbers, crit tables 12+12 w/ instant-kill rows, advancement costs, 24 specialties, weapons well-formed, 14 NPCs, GM Main-NPCs 8×6, Solo tables 36/36/20/12, §3.1 successesFor + dice ranges, §3.3 Health/Resolve formulas incl. Replicant±/Tough/Hardened, normalize/reclamp, creation legality: attr/skill budgets + Replicant STR/AGI bonus + key-attr B+/key-skill C+) + `tests/smoke.test.mjs` (headless Chrome via playwright-core, cross-origin/Firebase requests aborted → hermetic: every route renders w/ zero console errors, no 360/390px overflow, a11y basics). `node_modules` gitignored; tests NOT in the SW app shell (no cache bump). Roadmap Hardening item checked. | Process rule §10.5 committed harness | `npm test` → **35 pass / 0 fail** (24 unit + 11 smoke), system Chrome, Firebase blocked | n/a (dev-only, not shipped) |
| 2026-07-05 | **Global roll log + per-character journal (user request).** New `RollLog` store in `store.js` (`brp:rolllog`, newest-first, cap 150). `roller.js` now logs every roll — skill rolls, procedural rolls (death save/stabilize/first aid/Baseline), attacks, pushes, and in-combat PC/NPC skill/ranged/opposed rolls — with `{label,text,charId,charName,source}`; Solo/GM oracle `record()` mirror into it too (`source:"solo"|"gm"`). Sheet gains a **Roll Log** section (This-character / All-rolls toggle, pin-a-row-to-journal, delete/clear) and a **Journal** section (add/delete timestamped entries); Home shows a collapsed global roll-log card. Schema **v3**: `character.journal[] {id,ts,text}` (normalized/back-filled in `derived.js`). **Root-cause fix (pre-existing):** Attributes `.stat` grid overflowed 360px by ~5px because grid items couldn't shrink below the longest attribute name ("Intelligence") — added `min-width:0` + ellipsis on `.stat__name` and trimmed `.stat` padding .8→.6rem. Added a unit test for the v3 journal back-fill. | User asked to log roll results + add a journal (solo & non-solo) | `npm test` → **36 pass / 0 fail** (25 unit + 11 smoke, headless Chromium). Drove the real UI: rolled Hand-to-Hand on the sheet → logged `Success · 1 succ` with charId/charName/source=sheet; sheet Roll Log shows the row; pinning wrote `[Hand-to-Hand Combat] Success · 1 succ` to the journal; Home global roll-log card present; no 360/390px overflow. | brp-v23 |
| 2026-07-05 | **Solo Mode: new oracles + fixed roll procedure (from a fresh NotebookLM extraction of the Solo Mode source).** (a) **Imagining Clues** (`data-solo.js` `CLUE_MEANING` D8, `CLUE_EVIDENCE_DESCRIPTOR` D6→D10 with result+detail, `CLUE_EVIDENCE_TYPE` D6→D12) + a Solo "Imagining Clues" card (Meaning / Descriptor / Type / ⚡ Full clue). (b) **Character/NPC generator** (`CHARACTER_SPHERE` D6→D8, `CHARACTER_TRAIT` D6→D12) + a Solo "Character (NPC)" card (Sphere / Trait / ⚡ Full NPC, combined with NPC Skill Level). (c) **Hypothesis Check** (`HYPOTHESIS_CHECK` rewards) + a 🎲 Check button per hypothesis row: rolls the rating as Base Dice (no push), ≥2 succ = crit +5 PP, 1 = +3 PP, 0 = −3 PP. (d) **Root-cause fix:** Cipher & Location were rolled with a uniform `pick()` over the flat 36-word arrays; the book's real procedure is a **two-tier roll** — D6 selects a block (1–2/3–4/5–6), then D12 scopes the entry within it. Verified the word lists were already complete and in block order, so only the roll changed (`rollColumn`/`rollGrouped` in `solo.js`); the shown result now reports both dice. All new/oracle rolls feed the global roll log. Added 4 unit tests (clue/character/hypothesis tables + Cipher/Location block sizes). | User: add clue/character oracles, Hypothesis Check, and fix the D6→D12/D10 roll | `npm test` → **40 pass / 0 fail** (29 unit + 11 smoke). Drove the UI: Cipher → "Chase × Violence" (D6/D12 shown), ⚡ Full clue → "Subtle Book/magazine", ⚡ Full NPC → "Suspicious · Medicine", Hypothesis Check (D8 rating) → "Success +3 PP" logged to the global log; zero console errors. | brp-v24 |
| 2026-07-05 | **Roll Log row layout fix (user-reported).** A long combat label (e.g. "Ranged PK-D 5223 Blaster (.44 Special) — Cadence") starved the result column: the old `.rolllog__row` grid `auto auto 1fr auto` sized the `nowrap` label to full width, squeezing "Critical success…" into a 1-character-wide column that wrapped vertically. Rebuilt the row as a two-line grid (`grid-template-areas`: time+label+actions on top, result text spanning the full width below); the label now truncates with ellipsis and the result text always gets a full line. Affects the Roll Log everywhere it renders (sheet, Home, Solo, GM). | User screenshot: result text wrapped one char per line | Headless 360px: seeded 3 rolls incl. the long combat label → each row shows time + ellipsised label + pin/✕ on line 1 and the full result on line 2; no horizontal overflow. | brp-v25 |
| 2026-07-05 | **Roll-log spelling fix (user-reported).** The roll-log summary read "0 succes" / "1 succ": `outcomeSummary` in `roller.js` built the count from the stem `succ` + `es`. Moved the pure helper to `core.js` (`outcomeSummary`, no imports) with the correct `success`/`successes` stem, imported it into `roller.js`, and added a unit test asserting the exact strings (incl. singular "1 success" and a no-"succes" guard). | User screenshot: "Failure · 0 succes · 2 banes" | `npm test` → **41 pass / 0 fail** (30 unit + 11 smoke); outcomeSummary(0,0)="Failure · 0 successes", (1,0)="Success · 1 success". | brp-v26 |

