import { contributions } from "../shared/score.js";
import { presentAudit, emailBody, DEFAULT_DAILY_QUOTA } from "../shared/audit-core.js";
import { STOCKOUT_REASONS } from "../shared/reasons.js";
import { defaultCounts } from "../shared/demo.js";
import { t } from "./i18n.js";
import {
  distanceMeters,
  esc,
  formatDay,
  formatDistance,
  formatLong,
  formatMoney,
  percent,
  productName,
  scoreTone,
  weekRange,
} from "./format.js";
import { activePromoterId, isDone, stockoutRows } from "./model.js";

function draftFor(state, model, stop) {
  if (state.drafts[stop.id]) return state.drafts[stop.id];
  const seeded = defaultCounts(model.fixture, stop.storeId);
  return {
    counts: seeded.map(({ sku, onHand, facings }) => ({ sku, onHand, facings })),
    stockouts: seeded.filter((row) => row.reason).map((row) => ({ sku: row.sku, reason: row.reason })),
    photos: { before: null, after: null },
    checkin: null,
  };
}

function roleLabel(lang, role) {
  if (role === "manager") return t(lang, "role_manager");
  if (role === "seller") return t(lang, "role_seller");
  return t(lang, "role_promoter");
}

export function renderApp(state, model, route) {
  if (!model.user || route.name === "login") return renderLogin(state, model);
  const body = route.name === "dashboard"
    ? renderDashboard(state, model)
    : route.name === "visit"
      ? renderVisit(state, model, route.stopId)
      : renderAgenda(state, model);
  return `${shellStart(state, model, route)}${body}${scoreDialog(state, model)}</div></div>`;
}

function shellStart(state, model, route) {
  const lang = state.lang;
  const user = model.user;
  const pending = state.audits.filter((audit) => audit.servedBy === "device" && !audit.synced).length;
  const manager = user.role === "manager";
  const wide = state.ui.wide;
  const nav = `
    <a class="${route.name !== "dashboard" ? "is-active" : ""}" href="#/agenda">${esc(t(lang, "nav_today"))}</a>
    ${manager ? `<a class="${route.name === "dashboard" ? "is-active" : ""}" href="#/dashboard">${esc(t(lang, "nav_dashboard"))}</a>` : ""}
  `;
  return `
    <div class="app ${wide ? "" : "is-narrow"}">
      <aside class="rail">
        <a class="wordmark" href="${user.role === "manager" ? "#/dashboard" : "#/agenda"}">
          <span>${esc(t(lang, "brand"))}</span>
          <strong>${esc(t(lang, "product"))}</strong>
        </a>
        <nav class="rail-nav">${nav}</nav>
        <div class="rail-foot">
          <div class="who">
            <b>${esc(user.name)}</b>
            <span>${esc(roleLabel(lang, user.role))}${user.routeName ? ` · ${esc(user.routeName)}` : ""}</span>
          </div>
          <div class="segment" role="group" aria-label="Language">
            <button type="button" data-action="lang" data-lang="pt" data-testid="lang-pt" class="${lang === "pt" ? "is-active" : ""}">PT</button>
            <button type="button" data-action="lang" data-lang="en" data-testid="lang-en" class="${lang === "en" ? "is-active" : ""}">EN</button>
          </div>
          <button type="button" class="text-btn" data-action="reset">${esc(t(lang, "reset"))}</button>
          ${state.ui.installPrompt ? `<button type="button" class="text-btn" data-action="install">${esc(t(lang, "install"))}</button>` : ""}
        </div>
      </aside>
      <div class="workspace">
        <div class="banner">${esc(t(lang, "banner", { date: formatLong(model.fixture.demoToday, lang) }))}</div>
        <div class="statusline">
          <span class="pill ${state.ui.online ? "is-on" : ""}">${esc(state.ui.online ? t(lang, "online") : t(lang, "offline"))}</span>
          <span class="pill">${esc(t(lang, "outbox", { n: pending }))}</span>
          <button type="button" class="text-btn" data-action="sync">${esc(t(lang, "sync"))}</button>
          ${state.ui.syncNote ? `<span class="status-note">${esc(syncText(lang, state.ui.syncNote))}</span>` : ""}
        </div>
        ${wide ? "" : `<nav class="tabbar">${nav}</nav>`}
  `;
}

