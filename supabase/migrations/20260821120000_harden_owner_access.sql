-- SEC-001: keep the privileged role singular and prevent direct invocation of
-- the auth trigger helper. New accounts must always remain demo by default.
CREATE UNIQUE INDEX IF NOT EXISTS access_profiles_single_owner_idx
  ON public.access_profiles (role)
  WHERE role = 'owner'::public.access_role;

REVOKE ALL ON FUNCTION public.create_demo_access_profile() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_demo_access_profile() FROM anon, authenticated;

-- Reassert least privilege explicitly in case grants changed outside migrations.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.access_profiles FROM anon, authenticated;
GRANT SELECT ON public.access_profiles TO authenticated;
