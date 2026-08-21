# Campaign Edge Functions

Todos os endpoints aceitam `POST`, exigem o bearer token do usuário autenticado
e só operam em campanhas cujo `created_by` corresponde a esse usuário.

## `create-campaign`

Cria a campanha no banco, sempre com status inicial `rascunho`.

```json
{
  "nome": "Reativação de agosto",
  "descricao": "Clientes inativos",
  "tipo": 0
}
```

`tipo` é `0` para campanhas de interação e `1` para campanhas de link.

## `add-campaign-contacts`

```json
{
  "campanha_id": 42,
  "contatos": [
    { "nome": "Ana", "telefone": "+55 11 99999-9999" },
    { "nome": "Bruno", "bsuid": "business-scoped-user-id" }
  ]
}
```

Aceita até 1.000 contatos por requisição. Cada contato começa em `etapa = 0`.

## `submit-meta-template`

Submete um modelo à Meta e, se aceito, salva o modelo e seu status na campanha.

```json
{
  "campanha_id": 42,
  "template": {
    "name": "reativacao_agosto",
    "language": "pt_BR",
    "category": "MARKETING",
    "components": [{ "type": "BODY", "text": "Olá {{1}}, temos uma novidade para você." }],
    "allow_category_change": true
  }
}
```

## `upload-meta-template-media`

Recebe `multipart/form-data` com `campanha_id` e `file`, faz o upload resumível
da imagem, vídeo ou PDF para a Meta e devolve o `header_handle` exigido pelo
componente `HEADER` do template.

## `trigger-campaign`

Não envia mensagens. Valida a campanha, conta os contatos da etapa escolhida e
envia ao webhook do n8n a campanha, a etapa e o template selecionado.

```json
{
  "campanha_id": 42,
  "etapa": 0,
  "template_id": "123456789"
}
```

`template_id` é opcional; sem ele, usa o último template salvo. O n8n deve
consultar `envio_em_massa` por `campanha_id` e `etapa`, realizar os disparos e
atualizar o banco. O webhook contém uma `Idempotency-Key` única para evitar
processamento duplicado. O receptor também deve validar obrigatoriamente o header
`X-Webhook-Secret` antes de processar o payload.

## Secrets

```sh
supabase secrets set WHATSAPP_TOKEN=...
supabase secrets set WHATSAPP_BUSINESS_ACCOUNT_ID=...
supabase secrets set META_APP_ID=...
supabase secrets set N8N_CAMPAIGN_WEBHOOK_URL=...
supabase secrets set N8N_CAMPAIGN_WEBHOOK_SECRET=...
```

`WHATSAPP_API_VERSION` é opcional e usa `v23.0` por padrão.
`N8N_CAMPAIGN_WEBHOOK_SECRET` é obrigatório para disparar campanhas.

## Deploy

```sh
supabase db push
supabase functions deploy create-campaign
supabase functions deploy add-campaign-contacts
supabase functions deploy submit-meta-template
supabase functions deploy upload-meta-template-media
supabase functions deploy trigger-campaign
```
