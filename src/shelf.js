import { esc } from "./format.js";

const FILL = {
  cheese: "#E2B33C",
  butter: "#F3E2A4",
  requeijao: "#E7C4A4",
  drink: "#D4656A",
  milk: "#F7F1E4",
};

/** Diagrammatic shelf used as the sample photo. It is not a camera image. */
export function shelfDataUrl(counts, productsBySku) {
  const width = 640;
  const height = 400;
  const items = counts.slice(0, 8);
  const gap = 12;
  const left = 36;
  const usable = width - left * 2;
  const col = items.length ? (usable - gap * (items.length - 1)) / items.length : usable;
  const blocks = items.map((count, index) => {
    const product = productsBySku[count.sku];
    const facings = Number(count.facings || 0);
    const target = product?.facings || 4;
    const ratio = Math.max(0.08, Math.min(facings / target, 1));
    const h = 36 + ratio * 150;
    const x = left + index * (col + gap);
    const y = 250 - h;
    const fill = FILL[product?.category] || "#F7F1E4";
    const label = (product?.sku || count.sku).replace("VV-", "");
    return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${col.toFixed(1)}" height="${h.toFixed(1)}" rx="8" fill="${fill}" stroke="#12382A" stroke-opacity="0.25"/>
      <text x="${(x + col / 2).toFixed(1)}" y="${(y + h / 2).toFixed(1)}" text-anchor="middle" font-family="Georgia, serif" font-size="11" fill="#12382A">${esc(label)}</text>`;
  }).join("");
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="#E7F0EA"/>
  <rect x="24" y="250" width="592" height="18" rx="4" fill="#12382A"/>
  <rect x="24" y="300" width="592" height="18" rx="4" fill="#12382A"/>
  <text x="32" y="36" font-family="Georgia, serif" font-size="18" fill="#12382A">Vale Verde · sample shelf</text>
  <text x="32" y="58" font-family="Georgia, serif" font-size="12" fill="#3D5C4E">Diagram for the demo. Not a photograph.</text>
  ${blocks}
</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
