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
5. Deploy the security rules in [`database.rules.json`](database.rules.json) to your
   Realtime Database (player/GM roles are enforced there).

**Never commit real keys.** The committed `firebase-config.js` stays a placeholder. After
filling in real keys locally, stop git from tracking your edits:
`git update-index --skip-worktree firebase-config.js`.

Once enabled: the app signs in anonymously on launch, you can **create a campaign**
(you become the Game Runner and get a three-word join code like `neon-owl-sector`) or
**join with a code** from Settings, then **share your character** with the party. Vitals
and the combat tracker sync in real time.

## Deploy to GitHub Pages

The repository is **private** (it derives from licensed rulebooks), so Pages is published
via GitHub Actions rather than the branch setting:

1. `git init` and push to a private GitHub repo.
2. Add the official `actions/deploy-pages` workflow, uploading the repo root as the Pages
   artifact (there is no build step).
3. Enable Pages → *Source: GitHub Actions*.
4. Open the live URL, confirm it loads with no console errors, and install the PWA from it.

## Development

- `npm test` — headless regression harness (dev-only; `node_modules` is gitignored and not
  part of the service-worker app shell).
- Architecture, rules profile, and the change log live in [`CLAUDE.md`](CLAUDE.md).
