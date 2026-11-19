/**
 * Next-day visit priority.
 *
 * The nightly job scores every stop already on the promoter's fixed route.
 * The route order does not change; the score says where to spend attention
 * if the day runs long.
 *
 * Weights (must sum to 1):
 *   0.30 volume shipped   trailing 28-day invoiced value, min-max on that day's route
 *   0.20 ABC curve        customer curve from the commercial master (A/B/C)
 *   0.15 days since visit capped at 21; never visited in the window = 1
 *   0.15 recent stock-out count over 14 days, capped at 3
 *   0.10 key account      1 or 0
 *   0.10 lot near expiry  estimated as invoice date + shelf life, horizon 20 days
 */

export const WEIGHTS = {
  volume: 0.3,
  abc: 0.2,
  recency: 0.15,
  stockout: 0.15,
  keyAccount: 0.1,
  expiry: 0.1,
};

export const ABC_SCORE = { A: 1, B: 0.6, C: 0.3 };

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/** One decimal place, half away from zero. Matches the Python ETL. */
export function round1(value) {
  const sign = value < 0 ? -1 : 1;
  return (sign * Math.floor(Math.abs(value) * 10 + 0.5)) / 10;
}

export function abcComponent(curve) {
  return ABC_SCORE[curve] ?? ABC_SCORE.C;
}

export function recencyComponent(daysSinceLastVisit, cap = 21) {
  if (daysSinceLastVisit == null) return 1;
  return clamp(daysSinceLastVisit / cap, 0, 1);
}

export function stockoutComponent(eventsInWindow, cap = 3) {
  return clamp((eventsInWindow ?? 0) / cap, 0, 1);
}

export function expiryComponent(daysLeft, horizon = 20) {
  if (daysLeft == null) return 0;
  return clamp((horizon - daysLeft) / horizon, 0, 1);
}

export function volumeComponent(volume, min, max) {
  if (max === min) return volume > 0 ? 1 : 0;
  return clamp((volume - min) / (max - min), 0, 1);
}

export function keyAccountComponent(isKey) {
  return isKey ? 1 : 0;
}

export function priorityScore(parts) {
  const raw =
    WEIGHTS.volume * parts.volume +
    WEIGHTS.abc * parts.abc +
    WEIGHTS.recency * parts.recency +
    WEIGHTS.stockout * parts.stockout +
    WEIGHTS.keyAccount * parts.keyAccount +
    WEIGHTS.expiry * parts.expiry;
  return round1(raw * 100);
}

export function contributions(parts) {
  return Object.keys(WEIGHTS).map((key) => ({
    key,
    weight: WEIGHTS[key],
    component: parts[key],
    points: round1(WEIGHTS[key] * parts[key] * 100),
  }));
}