function syncText(lang, note) {
  if (note === "offline") return t(lang, "sync_offline");
  if (note === "done") return t(lang, "sync_done");
  if (note === "empty") return t(lang, "sync_empty");
  if (note.startsWith("err:")) return t(lang, "sync_err", { error: note.slice(4) });
  return note;
}

function renderLogin(state, model) {
  const lang = state.lang;
  const people = model.fixture.people.filter((person) => person.role === "promoter" || person.role === "manager");
  return `
    <div class="login">
      <section class="login-brand">
        <div>
          <p class="kicker">${esc(t(lang, "login_kicker"))}</p>
          <h1>${esc(t(lang, "product"))}</h1>
          <p class="brand-name">${esc(t(lang, "brand"))}</p>
        </div>
        <div>
          <p class="lead">${esc(t(lang, "login_title"))}</p>
          <p class="quiet">${esc(t(lang, "login_lead"))}</p>
        </div>
        <p class="quiet small">${esc(t(lang, "login_note"))}</p>
      </section>
      <section class="login-panel">
        <div class="segment" role="group" aria-label="Language">
          <button type="button" data-action="lang" data-lang="pt" data-testid="lang-pt" class="${lang === "pt" ? "is-active" : ""}">PT</button>
          <button type="button" data-action="lang" data-lang="en" data-testid="lang-en" class="${lang === "en" ? "is-active" : ""}">EN</button>
        </div>
        <h2>${esc(t(lang, "choose"))}</h2>
        <div class="personas">
          ${people.map((person) => `
            <button type="button" class="persona" data-action="login" data-user="${esc(person.id)}" data-testid="persona-${esc(person.id)}">
              <span class="avatar">${esc(initials(person.name))}</span>
              <span>
                <b>${esc(person.name)}</b>
                <small>${esc(roleLabel(lang, person.role))}${person.routeName ? ` · ${esc(person.routeName)}` : ""}</small>
              </span>
            </button>
          `).join("")}
        </div>
      </section>
    </div>
  `;
}

function initials(name) {
  return name.split(" ").slice(0, 2).map((part) => part[0]).join("");
}

function renderAgenda(state, model) {
  const lang = state.lang;
  const promoterId = activePromoterId(state, model);
  const stops = model.agenda.filter((stop) => stop.promoterId === promoterId);
  const done = stops.filter((stop) => isDone(state, stop.id)).length;
  const promoter = model.peopleById[promoterId];
  const range = weekRange(model.fixture.demoToday);
  const promoterSelect = model.user.role === "manager" ? `
    <label class="picker">${esc(t(lang, "promoter_pick"))}
      <select data-action="promoter">
        ${model.fixture.people.filter((person) => person.role === "promoter").map((person) => `
          <option value="${esc(person.id)}" ${person.id === promoterId ? "selected" : ""}>${esc(person.name)}</option>
        `).join("")}
      </select>
    </label>
  ` : "";
  const groups = ["morning", "afternoon"].map((shift) => {
    const items = stops.filter((stop) => stop.shift === shift);
    if (!items.length) return "";
    return `
      <section class="shift">
        <h3>${esc(t(lang, shift))}</h3>
        <div class="stops">
          ${items.map((stop) => stopCard(state, model, stop)).join("")}
        </div>
      </section>
    `;
  }).join("");
  return `
    <main class="page" data-testid="agenda">
      <header class="page-head">
        <div>
          <p class="kicker">${esc(promoter.routeName)} · ${esc(t(lang, "week_of", { start: formatDay(range.start, lang), end: formatDay(range.end, lang) }))}</p>
          <h2>${esc(formatLong(model.fixture.demoToday, lang))}</h2>
          <p class="quiet">${esc(t(lang, "progress", { done, total: stops.length }))}</p>
        </div>
        ${promoterSelect}
      </header>
      ${groups}
    </main>
  `;
}

