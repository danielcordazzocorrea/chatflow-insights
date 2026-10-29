-- Called only by the owner-checked delete-customer Edge Function.
-- A single database transaction keeps the chat, campaigns and pipeline in sync.
CREATE OR REPLACE FUNCTION public.delete_customer_data(
  p_client_id uuid DEFAULT NULL,
  p_campaign_contact_id bigint DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_phone text;
  v_bsuid text;
  v_digits text;
  v_phone_key text;
  v_bsuids text[];
  v_messages integer := 0;
  v_campaign_contacts integer := 0;
  v_clients integer := 0;
  v_assignments integer := 0;
BEGIN
  IF (p_client_id IS NULL) = (p_campaign_contact_id IS NULL) THEN
    RAISE EXCEPTION 'Provide exactly one customer identifier' USING ERRCODE = '22023';
  END IF;

  IF p_client_id IS NOT NULL THEN
    SELECT telefone, bsuid INTO v_phone, v_bsuid
    FROM public.dados_cliente WHERE id = p_client_id;
  ELSE
    SELECT telefone, bsuid INTO v_phone, v_bsuid
    FROM public.envio_em_massa WHERE id = p_campaign_contact_id;
  END IF;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Customer not found' USING ERRCODE = 'P0002';
  END IF;

  v_digits := regexp_replace(COALESCE(v_phone, ''), '[^0-9]', '', 'g');
  v_phone_key := CASE
    WHEN length(v_digits) IN (10, 11) THEN '55' || v_digits
    ELSE v_digits
  END;

  SELECT ARRAY(
    SELECT DISTINCT bsuid FROM (
      SELECT v_bsuid AS bsuid
      UNION ALL
      SELECT c.bsuid FROM public.dados_cliente AS c
      WHERE v_phone_key <> '' AND CASE
        WHEN length(regexp_replace(COALESCE(c.telefone, ''), '[^0-9]', '', 'g')) IN (10, 11)
          THEN '55' || regexp_replace(c.telefone, '[^0-9]', '', 'g')
        ELSE regexp_replace(COALESCE(c.telefone, ''), '[^0-9]', '', 'g')
      END = v_phone_key
      UNION ALL
      SELECT c.bsuid FROM public.envio_em_massa AS c
      WHERE v_phone_key <> '' AND CASE
        WHEN length(regexp_replace(COALESCE(c.telefone, ''), '[^0-9]', '', 'g')) IN (10, 11)
          THEN '55' || regexp_replace(c.telefone, '[^0-9]', '', 'g')
        ELSE regexp_replace(COALESCE(c.telefone, ''), '[^0-9]', '', 'g')
      END = v_phone_key
    ) AS linked WHERE bsuid IS NOT NULL AND bsuid <> ''
  ) INTO v_bsuids;

  DELETE FROM public.webhook_messages AS m
  WHERE (
    v_phone_key <> ''
    AND CASE
      WHEN length(regexp_replace(COALESCE(m.telefone, ''), '[^0-9]', '', 'g')) IN (10, 11)
        THEN '55' || regexp_replace(m.telefone, '[^0-9]', '', 'g')
      ELSE regexp_replace(COALESCE(m.telefone, ''), '[^0-9]', '', 'g')
    END = v_phone_key
  ) OR m.bsuid = ANY(v_bsuids);
  GET DIAGNOSTICS v_messages = ROW_COUNT;

  DELETE FROM public.envio_em_massa AS c
  WHERE (
    v_phone_key <> ''
    AND CASE
      WHEN length(regexp_replace(COALESCE(c.telefone, ''), '[^0-9]', '', 'g')) IN (10, 11)
        THEN '55' || regexp_replace(c.telefone, '[^0-9]', '', 'g')
      ELSE regexp_replace(COALESCE(c.telefone, ''), '[^0-9]', '', 'g')
    END = v_phone_key
  ) OR c.bsuid = ANY(v_bsuids);
  GET DIAGNOSTICS v_campaign_contacts = ROW_COUNT;

  DELETE FROM public.dados_cliente AS c
  WHERE (
    v_phone_key <> ''
    AND CASE
      WHEN length(regexp_replace(COALESCE(c.telefone, ''), '[^0-9]', '', 'g')) IN (10, 11)
        THEN '55' || regexp_replace(c.telefone, '[^0-9]', '', 'g')
      ELSE regexp_replace(COALESCE(c.telefone, ''), '[^0-9]', '', 'g')
    END = v_phone_key
  ) OR c.bsuid = ANY(v_bsuids);
  GET DIAGNOSTICS v_clients = ROW_COUNT;

  DELETE FROM public.lead_pipeline_assignments AS a
  WHERE (v_phone_key <> '' AND a.lead_key = 'p:' || v_phone_key)
     OR EXISTS (
       SELECT 1 FROM unnest(v_bsuids) AS linked_bsuid(value)
       WHERE a.lead_key = 'b:' || linked_bsuid.value
     );
  GET DIAGNOSTICS v_assignments = ROW_COUNT;

  RETURN jsonb_build_object(
    'clients', v_clients,
    'campaign_contacts', v_campaign_contacts,
    'messages', v_messages,
    'pipeline_assignments', v_assignments
  );
END;
$$;

REVOKE ALL ON FUNCTION public.delete_customer_data(uuid, bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_customer_data(uuid, bigint) TO service_role;
