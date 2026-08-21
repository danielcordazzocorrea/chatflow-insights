# Relatório de auditoria de segurança

Data: 21 de agosto de 2026
Escopo: React/Vite/TypeScript, Supabase Auth/PostgreSQL/RLS, Edge Functions/Deno, workflow n8n, dependências npm e configuração Vercel.

## Resumo executivo

Não foi encontrada vulnerabilidade crítica confirmada. A separação entre visitantes anônimos, contas `demo` e a conta `owner` possui controles no banco e nas Edge Functions, não apenas no frontend. Um teste remoto com a chave pública confirmou que as tabelas protegidas retornam zero linhas para acesso anônimo.

As correções desta auditoria adicionaram unicidade do papel `owner`, reduziram permissões da função interna de criação de perfil, adicionaram headers de segurança, fixaram a versão do SDK usado pelas Edge Functions e atualizaram dependências com advisories conhecidos.

O principal item pendente é operacional: confirmar no painel do Supabase que o único registro `owner` pertence à conta correta. A regra inicial escolheu o usuário mais antigo existente e não vinculou explicitamente o papel a um e-mail conhecido.

## Critical

Nenhum achado crítico confirmado.

## High

### SEC-001 — Identidade inicial do proprietário baseada na conta mais antiga

- Estado: parcialmente mitigado; conferência manual pendente.
- Local: `supabase/migrations/20260820150000_add_demo_access_isolation.sql`, linhas 14–22.
- Evidência: a carga inicial atribui `owner` ao primeiro usuário ordenado por `created_at`.
- Exploração: se outra conta fosse a mais antiga quando a migration foi aplicada, ela receberia acesso aos dados e integrações reais.
- Correção: confirmar no Dashboard do Supabase que o único `access_profiles.role = 'owner'` corresponde ao usuário autorizado. A migration `20260821120000_harden_owner_access.sql` passou a impedir mais de um `owner` e bloqueou alterações por usuários comuns.
- Mitigação adicional: ativar MFA para o operador e manter um procedimento administrativo documentado para troca do proprietário.

### SEC-002 — Dependências npm com advisories de alta severidade

- Estado: corrigido.
- Local: `package-lock.json`.
- Evidência: o audit inicial apontou vulnerabilidades em `react-router`, `postcss`, `js-yaml`, `brace-expansion` e `nanoid`.
- Exploração: dependendo do pacote e do contexto, entradas especialmente construídas poderiam causar negação de serviço, leitura indevida durante build ou problemas de roteamento.
- Correção implementada: `npm audit fix` atualizou versões compatíveis, incluindo React Router 7.18.2, PostCSS 8.5.26, js-yaml 4.3.1 e versões corrigidas das dependências transitivas.
- Resultado: nenhum advisory Critical, High ou Medium permaneceu.

## Medium

### SEC-003 — Ausência de MFA no fluxo da aplicação

- Estado: aberto.
- Local: `src/pages/Auth.tsx`, linhas 22–30.
- Evidência: o login aceita apenas e-mail e senha; não há matrícula ou exigência de nível AAL2.
- Exploração: uma senha reutilizada, vazada ou obtida por phishing permitiria assumir a sessão do `owner`.
- Correção proposta: implementar matrícula TOTP e exigir `aal2` para contas privilegiadas. Ativar CAPTCHA, senha forte e proteção contra senhas vazadas no Supabase.
- Mitigação: utilizar imediatamente uma senha longa, exclusiva e armazenada em gerenciador de senhas.

### SEC-004 — CORS permissivo nas Edge Functions

- Estado: aberto, risco reduzido pela autenticação bearer.
- Local: `supabase/functions/_shared/http.ts`, linhas 4–8; `supabase/functions/send-whatsapp/index.ts`, linhas 41–45.
- Evidência: `Access-Control-Allow-Origin: *`.
- Exploração: CORS não concede uma sessão por si só, mas permite que qualquer origem tente chamar os endpoints. Se um token for exposto a código malicioso, a política não cria uma barreira adicional.
- Correção proposta: configurar uma allowlist de origens de produção e desenvolvimento via secret, retornando o origin somente quando autorizado.
- Observação: não foi alterado nesta entrega porque a URL definitiva de produção não estava documentada, e um bloqueio incorreto interromperia a aplicação.

### SEC-005 — Secret do webhook n8n era opcional

