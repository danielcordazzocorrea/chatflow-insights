import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { authenticate, endpoint, HttpError, json, readObject } from "../_shared/http.ts";

serve(
  endpoint(async (req) => {
    const { user, admin } = await authenticate(req);
    const body = await readObject(req);
    const nome = typeof body.nome === "string" ? body.nome.trim() : "";
    const descricao = typeof body.descricao === "string" ? body.descricao.trim() || null : null;
    const tipo = Number(body.tipo ?? 0);
    if (!nome || nome.length > 160)
      throw new HttpError(400, "nome must contain 1 to 160 characters");
    if (descricao && descricao.length > 2000) throw new HttpError(400, "descricao is too long");
    if (tipo !== 0 && tipo !== 1)
      throw new HttpError(400, "tipo must be 0 (interaction) or 1 (link)");

    const templatesMeta = body.templates_meta ?? null;
    if (
      templatesMeta !== null &&
      (typeof templatesMeta !== "object" || Array.isArray(templatesMeta))
    ) {
      throw new HttpError(400, "templates_meta must be an object");
    }

    const { data, error } = await admin
      .from("campanhas")
      .insert({
        nome,
        descricao,
        tipo,
        templates_meta: templatesMeta,
        created_by: user.id,
        status: "rascunho",
      })
      .select()
      .single();
    if (error) throw new HttpError(500, "Could not create campaign", error.message);
    return json({ campaign: data }, 201);
  }),
);