function stopCard(state, model, stop) {
  const lang = state.lang;
  const store = model.storesById[stop.storeId];
  const done = isDone(state, stop.id);
  return `
    <article class="stop ${done ? "is-done" : ""}">
      <button type="button" class="stop-open" data-action="open-stop" data-id="${esc(stop.id)}" data-testid="stop-${esc(stop.storeId)}">
        <span class="order">${String(stop.order).padStart(2, "0")}</span>
        <span class="stop-copy">
          <b>${esc(store.name)}</b>
          <small>${esc(store.city)} · ${esc(t(lang, `channel_${store.channel}`))}</small>
          <span class="chips">${chips(lang, stop, store)}</span>
          <small class="meta">${esc(t(lang, "shipped"))} ${esc(formatMoney(stop.volumeCents, lang))} · ${esc(recencyLabel(lang, stop))}</small>
        </span>
      </button>
      <button type="button" class="score tone-${scoreTone(stop.score)}" style="--p:${stop.score}" data-action="open-score" data-id="${esc(stop.id)}" data-testid="score-${esc(stop.storeId)}" aria-label="${esc(t(lang, "why"))}">
        <b>${stop.score.toFixed(1)}</b>
      </button>
    </article>
  `;
}

function chips(lang, stop, store) {
  const items = [];
  if (store.keyAccount) items.push(["key", "chip_key"]);
  if (stop.stockoutEvents14d > 0) items.push(["alert", "chip_stockout"]);
  if (stop.lot && stop.lot.daysLeft <= 10) items.push(["alert", "chip_expiry"]);
  if (stop.daysSinceVisit == null || stop.daysSinceVisit >= 14) items.push(["warn", "chip_overdue"]);
  if (stop.frequency === "biweekly") items.push(["info", "chip_biweekly"]);
  return items.map(([tone, key]) => `<i class="chip chip-${tone}">${esc(t(lang, key))}</i>`).join("");
}

function recencyLabel(lang, stop) {
  if (stop.daysSinceVisit == null) return t(lang, "never");
  if (stop.daysSinceVisit === 1) return t(lang, "yesterday");
  return t(lang, "days_ago", { days: stop.daysSinceVisit });
}

function renderVisit(state, model, stopId) {
  const lang = state.lang;
  const stop = model.agenda.find((item) => item.id === stopId);
  if (!stop) {
    return `<main class="page"><p>${esc(t(lang, "back"))}</p></main>`;
  }
  const store = model.storesById[stop.storeId];
  const seller = model.peopleById[store.sellerId];
  const draft = draftFor(state, model, stop);
  const done = isDone(state, stop.id);
  const readonly = model.user.role !== "promoter" || model.user.id !== stop.promoterId;
  const audit = auditFor(state, stop, lang);
  const checkin = draft.checkin;
  return `
    <main class="page visit" data-testid="visit">
      <a class="back" href="#/agenda">${esc(t(lang, "back"))}</a>
      <header class="page-head visit-head">
        <div>
          <p class="kicker">${esc(t(lang, stop.shift))} · ${esc(t(lang, "order", { n: stop.order }))}</p>
          <h2>${esc(store.name)}</h2>
          <p class="quiet">${esc(store.address)}, ${esc(store.city)} · ${esc(t(lang, "seller"))}: ${esc(seller.name)}</p>
        </div>
        <button type="button" class="score tone-${scoreTone(stop.score)}" style="--p:${stop.score}" data-action="open-score" data-id="${esc(stop.id)}" aria-label="${esc(t(lang, "why"))}">
          <b>${stop.score.toFixed(1)}</b>
        </button>
      </header>
      ${readonly ? `<p class="note">${esc(t(lang, "readonly"))}</p>` : ""}
      ${checkinBlock(lang, store, stop, checkin, state, readonly || done)}
      ${countBlock(lang, model, stop, draft, readonly || done)}
      ${photoBlock(lang, draft, readonly || done)}
      ${auditBlock(state, lang, audit, readonly || done, Boolean(checkin))}
      <div class="visit-actions">
        ${done ? `<p class="done-flag">${esc(t(lang, "completed"))}</p>` : `
          <button type="button" class="primary" data-action="complete" data-id="${esc(stop.id)}" ${readonly || !checkin || !audit ? "disabled" : ""}>${esc(t(lang, "complete"))}</button>
        `}
        ${state.ui.notice ? `<p class="note warn">${esc(noticeText(lang, state.ui.notice))}</p>` : ""}
      </div>
    </main>
  `;
}

function noticeText(lang, notice) {
  if (notice === "checkin") return t(lang, "checkin_need");
  if (notice === "audit") return t(lang, "audit_missing");
  if (notice === "quota") return t(lang, "quota_block");
  if (notice === "photo") return t(lang, "photo_large");
  return notice;
}

