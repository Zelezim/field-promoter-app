import fixture from "./fixture.json" with { type: "json" };
import { buildAgenda, scheduledStops } from "./agenda.js";
import { buildMockAudit } from "./audit-core.js";
import { addDays, eachDate, startOfIsoWeek } from "./dates.js";

const CATEGORY_ORDER = ["cheese", "butter", "requeijao", "drink", "milk"];

export function indexes(data = fixture) {
  return {
    productsBySku: Object.fromEntries(data.products.map((product) => [product.sku, product])),
    storesById: Object.fromEntries(data.stores.map((store) => [store.id, store])),
    peopleById: Object.fromEntries(data.people.map((person) => [person.id, person])),
  };
}

export function skusForStore(data, storeId) {
  const { productsBySku } = indexes(data);
  const seen = new Set();
  const skus = [];
  for (const invoice of data.invoices) {
    if (invoice.storeId !== storeId) continue;
    for (const line of invoice.lines) {
      if (seen.has(line.sku) || !productsBySku[line.sku]) continue;
      seen.add(line.sku);
      skus.push(line.sku);
    }
  }
  skus.sort((a, b) => {
    const left = CATEGORY_ORDER.indexOf(productsBySku[a].category);
    const right = CATEGORY_ORDER.indexOf(productsBySku[b].category);
    return left - right || a.localeCompare(b);
  });
  return skus;
}

export function agendaFor(data, visits, visitDate = data.demoToday) {
  const { productsBySku, storesById } = indexes(data);
  return data.people
    .filter((person) => person.role === "promoter")
    .flatMap((promoter) => buildAgenda({
      promoterId: promoter.id,
      date: visitDate,
      routes: data.routes,
      storesById,
      productsBySku,
      invoices: data.invoices,
      visits,
      stockouts: data.stockouts,
    }));
}

export function weekSchedule(data) {
  const start = startOfIsoWeek(data.demoToday);
  const dates = eachDate(start, addDays(start, 5));
  const stops = [];
  for (const day of dates) {
    for (const person of data.people) {
      if (person.role !== "promoter") continue;
      stops.push(...scheduledStops(data.routes, person.id, day));
    }
  }
  return stops;
}

export function defaultCounts(data, storeId) {
  const preset = data.shelfPresets?.[storeId] || {};
  const { productsBySku } = indexes(data);
  return skusForStore(data, storeId).map((sku) => {
    const product = productsBySku[sku];
    const custom = preset[sku] || {};
    return {
      sku,
      onHand: custom.onHand ?? product.facings * 2,
      facings: custom.facings ?? product.facings,
      reason: custom.reason || null,
    };
  });
}

const AUDIT_KINDS = {
  store_super_ribeiro: "healthy",
  store_hortifruti: "poor",
  store_serra_clara: "mixed",
  store_atacado_porto: "healthy",
};

function countsForKind(data, storeId, kind) {
  const { productsBySku } = indexes(data);
  return skusForStore(data, storeId).map((sku) => {
    const product = productsBySku[sku];
    if (kind === "poor" && (sku === "VV-BLM-200" || sku === "VV-REQ-220")) {
      return { sku, onHand: 0, facings: 0 };
    }
    if (kind === "mixed" && sku === "VV-LEZ-1000") return { sku, onHand: 0, facings: 0 };
    if (kind === "mixed" && sku === "VV-FRE-500") return { sku, onHand: 3, facings: 2 };
    return { sku, onHand: product.facings * 2, facings: product.facings };
  });
}

export function seedAudits(data) {
  const { storesById, peopleById } = indexes(data);
  const manager = data.people.find((person) => person.role === "manager");
  const audits = [];
  for (const [storeId, kind] of Object.entries(AUDIT_KINDS)) {
    const visit = [...data.visits].reverse().find((row) => row.storeId === storeId && row.status === "completed");
    if (!visit) continue;
    const store = storesById[storeId];
    const seller = peopleById[store.sellerId];
    const input = {
      storeId,
      storeName: store.name,
      visitId: visit.id,
      locale: "pt",
      products: data.products,
      counts: countsForKind(data, storeId, kind),
      stockouts: kind === "poor"
        ? [
          { sku: "VV-BLM-200", reason: "shelf" },
          { sku: "VV-REQ-220", reason: "space" },
        ]
        : kind === "mixed"
          ? [{ sku: "VV-LEZ-1000", reason: "supplier" }]
          : [],
      keyAccount: store.keyAccount,
      recipients: [manager.email, seller.email],
      lot: null,
    };
    const audit = buildMockAudit(input);
    audits.push({
      id: `aud_${storeId}`,
      storeId,
      visitId: visit.id,
      promoterId: visit.promoterId,
      sellerId: store.sellerId,
      createdAt: `${visit.date}T18:00:00Z`,
      servedBy: "server",
      source: audit.source,
      model: audit.model,
      photoReceived: false,
      input,
    });
  }
  return audits;
}

export function coverage(schedule, visits, demoToday) {
  const planned = schedule.filter((stop) => stop.date <= demoToday);
  const done = new Set(
    visits.filter((visit) => visit.status === "completed").map((visit) => visit.stopId),
  );
  const completed = planned.filter((stop) => done.has(stop.id)).length;
  return {
    planned: planned.length,
    completed,
    ratio: planned.length ? completed / planned.length : 0,
  };
}

export function loadDemo() {
  return {
    fixture,
    visits: fixture.visits.map((visit) => ({ ...visit })),
    audits: seedAudits(fixture),
    agenda: agendaFor(fixture, fixture.visits),
    schedule: weekSchedule(fixture),
  };
}

export { fixture };
