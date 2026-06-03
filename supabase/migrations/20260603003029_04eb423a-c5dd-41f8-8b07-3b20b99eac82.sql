
CREATE TABLE IF NOT EXISTS public.webhook_messages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id      text UNIQUE NOT NULL,
  message_status  text,
  message_text    text,
  who_sent        text,
  telefone        text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.dados_cliente (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bsuid           text UNIQUE NOT NULL,
  telefone        text,
  nome            text,
  responded       text DEFAULT 'false',
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webhook_messages_telefone ON public.webhook_messages(telefone);
CREATE INDEX IF NOT EXISTS idx_webhook_messages_created_at ON public.webhook_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dados_cliente_telefone ON public.dados_cliente(telefone);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.webhook_messages TO authenticated;
GRANT ALL ON public.webhook_messages TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dados_cliente TO authenticated;
GRANT ALL ON public.dados_cliente TO service_role;

ALTER TABLE public.webhook_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dados_cliente ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read messages" ON public.webhook_messages FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert messages" ON public.webhook_messages FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update messages" ON public.webhook_messages FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated read clientes" ON public.dados_cliente FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert clientes" ON public.dados_cliente FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update clientes" ON public.dados_cliente FOR UPDATE TO authenticated USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.webhook_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.dados_cliente;
ALTER TABLE public.webhook_messages REPLICA IDENTITY FULL;
ALTER TABLE public.dados_cliente REPLICA IDENTITY FULL;
