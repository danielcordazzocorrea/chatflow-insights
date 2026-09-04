-- Instruções personalizadas, por proprietário, para melhorar mensagens do chat.
CREATE TABLE public.ai_rewrite_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  system_message text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_rewrite_system_message_length CHECK (char_length(system_message) <= 4000)
);

ALTER TABLE public.ai_rewrite_settings ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_rewrite_settings TO authenticated;
GRANT ALL ON public.ai_rewrite_settings TO service_role;

CREATE POLICY "Owners manage own AI rewrite settings"
  ON public.ai_rewrite_settings
  FOR ALL
  TO authenticated
  USING (user_id = (SELECT auth.uid()) AND (SELECT public.is_owner()))
  WITH CHECK (user_id = (SELECT auth.uid()) AND (SELECT public.is_owner()));

