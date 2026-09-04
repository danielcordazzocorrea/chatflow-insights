-- Move as instruções para a configuração da IA automática consumida pelo n8n.
ALTER TABLE public.configuracoes_ia
  ADD COLUMN IF NOT EXISTS system_message text NOT NULL DEFAULT '';

ALTER TABLE public.configuracoes_ia
  DROP CONSTRAINT IF EXISTS configuracoes_ia_system_message_length;

ALTER TABLE public.configuracoes_ia
  ADD CONSTRAINT configuracoes_ia_system_message_length
  CHECK (char_length(system_message) <= 4000);

-- Preserva uma eventual configuração criada pela versão anterior da interface.
UPDATE public.configuracoes_ia
SET system_message = source.system_message
FROM (
  SELECT system_message
  FROM public.ai_rewrite_settings
  ORDER BY updated_at DESC
  LIMIT 1
) AS source
WHERE source.system_message <> '';

DROP TABLE public.ai_rewrite_settings;

