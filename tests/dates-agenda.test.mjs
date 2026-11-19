import assert from "node:assert/strict";
import test from "node:test";
import { buildAgenda, routeRunsOn, stockoutEvents } from "../shared/agenda.js";
import { isoWeek, isoWeekday } from "../shared/dates.js";
import { loadDemo } from "../shared/demo.js";

test("demo clock is Thursday of ISO week 47", () => {
  assert.equal(isoWeekday("2026-11-19"), 4);
  assert.deepEqual(isoWeek("2026-11-19"), { year: 2026, week: 47 });
});

test("biweekly routes follow ISO week parity", () => {
  const route = {
    weekday: 4,
    frequency: "biweekly",
    weekParity: 1,
    promoterId: "p",
    storeId: "s",
    shift: "morning",
    order: 1,
  };
  assert.equal(routeRunsOn(route, "2026-11-19"), true);
  assert.equal(routeRunsOn(route, "2026-11-12"), false);
  assert.equal(routeRunsOn({ ...route, frequency: "weekly" }, "2026-11-12"), true);
  assert.equal(routeRunsOn({ ...route, weekday: 1 }, "2026-11-19"), false);
});

test("volume is normalized only across stores due that day", () => {
  const stores = {
    big: { id: "big", abc: "A", keyAccount: false },
    small: { id: "small", abc: "C", keyAccount: false },
  };
  const products = { MILK: { sku: "MILK", shelfLifeDays: 180 } };
  const routes = [
    { promoterId: "p", storeId: "big", weekday: 4, shift: "morning", order: 1, frequency: "weekly", weekParity: 0 },
    { promoterId: "p", storeId: "small", weekday: 4, shift: "morning", order: 2, frequency: "weekly", weekParity: 0 },
    { promoterId: "p", storeId: "small", weekday: 3, shift: "morning", order: 1, frequency: "weekly", weekParity: 0 },
  ];
  const invoices = [
    { id: "1", date: "2026-11-10", storeId: "big", sellerId: "s", lines: [{ sku: "MILK", qty: 10, unitPriceCents: 100, revenueCents: 1000 }] },
    { id: "2", date: "2026-11-10", storeId: "small", sellerId: "s", lines: [{ sku: "MILK", qty: 1, unitPriceCents: 100, revenueCents: 100 }] },
  ];
  const stops = buildAgenda({
    promoterId: "p",
    date: "2026-11-19",
    routes,
    storesById: stores,
    productsBySku: products,
    invoices,
    visits: [],
    stockouts: [],
  });
  assert.deepEqual(stops.map((stop) => stop.storeId), ["big", "small"]);
  assert.equal(stops[0].parts.volume, 1);
  assert.equal(stops[1].parts.volume, 0);
  assert.equal(stops[0].parts.recency, 1);
});

test("stock-out window ignores events before the 14 days and on the visit date", () => {
  const events = [
    { storeId: "s", date: "2026-11-05", sku: "A", reason: "shelf" },
    { storeId: "s", date: "2026-11-04", sku: "A", reason: "shelf" },
    { storeId: "s", date: "2026-11-19", sku: "A", reason: "shelf" },
  ];
  assert.equal(stockoutEvents(events, "s", "2026-11-19"), 1);
});

test("Camila's Thursday route tells the fictional story", () => {
  const demo = loadDemo();
  const stops = demo.agenda.filter((stop) => stop.promoterId === "promo_camila");
  const byStore = Object.fromEntries(stops.map((stop) => [stop.storeId, stop]));
  assert.equal(stops.length, 7);
  assert.equal(byStore.store_serra_clara.daysSinceVisit, 3);
  assert.equal(byStore.store_serra_clara.stockoutEvents14d, 2);
  assert.equal(byStore.store_serra_clara.lot.daysLeft, 6);
  assert.equal(byStore.store_padaria_aurora.daysSinceVisit, 1);
  assert.equal(byStore.store_vila_aurora.daysSinceVisit, null);
  assert.equal(byStore.store_emporio_flores.frequency, "biweekly");
  assert.equal(byStore.store_emporio_flores.daysSinceVisit, 14);
  assert.ok(byStore.store_serra_clara.score > 70);
  assert.ok(byStore.store_padaria_aurora.score < 15);
  assert.ok(byStore.store_serra_clara.score > byStore.store_super_ribeiro.score);
  assert.ok(byStore.store_super_ribeiro.score > byStore.store_hortifruti.score);
  for (const stop of stops) {
    assert.ok(stop.score >= 0 && stop.score <= 100);
  }
});
