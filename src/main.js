import "@fontsource/fraunces/500.css";
import "@fontsource/fraunces/600.css";
import "@fontsource/outfit/400.css";
import "@fontsource/outfit/500.css";
import "@fontsource/outfit/600.css";
import "./styles.css";
import { DEFAULT_DAILY_QUOTA, deviceAudit, requestAudit } from "./api.js";
import { shelfDataUrl } from "./shelf.js";
import { distanceMeters } from "./format.js";
import { derive } from "./model.js";
import { demoPosition, draftFor } from "./render.js";
import { renderApp } from "./render.js";
import { boot, clearState, writeState } from "./state.js";

const app = document.querySelector("#app");
const state = await boot();
let model = derive(state);

function route() {
  const parts = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  if (parts[0] === "agenda") return { name: "agenda" };
  if (parts[0] === "visit" && parts[1]) return { name: "visit", stopId: decodeURIComponent(parts[1]) };
  if (parts[0] === "dashboard") return { name: "dashboard" };
  return { name: "login" };
}

function homeHash(user) {
  return user?.role === "manager" ? "#/dashboard" : "#/agenda";
}

function draw() {
  model = derive(state);
  document.documentElement.lang = state.lang === "pt" ? "pt-BR" : "en";
  let current = route();
  if (model.user && current.name === "login") {
    location.hash = homeHash(model.user);
    return;
  }
  if (model.user?.role === "promoter" && current.name === "dashboard") {
    location.hash = "#/agenda";
    return;
  }
  app.innerHTML = renderApp(state, model, current);
  const dialog = app.querySelector("[role=dialog] button");
  if (dialog && state.ui.scoreStopId) dialog.focus();
}

async function save() {
  try {
    await writeState(state);
  } catch {
    /* private mode can refuse IndexedDB; the session still works */
  }
}

function stopById(id) {
  return model.agenda.find((stop) => stop.id === id) || null;
}

function currentStop() {
  const current = route();
  return current.name === "visit" ? stopById(current.stopId) : null;
}

function ensureDraft(stop) {
  if (!state.drafts[stop.id]) state.drafts[stop.id] = draftFor(state, model, stop);
  return state.drafts[stop.id];
}

function auditPayload(stop, draft) {
  const store = model.storesById[stop.storeId];
  const seller = model.peopleById[store.sellerId];
  const manager = model.fixture.people.find((person) => person.role === "manager");
  return {
    storeId: store.id,
    storeName: store.name,
    visitId: `draft:${stop.id}`,
    locale: state.lang,
    products: model.fixture.products,
    counts: draft.counts,
    stockouts: draft.stockouts,
    keyAccount: store.keyAccount,
    lot: stop.lot,
    recipients: [manager.email, seller.email],
    photoDataUrl: draft.photos.before || draft.photos.after || "",
  };
}

function rememberAudit(stop, audit, servedBy, quota) {
  const payload = auditPayload(stop, ensureDraft(stop));
  const { photoDataUrl, ...input } = payload;
  state.audits.push({
    id: `aud_${stop.id}_${state.audits.length + 1}`,
    storeId: stop.storeId,
    visitId: `draft:${stop.id}`,
    promoterId: stop.promoterId,
    sellerId: model.storesById[stop.storeId].sellerId,
    createdAt: new Date().toISOString(),
    servedBy,
    synced: servedBy === "server",
    source: audit.source,
    model: audit.model,
    photoReceived: Boolean(photoDataUrl),
    input,
  });
  if (quota) state.ui.quota = quota;
}

async function runAudit(stop) {
  const draft = ensureDraft(stop);
  if (!draft.checkin) {
    state.ui.notice = "checkin";
    draw();
    return;
  }
  state.ui.busy = true;
  state.ui.notice = "";
  draw();
  const payload = auditPayload(stop, draft);
  const result = await requestAudit(payload, `demo.${state.userId}`);
  state.ui.busy = false;
  if (result.error === "quota") {
    state.ui.notice = "quota";
    state.ui.quota = result.quota;
    draw();
    await save();
    return;
  }
  if (result.error) {
    state.ui.notice = result.error;
    draw();
    return;
  }
  if (result.offline) {
    if (state.deviceQuotaUsed >= DEFAULT_DAILY_QUOTA) {
      state.ui.notice = "quota";
      draw();
      return;
    }
    const local = deviceAudit(payload);
    state.deviceQuotaUsed += 1;
    state.ui.quota = {
      remaining: DEFAULT_DAILY_QUOTA - state.deviceQuotaUsed,
      limit: DEFAULT_DAILY_QUOTA,
    };
    rememberAudit(stop, local.audit, "device", state.ui.quota);
  } else {
    rememberAudit(stop, result.audit, "server", result.quota);
  }
  await save();
  draw();
}

