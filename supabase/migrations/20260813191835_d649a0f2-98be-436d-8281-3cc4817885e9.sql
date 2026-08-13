ALTER TABLE public.dados_cliente
ADD COLUMN IF NOT EXISTS ia_ativa boolean NOT NULL DEFAULT true;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dados_cliente TO authenticated;
GRANT ALL ON public.dados_cliente TO service_role;