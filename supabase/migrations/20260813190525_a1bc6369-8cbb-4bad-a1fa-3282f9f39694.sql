CREATE TABLE IF NOT EXISTS public.configuracoes_ia (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ia_global_ativa boolean NOT NULL DEFAULT true,
  singleton boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS configuracoes_ia_singleton_idx ON public.configuracoes_ia (singleton);

GRANT SELECT, INSERT, UPDATE ON public.configuracoes_ia TO authenticated;
GRANT ALL ON public.configuracoes_ia TO service_role;

ALTER TABLE public.configuracoes_ia ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read configuracoes_ia" ON public.configuracoes_ia;
DROP POLICY IF EXISTS "Authenticated insert configuracoes_ia" ON public.configuracoes_ia;
DROP POLICY IF EXISTS "Authenticated update configuracoes_ia" ON public.configuracoes_ia;
CREATE POLICY "Authenticated read configuracoes_ia" ON public.configuracoes_ia FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert configuracoes_ia" ON public.configuracoes_ia FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update configuracoes_ia" ON public.configuracoes_ia FOR UPDATE TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.set_updated_at_configuracoes_ia()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_configuracoes_ia_updated_at ON public.configuracoes_ia;
CREATE TRIGGER trg_configuracoes_ia_updated_at BEFORE UPDATE ON public.configuracoes_ia
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_configuracoes_ia();

INSERT INTO public.configuracoes_ia (ia_global_ativa) VALUES (true) ON CONFLICT DO NOTHING;
