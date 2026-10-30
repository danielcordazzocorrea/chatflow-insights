import {
  authenticate,
  endpoint,
  firstStringFromDict,
  HttpError,
  json,
  readObject,
} from "../_shared/http.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const WEBHOOK_URL = "https://n8n.danielcordazzo.com.br/webhook/crm-ai-agent-v1";
const SESSION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

serve(
  endpoint(async (req) => {
    await authenticate(req);
    const body = await readObject(req);
    const message = typeof body.message === "string" ? body.message.trim() : "";
    const sessionId = typeof body.sessionId === "string" ? body.sessionId : "";
    if (!message || message.length > 4000) {
      throw new HttpError(400, "A mensagem deve ter entre 1 e 4000 caracteres");
    }
    if (!SESSION_ID.test(sessionId)) throw new HttpError(400, "Conversa inválida");

    const publishableKey =
      firstStringFromDict("SUPABASE_PUBLISHABLE_KEYS") ?? Deno.env.get("SUPABASE_ANON_KEY");
    if (!publishableKey) throw new HttpError(500, "Supabase não configurado");

    let response: Response;
    try {
      response = await fetch(WEBHOOK_URL, {
        method: "POST",
        headers: {
          Authorization: req.headers.get("Authorization") ?? "",
          apikey: publishableKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message, sessionId }),
        signal: AbortSignal.timeout(60_000),
      });
    } catch (error) {
      console.error("[crm-ai-chat] n8n unreachable", error);
      throw new HttpError(502, "O agente não está disponível agora");
    }

    const result = await response.json().catch(() => null);
    if (!response.ok || !result || typeof result.reply !== "string") {
      console.error("[crm-ai-chat] Invalid n8n response", response.status);
      throw new HttpError(502, "O agente não respondeu. Tente novamente.");
    }
    return json({ reply: result.reply, sessionId });
  }),
);
