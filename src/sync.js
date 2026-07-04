// sync.js — Firebase auth, campaigns, join codes, presence + cloud mirroring.
// (CLAUDE.md §5/§6.1, Phase 5.) The app runs FULLY in local-only mode when
// FIREBASE_ENABLED is false: the Firebase SDK is loaded via DYNAMIC import() only
// when enabled, so local mode never touches the network and the SW app shell
// stays free of cross-origin deps. Every public method is a safe no-op until the
// layer is `ready`. Two-way sync mirrors characters + shared combat over RTDB;
// portraits go to Storage. Schema per §7; roles enforced in database.rules.json.
import { FIREBASE_ENABLED, firebaseConfig } from "../firebase-config.js";

const SDK = "https://www.gstatic.com/firebasejs/10.12.2"; // modular ESM CDN
const S = { ready: false, app: null, auth: null, db: null, storage: null, fn: {}, uid: null, campaignId: null, role: "player", joinCode: null };
const subs = { auth: new Set(), party: new Set(), combat: new Set(), character: new Set(), status: new Set() };
const unsub = { party: null, combat: null, character: null };
let echoGuard = 0; // suppress re-emitting our own writes back into the UI

// Noir/cyberpunk three-word join codes (e.g. "neon-owl-sector"). [§5]
const CODE_WORDS = {
  a: ["neon", "rain", "chrome", "ghost", "acid", "static", "velvet", "cobalt", "ember", "hollow", "midnight", "smog"],
  b: ["owl", "raven", "koi", "wolf", "moth", "fox", "crane", "viper", "lynx", "dove", "jackal", "sparrow"],
  c: ["sector", "alley", "tower", "spire", "district", "quay", "terrace", "block", "row", "precinct", "arcade", "wall"],
};
const pick = (a) => a[Math.floor(Math.random() * a.length)];
export const makeJoinCode = () => `${pick(CODE_WORDS.a)}-${pick(CODE_WORDS.b)}-${pick(CODE_WORDS.c)}`;

export const Sync = {
  get enabled() { return !!FIREBASE_ENABLED; },
  get ready() { return S.ready; },
  get uid() { return S.uid; },
  get campaignId() { return S.campaignId; },
  get role() { return S.role; },
  get joinCode() { return S.joinCode; },
  get inCampaign() { return !!S.campaignId; },
  // subscriptions — return an unsubscribe fn
  onAuth(cb) { subs.auth.add(cb); return () => subs.auth.delete(cb); },
  onParty(cb) { subs.party.add(cb); return () => subs.party.delete(cb); },
  onCombat(cb) { subs.combat.add(cb); return () => subs.combat.delete(cb); },
  onCharacter(cb) { subs.character.add(cb); return () => subs.character.delete(cb); },
  onStatus(cb) { subs.status.add(cb); return () => subs.status.delete(cb); },
};

function emit(set, ...args) { for (const cb of set) { try { cb(...args); } catch (e) { /* listener error — isolate */ } } }
const status = () => emit(subs.status);

// ---- boot -----------------------------------------------------------------
export async function initSync() {
  if (!FIREBASE_ENABLED) return false; // local-only: never import the SDK
  try {
    const [app, auth, db, storage] = await Promise.all([
      import(`${SDK}/firebase-app.js`),
      import(`${SDK}/firebase-auth.js`),
      import(`${SDK}/firebase-database.js`),
      import(`${SDK}/firebase-storage.js`),
    ]);
    S.app = app.initializeApp(firebaseConfig);
    S.auth = auth.getAuth(S.app);
    S.db = db.getDatabase(S.app);
    S.storage = storage.getStorage(S.app);
    S.fn = { app, auth, db, storage };
    auth.onAuthStateChanged(S.auth, (user) => {
      S.uid = user?.uid || null;
      emit(subs.auth, user);
      status();
      if (user) restoreCampaign();
    });
    await auth.signInAnonymously(S.auth);
    S.ready = true;
    status();
    return true;
  } catch (e) {
    console.warn("Sync unavailable — staying local-only:", e?.message || e);
    return false;
  }
}

// ---- auth / account -------------------------------------------------------
export async function linkGoogle() {
  if (!S.ready) return { ok: false, error: "Cloud sync is off." };
  try {
    const provider = new S.fn.auth.GoogleAuthProvider();
    try { await S.fn.auth.linkWithPopup(S.auth.currentUser, provider); }
    catch (e) { if (e?.code === "auth/credential-already-in-use") await S.fn.auth.signInWithPopup(S.auth, provider); else throw e; }
    status();
    return { ok: true };
  } catch (e) { return { ok: false, error: e?.message || String(e) }; }
}
export function accountLabel() {
  const u = S.auth?.currentUser;
  if (!u) return "Not signed in";
  return u.isAnonymous ? "Anonymous (this device)" : (u.displayName || u.email || "Google account");
}

// ---- campaigns ------------------------------------------------------------
const dref = (path) => S.fn.db.ref(S.db, path);

