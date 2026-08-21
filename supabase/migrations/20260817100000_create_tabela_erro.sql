CREATE TABLE IF NOT EXISTS public.tabela_erro (
  id bigserial NOT NULL,
  mensagem text NULL,
  telefone text NULL,
  created_at timestamp with time zone NULL DEFAULT now(),
  id_campanha bigint NULL,
  CONSTRAINT tabela_erro_pkey PRIMARY KEY (id)
) TABLESPACE pg_default;

GRANT SELECT ON public.tabela_erro TO authenticated;
GRANT ALL ON public.tabela_erro TO service_role;
GRANT ALL ON SEQUENCE public.tabela_erro_id_seq TO service_role;

ALTER TABLE public.tabela_erro ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for all users" ON public.tabela_erro;
CREATE POLICY "Enable read access for all users"
ON public.tabela_erro
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (true);
