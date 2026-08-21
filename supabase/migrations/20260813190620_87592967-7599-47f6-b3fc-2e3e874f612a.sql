ALTER TABLE public.configuracoes_ia REPLICA IDENTITY FULL;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'configuracoes_ia') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.configuracoes_ia;
  END IF;
END
$$;
