-- Reconcile replies received before the inbound n8n workflow started advancing
-- campaign contacts. Only contacts with an earlier outbound campaign message
-- and a later inbound client message are moved from stage 1 to stage 2.
UPDATE public.envio_em_massa AS contact
SET etapa = 2
WHERE contact.etapa = 1
  AND EXISTS (
    SELECT 1
    FROM public.webhook_messages AS outbound
    JOIN public.webhook_messages AS inbound
      ON inbound.who_sent = 'client'
     AND inbound.created_at >= outbound.created_at
    WHERE outbound.envio_em_massa_id = contact.id
      AND (
        regexp_replace(COALESCE(inbound.telefone, ''), '\D', '', 'g')
          = regexp_replace(COALESCE(contact.telefone, ''), '\D', '', 'g')
        OR regexp_replace(COALESCE(inbound.telefone, ''), '\D', '', 'g')
          = '55' || regexp_replace(COALESCE(contact.telefone, ''), '\D', '', 'g')
        OR regexp_replace(COALESCE(contact.telefone, ''), '\D', '', 'g')
          = '55' || regexp_replace(COALESCE(inbound.telefone, ''), '\D', '', 'g')
        OR (
          contact.bsuid IS NOT NULL
          AND inbound.bsuid = contact.bsuid
        )
      )
  );
