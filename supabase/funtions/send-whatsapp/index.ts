// Edge Function: send-whatsapp
// Envia mensagem de texto via WhatsApp Cloud API e grava em webhook_messages.
//
// Secrets necessários (configure no Supabase):
//   supabase secrets set WHATSAPP_TOKEN=EAAG...
//   supabase secrets set WHATSAPP_PHONE_NUMBER_ID=123456789012345
//
// Credenciais lidas do sistema novo (SUPABASE_PUBLISHABLE_KEYS /
// SUPABASE_SECRET_KEYS) com fallback pras vars legadas durante a transição.

// @ts-expect-error -- Deno remote import resolved at runtime
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
// @ts-expect-error -- Deno remote import resolved at runtime
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

declare const Deno: { env: { get(key: string): string | undefined } };

// Lê do sistema novo (SUPABASE_PUBLISHABLE_KEYS / SUPABASE_SECRET_KEYS, que
// são dicionários JSON) e cai pras vars legadas se as novas não existirem.
const firstStringFromDict = (envVar: string): string | undefined => {
  const raw = Deno.env.get(envVar);
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed === "string" && parsed.length > 0) return parsed;
    if (typeof parsed === "object" && parsed !== null) {
      for (const value of Object.values(parsed)) {
        if (typeof value === "string" && value.length > 0) return value;
      }
    }
  } catch {
    return raw;
  }
  return undefined;
};
const getPublishableKey = () =>
  firstStringFromDict("SUPABASE_PUBLISHABLE_KEYS") ?? Deno.env.get("SUPABASE_ANON_KEY");
const getSecretKey = () =>
  firstStringFromDict("SUPABASE_SECRET_KEYS") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req: Request) => {
  try {
    return await handle(req);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    console.error("[send-whatsapp] uncaught:", msg, stack);
    return json({ error: "Internal error", detail: msg }, 500);
  }
});

