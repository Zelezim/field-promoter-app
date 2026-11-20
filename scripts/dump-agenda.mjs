import { loadDemo } from "../shared/demo.js";

const demo = loadDemo();
const stops = demo.agenda.map((stop) => ({
  id: stop.id,
  promoterId: stop.promoterId,
  storeId: stop.storeId,
  shift: stop.shift,
  score: stop.score,
  daysSinceVisit: stop.daysSinceVisit,
  stockoutEvents14d: stop.stockoutEvents14d,
  volumeCents: stop.volumeCents,
  parts: stop.parts,
  lot: stop.lot,
}));
process.stdout.write(`${JSON.stringify(stops)}\n`);
