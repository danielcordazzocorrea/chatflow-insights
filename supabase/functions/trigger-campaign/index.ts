import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import {
  authenticate,
  endpoint,
  HttpError,
  json,
  readObject,
  requireOwnedCampaign,
} from "../_shared/http.ts";

serve(
  endpoint(async (req) => {
    const { user, admin } = await authenticate(req);
    const body = await readObject(req);
    const campaignId = Number(body.campanha_id);
    const etapa = Number(body.etapa);
    if (!Number.isSafeInteger(campaignId) || campaignId <= 0) {
      throw new HttpError(400, "campanha_id is invalid");
    }
    if (!Number.isSafeInteger(etapa) || etapa < 0) {
      throw new HttpError(400, "etapa must be a non-negative integer");
    }

    const campaign = await requireOwnedCampaign(admin, campaignId, user.id);
    const { data: linkedTemplates, error: linkedTemplatesError } = await admin
      .from("campanha_templates")
      .select("templates_meta(*)")
      .eq("campanha_id", campaignId);
    const libraryUnavailable =
      linkedTemplatesError?.code === "42P01" || linkedTemplatesError?.code === "PGRST205";
    if (linkedTemplatesError && !libraryUnavailable) {
      throw new HttpError(500, "Could not load campaign templates", linkedTemplatesError.message);
    }
    const reusableTemplates = (linkedTemplates ?? [])
      .map((link) => link.templates_meta)
      .filter(Boolean)
      .map((item) => {
        const record = item as Record<string, unknown>;
        return {
          ...(record.payload && typeof record.payload === "object" ? record.payload : {}),
          library_id: record.id,
          meta_id: record.meta_id,
          name: record.name,
          language: record.language,
          category: record.category,
          status: record.status,
        };
      });
    const legacyTemplates = Array.isArray(campaign.templates_meta)
      ? campaign.templates_meta
      : campaign.templates_meta
        ? [campaign.templates_meta]
        : [];
    const templates = reusableTemplates.length ? reusableTemplates : legacyTemplates;
    const requestedTemplateId =
      typeof body.template_id === "string" || typeof body.template_id === "number"
        ? String(body.template_id)
        : null;
    const template = requestedTemplateId
      ? templates.find((item) => {
          if (!item || typeof item !== "object") return false;
          const value = item as Record<string, unknown>;
          return String(value.library_id ?? value.meta_id ?? value.name) === requestedTemplateId;
        })
      : templates[templates.length - 1];
    if (!template) throw new HttpError(409, "Campaign does not have the requested Meta template");
    const selectedTemplate = template as Record<string, unknown>;
    const templateStatus = String(selectedTemplate.status ?? "").toUpperCase();
    if (templateStatus && templateStatus !== "APPROVED") {
      throw new HttpError(409, `Template is not approved by Meta (status: ${templateStatus})`);
    }

    const { count, error: countError } = await admin
      .from("envio_em_massa")
      .select("id", { count: "exact", head: true })
      .eq("campanha_id", campaignId)
      .eq("etapa", etapa);
    if (countError)
      throw new HttpError(500, "Could not count campaign contacts", countError.message);
    if (!count) throw new HttpError(409, `Campaign has no contacts at etapa ${etapa}`);

    const webhookUrl = Deno.env.get("N8N_CAMPAIGN_WEBHOOK_URL");
    const webhookSecret = Deno.env.get("N8N_CAMPAIGN_WEBHOOK_SECRET");
    if (!webhookUrl) throw new HttpError(500, "N8N_CAMPAIGN_WEBHOOK_URL is missing");
    // SEC-005: campaign dispatch must never call an unauthenticated webhook.
    if (!webhookSecret) throw new HttpError(500, "N8N_CAMPAIGN_WEBHOOK_SECRET is missing");

    const eventId = crypto.randomUUID();
    const payload = {
      event: "campaign.dispatch.requested",
      event_id: eventId,
      requested_at: new Date().toISOString(),
      requested_by: user.id,
      campanha_id: campaignId,
      etapa,
      template,
      quantidade_contatos: count,
      campanha: { nome: campaign.nome, tipo: campaign.tipo, status: campaign.status },
    };
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": eventId,
        "Automation-Auth": webhookSecret,
      },
      body: JSON.stringify(payload),
    });
    const responseBody = await response.text();
    if (!response.ok) {
      console.error("campaign webhook rejected", {
        campanha_id: campaignId,
        etapa,
        template_id: requestedTemplateId,
        status: response.status,
        response: responseBody.slice(0, 500),
      });
      throw new HttpError(502, "n8n rejected the campaign trigger", {
        status: response.status,
        response: responseBody.slice(0, 2000),
      });
    }

    return json({
      ok: true,
      event_id: eventId,
      campanha_id: campaignId,
      etapa,
      quantidade_contatos: count,
      n8n_status: response.status,
    });
  }),
);
