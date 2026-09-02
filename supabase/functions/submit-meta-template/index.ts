import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import {
  authenticate,
  endpoint,
  HttpError,
  json,
  readObject,
  requireOwnedCampaign,
} from "../_shared/http.ts";

const categories = new Set(["AUTHENTICATION", "MARKETING", "UTILITY"]);

serve(
  endpoint(async (req) => {
    const { user, admin } = await authenticate(req);
    const body = await readObject(req);
    const campaignId = Number(body.campanha_id);
    if (!Number.isSafeInteger(campaignId) || campaignId <= 0) {
      throw new HttpError(400, "campanha_id is invalid");
    }
    const campaign = await requireOwnedCampaign(admin, campaignId, user.id);

    if (!body.template || typeof body.template !== "object" || Array.isArray(body.template)) {
      throw new HttpError(400, "template must be an object");
    }
    const template = body.template as Record<string, unknown>;
    const name = typeof template.name === "string" ? template.name.trim() : "";
    const language = typeof template.language === "string" ? template.language.trim() : "";
    const category = typeof template.category === "string" ? template.category.toUpperCase() : "";
    if (!/^[a-z0-9_]+$/.test(name)) {
      throw new HttpError(400, "template.name must use lowercase letters, numbers and underscores");
    }
    if (!language) throw new HttpError(400, "template.language is required");
    if (!categories.has(category)) {
      throw new HttpError(400, "template.category must be AUTHENTICATION, MARKETING or UTILITY");
    }
    if (!Array.isArray(template.components) || !template.components.length) {
      throw new HttpError(400, "template.components must be a non-empty array");
    }

    const token = Deno.env.get("WHATSAPP_TOKEN");
    const businessAccountId = Deno.env.get("WHATSAPP_BUSINESS_ACCOUNT_ID");
    const apiVersion = Deno.env.get("WHATSAPP_API_VERSION") ?? "v23.0";
    if (!token || !businessAccountId) {
      throw new HttpError(500, "WhatsApp template API env is not configured");
    }

    const metaPayload = {
      name,
      language,
      category,
      components: template.components,
      ...(typeof template.allow_category_change === "boolean"
        ? { allow_category_change: template.allow_category_change }
        : {}),
    };
    const response = await fetch(
      `https://graph.facebook.com/${apiVersion}/${businessAccountId}/message_templates`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(metaPayload),
      },
    );
    const meta = await response.json().catch(() => ({}));
    if (!response.ok) throw new HttpError(response.status, "Meta rejected the template", meta);

    const submittedAt = new Date().toISOString();
    const savedTemplate = {
      ...metaPayload,
      meta_id: meta.id ?? null,
      status: meta.status ?? "PENDING",
      submitted_at: submittedAt,
    };
    const { data: libraryTemplate, error: libraryError } = await admin
      .from("templates_meta")
      .upsert(
        {
          created_by: user.id,
          name,
          language,
          category,
          status: meta.status ?? "PENDING",
          meta_id: meta.id ? String(meta.id) : null,
          payload: savedTemplate,
          updated_at: submittedAt,
        },
        { onConflict: "created_by,name,language" },
      )
      .select()
      .single();
    const libraryUnavailable = libraryError?.code === "42P01" || libraryError?.code === "PGRST205";
    if (libraryError && !libraryUnavailable) {
      throw new HttpError(
        502,
        "Template created at Meta but could not be saved to library",
        libraryError.message,
      );
    }
    if (libraryTemplate) {
      const { error: linkError } = await admin
        .from("campanha_templates")
        .upsert(
          { campanha_id: campaignId, template_id: libraryTemplate.id },
          { onConflict: "campanha_id,template_id" },
        );
      if (linkError)
        throw new HttpError(
          502,
          "Template saved but could not be linked to campaign",
          linkError.message,
        );
    }
    const previousTemplates = Array.isArray(campaign.templates_meta)
      ? campaign.templates_meta
      : campaign.templates_meta
        ? [campaign.templates_meta]
        : [];
    const previousStatuses =
      campaign.meta_templates_status && typeof campaign.meta_templates_status === "object"
        ? campaign.meta_templates_status
        : {};
    const key = String(meta.id ?? name);
    const { data: updatedCampaign, error } = await admin
      .from("campanhas")
      .update({
        templates_meta: [...previousTemplates, savedTemplate],
        meta_templates_status: {
          ...previousStatuses,
          [key]: { name, status: meta.status ?? "PENDING", updated_at: submittedAt },
        },
      })
      .eq("id", campaignId)
      .eq("created_by", user.id)
      .select()
      .single();
    if (error) {
      return json(
        {
          error: "Template created at Meta but could not be saved locally",
          meta,
          detail: error.message,
        },
        502,
      );
    }
    return json(
      {
        template: savedTemplate,
        library_template: libraryTemplate,
        meta,
        campaign: updatedCampaign,
      },
      201,
    );
  }),
);
