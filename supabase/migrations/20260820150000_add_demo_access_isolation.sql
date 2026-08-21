-- Isola visitantes demonstrativos dos dados e integrações reais.
CREATE TYPE public.access_role AS ENUM ('owner', 'demo');

CREATE TABLE public.access_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.access_role NOT NULL DEFAULT 'demo',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.access_profiles ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.access_profiles TO authenticated;
GRANT ALL ON public.access_profiles TO service_role;

-- Preserva como owner apenas a conta mais antiga já existente.
INSERT INTO public.access_profiles (user_id, role)
SELECT id, CASE
  WHEN id = (SELECT id FROM auth.users ORDER BY created_at, id LIMIT 1)
    THEN 'owner'::public.access_role
  ELSE 'demo'::public.access_role
END
FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.create_demo_access_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.access_profiles (user_id, role)
  VALUES (NEW.id, 'demo')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_access_profile ON auth.users;
CREATE TRIGGER on_auth_user_created_access_profile
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.create_demo_access_profile();

CREATE OR REPLACE FUNCTION public.is_owner()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.access_profiles
    WHERE user_id = auth.uid() AND role = 'owner'
  );
$$;

REVOKE ALL ON FUNCTION public.is_owner() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_owner() TO authenticated, service_role;

CREATE POLICY "Users read own access profile"
  ON public.access_profiles FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- Estas políticas são RESTRICTIVE: precisam ser satisfeitas junto das
-- políticas existentes, fechando inclusive acessos que antes usavam true.
CREATE POLICY "Owners only clientes"
  ON public.dados_cliente AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.is_owner()))
  WITH CHECK ((SELECT public.is_owner()));

CREATE POLICY "Owners only messages"
  ON public.webhook_messages AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.is_owner()))
  WITH CHECK ((SELECT public.is_owner()));

CREATE POLICY "Owners only AI config"
  ON public.configuracoes_ia AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.is_owner()))
  WITH CHECK ((SELECT public.is_owner()));

CREATE POLICY "Owners only campaigns"
  ON public.campanhas AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.is_owner()))
  WITH CHECK ((SELECT public.is_owner()));

CREATE POLICY "Owners only campaign contacts"
  ON public.envio_em_massa AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.is_owner()))
  WITH CHECK ((SELECT public.is_owner()));

CREATE POLICY "Owners only error log"
  ON public.tabela_erro AS RESTRICTIVE FOR SELECT TO authenticated
  USING ((SELECT public.is_owner()));