function checkinBlock(lang, store, stop, checkin, state, locked) {
  let status = `<p class="quiet">${esc(t(lang, "checkin_help"))}</p>`;
  if (state.ui.geo === "wait") status = `<p class="quiet">${esc(t(lang, "geo_wait"))}</p>`;
  if (state.ui.geo === "denied") status = `<p class="note warn">${esc(t(lang, "checkin_denied"))}</p>`;
  if (state.ui.geo === "far" && state.ui.geoDistance != null) {
    status = `<p class="note warn">${esc(t(lang, "checkin_far", { distance: formatDistance(state.ui.geoDistance) }))}</p>`;
  }
  if (checkin) {
    status = `<p class="note ok">${esc(t(lang, "checkin_ok", { distance: formatDistance(checkin.distanceM) }))}</p>`;
  }
  return `
    <section class="card">
      <h3>1 · ${esc(t(lang, "checkin"))}</h3>
      ${status}
      ${locked || checkin ? "" : `
        <div class="row-actions">
          <button type="button" class="primary" data-action="checkin-demo" data-id="${esc(stop.id)}" data-testid="checkin-demo">${esc(t(lang, "checkin_demo"))}</button>
          <button type="button" class="ghost" data-action="checkin-device" data-id="${esc(stop.id)}">${esc(t(lang, "checkin_device"))}</button>
        </div>
      `}
    </section>
  `;
}

function countBlock(lang, model, stop, draft, locked) {
  const rows = draft.counts.map((count) => {
    const product = model.productsBySku[count.sku];
    const reason = draft.stockouts.find((row) => row.sku === count.sku)?.reason || "";
    const showReasons = count.onHand === 0 || reason;
    return `
      <div class="sku">
        <div>
          <b>${esc(productName(product, lang))}</b>
          <small>${esc(t(lang, `cat_${product.category}`))} · ${esc(product.sku)} · ${esc(t(lang, "target", { n: product.facings }))}</small>
        </div>
        ${stepper(lang, stop.id, count, "onHand", locked)}
        ${stepper(lang, stop.id, count, "facings", locked)}
        ${showReasons ? reasonPicker(lang, stop.id, count.sku, reason, locked) : ""}
      </div>
    `;
  }).join("");
  return `
    <section class="card">
      <h3>2 · ${esc(t(lang, "count"))}</h3>
      <p class="quiet">${esc(t(lang, "stockout_help"))}</p>
      <div class="sku-head"><span></span><span>${esc(t(lang, "on_hand"))}</span><span>${esc(t(lang, "facings"))}</span></div>
      ${rows}
    </section>
  `;
}

function stepper(lang, stopId, count, field, locked) {
  return `
    <div class="stepper" aria-label="${esc(t(lang, field === "onHand" ? "on_hand" : "facings"))}">
      <button type="button" data-action="bump" data-id="${esc(stopId)}" data-sku="${esc(count.sku)}" data-field="${field}" data-delta="-1" ${locked ? "disabled" : ""}>−</button>
      <span>${count[field]}</span>
      <button type="button" data-action="bump" data-id="${esc(stopId)}" data-sku="${esc(count.sku)}" data-field="${field}" data-delta="1" ${locked ? "disabled" : ""}>+</button>
    </div>
  `;
}

function reasonPicker(lang, stopId, sku, current, locked) {
  return `
    <div class="reasons">
      ${STOCKOUT_REASONS.map((reason) => `
        <button type="button" class="chip ${current === reason ? "chip-alert" : ""}" data-action="reason" data-id="${esc(stopId)}" data-sku="${esc(sku)}" data-reason="${reason}" aria-pressed="${current === reason}" ${locked ? "disabled" : ""}>${esc(t(lang, `reason_${reason}`))}</button>
      `).join("")}
    </div>
  `;
}

function photoBlock(lang, draft, locked) {
  return `
    <section class="card">
      <h3>3 · ${esc(t(lang, "photo"))}</h3>
      <p class="quiet">${esc(t(lang, "photo_help"))}</p>
      <div class="photos">
        ${photoSlot(lang, "before", draft.photos.before, locked)}
        ${photoSlot(lang, "after", draft.photos.after, locked)}
      </div>
    </section>
  `;
}