- Estado: corrigido.
- Local: `supabase/functions/trigger-campaign/index.ts`, linhas 52–74.
- Evidência original: a função enviava `X-Webhook-Secret` apenas quando `N8N_CAMPAIGN_WEBHOOK_SECRET` existia.
- Exploração: se o webhook receptor for público e não exigir autenticação própria, terceiros que descobrirem sua URL podem tentar acionar campanhas diretamente.
- Correção implementada: a Edge Function agora falha de forma segura quando o secret não existe e sempre envia `X-Webhook-Secret`. O workflow receptor deve validar o mesmo valor antes de qualquer consulta ou disparo.

### SEC-006 — Headers de segurança ausentes

- Estado: corrigido.
- Local: `vercel.json`, linhas 2–30.
- Exploração: a ausência de CSP e proteção contra framing aumenta o impacto potencial de XSS e clickjacking.
- Correção implementada: CSP, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` e `Permissions-Policy` adicionados na configuração da Vercel.

## Low

### SEC-007 — Advisory residual do esbuild no servidor de desenvolvimento Windows

- Estado: aberto; somente desenvolvimento.
- Local: `package-lock.json`, dependência transitiva de Vite.
- Evidência: `npm audit` mantém um advisory Low para esbuild 0.27.7.
- Exploração: requer acesso local e execução do servidor de desenvolvimento no Windows; não afeta o bundle estático publicado.
- Correção proposta: atualizar Vite quando uma versão compatível passar a depender de esbuild 0.28.1 ou superior.
- Mitigação: não expor `npm run dev` a redes não confiáveis.

### SEC-008 — Sessão persistida em localStorage

- Estado: aceito com mitigação.
- Local: `src/integrations/supabase/client.ts`, linhas 21–27.
- Evidência: Supabase Auth persiste a sessão em `localStorage`.
- Exploração: uma futura vulnerabilidade XSS no mesmo origin poderia ler o token da sessão.
- Correção proposta: para maior garantia, adotar arquitetura BFF com cookie `HttpOnly`; isso exige mudança arquitetural e proteção CSRF.
- Mitigação atual: React escapa conteúdo textual, não foi localizado fluxo explorável de XSS, e foi adicionada uma CSP restritiva.

## Verificações sem vulnerabilidade confirmada

- SQL injection: não foram encontradas queries SQL construídas com input; o código usa Supabase Query Builder e parâmetros.
- IDOR: Edge Functions validam `created_by` e as policies de campanha relacionam recursos ao usuário autenticado.
- CSRF: os endpoints usam bearer token no header `Authorization`, não autenticação automática por cookie.
- XSS: não foi identificado fluxo de dados não confiáveis para execução de HTML. O uso de `dangerouslySetInnerHTML` em `src/components/ui/chart.tsx` gera CSS a partir de configuração interna; deve permanecer sem input de usuário.
- Secrets: `.env` está ignorado pelo Git, não há `service_role` no frontend e os tokens da Meta são lidos apenas em Edge Functions.
- Chave pública: `VITE_SUPABASE_PUBLISHABLE_KEY` é intencionalmente pública e depende de RLS para proteção.
- Acesso anônimo: `access_profiles`, `dados_cliente`, `webhook_messages`, `configuracoes_ia`, `campanhas`, `envio_em_massa` e `tabela_erro` retornaram `[]` usando a chave anônima.

## Validação da separação demo/owner

Controles confirmados:

1. trigger em `auth.users` cria novos perfis como `demo`;
2. usuários autenticados só leem o próprio `access_profiles`;
3. policies restritivas exigem `public.is_owner()` nas tabelas reais;
4. Edge Functions consultam `access_profiles` com `service_role` e recusam qualquer papel diferente de `owner`;
5. o frontend demo usa dados mockados e não abre subscriptions das tabelas reais;
6. existe índice único que permite no máximo um `owner`.

Teste ainda recomendado após criar a conta demonstrativa:

- autenticar com a conta demo e confirmar dashboard/chat mockados;
- consultar diretamente as tabelas via cliente autenticado e confirmar zero linhas;
- invocar `send-whatsapp` e uma função de campanha e confirmar HTTP 403;
- confirmar no painel que somente o usuário autorizado possui `role = owner`.

## Correções realizadas nesta auditoria

- Aplicada a migration `20260821120000_harden_owner_access.sql` no Supabase remoto.
- Adicionados headers de segurança em `vercel.json`.
- Fixada a versão de `@supabase/supabase-js` usada via ESM nas Edge Functions.
- Atualizado `package-lock.json` para remover todos os advisories High e Medium conhecidos.
- Corrigido o diretório de `send-whatsapp` para `supabase/functions/send-whatsapp`.
- Confirmado que `.env` e `supabase/.temp` não são versionados.
- Sanitizado o template n8n, removendo IDs de webhook, referências internas de credenciais e o Phone Number ID.
- Tornado obrigatório o secret compartilhado usado no disparo de campanhas para o n8n.
