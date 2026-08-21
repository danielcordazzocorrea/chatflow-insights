-- Relates every outbound campaign message to its campaign/contact so delivery
-- and read status webhooks can produce unambiguous campaign reports.
ALTER TABLE public.webhook_messages
  ADD COLUMN IF NOT EXISTS bsuid text NULL,
  ADD COLUMN IF NOT EXISTS campanha_id bigint NULL REFERENCES public.campanhas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS envio_em_massa_id bigint NULL REFERENCES public.envio_em_massa(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_webhook_messages_campanha
  ON public.webhook_messages (campanha_id, message_status);

CREATE INDEX IF NOT EXISTS idx_webhook_messages_envio_em_massa
  ON public.webhook_messages (envio_em_massa_id)
  WHERE envio_em_massa_id IS NOT NULL;
