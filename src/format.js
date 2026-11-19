import { addDays, parseISODate, startOfIsoWeek } from "../shared/dates.js";

export function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[char]);
}

export function formatMoney(cents, lang) {
  const amount = new Intl.NumberFormat(lang === "pt" ? "pt-BR" : "en-GB", {
    maximumFractionDigits: 0,
  }).format((cents || 0) / 100);
  return `R$\u00a0${amount}`;
}

export function formatLong(iso, lang) {
  return new Intl.DateTimeFormat(lang === "pt" ? "pt-BR" : "en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(parseISODate(iso));
}

export function formatDay(iso, lang) {
  return new Intl.DateTimeFormat(lang === "pt" ? "pt-BR" : "en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(parseISODate(iso));
}

export function weekRange(demoToday) {
  const start = startOfIsoWeek(demoToday);
  return { start, end: addDays(start, 5) };
}

export function scoreTone(score) {
  if (score >= 70) return "high";
  if (score >= 40) return "mid";
  return "low";
}

export function distanceMeters(lat1, lng1, lat2, lng2) {
  const radius = 6371000;
  const p1 = (lat1 * Math.PI) / 180;
  const p2 = (lat2 * Math.PI) / 180;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dLng / 2) ** 2;
  return 2 * radius * Math.asin(Math.sqrt(a));
}

export function formatDistance(meters) {
  if (!Number.isFinite(meters)) return "—";
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

export function productName(product, lang) {
  if (!product) return "";
  return lang === "en" && product.nameEn ? product.nameEn : product.name;
}

export function percent(value) {
  return `${Math.round((value || 0) * 100)}%`;
}