function photoSlot(lang, kind, src, locked) {
  return `
    <figure>
      ${src ? `<img alt="${esc(t(lang, kind))}" src="${esc(src)}" />` : `<div class="photo-empty">${esc(t(lang, kind))}</div>`}
      <figcaption>${esc(t(lang, kind))}</figcaption>
      ${locked ? "" : `
        <div class="row-actions">
          <button type="button" class="ghost" data-action="sample-photo" data-kind="${kind}">${esc(t(lang, "sample"))}</button>
          <label class="ghost file">${esc(t(lang, "upload"))}<input type="file" accept="image/*" capture="environment" data-action="photo" data-kind="${kind}" /></label>
        </div>
      `}
    </figure>
  `;
}

function auditFor(state, stop, lang) {
  const linked = [...state.audits].reverse().find((audit) => audit.visitId === `draft:${stop.id}`);
  return linked ? presentAudit(linked, lang) : null;
}

function auditBlock(state, lang, audit, locked, checkedIn) {
  const quota = state.ui.quota;
  const remaining = quota ? quota.remaining : Math.max(DEFAULT_DAILY_QUOTA - state.deviceQuotaUsed, 0);
  return `
    <section class="card" data-testid="audit-panel">
      <h3>4 · ${esc(t(lang, "audit"))}</h3>
      <p class="quiet">${esc(t(lang, "quota", { remaining }))}</p>
      ${locked && !audit ? "" : audit ? "" : `
        <button type="button" class="primary" data-action="run-audit" data-testid="run-audit" ${state.ui.busy || !checkedIn ? "disabled" : ""}>${esc(state.ui.busy ? t(lang, "running") : t(lang, "run_audit"))}</button>
      `}
      ${audit ? auditView(lang, audit) : ""}
    </section>
  `;
}

function auditView(lang, audit) {
  const swot = audit.swot || {};
  return `
    <div data-testid="audit-result">
      <div class="exec">
        <strong>${audit.executionScore}</strong>
        <span>${esc(t(lang, "execution"))}</span>
      </div>
      <p>${esc(audit.summary || "")}</p>
      <p class="quiet">${esc(audit.servedBy === "server" ? t(lang, "server_note") : t(lang, "device_note"))}</p>
      <dl class="metrics">
        <div><dt>${esc(t(lang, "planogram"))}</dt><dd>${percent(audit.planogramCompliance)}</dd></div>
        <div><dt>${esc(t(lang, "price"))}</dt><dd>${percent(audit.priceVisibility)}</dd></div>
        <div><dt>${esc(t(lang, "fefo"))}</dt><dd>${esc(audit.fefo?.compliant ? t(lang, "fefo_ok") : t(lang, "fefo_bad"))}</dd></div>
      </dl>
      <p class="quiet">${esc(audit.fefo?.notes || "")}</p>
      ${listBlock(lang, "defects", audit.defects)}
      ${listBlock(lang, "opportunities", audit.opportunities)}
      <div class="swot">
        ${["strengths", "weaknesses", "opportunities", "threats"].map((key) => `
          <section>
            <h4>${esc(t(lang, `swot_${key[0]}`))}</h4>
            <ul>${(swot[key] || []).map((item) => `<li>${esc(item)}</li>`).join("") || `<li>${esc(t(lang, "none"))}</li>`}</ul>
          </section>
        `).join("")}
      </div>
      ${(audit.expiryRisks || []).length ? `
        <h4>${esc(t(lang, "expiry_risks"))}</h4>
        <ul>${audit.expiryRisks.map((risk) => `<li>${esc(risk.sku)} · ${esc(t(lang, "days_left", { days: risk.daysLeft }))}. ${esc(risk.action || "")}</li>`).join("")}</ul>
      ` : ""}
      ${audit.notify ? `
        <div class="email">
          <h4>${esc(t(lang, "email"))}</h4>
          <p class="quiet">${esc(t(lang, "email_help"))}</p>
          <p><b>${esc(t(lang, "to"))}:</b> ${esc((audit.notify.to || []).join(", "))}</p>
          <p><b>${esc(audit.notify.subject || "")}</b></p>
          <pre>${esc(emailBody(audit))}</pre>
        </div>
      ` : ""}
    </div>
  `;
}

function listBlock(lang, key, items) {
  const rows = items || [];
  return `
    <h4>${esc(t(lang, key))}</h4>
    <ul>${rows.length ? rows.map((item) => `<li>${esc(item.detail || item.type || "")}</li>`).join("") : `<li>${esc(t(lang, "none"))}</li>`}</ul>
  `;
}

