-- Replace legacy campaign message placeholders with the actual Meta template
-- body so existing outbound messages render correctly in the chat.
UPDATE public.webhook_messages AS message
SET message_text = replace(
  body.component ->> 'text',
  '{{1}}',
  COALESCE(NULLIF(contact.nome, ''), 'Cliente')
)
FROM public.envio_em_massa AS contact
JOIN public.campanha_templates AS campaign_template
  ON campaign_template.campanha_id = contact.campanha_id
JOIN public.templates_meta AS template
  ON template.id = campaign_template.template_id
CROSS JOIN LATERAL (
  SELECT component
  FROM jsonb_array_elements(COALESCE(template.payload -> 'components', '[]'::jsonb)) AS component
  WHERE upper(component ->> 'type') = 'BODY'
  LIMIT 1
) AS body
WHERE message.envio_em_massa_id = contact.id
  AND message.campanha_id = contact.campanha_id
  AND message.message_text = '[template] ' || template.name;
