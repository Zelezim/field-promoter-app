import { buildMockAudit, DEFAULT_DAILY_QUOTA } from "../shared/audit-core.js";

/**
 * Prefer the server function. On a static host (GitHub Pages, vite preview)
 * the route is missing and the same mock module runs in the browser.
 * A 429 is never replaced by a free local audit.
 */
export async function requestAudit(payload, token) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch("/api/ai-audit", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const text = await response.text();
    let data = null;
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
    if (!data || typeof data !== "object") return { offline: true };
    if (response.status === 429) return { error: "quota", quota: data.quota };
    if (!response.ok) return { error: data.error || "failed", status: response.status };
    return { audit: data.audit, quota: data.quota, offline: false };
  } catch {
    return { offline: true };
  } finally {
    clearTimeout(timer);
  }
}

export function deviceAudit(payload) {
  return { audit: buildMockAudit(payload), offline: true, quota: null };
}

export { DEFAULT_DAILY_QUOTA };
