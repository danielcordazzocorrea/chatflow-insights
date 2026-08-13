ALTER TABLE public.configuracoes_ia REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.configuracoes_ia;