export async function createCampaign(name) {
  if (!S.ready) return { ok: false, error: "Cloud sync is off." };
  const { push, set, serverTimestamp } = S.fn.db;
  try {
    const cRef = push(dref("campaigns"));
    const cid = cRef.key;
    let code = makeJoinCode();
    // ensure the code is free (retry a couple of times on collision)
    for (let i = 0; i < 3; i++) { const snap = await S.fn.db.get(dref(`joinCodes/${code}`)); if (!snap.exists()) break; code = makeJoinCode(); }
    await set(dref(`campaigns/${cid}/meta`), { name: name || "Untitled Case", joinCode: code, createdAt: serverTimestamp(), ownerUid: S.uid });
    await set(dref(`campaigns/${cid}/members/${S.uid}`), { displayName: accountLabel(), role: "gm", lastSeen: serverTimestamp() });
    await set(dref(`joinCodes/${code}`), cid);
    await enterCampaign(cid, "gm", code);
    return { ok: true, cid, code };
  } catch (e) { return { ok: false, error: e?.message || String(e) }; }
}

export async function joinCampaign(joinCode) {
  if (!S.ready) return { ok: false, error: "Cloud sync is off." };
  const code = String(joinCode || "").trim().toLowerCase();
  try {
    const snap = await S.fn.db.get(dref(`joinCodes/${code}`));
    if (!snap.exists()) return { ok: false, error: "No campaign found for that join code." };
    const cid = snap.val();
    await S.fn.db.set(dref(`campaigns/${cid}/members/${S.uid}`), { displayName: accountLabel(), role: "player", lastSeen: S.fn.db.serverTimestamp() });
    await enterCampaign(cid, "player", code);
    return { ok: true, cid, code };
  } catch (e) { return { ok: false, error: e?.message || String(e) }; }
}

export async function leaveCampaign() {
  if (!S.ready || !S.campaignId) return;
  try { await S.fn.db.remove(dref(`campaigns/${S.campaignId}/members/${S.uid}`)); } catch { /* best effort */ }
  detachCampaign();
}

// Persist/restore the current campaign locally so a reload rejoins it.
const CAMP_KEY = "brp:campaign";
async function enterCampaign(cid, role, code) {
  S.campaignId = cid; S.role = role; S.joinCode = code || S.joinCode || null;
  try { localStorage.setItem(CAMP_KEY, JSON.stringify({ cid, role, code: S.joinCode })); } catch {}
  watchParty(); watchCombat();
  status();
}
function restoreCampaign() {
  try {
    const saved = JSON.parse(localStorage.getItem(CAMP_KEY) || "null");
    if (saved?.cid && !S.campaignId) { S.campaignId = saved.cid; S.role = saved.role || "player"; S.joinCode = saved.code || null; watchParty(); watchCombat(); status(); }
  } catch {}
}
function detachCampaign() {
  for (const k of Object.keys(unsub)) { if (unsub[k]) { unsub[k](); unsub[k] = null; } }
  S.campaignId = null; S.role = "player"; S.joinCode = null;
  try { localStorage.removeItem(CAMP_KEY); } catch {}
  emit(subs.party, []); emit(subs.combat, null); status();
}

// ---- party presence -------------------------------------------------------
function watchParty() {
  if (!S.ready || !S.campaignId) return;
  const { ref, onValue, onDisconnect, set, serverTimestamp } = S.fn.db;
  const meRef = ref(S.db, `campaigns/${S.campaignId}/members/${S.uid}/lastSeen`);
  try { onDisconnect(meRef).set(serverTimestamp()); set(meRef, serverTimestamp()); } catch {}
  unsub.party?.();
  unsub.party = onValue(ref(S.db, `campaigns/${S.campaignId}/members`), (snap) => {
    const members = snap.val() || {};
    emit(subs.party, Object.entries(members).map(([uid, m]) => ({ uid, ...m })));
  });
}

// ---- character mirroring (two-way) ----------------------------------------
// Called by store.js on every local save. Pushes to the cloud when the character
// belongs to the active campaign; otherwise a no-op.
export function mirrorCharacter(ch) {
  if (!S.ready || !S.campaignId || !ch?.id || ch.campaignId !== S.campaignId) return;
  echoGuard = Date.now();
  try { S.fn.db.set(dref(`characters/${ch.id}`), { ...ch, owner: ch.owner || S.uid, campaignId: S.campaignId }); } catch {}
}
// Watch a specific character for remote edits (the sheet subscribes to its own).
export function watchCharacter(id, cb) {
  if (!S.ready || !id) return () => {};
  const { ref, onValue } = S.fn.db;
  const off = onValue(ref(S.db, `characters/${id}`), (snap) => {
    const val = snap.val();
    if (!val) return;
    if (Date.now() - echoGuard < 1500) return; // ignore our own just-written echo
    emit(subs.character, val);
    cb && cb(val);
  });
  return off;
}

// ---- shared combat mirroring ----------------------------------------------
export function mirrorCombat(state) {
  if (!S.ready || !S.campaignId) return;
  echoGuard = Date.now();
  try { S.fn.db.set(dref(`campaigns/${S.campaignId}/combat`), state); } catch {}
}
function watchCombat() {
  if (!S.ready || !S.campaignId) return;
  const { ref, onValue } = S.fn.db;
  unsub.combat?.();
  unsub.combat = onValue(ref(S.db, `campaigns/${S.campaignId}/combat`), (snap) => {
    if (Date.now() - echoGuard < 1500) return; // our own echo
    emit(subs.combat, snap.val() || null);
  });
}

// ---- portrait upload (Storage) --------------------------------------------
export async function uploadPortrait(characterId, dataUrl) {
  if (!S.ready) return null;
  try {
    const r = S.fn.storage.ref(S.storage, `portraits/${characterId}.jpg`);
    await S.fn.storage.uploadString(r, dataUrl, "data_url");
    return await S.fn.storage.getDownloadURL(r);
  } catch (e) { return null; }
}