function scoreDialog(state, model) {
  if (!state.ui.scoreStopId) return "";
  const lang = state.lang;
  const stop = model.agenda.find((item) => item.id === state.ui.scoreStopId);
  if (!stop) return "";
  const store = model.storesById[stop.storeId];
  const product = stop.lot ? model.productsBySku[stop.lot.sku] : null;
  const rows = contributions(stop.parts);
  const labels = {
    volume: "w_volume",
    abc: "w_abc",
    recency: "w_recency",
    stockout: "w_stockout",
    keyAccount: "w_key",
    expiry: "w_expiry",
  };
  const hints = {
    volume: t(lang, "h_volume", { money: formatMoney(stop.volumeCents, lang) }),
    abc: t(lang, "h_abc", { curve: store.abc }),
    recency: stop.daysSinceVisit == null
      ? `${t(lang, "never")}. ${t(lang, "h_recency")}`
      : `${t(lang, "days_ago", { days: stop.daysSinceVisit })}. ${t(lang, "h_recency")}`,
    stockout: t(lang, "h_stockout", { events: stop.stockoutEvents14d }),
    keyAccount: `${t(lang, "h_key")}: ${store.keyAccount ? t(lang, "yes") : t(lang, "no")}`,
    expiry: stop.lot
      ? `${t(lang, "h_expiry")} ${t(lang, "lot_line", {
        sku: productName(product, lang),
        invoice: stop.lot.invoiceDate,
        days: stop.lot.daysLeft,
      })}`
      : t(lang, "h_expiry"),
  };
  return `
    <div class="overlay" data-action="close-score">
      <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="score-title" data-action="noop" data-testid="score-dialog">
        <header>
          <div>
            <p class="kicker">${esc(store.name)}</p>
            <h3 id="score-title">${esc(t(lang, "why"))}</h3>
          </div>
          <button type="button" class="score tone-${scoreTone(stop.score)}" style="--p:${stop.score}"><b>${stop.score.toFixed(1)}</b></button>
        </header>
        <p class="quiet">${esc(t(lang, "formula"))}</p>
        <ol class="breakdown">
          ${rows.map((row) => `
            <li>
              <div>
                <b>${esc(t(lang, labels[row.key]))}</b>
                <small>${esc(hints[row.key])}</small>
              </div>
              <span class="weight">${Math.round(row.weight * 100)}%</span>
              <span class="bar"><i style="width:${Math.round(row.component * 100)}%"></i></span>
              <b>${row.points.toFixed(1)}</b>
            </li>
          `).join("")}
        </ol>
        <button type="button" class="ghost" data-action="close-score">${esc(t(lang, "close"))}</button>
      </div>
    </div>
  `;
}

