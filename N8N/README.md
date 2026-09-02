# Automações n8n

Modelos sanitizados e prontos para importação:

- `envio_em_massa_automatico.json`
- `whatsapp_automation.json`

Após importar no n8n:

1. Reconecte as credenciais do Supabase, Meta/WhatsApp, OpenAI e demais serviços usados pelos nós.
2. Substitua `CONFIGURE_PHONE_NUMBER_ID` pelo Phone Number ID da Meta.
3. No envio em massa, substitua `CONFIGURE_WEBHOOK_PATH` por um caminho exclusivo para o webhook.
4. Revise os parâmetros e publique o workflow somente depois de um teste controlado.

Os arquivos não incluem IDs dos workflows, IDs de nós, referências de credenciais, IDs de webhook, tokens ou identificadores da instância de origem.
