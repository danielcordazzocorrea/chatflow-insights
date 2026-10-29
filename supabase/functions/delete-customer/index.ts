import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { authenticate, endpoint, HttpError, json, readObject } from "../_shared/http.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

serve(
  endpoint(async (req) => {
    const { admin } = await authenticate(req);
    const body = await readObject(req);
    if (body.confirm !== true) throw new HttpError(400, "Confirm customer deletion");

    const source = body.source;
    const id = body.id;
    let clientId: string | null = null;
    let campaignContactId: number | null = null;
    if (source === "client" && typeof id === "string" && UUID.test(id)) {
      clientId = id;
    } else if (source === "campaign_contact") {
      const numericId = Number(id);
      if (Number.isSafeInteger(numericId) && numericId > 0) campaignContactId = numericId;
    }
    if (!clientId && !campaignContactId) throw new HttpError(400, "Invalid customer identifier");

    const { data, error } = await admin.rpc("delete_customer_data", {
      p_client_id: clientId,
      p_campaign_contact_id: campaignContactId,
    });
    if (error?.code === "P0002") throw new HttpError(404, "Customer not found");
    if (error) throw new HttpError(500, "Could not delete customer", error.message);

    return json({ ok: true, deleted: data });
  }),
);