const handle = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  // 1. Autenticação: exige JWT válido de usuário logado
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Missing Authorization header" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = getPublishableKey();
  console.log("[send-whatsapp] env check", {
    has_url: !!supabaseUrl,
    has_publishable: !!supabaseAnonKey,
    publishable_source: Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") ? "new" : "legacy",
    secret_source: Deno.env.get("SUPABASE_SECRET_KEYS") ? "new" : "legacy",
  });
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("[send-whatsapp] env missing");
    return json({ error: "Supabase env not configured" }, 500);
  }

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData?.user) {
    console.error("[send-whatsapp] auth failed:", userError?.message);
    return json({ error: "Unauthorized", detail: userError?.message }, 401);
  }

  // 2. Parse body
  let body: { telefone?: string; message?: string; bsuid?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }
  const telefone = (body.telefone ?? "").trim();
  const bsuid = (body.bsuid ?? "").trim();
  const message = (body.message ?? "").trim();
  if ((!telefone && !bsuid) || !message) {
    return json({ error: "telefone ou bsuid e message são obrigatórios" }, 400);
  }

  let toDigits = "";
  let canonicalPhone = "";
  if (telefone) {
    toDigits = telefone.replace(/\D/g, "");
    if (toDigits.length < 10) {
      return json({ error: "telefone inválido" }, 400);
    }
    // Normaliza pro formato canônico BR (sem 55, sem 9 do celular, 10 dígitos)
    const local = toDigits.startsWith("55") ? toDigits.slice(2) : toDigits;
    canonicalPhone = local.length === 11 && local[2] === "9"
      ? local.slice(0, 2) + local.slice(3)
      : local;
  }

  // 3. Checagem de opt-out (LGPD Art. 18 — direito de oposição).
  // Busca todas as linhas e compara em forma canônica de telefone OU match
  // direto de bsuid — garante bloqueio mesmo quando só temos um dos identificadores.
  const serviceKey = getSecretKey();
  if (serviceKey) {
    const adminClient = createClient(supabaseUrl, serviceKey);
    const { data: optOutRows } = await adminClient
      .from("phone_opt_outs")
      .select("telefone, bsuid, opted_out_at");
    const match = (optOutRows ?? []).find(
      (r: { telefone: string | null; bsuid: string | null; opted_out_at: string }) => {
        if (bsuid && r.bsuid && r.bsuid === bsuid) return true;
        if (!canonicalPhone || !r.telefone) return false;
        const d = r.telefone.replace(/\D/g, "");
        const local = d.startsWith("55") ? d.slice(2) : d;
        const canonical = local.length === 11 && local[2] === "9"
          ? local.slice(0, 2) + local.slice(3)
          : local;
        return canonical === canonicalPhone;
      },
    );
    if (match) {
      return json(
        {
          error: "Contato em opt-out",
          message:
            "Esse contato solicitou descadastramento e não pode receber mensagens.",
          opted_out_at: match.opted_out_at,
        },
        403,
      );
    }
  }

  // 4. WhatsApp Cloud API
  const waToken = Deno.env.get("WHATSAPP_TOKEN");
  const waPhoneId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
  if (!waToken || !waPhoneId) {
    console.error("[send-whatsapp] WHATSAPP_TOKEN/WHATSAPP_PHONE_NUMBER_ID missing");
    return json(
      { error: "WHATSAPP_TOKEN ou WHATSAPP_PHONE_NUMBER_ID não configurados" },
      500,
    );
  }

  // Envia com `to` (telefone) quando disponível, ou `recipient` (BSUID) caso
  // o contato tenha username e o telefone não esteja mais visível pra nós.
  // A Meta dá precedência ao `to` quando ambos vêm — então só mandamos um.
  const waPayload: Record<string, unknown> = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    type: "text",
    text: { preview_url: false, body: message },
  };
  if (telefone) {
    waPayload.to = toDigits;
  } else {
    waPayload.recipient = bsuid;
  }

  const waResponse = await fetch(
    `https://graph.facebook.com/v23.0/${waPhoneId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${waToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(waPayload),
    },
  );
  const waData = await waResponse.json().catch(() => ({}));
  if (!waResponse.ok) {
    console.error("[send-whatsapp] WA API error:", waResponse.status, JSON.stringify(waData));
    return json(
      {
        error: "WhatsApp API error",
        status: waResponse.status,
        detail: waData,
      },
      waResponse.status,
    );
  }
  const wamid: string | undefined = waData?.messages?.[0]?.id;
  // BSUID que a Meta devolve no envio — usar pra pareamento futuro.
  const returnedBsuid: string | undefined = waData?.contacts?.[0]?.user_id;

  // 5. Persistir em webhook_messages (service_role bypass RLS) e pareamento
  // telefone↔bsuid em envio_em_massa quando a Meta nos devolveu o BSUID.
  const persistedBsuid = returnedBsuid ?? (bsuid || null);
  if (serviceKey) {
    const adminClient = createClient(supabaseUrl, serviceKey);
    const { error: insertError } = await adminClient
      .from("webhook_messages")
      .insert({
        message_id: wamid ?? `manual-${crypto.randomUUID()}`,
        message_status: "sent",
        message_text: message,
        who_sent: "manual_response",
        telefone: telefone || null,
        bsuid: persistedBsuid,
      });
    if (insertError) {
      console.error("[send-whatsapp] insert webhook_messages:", insertError.message);
      // Mensagem foi enviada com sucesso ao WA, só não conseguimos gravar.
      // Retorna ok mas avisa.
      return json({ ok: true, wamid, warning: "insert failed", insertError }, 200);
    }

    // Backfill: se conhecemos esse telefone na base e ainda não tínhamos BSUID,
    // grava agora. Isso pareia a base ativa sem precisar de migração separada.
    if (returnedBsuid && telefone) {
      const { error: updateError } = await adminClient
        .from("envio_em_massa")
        .update({ bsuid: returnedBsuid })
        .eq("telefone", telefone)
        .is("bsuid", null);
      if (updateError) {
        console.warn("[send-whatsapp] backfill bsuid:", updateError.message);
      }
    }
  }

  return json({ ok: true, wamid, bsuid: persistedBsuid }, 200);
};
