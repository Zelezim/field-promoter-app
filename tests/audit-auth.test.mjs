import assert from "node:assert/strict";
import test from "node:test";
import { buildMockAudit, emailBody, presentAudit } from "../shared/audit-core.js";
import { handleAuditRequest } from "../shared/audit-service.js";
import { signHs256 } from "../shared/auth.js";
import { loadDemo } from "../shared/demo.js";

const baseEnv = {
  AI_PROVIDER: "mock",
  ALLOW_DEMO_TOKENS: "true",
  AI_DAILY_QUOTA: "3",
  SUPABASE_JWT_SECRET: "",
  OPENAI_API_KEY: "",
};

function request(body, authorization = "Bearer demo.promo_camila", method = "POST") {
  return new Request("http://local/api/ai-audit", {
    method,
    headers: { authorization, "content-type": "application/json" },
    body: method === "POST" ? JSON.stringify(body) : undefined,
  });
}

const payload = {
  storeId: "store_serra_clara",
  storeName: "Mercado Serra Clara",
  locale: "en",
  products: [{ sku: "VV-LEZ-1000", name: "Leite zero lactose 1L", nameEn: "Lactose-free milk 1L", category: "milk", facings: 3, shelfLifeDays: 120 }],
  counts: [{ sku: "VV-LEZ-1000", onHand: 0, facings: 0 }],
  stockouts: [{ sku: "VV-LEZ-1000", reason: "supplier" }],
  recipients: ["renata.pacheco@vale-verde.example", "otavio.lima@vale-verde.example"],
};

test("mock audit is deterministic and stays inside 0-100", () => {
  const first = buildMockAudit(payload);
  const second = buildMockAudit(payload);
  assert.deepEqual(first, second);
  assert.equal(first.source, "mock");
  assert.ok(first.executionScore >= 0 && first.executionScore <= 100);
  assert.equal(first.defects[0].type, "stockout");
  assert.match(emailBody(first), /does not send email/);
});

test("language toggle rebuilds a mock audit from its input", () => {
  const record = { source: "mock", input: payload, id: "aud_1", servedBy: "device" };
  assert.match(presentAudit(record, "pt").summary, /execução/);
  assert.match(presentAudit(record, "en").summary, /execution/);
});

test("seeded audits rank a healthy store above a poor one", () => {
  const demo = loadDemo();
  const byStore = Object.fromEntries(demo.audits.map((audit) => [audit.storeId, presentAudit(audit, "en")]));
  assert.ok(byStore.store_super_ribeiro.executionScore > byStore.store_hortifruti.executionScore);
  assert.ok(byStore.store_super_ribeiro.executionScore >= 90);
});

test("missing and demo tokens", async () => {
  const missing = await handleAuditRequest(request(payload, ""), baseEnv);
  assert.equal(missing.status, 401);
  const rejected = await handleAuditRequest(request(payload), { ...baseEnv, AI_PROVIDER: "openai", OPENAI_API_KEY: "sk-test" });
  assert.equal(rejected.status, 401);
  assert.equal(rejected.body.error, "demo_token_rejected");
});

test("quota blocks the fourth call and does not call the model", async () => {
  const user = `Bearer demo.quota_${Math.random().toString(16).slice(2)}`;
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    throw new Error("network");
  };
  for (let index = 0; index < 3; index += 1) {
    const result = await handleAuditRequest(request(payload, user), baseEnv, fetchImpl);
    assert.equal(result.status, 200, JSON.stringify(result.body));
    assert.equal(result.body.quota.remaining, 2 - index);
  }
  const blocked = await handleAuditRequest(request(payload, user), baseEnv, fetchImpl);
  assert.equal(blocked.status, 429);
  assert.equal(calls, 0);
});

test("HS256 Supabase token is accepted and an expired one is not", async () => {
  const secret = "test-secret";
  const env = { ...baseEnv, SUPABASE_JWT_SECRET: secret, ALLOW_DEMO_TOKENS: "false" };
  const token = await signHs256({ sub: "11111111-1111-4111-8111-111111111111", role: "promoter", exp: Math.floor(Date.now() / 1000) + 60 }, secret);
  const ok = await handleAuditRequest(request(payload, `Bearer ${token}`), env);
  assert.equal(ok.status, 200);
  const expired = await signHs256({ sub: "11111111-1111-4111-8111-111111111111", exp: Math.floor(Date.now() / 1000) - 10 }, secret);
  const denied = await handleAuditRequest(request(payload, `Bearer ${expired}`), env);
  assert.equal(denied.status, 401);
});

test("openai path requires a key and forwards the photo without logging it", async () => {
  const env = { ...baseEnv, AI_PROVIDER: "openai", OPENAI_API_KEY: "", SUPABASE_JWT_SECRET: "test-secret" };
  const token = await signHs256({ sub: "22222222-2222-4222-8222-222222222222", exp: Math.floor(Date.now() / 1000) + 60 }, "test-secret");
  const missing = await handleAuditRequest(request({ ...payload, photoDataUrl: "data:image/png;base64,aaaa" }, `Bearer ${token}`), env);
  assert.equal(missing.status, 503);

  let seen;
  const fetchImpl = async (url, options) => {
    seen = { url, authorization: options.headers.authorization, body: JSON.parse(options.body) };
    return new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify({ executionScore: 88, summary: "from model", defects: [], swot: { strengths: ["space"] } }) } }],
    }), { status: 200, headers: { "content-type": "application/json" } });
  };
  const result = await handleAuditRequest(
    request({ ...payload, photoDataUrl: "data:image/png;base64,bbbb" }, `Bearer ${token}`),
    { ...env, OPENAI_API_KEY: "sk-example" },
    fetchImpl,
  );
  assert.equal(result.status, 200);
  assert.equal(result.body.audit.source, "openai");
  assert.equal(result.body.audit.executionScore, 88);
  assert.equal(seen.authorization, "Bearer sk-example");
  assert.equal(seen.body.messages[1].content[1].image_url.url, "data:image/png;base64,bbbb");
  assert.equal(seen.url, "https://api.openai.com/v1/chat/completions");
});

test("database quota failure does not fall open", async () => {
  const env = {
    ...baseEnv,
    SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "service-role",
  };
  const tokenUser = "33333333-3333-4333-8333-333333333333";
  const fetchImpl = async () => new Response("quota_exceeded", { status: 400 });
  const blocked = await handleAuditRequest(request(payload, `Bearer demo.${tokenUser}`), env, fetchImpl);
  assert.equal(blocked.status, 429);

  const broken = async () => new Response("database offline", { status: 500 });
  const failed = await handleAuditRequest(request(payload, `Bearer demo.${tokenUser}`), env, broken);
  assert.equal(failed.status, 502);
});

test("oversized photo is rejected", async () => {
  const user = `Bearer demo.photo_${Math.random().toString(16).slice(2)}`;
  const result = await handleAuditRequest(request({ ...payload, photoDataUrl: "x".repeat(1_500_001) }, user), baseEnv);
  assert.equal(result.status, 413);
});
