import { loadDemo } from "../shared/demo.js";

const DB_NAME = "rota-clara";
const DB_VERSION = 1;
const STATE_KEY = "state";
export const DEMO_VERSION = 1;

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("kv")) db.createObjectStore("kv");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readState() {
  const db = await openDb();
  try {
    return await requestToPromise(db.transaction("kv", "readonly").objectStore("kv").get(STATE_KEY));
  } finally {
    db.close();
  }
}

export async function writeState(state) {
  const { ui, ...stored } = state;
  void ui;
  const db = await openDb();
  try {
    await requestToPromise(db.transaction("kv", "readwrite").objectStore("kv").put(stored, STATE_KEY));
  } finally {
    db.close();
  }
}

export async function clearState() {
  const db = await openDb();
  try {
    await requestToPromise(db.transaction("kv", "readwrite").objectStore("kv").delete(STATE_KEY));
  } finally {
    db.close();
  }
}

function fresh() {
  const demo = loadDemo();
  return {
    version: DEMO_VERSION,
    lang: "pt",
    userId: null,
    visits: demo.visits,
    audits: demo.audits,
    drafts: {},
    deviceQuotaUsed: 0,
  };
}

export async function boot() {
  const params = new URLSearchParams(location.search);
  if (params.get("reset") === "1") {
    await clearState();
    params.delete("reset");
    const search = params.toString();
    history.replaceState(null, "", `${location.pathname}${search ? `?${search}` : ""}${location.hash}`);
  }

  let saved;
  try {
    saved = await readState();
  } catch {
    saved = null;
  }
  const state = saved && saved.version === DEMO_VERSION ? saved : fresh();
  state.drafts ||= {};
  state.audits ||= [];
  state.visits ||= fresh().visits;
  state.deviceQuotaUsed ||= 0;

  const lang = params.get("lang");
  if (lang === "en" || lang === "pt") state.lang = lang;
  const asUser = params.get("as");
  if (asUser) state.userId = asUser;

  state.ui = {
    promoterId: "promo_camila",
    scoreStopId: null,
    notice: "",
    busy: false,
    geo: "",
    quota: null,
    syncNote: "",
    online: navigator.onLine,
    installPrompt: null,
    wide: window.matchMedia("(min-width: 980px)").matches,
  };
  return state;
}
