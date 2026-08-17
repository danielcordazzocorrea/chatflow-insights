CREATE OR REPLACE FUNCTION public.enforce_message_status_forward()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  rank_atual int;
  rank_novo int;
BEGIN
  rank_atual := CASE COALESCE(OLD.message_status, '')
    WHEN 'accepted' THEN 1
    WHEN 'sent' THEN 2
    WHEN 'delivered' THEN 3
    WHEN 'read' THEN 4
    WHEN 'failed' THEN 5
    ELSE 0
  END;

  rank_novo := CASE COALESCE(NEW.message_status, '')
    WHEN 'accepted' THEN 1
    WHEN 'sent' THEN 2
    WHEN 'delivered' THEN 3
    WHEN 'read' THEN 4
    WHEN 'failed' THEN 5
    ELSE 0
  END;

  IF rank_novo < rank_atual THEN
    NEW.message_status := OLD.message_status;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_webhook_messages_status_forward ON public.webhook_messages;

CREATE TRIGGER trg_webhook_messages_status_forward
  BEFORE UPDATE OF message_status ON public.webhook_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_message_status_forward();
