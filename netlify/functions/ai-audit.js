import { handleAuditRequest } from "../../shared/audit-service.js";

/**
 * The browser sends the Supabase Auth JWT. The model key stays here.
 * With AI_PROVIDER unset or "mock", the response is the deterministic audit.
 * Set AI_PROVIDER=openai and OPENAI_API_KEY to call the vision model.
 * Quota prefers public.consume_ai_quota (service role) and falls back to
 * a process-local counter when that database is not configured.
 */
function env(name) {
  const value = Netlify.env.get(name);
  return value == null ? "" : value;
}

export default async (req) => {
  const result = await handleAuditRequest(req, {
    AI_PROVIDER: env("AI_PROVIDER") || "mock",
    OPENAI_API_KEY: env("OPENAI_API_KEY"),
    OPENAI_MODEL: env("OPENAI_MODEL") || "gpt-4o-mini",
    SUPABASE_JWT_SECRET: env("SUPABASE_JWT_SECRET"),
    SUPABASE_URL: env("SUPABASE_URL"),
    SUPABASE_SERVICE_ROLE_KEY: env("SUPABASE_SERVICE_ROLE_KEY"),
    ALLOW_DEMO_TOKENS: env("ALLOW_DEMO_TOKENS") || "true",
    AI_DAILY_QUOTA: env("AI_DAILY_QUOTA") || "20",
  });
  return new Response(JSON.stringify(result.body), {
    status: result.status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
};

export const config = {
  path: "/api/ai-audit",
  method: "POST",
};
