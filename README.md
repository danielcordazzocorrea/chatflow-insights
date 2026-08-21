# Chatflow Insights — Whats·Ops

Painel operacional para atendimento, automação e campanhas no WhatsApp. A aplicação reúne indicadores, conversas, controle de IA e gestão de campanhas em uma interface React conectada ao Supabase e às APIs da Meta.

> O produto está em evolução contínua. Novas funcionalidades, integrações e melhorias operacionais serão adicionadas nas próximas versões.

## Funcionalidades atuais

- Autenticação por e-mail e senha com Supabase Auth.
- Dashboard com métricas de clientes, mensagens e atendimentos.
- Chat operacional com histórico, status de entrega e controle individual da IA.
- Controle global da automação de IA.
- Respeito à janela de atendimento de 24 horas da Meta.
- Campanhas com contatos, etapas, templates e acompanhamento de status.
- Upload de mídias e submissão de templates para a Meta.
- Integração com n8n para execução dos fluxos de automação.
- Atualizações em tempo real por Supabase Realtime.
- Ambiente demonstrativo com dados mockados e ações simuladas.

## Segurança e separação de contas

A aplicação diferencia dois níveis de acesso:

- `owner`: operador autorizado a acessar dados e integrações reais.
- `demo`: usuário demonstrativo, limitado a dados mockados e ações simuladas.

Novos usuários recebem `demo` automaticamente. A separação não depende apenas da interface: políticas Row Level Security do PostgreSQL bloqueiam as tabelas reais para contas demo, e as Edge Functions verificam o papel antes de usar credenciais privilegiadas ou chamar serviços externos.

Controles adicionais incluídos:

- apenas um perfil pode possuir o papel `owner`;
- usuários autenticados não podem promover o próprio perfil;
- secrets permanecem exclusivamente nas variáveis das Edge Functions;
- o frontend utiliza somente a chave pública do Supabase;
- headers de segurança e Content Security Policy são aplicados pela Vercel;
- Edge Functions aceitam chamadas de navegador somente do domínio oficial e do ambiente local;
- endpoints de campanha validam autenticação, propriedade e entradas;
- `.env` e metadados locais do Supabase não são versionados.

Consulte [security_best_practices_report.md](./security_best_practices_report.md) para o relatório técnico de segurança.

## Tecnologias

- React 19 e TypeScript
- Vite
- Tailwind CSS
- Supabase Auth, PostgreSQL, RLS, Realtime e Edge Functions
- React Router
- TanStack Query
- Recharts e Framer Motion
- n8n
- WhatsApp Cloud API / Meta Graph API
- Vercel

## Estrutura principal

```text
src/
  components/           componentes compartilhados e módulos visuais
  contexts/             contexto de autorização owner/demo
  integrations/         cliente e tipos do Supabase
  lib/                  utilitários e dados demonstrativos
  pages/                autenticação, dashboard, chat e campanhas
supabase/
  functions/            Edge Functions autenticadas
  migrations/           schema, RLS e regras de autorização
N8N/                    workflow de automação do WhatsApp
```

O workflow versionado é um template sanitizado: IDs de webhook, referências de
credenciais e o identificador do telefone foram removidos. Após importar o JSON,
reconecte manualmente cada credencial no n8n e configure o Phone Number ID.

## Configuração local

Requisitos:

- Node.js 20 ou superior
- npm
- projeto Supabase configurado

Instale as dependências:

```sh
npm ci
```

Copie `.env.example` para `.env` e configure somente as variáveis públicas do frontend:

```env
VITE_SUPABASE_PROJECT_ID="seu-project-id"
VITE_SUPABASE_PUBLISHABLE_KEY="sua-chave-publica"
VITE_SUPABASE_URL="https://seu-project-id.supabase.co"
```

Nunca coloque `service_role`, tokens da Meta, senhas ou secrets do n8n em variáveis prefixadas com `VITE_`: elas são incorporadas ao bundle público.

Inicie o ambiente de desenvolvimento:

```sh
npm run dev
```

## Comandos

```sh
npm run dev       # servidor local
npm run build     # build de produção
npm run preview   # prévia do build
npm run lint      # ESLint e Prettier
npm run format    # formatação do projeto
npm audit         # advisories das dependências npm
```

## Supabase

O projeto utiliza migrations como fonte de verdade do banco. Para aplicar migrations pendentes:

```sh
npx supabase db push
```

Os secrets das integrações devem ser cadastrados diretamente no Supabase:

```sh
npx supabase secrets set WHATSAPP_TOKEN=...
npx supabase secrets set WHATSAPP_PHONE_NUMBER_ID=...
npx supabase secrets set WHATSAPP_BUSINESS_ACCOUNT_ID=...
npx supabase secrets set META_APP_ID=...
npx supabase secrets set N8N_CAMPAIGN_WEBHOOK_URL=...
npx supabase secrets set N8N_CAMPAIGN_WEBHOOK_SECRET=...
```

`N8N_CAMPAIGN_WEBHOOK_SECRET` é obrigatório. O endpoint receptor no n8n deve
comparar `X-Webhook-Secret` antes de consultar contatos ou iniciar disparos.

Veja [supabase/functions/README.md](./supabase/functions/README.md) para os contratos dos endpoints e instruções de implantação.

## Deploy

O frontend está preparado para Vercel, incluindo fallback de rotas SPA e headers de segurança em `vercel.json`. Em produção:

1. configure as três variáveis `VITE_SUPABASE_*` no ambiente da Vercel;
2. aplique todas as migrations do Supabase;
3. configure os secrets das Edge Functions;
4. implante as funções necessárias;
5. confirme que o único perfil `owner` pertence ao operador autorizado;
6. execute o build e os testes de acesso anônimo/demo antes de liberar o endereço.

## Próximas funcionalidades

O roadmap poderá incluir, entre outras melhorias:

- autenticação multifator para o operador;
- relatórios e filtros avançados de campanhas;
- agendamento, pausa e retomada de disparos;
- gestão de templates e aprovações em tempo real;
- auditoria de ações administrativas;
- alertas operacionais e observabilidade;
- melhorias de acessibilidade e experiência mobile;
- novos canais, integrações e automações.

As prioridades poderão evoluir conforme o uso real do produto e as regras da plataforma WhatsApp.

## Boas práticas de contribuição

- Não versione arquivos `.env` ou credenciais.
- Crie migrations novas; não reescreva migrations já aplicadas em produção.
- Toda ação privilegiada deve ser autorizada no backend, nunca apenas escondida no frontend.
- Preserve o comportamento seguro por padrão: novos usuários devem continuar como `demo`.
- Rode `npm run build`, `npm run lint` e `npm audit` antes de publicar.

## Status

Versão operacional inicial. O projeto continuará recebendo novas features e aprimoramentos de segurança.
