/** Supabase Auth JWT (HS256) plus a clearly marked demo token for the static showcase. */

function bytesToBase64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(value) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

export async function signHs256(payload, secret) {
  const header = bytesToBase64Url(new TextEncoder().encode(JSON.stringify({ alg: "HS256", typ: "JWT" })));
  const body = bytesToBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${header}.${body}`)),
  );
  return `${header}.${body}.${bytesToBase64Url(signature)}`;
}

export async function verifyHs256(token, secret) {
  const parts = String(token || "").split(".");
  if (parts.length !== 3) return null;
  const [header, body, signature] = parts;
  let signatureBytes;
  try {
    signatureBytes = base64UrlToBytes(signature);
  } catch {
    return null;
  }
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const ok = await crypto.subtle.verify(
    "HMAC",
    key,
    signatureBytes,
    new TextEncoder().encode(`${header}.${body}`),
  );
  if (!ok) return null;
  try {
    const payload = JSON.parse(new TextDecoder().decode(base64UrlToBytes(body)));
    if (payload.exp && payload.exp < Date.now() / 1000) return null;
    return payload;
  } catch {
    return null;
  }
}

const buckets = new Map();

export function resetQuota() {
  buckets.clear();
}

/** Process-local quota. Production should call public.consume_ai_quota instead. */
export function consumeQuota(userId, limit = 20, now = new Date()) {
  const day = now.toISOString().slice(0, 10);
  const key = `${userId}:${day}`;
  const used = buckets.get(key) ?? 0;
  if (used >= limit) return { ok: false, used, limit, remaining: 0 };
  const next = used + 1;
  buckets.set(key, next);
  return { ok: true, used: next, limit, remaining: limit - next };
}

export function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value || "");
}

/**
 * Demo tokens (`demo.<userId>`) work only while the real provider is off and
 * ALLOW_DEMO_TOKENS is not "false". A deployed stack with OpenAI rejects them.
 */
export async function authenticate(authorization, env) {
  const header = authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) return { error: "missing_token", status: 401 };

  const allowDemo = env.ALLOW_DEMO_TOKENS !== "false" && env.AI_PROVIDER !== "openai";
  if (token.startsWith("demo.")) {
    if (!allowDemo) return { error: "demo_token_rejected", status: 401 };
    const userId = token.slice("demo.".length);
    if (!userId) return { error: "missing_token", status: 401 };
    return { user: { sub: userId, role: "demo" } };
  }

  if (!env.SUPABASE_JWT_SECRET) return { error: "jwt_secret_not_configured", status: 401 };
  const payload = await verifyHs256(token, env.SUPABASE_JWT_SECRET);
  if (!payload?.sub) return { error: "invalid_token", status: 401 };
  return { user: payload };
}
