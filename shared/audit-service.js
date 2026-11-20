import { buildMockAudit, DEFAULT_DAILY_QUOTA } from "./audit-core.js";
import { authenticate, consumeQuota, isUuid } from "./auth.js";

/**
 * Testable core of the Netlify function. The function file only reads
 * Netlify.env and returns a Response; every decision lives here.
 */

const SYSTEM = `You audit shelf execution for Vale Verde Dairy, a fictional brand.
Reply with one JSON object and no markdown. Keys:
executionScore (number 0-100),
planogramCompliance (number 0-1),
priceVisibility (number 0-1),
fefo ({compliant: boolean, notes: string}),
defects (array of {sku, name, type, severity, detail}),
opportunities (array of {sku, name, type, detail}),
swot ({strengths, weaknesses, opportunities, threats} arrays of strings),
expiryRisks (array of {sku, daysLeft, action}),
summary (string).
Use only stores, SKUs, and facts present in the user payload.`;

function json(body, status) {
  return { status, body };
}

export async function takeQuota(userId, env, fetchImpl = fetch) {
  const limit = Number(env.AI_DAILY_QUOTA || DEFAULT_DAILY_QUOTA);
  const canUseDatabase = Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY && isUuid(userId));
  if (!canUseDatabase) return consumeQuota(userId, limit);

  const response = await fetchImpl(`${env.SUPABASE_URL.replace(/\/$/, "")}/rest/v1/rpc/consume_ai_quota`, {
    method: "POST",
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ p_user: userId, p_limit: limit }),
  });
  if (response.ok) {
    const used = Number(await response.json());
    return { ok: true, used, limit, remaining: Math.max(limit - used, 0), source: "supabase" };
  }
  const detail = await response.text();
  if (detail.includes("quota_exceeded")) {
    return { ok: false, used: limit, limit, remaining: 0, source: "supabase" };
  }
  const error = new Error("quota_backend_failed");
  error.detail = detail.slice(0, 200);
  throw error;
}

async function openAiAudit(body, env, fetchImpl) {
  const model = env.OPENAI_MODEL || "gpt-4o-mini";
  const content = [{ type: "text", text: JSON.stringify({
    storeId: body.storeId,
    storeName: body.storeName,
    locale: body.locale,
    counts: body.counts,
    stockouts: body.stockouts || [],
    lot: body.lot || null,
    keyAccount: Boolean(body.keyAccount),
  }) }];
  if (body.photoDataUrl) {
    content.push({ type: "image_url", image_url: { url: body.photoDataUrl } });
  }
  const response = await fetchImpl("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.OPENAI_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content },
      ],
    }),
  });
  if (!response.ok) {
    const detail = await response.text();
    const error = new Error(`openai_${response.status}`);
    error.detail = detail.slice(0, 240);
    throw error;
  }
  const payload = await response.json();
  const raw = payload.choices?.[0]?.message?.content || "{}";
  const parsed = JSON.parse(raw);
  return { source: "openai", model, storeId: body.storeId, storeName: body.storeName, ...parsed };
}

export async function handleAuditRequest(request, env, fetchImpl = fetch) {
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const auth = await authenticate(request.headers.get("authorization"), env);
  if (auth.error) return json({ error: auth.error }, auth.status);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }
  if (!body || typeof body.storeId !== "string" || !Array.isArray(body.counts) || body.counts.length > 40) {
    return json({ error: "invalid_payload" }, 400);
  }
  if (body.stockouts && (!Array.isArray(body.stockouts) || body.stockouts.length > 40)) {
    return json({ error: "invalid_payload" }, 400);
  }
  if (body.photoDataUrl && String(body.photoDataUrl).length > 1_500_000) {
    return json({ error: "photo_too_large" }, 413);
  }

  let quota;
  try {
    quota = await takeQuota(auth.user.sub, env, fetchImpl);
  } catch {
    return json({ error: "quota_backend_failed" }, 502);
  }
  if (!quota.ok) return json({ error: "quota_exceeded", quota }, 429);

  const provider = env.AI_PROVIDER || "mock";
  if (provider === "openai") {
    if (!env.OPENAI_API_KEY) return json({ error: "openai_key_missing", quota }, 503);
    try {
      const audit = await openAiAudit(body, env, fetchImpl);
      return json({ audit, quota }, 200);
    } catch (error) {
      return json({ error: "openai_failed", detail: error.message }, 502);
    }
  }

  const audit = buildMockAudit(body);
  return json({ audit, quota }, 200);
}