document.body.addEventListener("click", async (event) => {
  const el = event.target.closest("[data-action]");
  if (!el || el.disabled) return;
  const action = el.dataset.action;
  if (action === "noop") {
    event.stopPropagation();
    return;
  }
  if (action === "lang") {
    state.lang = el.dataset.lang;
    await save();
    draw();
    return;
  }
  if (action === "login") {
    state.userId = el.dataset.user;
    await save();
    location.hash = homeHash(model.peopleById?.[el.dataset.user] || derive(state).user);
    draw();
    return;
  }
  if (action === "reset") {
    await clearState();
    location.href = location.pathname;
    return;
  }
  if (action === "install" && state.ui.installPrompt) {
    state.ui.installPrompt.prompt();
    return;
  }
  if (action === "open-stop") {
    location.hash = `#/visit/${encodeURIComponent(el.dataset.id)}`;
    return;
  }
  if (action === "open-score") {
    event.stopPropagation();
    state.ui.scoreStopId = el.dataset.id;
    draw();
    return;
  }
  if (action === "close-score") {
    state.ui.scoreStopId = null;
    draw();
    return;
  }
  if (action === "checkin-demo") {
    const stop = stopById(el.dataset.id);
    if (!stop) return;
    const draft = ensureDraft(stop);
    draft.checkin = demoPosition(model.storesById[stop.storeId]);
    state.ui.geo = "";
    state.ui.notice = "";
    await save();
    draw();
    return;
  }
  if (action === "checkin-device") {
    const stop = stopById(el.dataset.id);
    if (!stop || !navigator.geolocation) {
      state.ui.geo = "denied";
      draw();
      return;
    }
    state.ui.geo = "wait";
    draw();
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const store = model.storesById[stop.storeId];
        const distance = distanceMeters(store.lat, store.lng, position.coords.latitude, position.coords.longitude);
        if (distance > 150) {
          state.ui.geo = "far";
          state.ui.geoDistance = distance;
          draw();
          return;
        }
        const draft = ensureDraft(stop);
        draft.checkin = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          at: new Date().toISOString(),
          distanceM: Math.round(distance),
          source: "device",
        };
        state.ui.geo = "";
        await save();
        draw();
      },
      () => {
        state.ui.geo = "denied";
        draw();
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
    return;
  }
  if (action === "bump") {
    const stop = stopById(el.dataset.id);
    if (!stop) return;
    const draft = ensureDraft(stop);
    const count = draft.counts.find((row) => row.sku === el.dataset.sku);
    if (!count) return;
    const cap = el.dataset.field === "facings" ? 24 : 99;
    count[el.dataset.field] = Math.min(cap, Math.max(0, count[el.dataset.field] + Number(el.dataset.delta)));
    await save();
    draw();
    return;
  }
  if (action === "reason") {
    const stop = stopById(el.dataset.id);
    if (!stop) return;
    const draft = ensureDraft(stop);
    const existing = draft.stockouts.find((row) => row.sku === el.dataset.sku);
    if (existing && existing.reason === el.dataset.reason) {
      draft.stockouts = draft.stockouts.filter((row) => row.sku !== el.dataset.sku);
    } else if (existing) {
      existing.reason = el.dataset.reason;
    } else {
      draft.stockouts.push({ sku: el.dataset.sku, reason: el.dataset.reason });
    }
    await save();
    draw();
    return;
  }
  if (action === "sample-photo") {
    const stop = currentStop();
    if (!stop) return;
    const draft = ensureDraft(stop);
    draft.photos[el.dataset.kind] = shelfDataUrl(draft.counts, model.productsBySku);
    await save();
    draw();
    return;
  }
  if (action === "run-audit") {
    const stop = currentStop();
    if (stop) await runAudit(stop);
    return;
  }
  if (action === "complete") {
    const stop = stopById(el.dataset.id);
    if (!stop) return;
    const draft = ensureDraft(stop);
    if (!draft.checkin) {
      state.ui.notice = "checkin";
      draw();
      return;
    }
    if (!state.audits.some((audit) => audit.visitId === `draft:${stop.id}`)) {
      state.ui.notice = "audit";
      draw();
      return;
    }
    state.visits.push({
      id: `vis_${stop.id}`,
      stopId: stop.id,
      storeId: stop.storeId,
      promoterId: stop.promoterId,
      date: stop.date,
      status: "completed",
      checkedInAt: draft.checkin.at,
      lat: draft.checkin.lat,
      lng: draft.checkin.lng,
      distanceM: draft.checkin.distanceM,
    });
    state.ui.notice = "";
    await save();
    draw();
    return;
  }
  if (action === "sync") {
    const pending = state.audits.filter((audit) => audit.servedBy === "device" && !audit.synced);
    if (!pending.length) {
      state.ui.syncNote = "empty";
      draw();
      return;
    }
    for (const audit of pending) {
      const result = await requestAudit({ ...audit.input, locale: state.lang }, `demo.${state.userId}`);
      if (result.offline) {
        state.ui.syncNote = "offline";
        draw();
        return;
      }
      if (result.error) {
        state.ui.syncNote = `err:${result.error}`;
        draw();
        return;
      }
      audit.synced = true;
      audit.servedBy = "server";
      if (result.quota) state.ui.quota = result.quota;
    }
    state.ui.syncNote = "done";
    await save();
    draw();
  }
});

document.body.addEventListener("change", async (event) => {
  const target = event.target;
  if (target.dataset.action === "promoter") {
    state.ui.promoterId = target.value;
    draw();
    return;
  }
  if (target.dataset.action !== "photo") return;
  const file = target.files?.[0];
  const stop = currentStop();
  if (!file || !stop) return;
  if (file.size > 900_000) {
    state.ui.notice = "photo";
    draw();
    return;
  }
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
  const draft = ensureDraft(stop);
  draft.photos[target.dataset.kind] = dataUrl;
  state.ui.notice = "";
  await save();
  draw();
});

window.addEventListener("hashchange", () => {
  state.ui.notice = "";
  state.ui.scoreStopId = null;
  draw();
});

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && state.ui.scoreStopId) {
    state.ui.scoreStopId = null;
    draw();
  }
});

window.addEventListener("resize", () => {
  const wide = window.matchMedia("(min-width: 980px)").matches;
  if (wide !== state.ui.wide) {
    state.ui.wide = wide;
    draw();
  }
});

window.addEventListener("online", () => {
  state.ui.online = true;
  draw();
});
window.addEventListener("offline", () => {
  state.ui.online = false;
  draw();
});

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  state.ui.installPrompt = event;
  draw();
});

if (model.user && (location.hash === "" || location.hash === "#/" || location.hash === "#/login")) {
  location.hash = homeHash(model.user);
}
draw();
