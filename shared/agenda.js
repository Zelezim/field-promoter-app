import { addDays, diffDays, isoWeek, isoWeekday } from "./dates.js";
import {
  abcComponent,
  expiryComponent,
  keyAccountComponent,
  priorityScore,
  recencyComponent,
  stockoutComponent,
  volumeComponent,
} from "./score.js";

/**
 * A biweekly route runs when the ISO week parity matches `weekParity`
 * (0 = even weeks, 1 = odd weeks). Weekly routes ignore parity.
 */
export function routeRunsOn(route, isoDate) {
  if (route.weekday !== isoWeekday(isoDate)) return false;
  if (route.frequency === "weekly") return true;
  if (route.frequency === "biweekly") {
    return isoWeek(isoDate).week % 2 === route.weekParity;
  }
  return false;
}

export function scheduledStops(routes, promoterId, isoDate) {
  return routes
    .filter((route) => route.promoterId === promoterId && routeRunsOn(route, isoDate))
    .sort((a, b) => shiftRank(a.shift) - shiftRank(b.shift) || a.order - b.order)
    .map((route) => ({
      id: `${isoDate}:${promoterId}:${route.storeId}`,
      date: isoDate,
      promoterId,
      storeId: route.storeId,
      shift: route.shift,
      order: route.order,
      frequency: route.frequency,
    }));
}

function shiftRank(shift) {
  return shift === "afternoon" ? 1 : 0;
}

function lineRevenueCents(line) {
  if (Number.isInteger(line.revenueCents)) return line.revenueCents;
  return line.qty * line.unitPriceCents;
}

/** Invoiced value in cents over the 28 days before the visit (visit date excluded). */
export function storeVolumeCents(invoices, storeId, visitDate, windowDays = 28) {
  const start = addDays(visitDate, -windowDays);
  let total = 0;
  for (const invoice of invoices) {
    if (invoice.storeId !== storeId) continue;
    if (invoice.date < start || invoice.date >= visitDate) continue;
    for (const line of invoice.lines) total += lineRevenueCents(line);
  }
  return total;
}

export function daysSinceLastVisit(visits, storeId, visitDate) {
  let latest = null;
  for (const visit of visits) {
    if (visit.storeId !== storeId || visit.status !== "completed") continue;
    if (visit.date >= visitDate) continue;
    if (latest == null || visit.date > latest) latest = visit.date;
  }
  if (latest == null) return null;
  return diffDays(visitDate, latest);
}

export function stockoutEvents(stockouts, storeId, visitDate, windowDays = 14) {
  const start = addDays(visitDate, -windowDays);
  let count = 0;
  for (const event of stockouts) {
    if (event.storeId !== storeId) continue;
    if (event.date < start || event.date >= visitDate) continue;
    count += 1;
  }
  return count;
}

/**
 * Expiry is an estimate: latest invoice of each SKU before the visit, plus the
 * catalog shelf life. The worst (soonest) SKU drives the score. This is not a
 * scanned lot date.
 */
export function worstLot(invoices, productsBySku, storeId, visitDate, lookbackDays = 45) {
  const start = addDays(visitDate, -lookbackDays);
  const latestBySku = new Map();
  for (const invoice of invoices) {
    if (invoice.storeId !== storeId) continue;
    if (invoice.date < start || invoice.date >= visitDate) continue;
    for (const line of invoice.lines) {
      const prev = latestBySku.get(line.sku);
      if (!prev || invoice.date > prev) latestBySku.set(line.sku, invoice.date);
    }
  }
  let worst = null;
  for (const [sku, invoiceDate] of latestBySku) {
    const product = productsBySku[sku];
    if (!product) continue;
    const expiry = addDays(invoiceDate, product.shelfLifeDays);
    const daysLeft = diffDays(expiry, visitDate);
    if (!worst || daysLeft < worst.daysLeft) {
      worst = { sku, invoiceDate, expiry, daysLeft };
    }
  }
  return worst;
}

export function buildAgenda({
  promoterId,
  date,
  routes,
  storesById,
  productsBySku,
  invoices,
  visits,
  stockouts,
}) {
  const due = scheduledStops(routes, promoterId, date);
  const volumes = due.map((stop) => storeVolumeCents(invoices, stop.storeId, date));
  const min = volumes.length ? Math.min(...volumes) : 0;
  const max = volumes.length ? Math.max(...volumes) : 0;

  return due.map((stop, index) => {
    const store = storesById[stop.storeId];
    const days = daysSinceLastVisit(visits, stop.storeId, date);
    const events = stockoutEvents(stockouts, stop.storeId, date);
    const lot = worstLot(invoices, productsBySku, stop.storeId, date);
    const parts = {
      volume: volumeComponent(volumes[index], min, max),
      abc: abcComponent(store.abc),
      recency: recencyComponent(days),
      stockout: stockoutComponent(events),
      keyAccount: keyAccountComponent(store.keyAccount),
      expiry: expiryComponent(lot ? lot.daysLeft : null),
    };
    return {
      ...stop,
      volumeCents: volumes[index],
      daysSinceVisit: days,
      stockoutEvents14d: events,
      lot,
      parts,
      score: priorityScore(parts),
    };
  });
}
