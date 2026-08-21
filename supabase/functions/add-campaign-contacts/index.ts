import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import {
  authenticate,
  endpoint,
  HttpError,
  json,
  normalizePhone,
  readObject,
  requireOwnedCampaign,
} from "../_shared/http.ts";

type ContactInput = { telefone?: unknown; nome?: unknown; bsuid?: unknown };

serve(
  endpoint(async (req) => {
    const { user, admin } = await authenticate(req);
    const body = await readObject(req);
    const campaignId = Number(body.campanha_id);
    if (!Number.isSafeInteger(campaignId) || campaignId <= 0) {
      throw new HttpError(400, "campanha_id is invalid");
    }
    if (
      !Array.isArray(body.contatos) ||
      body.contatos.length === 0 ||
      body.contatos.length > 1000
    ) {
      throw new HttpError(400, "contatos must contain between 1 and 1000 items");
    }
    await requireOwnedCampaign(admin, campaignId, user.id);

    const seen = new Set<string>();
    const rows = body.contatos.map((raw, index) => {
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
        throw new HttpError(400, `contatos[${index}] is invalid`);
      }
      const contact = raw as ContactInput;
      const telefone = normalizePhone(contact.telefone);
      const bsuid = typeof contact.bsuid === "string" ? contact.bsuid.trim() || null : null;
      const nome =
        typeof contact.nome === "string" ? contact.nome.trim().slice(0, 160) || null : null;
      if (!telefone && !bsuid) {
        throw new HttpError(400, `contatos[${index}] requires a valid telefone or bsuid`);
      }
      const key = bsuid ? `b:${bsuid}` : `p:${telefone}`;
      if (seen.has(key)) throw new HttpError(400, `Duplicate contact at index ${index}`);
      seen.add(key);
      return { campanha_id: campaignId, telefone, bsuid, nome, etapa: 0 };
    });

    const { data, error } = await admin.from("envio_em_massa").insert(rows).select();
    if (error) {
      const conflict = error.code === "23505";
      throw new HttpError(
        conflict ? 409 : 500,
        conflict ? "A BSUID already belongs to the contact base" : "Could not add contacts",
        error.message,
      );
    }
    return json(
      { campaign_id: campaignId, inserted: data?.length ?? rows.length, contacts: data },
      201,
    );
  }),
);
