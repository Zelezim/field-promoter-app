import { addDays } from "../shared/dates.js";
import { agendaFor, indexes, weekSchedule } from "../shared/demo.js";
import { fixture } from "../shared/demo.js";

export function derive(state) {
  const data = fixture;
  const idx = indexes(data);
  return {
    fixture: data,
    user: idx.peopleById[state.userId] || null,
    agenda: agendaFor(data, state.visits),
    schedule: weekSchedule(data),
    ...idx,
  };
}

export function activePromoterId(state, model) {
  if (!model.user) return null;
  if (model.user.role === "promoter") return model.user.id;
  return state.ui.promoterId || "promo_camila";
}

export function stockoutRows(state, model) {
  const start = addDays(model.fixture.demoToday, -14);
  const rows = model.fixture.stockouts.filter(
    (event) => event.date >= start && event.date <= model.fixture.demoToday,
  );
  for (const [stopId, draft] of Object.entries(state.drafts || {})) {
    const stop = model.agenda.find((item) => item.id === stopId);
    if (!stop) continue;
    for (const row of draft.stockouts || []) {
      rows.push({
        id: `live-${stopId}-${row.sku}`,
        date: model.fixture.demoToday,
        storeId: stop.storeId,
        sku: row.sku,
        reason: row.reason,
      });
    }
  }
  return rows;
}

export function isDone(state, stopId) {
  return state.visits.some((visit) => visit.stopId === stopId && visit.status === "completed");
}