function renderDashboard(state, model) {
  const lang = state.lang;
  const today = model.fixture.demoToday;
  const range = weekRange(today);
  const doneIds = new Set(state.visits.filter((visit) => visit.status === "completed").map((visit) => visit.stopId));
  const weekStops = model.schedule.filter((stop) => stop.date <= today);
  const weekDone = weekStops.filter((stop) => doneIds.has(stop.id)).length;
  const todayStops = model.agenda;
  const todayDone = todayStops.filter((stop) => doneIds.has(stop.id)).length;
  const stockouts = stockoutRows(state, model);
  const audits = [...state.audits].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  const scores = audits.map((audit) => presentAudit(audit, lang).executionScore);
  const avg = scores.length ? Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length) : 0;
  const promoters = model.fixture.people.filter((person) => person.role === "promoter");
  const reasonCounts = new Map();
  for (const row of stockouts) reasonCounts.set(row.reason, (reasonCounts.get(row.reason) || 0) + 1);
  const maxReason = Math.max(1, ...reasonCounts.values());
  const ranking = [...model.agenda].sort((a, b) => b.score - a.score);
  return `
    <main class="page" data-testid="dashboard">
      <header class="page-head">
        <div>
          <p class="kicker">${esc(model.user.name)} · ${esc(t(lang, "week_of", { start: formatDay(range.start, lang), end: formatDay(range.end, lang) }))}</p>
          <h2>${esc(t(lang, "dash_title"))}</h2>
          <p class="quiet">${esc(t(lang, "dash_lead"))}</p>
        </div>
      </header>
      <section class="kpis">
        ${kpi(t(lang, "kpi_coverage"), percent(weekStops.length ? weekDone / weekStops.length : 0), t(lang, "kpi_coverage_hint"))}
        ${kpi(t(lang, "kpi_today"), `${todayDone}/${todayStops.length}`, t(lang, "kpi_today_hint"))}
        ${kpi(t(lang, "kpi_stock"), String(stockouts.length), t(lang, "kpi_stock_hint"))}
        ${kpi(t(lang, "kpi_exec"), String(avg), t(lang, "kpi_exec_hint"))}
      </section>
      <section class="split-cards">
        <article class="card">
          <h3>${esc(t(lang, "by_promoter"))}</h3>
          ${promoters.map((person) => {
            const planned = weekStops.filter((stop) => stop.promoterId === person.id);
            const done = planned.filter((stop) => doneIds.has(stop.id)).length;
            const ratio = planned.length ? done / planned.length : 0;
            return `
              <div class="bar-row">
                <span>${esc(person.name)}</span>
                <span class="bar"><i style="width:${Math.round(ratio * 100)}%"></i></span>
                <b>${percent(ratio)}</b>
              </div>
            `;
          }).join("")}
        </article>
        <article class="card">
          <h3>${esc(t(lang, "by_reason"))}</h3>
          ${[...reasonCounts.entries()].sort((a, b) => b[1] - a[1]).map(([reason, count]) => `
            <div class="bar-row">
              <span>${esc(t(lang, `reason_${reason}`))}</span>
              <span class="bar"><i style="width:${Math.round((count / maxReason) * 100)}%"></i></span>
              <b>${count}</b>
            </div>
          `).join("") || `<p class="quiet">${esc(t(lang, "none"))}</p>`}
        </article>
      </section>
      <section class="card">
        <h3>${esc(t(lang, "ranking"))}</h3>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>${esc(t(lang, "col_store"))}</th>
                <th>${esc(t(lang, "col_who"))}</th>
                <th>${esc(t(lang, "col_score"))}</th>
                <th>${esc(t(lang, "col_exec"))}</th>
                <th>${esc(t(lang, "col_so"))}</th>
                <th>${esc(t(lang, "col_abc"))}</th>
              </tr>
            </thead>
            <tbody>
              ${ranking.map((stop) => {
                const store = model.storesById[stop.storeId];
                const promoter = model.peopleById[stop.promoterId];
                const previous = [...state.audits].reverse().find((audit) => audit.storeId === stop.storeId);
                const execution = previous ? presentAudit(previous, lang).executionScore : "—";
                return `
                  <tr>
                    <td><a href="#/visit/${esc(stop.id)}">${esc(store.name)}</a><small>${esc(store.city)}</small></td>
                    <td>${esc(promoter.name.split(" ")[0])}</td>
                    <td><b class="tone-text-${scoreTone(stop.score)}">${stop.score.toFixed(1)}</b></td>
                    <td>${execution}</td>
                    <td>${stop.stockoutEvents14d}</td>
                    <td>${esc(store.abc)}${store.keyAccount ? ` · ${esc(t(lang, "key_yes"))}` : ""}</td>
                  </tr>
                `;
              }).join("")}
            </tbody>
          </table>
        </div>
      </section>
      <section>
        <h3>${esc(t(lang, "reports"))}</h3>
        <div class="reports">
          ${audits.map((record) => {
            const audit = presentAudit(record, lang);
            const store = model.storesById[record.storeId];
            return `
              <article class="card report">
                <div class="exec small"><strong>${audit.executionScore}</strong><span>${esc(t(lang, "execution"))}</span></div>
                <div>
                  <b>${esc(store?.name || record.storeId)}</b>
                  <p>${esc(audit.summary || "")}</p>
                </div>
              </article>
            `;
          }).join("")}
        </div>
      </section>
    </main>
  `;
}

function kpi(label, value, hint) {
  return `
    <article class="kpi">
      <span>${esc(label)}</span>
      <strong>${esc(value)}</strong>
      <small>${esc(hint)}</small>
    </article>
  `;
}

export function demoPosition(store) {
  const lat = store.lat + 0.00012;
  const lng = store.lng + 0.00008;
  return {
    lat,
    lng,
    at: new Date().toISOString(),
    distanceM: Math.round(distanceMeters(store.lat, store.lng, lat, lng)),
    source: "demo",
  };
}

export { distanceMeters, draftFor };
