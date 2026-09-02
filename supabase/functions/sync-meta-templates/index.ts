import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { authenticate, endpoint, HttpError, json } from "../_shared/http.ts";

type MetaTemplate = {
  id?: string;
  name?: string;
  status?: string;
  language?: string;
  category?: string;
  components?: unknown[];
};

serve(
  endpoint(async (req) => {
    const { user, admin } = await authenticate(req);
    const token = Deno.env.get("WHATSAPP_TOKEN");
    const businessAccountId = Deno.env.get("WHATSAPP_BUSINESS_ACCOUNT_ID");
    const apiVersion = Deno.env.get("WHATSAPP_API_VERSION") ?? "v23.0";
    if (!token || !businessAccountId) {
      throw new HttpError(500, "WhatsApp template API env is not configured");
    }

    const response = await fetch(
      `https://graph.facebook.com/${apiVersion}/${businessAccountId}/message_templates?fields=id,name,status,language,category,components&limit=200`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new HttpError(response.status, "Could not read Meta templates", result);
    const metaTemplates = (Array.isArray(result.data) ? result.data : []) as MetaTemplate[];
    const byKey = new Map<string, MetaTemplate>();
    metaTemplates.forEach((template) => {
      if (template.id) byKey.set(String(template.id), template);
      if (template.name && template.language) {
        byKey.set(`${template.name}:${template.language}`, template);
      }
      if (template.name) byKey.set(template.name, template);
    });

    const { data: campaigns, error: campaignError } = await admin
      .from("campanhas")
      .select("id,templates_meta,meta_templates_status")
      .eq("created_by", user.id);
    if (campaignError) throw new HttpError(500, "Could not load campaigns", campaignError.message);

    let updated = 0;
    for (const campaign of campaigns ?? []) {
      const previous = Array.isArray(campaign.templates_meta)
        ? campaign.templates_meta
        : campaign.templates_meta
          ? [campaign.templates_meta]
          : [];
      let changed = false;
      const templates = previous.map((item) => {
        if (!item || typeof item !== "object" || Array.isArray(item)) return item;
        const local = item as Record<string, unknown>;
        const remote =
          byKey.get(String(local.meta_id ?? "")) ??
          byKey.get(`${String(local.name ?? "")}:${String(local.language ?? "pt_BR")}`) ??
          byKey.get(String(local.name ?? ""));
        if (!remote) return item;
        if (String(local.status ?? "") !== String(remote.status ?? "")) changed = true;
        return {
          ...local,
          meta_id: remote.id ?? local.meta_id,
          status: remote.status ?? local.status,
          category: remote.category ?? local.category,
          language: remote.language ?? local.language,
          components: remote.components ?? local.components,
          synced_at: new Date().toISOString(),
        };
      });
      if (changed) {
        const statuses = Object.fromEntries(
          templates
            .filter((item) => item && typeof item === "object" && !Array.isArray(item))
            .map((item) => {
              const value = item as Record<string, unknown>;
              return [
                String(value.meta_id ?? value.name),
                { name: value.name, status: value.status, updated_at: new Date().toISOString() },
              ];
            }),
        );
        const { error } = await admin
          .from("campanhas")
          .update({ templates_meta: templates, meta_templates_status: statuses })
          .eq("id", campaign.id);
        if (!error) updated++;
      }
    }

    const libraryUpdates = await Promise.all(
      metaTemplates.map((template) =>
        admin
          .from("templates_meta")
          .update({
            status: template.status ?? "PENDING",
            meta_id: template.id ?? null,
            payload: template,
            updated_at: new Date().toISOString(),
          })
          .eq("created_by", user.id)
          .eq("name", template.name ?? "")
          .eq("language", template.language ?? "pt_BR"),
      ),
    );
    const libraryUnavailable = libraryUpdates.some(
      ({ error }) => error?.code === "42P01" || error?.code === "PGRST205",
    );

    return json({
      templates: metaTemplates,
      campaigns_updated: updated,
      library_unavailable: libraryUnavailable,
    });
  }),
);
