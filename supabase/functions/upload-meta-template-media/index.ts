import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { authenticate, endpoint, HttpError, json, requireOwnedCampaign } from "../_shared/http.ts";

const allowedTypes = new Set(["image/jpeg", "image/png", "video/mp4", "application/pdf"]);
const maxSize = 16 * 1024 * 1024;

serve(
  endpoint(async (req) => {
    const { user, admin } = await authenticate(req);
    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      throw new HttpError(400, "Expected multipart form data");
    }

    const campaignId = Number(form.get("campanha_id"));
    if (!Number.isSafeInteger(campaignId) || campaignId <= 0) {
      throw new HttpError(400, "campanha_id is invalid");
    }
    await requireOwnedCampaign(admin, campaignId, user.id);

    const file = form.get("file");
    if (!(file instanceof File)) throw new HttpError(400, "file is required");
    if (!allowedTypes.has(file.type)) throw new HttpError(400, "Unsupported media type");
    if (!file.size || file.size > maxSize) {
      throw new HttpError(400, "File must contain data and be at most 16 MB");
    }

    const token = Deno.env.get("WHATSAPP_TOKEN");
    const appId = Deno.env.get("META_APP_ID");
    const apiVersion = Deno.env.get("WHATSAPP_API_VERSION") ?? "v23.0";
    if (!token || !appId) throw new HttpError(500, "WHATSAPP_TOKEN or META_APP_ID is missing");

    const sessionUrl = new URL(`https://graph.facebook.com/${apiVersion}/${appId}/uploads`);
    sessionUrl.searchParams.set("file_length", String(file.size));
    sessionUrl.searchParams.set("file_type", file.type);
    sessionUrl.searchParams.set("file_name", file.name);
    const sessionResponse = await fetch(sessionUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    const session = await sessionResponse.json().catch(() => ({}));
    if (!sessionResponse.ok || !session.id) {
      throw new HttpError(
        sessionResponse.status || 502,
        "Could not create Meta upload session",
        session,
      );
    }

    const uploadResponse = await fetch(`https://graph.facebook.com/${apiVersion}/${session.id}`, {
      method: "POST",
      headers: {
        Authorization: `OAuth ${token}`,
        "Content-Type": file.type,
        file_offset: "0",
      },
      body: await file.arrayBuffer(),
    });
    const upload = await uploadResponse.json().catch(() => ({}));
    if (!uploadResponse.ok || !upload.h) {
      throw new HttpError(uploadResponse.status || 502, "Could not upload template media", upload);
    }

    return json({ handle: upload.h, mime_type: file.type, file_name: file.name });
  }),
);
