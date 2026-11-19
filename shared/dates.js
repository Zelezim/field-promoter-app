/** UTC date helpers. ISO dates never shift with the machine timezone. */

export function parseISODate(iso) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

export function formatISODate(date) {
  return date.toISOString().slice(0, 10);
}

export function addDays(iso, days) {
  const date = parseISODate(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return formatISODate(date);
}

export function diffDays(laterIso, earlierIso) {
  return Math.round((parseISODate(laterIso) - parseISODate(earlierIso)) / 86400000);
}

/** ISO weekday: Monday = 1 … Sunday = 7. */
export function isoWeekday(iso) {
  const day = parseISODate(iso).getUTCDay();
  return day === 0 ? 7 : day;
}

/** ISO week, aligned with Python datetime.date.isocalendar(). */
export function isoWeek(iso) {
  const target = parseISODate(iso);
  const weekday = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - weekday);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((target - yearStart) / 86400000 + 1) / 7);
  return { year: target.getUTCFullYear(), week };
}

export function startOfIsoWeek(iso) {
  return addDays(iso, 1 - isoWeekday(iso));
}

export function eachDate(startIso, endIso) {
  const dates = [];
  for (let cursor = startIso; cursor <= endIso; cursor = addDays(cursor, 1)) {
    dates.push(cursor);
  }
  return dates;
}
