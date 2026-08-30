# Continuar daqui — Confeitaria Livya → SaaS

> Documento de handoff pra retomar o trabalho em outra janela do Claude.
> Última atualização: 2026-08-30

## O que é o projeto

Cardápio digital / delivery online que era um app **de uma loja só** (Confeitaria Livya, feito no Lovable).
O objetivo é transformá-lo em **SaaS multi-loja** (várias confeitarias usando o mesmo sistema).

**Pasta do projeto:** `C:\Users\Alessandro\Documents\PROJETOS CLAUDE\confeitarialivya-saas`
(Existe OUTRO projeto SaaS antigo em `delivery-saas` — monorepo Next.js+NestJS. NÃO é esse. Ignorar.)

## Stack

- TanStack Start (React 19 + SSR) + Vite 8
- Supabase (banco, auth, storage) — **atualmente DESCONECTADO**
- Tailwind v4 + shadcn/ui
- Zustand (carrinho) + React Query (dados)
- Roda com **npm** (não tem bun instalado). Node 24.

## Como rodar

```bash
cd "C:\Users\Alessandro\Documents\PROJETOS CLAUDE\confeitarialivya-saas"
npm run dev
```

Sobe em `http://localhost:8080` (o Lovable forçava essa porta; mantivemos).
Primeiro boot é lento no Windows (~2min na primeira vez, ~10s depois).

## Decisões já tomadas (NÃO re-perguntar)

1. **Endereço das lojas:** por caminho (`/nome-da-loja`), ex: `/confeitaria-livya`. (Subdomínio fica pra depois.)
2. **Cobrança:** SIM, vai ter assinatura das lojas (Fase 5).
3. **Cadastro de lojas:** só o dono do sistema cria (super admin).
4. **Banco:** vamos conectar um **Supabase NOVO** no final (o antigo da Livya, que estava no ar, foi desconectado pra não arriscar).

## O que JÁ FOI FEITO

### Lovable removido 100%
- Apagado: `lovable-error-reporting.ts`, `.lovable/`, `AGENTS.md`, `bun.lock`
- Reconstruída a config de build standalone em `vite.config.ts` (sem `@lovable.dev/vite-tanstack-config`)
- Metadados, URLs `lovable.app` e mensagens "Lovable Cloud" trocados
- Confirmado: zero referências ao Lovable no projeto

### Supabase antigo desconectado
- `.env` — credenciais apagadas, campos em branco pra preencher com o Supabase novo
- `supabase/config.toml` — project_id zerado
- `src/routes/admin/route.tsx` — chave de auth agora é dinâmica (deriva do `VITE_SUPABASE_PROJECT_ID`)
- Confirmado: zero referências ao projeto antigo (`naxvkmvoevlvtsuiwqnl`)

### Script de admin novo criado
- `supabase/seed.sql` — cria admin automaticamente quando conectar o Supabase novo:
  - E-mail: `admin@confeitaria.com`
  - Senha: `admin123`

## POR QUE O LOGIN NÃO FUNCIONA AGORA (esperado!)

O Supabase está DESCONECTADO. Sem banco, não tem como validar login nem carregar
dados (cardápio some, login dá erro). Isso é normal até conectarmos o banco novo.

## PRÓXIMO PASSO (onde paramos)

**Fase 1 — Base multi-loja no banco.** Ainda NÃO começou de fato.

O que fazer na Fase 1:
1. Criar tabela `stores` (lojas) com coluna `slug` (o nome-da-loja da URL)
2. Adicionar `store_id` em: products, categories, orders, delivery_fees, store_settings, addon_groups
3. Criar RLS (Row Level Security) pra isolar dados por loja (Loja A não vê dados da Loja B)
4. Migração deve ser **só-adiciona** (não apaga/quebra nada), já que as 51 migrations existentes recriam o banco

Depois: Fase 2 (rota `/$slug`), Fase 3 (login por loja), Fase 4 (painel super admin), Fase 5 (assinatura).

## Quando for conectar o Supabase novo (no final)

1. Criar projeto novo em supabase.com
2. Preencher `.env` com URL + publishable key + project_id
3. Aplicar as 51 migrations de `supabase/migrations/`
4. Rodar `supabase/seed.sql` pra criar o admin
5. Login: `admin@confeitaria.com` / `admin123`

## Estrutura importante

- `src/routes/index.tsx` — cardápio do cliente (página pública)
- `src/routes/admin/` — painel admin (produtos, pedidos, categorias, etc.)
- `src/routes/staff/` — painel de funcionários
- `src/routes/auth.tsx` — tela de login
- `src/lib/*.functions.ts` — server functions que puxam dados do Supabase
- `src/integrations/supabase/` — clients Supabase
- `supabase/migrations/` — 51 migrations (esqueleto do banco)

## Como o usuário quer trabalhar

- Português-BR, informal
- NÃO é programador — explicar em linguagem simples, sem jargão
- Uma etapa por vez, ele testa clicando
- Confirmar antes de mudanças grandes/arriscadas
