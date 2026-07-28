# Blade Runner Player

An installable, offline-capable **player companion PWA** for the *Blade Runner RPG*
(Free League Publishing) — character creation wizard, full in-play sheet, a native
step-dice engine, guided death/recovery/advancement, a searchable rules library, and a
shared party + combat tracker.

Vanilla JavaScript ES modules, **no build step**. Clone and open it and it just runs.

> Personal play aid built from rulebooks you own. Numbers and mechanics are extracted;
> flavor text is paraphrased. Not affiliated with or endorsed by the publisher or
> rights-holders. If you publish or distribute this app, licensing is your responsibility.

## Run it locally 

Any static file server works (ES modules need `http(s)://`, not `file://`):

```sh
python3 -m http.server 8778
# then open http://localhost:8778/
```

The app is **fully functional with zero configuration** — characters, dice, combat, and
everything else are saved to `localStorage` on your device. Cloud sync is entirely optional.

## Install as an app (PWA)

Open the site in a mobile or desktop browser and choose **Install / Add to Home Screen**.
It then runs full-screen and offline. When you deploy a new version, the app shows an
“Update available — reload” toast.

## Optional: enable cloud sync & multiplayer (Firebase)

Local mode never touches the network. To play with a shared party and a live combat
tracker across devices, connect your own Firebase project:

1. Create a project at <https://console.firebase.google.com>.
2. Add a **Realtime Database** and **Storage** bucket.
3. In *Authentication*, enable **Anonymous** (and **Google**, if you want cross-device
   account linking).
4. Copy your web app config into [`firebase-config.js`](firebase-config.js) and set
   `FIREBASE_ENABLED = true`:

   ```js
   export const FIREBASE_ENABLED = true;
   export const firebaseConfig = {
     apiKey: "…", authDomain: "…", databaseURL: "…",
     projectId: "…", storageBucket: "…", appId: "…",
   };
   ```
5. Deploy **both** rule files — the database and Storage rules are the only access
   control, since the web config is public:

   ```sh
   firebase deploy --only database,storage
   ```

   [`database.rules.json`](database.rules.json) enforces player/GM roles, character
   ownership (a character can only be created by its owner and updated by that owner or
   the campaign's GM), self-promotion to `gm` is blocked, and join codes resolve only when
   you already know them — they cannot be listed. [`storage.rules`](storage.rules) allows
   nothing but signed-in reads/writes of `portraits/{characterId}`, capped at 1 MB and
   restricted to image content types.

**About the committed config.** This repository ships a working `firebase-config.js` with
`FIREBASE_ENABLED = true` so the deployed site has multiplayer out of the box. Firebase web
API keys are identifiers, not secrets — access is governed entirely by
`database.rules.json` plus your Storage rules, so those must stay locked down. If you fork
this, replace the config with your own project (or set `FIREBASE_ENABLED = false` to run
purely local). To keep local edits out of git:
`git update-index --skip-worktree firebase-config.js`.

Once enabled: the app signs in anonymously on launch, you can **create a campaign**
(you become the Game Runner and get a three-word join code like `neon-owl-sector`) or
**join with a code** from Settings, then **share your character** with the party. Vitals
and the combat tracker sync in real time.

## Deploy to GitHub Pages

There is no build step, so Pages serves the repository root as-is (`.nojekyll` stops
Jekyll from touching it):

1. Push to GitHub.
2. Settings → Pages → *Source: Deploy from a branch* → `main` / `/ (root)`.
   (On a **private** repo Pages needs a paid plan or the `actions/deploy-pages` workflow
   instead — upload the repo root as the artifact and set *Source: GitHub Actions*.)
3. Open the live URL, confirm it loads with no console errors, and install the PWA from it.

## Development

- `npm test` — headless regression harness (dev-only; `node_modules` is gitignored and not
  part of the service-worker app shell).
- Architecture, rules profile, and the change log live in [`CLAUDE.md`](CLAUDE.md).
