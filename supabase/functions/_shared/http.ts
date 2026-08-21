// Shared helpers for authenticated campaign Edge Functions.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.106.2";

const allowedOrigins = new Set([
  "https://chatflow-insights.vercel.app",
  "http://localhost:8080",
  "http://127.0.0.1:8080",
]);

const isAllowedOrigin = (req: Request) => {
  const origin = req.headers.get("Origin");
  // Server-to-server clients such as n8n do not send a browser Origin header.
  return !origin || allowedOrigins.has(origin);
};

const withCors = (req: Request, response: Response) => {
  const headers = new Headers(response.headers);
  const origin = req.headers.get("Origin");
  if (origin && allowedOrigins.has(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Vary", "Origin");
  }
  headers.set("Access-Control-Allow-Headers", "authorization, x-client-info, apikey, content-type");
  headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
};

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const firstStringFromDict = (name: string): string | undefined => {
  const raw = Deno.env.get(name);
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed === "string" && parsed) return parsed;
    if (parsed && typeof parsed === "object") {
      return Object.values(parsed).find((value) => typeof value === "string" && value) as
        | string
        | undefined;
    }
  } catch {
    return raw;
  }
  return undefined;
};

export const authenticate = async (req: Request) => {
  const authorization = req.headers.get("Authorization");
  if (!authorization) throw new HttpError(401, "Missing Authorization header");

  const url = Deno.env.get("SUPABASE_URL");
  const publishableKey =
    firstStringFromDict("SUPABASE_PUBLISHABLE_KEYS") ?? Deno.env.get("SUPABASE_ANON_KEY");
  const secretKey =
    firstStringFromDict("SUPABASE_SECRET_KEYS") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !publishableKey || !secretKey) {
    throw new HttpError(500, "Supabase env not configured");
  }

  const authClient = createClient(url, publishableKey, {
    global: { headers: { Authorization: authorization } },
  });
  const { data, error } = await authClient.auth.getUser();
  if (error || !data.user) throw new HttpError(401, "Unauthorized");

  const admin = createClient(url, secretKey);
  const { data: profile, error: profileError } = await admin
    .from("access_profiles")
    .select("role")
    .eq("user_id", data.user.id)
    .maybeSingle();
  if (profileError) throw new HttpError(500, "Could not verify access role");
  if (profile?.role !== "owner") throw new HttpError(403, "Demo users cannot perform this action");

  return { user: data.user, admin };
};

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public detail?: unknown,
  ) {
    super(message);
  }
}

export const endpoint = (handler: (req: Request) => Promise<Response>) => async (req: Request) => {
  if (!isAllowedOrigin(req)) return json({ error: "Origin not allowed" }, 403);
  if (req.method === "OPTIONS") return withCors(req, new Response(null));
  if (req.method !== "POST") return withCors(req, json({ error: "Method not allowed" }, 405));
  try {
    return withCors(req, await handler(req));
  } catch (error) {
    if (error instanceof HttpError) {
      return withCors(
        req,
        json(
          { error: error.message, ...(error.detail ? { detail: error.detail } : {}) },
          error.status,
        ),
      );
    }
    console.error(error);
    return withCors(req, json({ error: "Internal error" }, 500));
  }
};

export const readObject = async (req: Request): Promise<Record<string, unknown>> => {
  try {
    const value = await req.json();
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error();
    return value;
  } catch {
    throw new HttpError(400, "Invalid JSON body");
  }
};

export const normalizePhone = (value: unknown): string | null => {
  if (typeof value !== "string" || !value.trim()) return null;
  const digits = value.replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 15 ? digits : null;
};

export const requireOwnedCampaign = async (
  admin: ReturnType<typeof createClient>,
  campaignId: number,
  userId: string,
) => {
  const { data, error } = await admin
    .from("campanhas")
    .select("id, nome, tipo, status, templates_meta, meta_templates_status")
    .eq("id", campaignId)
    .eq("created_by", userId)
    .maybeSingle();
  if (error) throw new HttpError(500, "Could not read campaign", error.message);
  if (!data) throw new HttpError(404, "Campaign not found");
  return data;
};
