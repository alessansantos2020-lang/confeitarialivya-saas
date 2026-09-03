# Continuar daqui — SaaS de Lojas (multi-segmento)

> Documento de handoff pra retomar o trabalho em outra janela do Claude.
> Última atualização: 2026-09-03 (plano novo do Painel do Dono + auditoria do código)

## Como retomar em outra janela

1. Abrir uma janela nova do Claude **na pasta do projeto**
   (`C:\Users\Alessandro\Documents\PROJETOS CLAUDE\confeitarialivya-saas`).
2. Mandar a mensagem: `@CONTINUAR-AQUI.md continue esse projeto`.
3. Ler a seção "ONDE PAROU" abaixo — é a lista do que falta, em ordem.

## O que é o projeto

Sistema de **catálogo online + delivery** que virou um **SaaS multi-loja**: várias
lojas de **segmentos diferentes** (confeitaria, pizzaria, mercado, petshop, etc.)
usam o mesmo sistema. Cada loja tem seu próprio endereço público, cardápio, cor e
painel de administração.

Começou como app de uma loja só (Confeitaria Livya, feito no Lovable). Hoje a
"Confeitaria Livya" é só a **primeira loja de exemplo**, não a marca do produto.

**Pasta do projeto:** `C:\Users\Alessandro\Documents\PROJETOS CLAUDE\confeitarialivya-saas`
(Existe OUTRO projeto em `delivery-saas` — monorepo Next.js+NestJS. NÃO é esse. Ignorar.)

## Stack

- TanStack Start em **modo SPA puro** (roda 100% no navegador) + Vite 8
- Supabase (banco + auth + storage + Edge Functions) — **CONECTADO e no ar**
- Tailwind v4 + shadcn/ui
- Zustand (carrinho) + React Query (dados)
- Roda com **npm**. Porta 8080.

## Como rodar

```bash
cd "C:\Users\Alessandro\Documents\PROJETOS CLAUDE\confeitarialivya-saas"
npm run dev
```

Sobe em `http://localhost:8080`. Publicado na Vercel: `https://confeitarialivya-saas.vercel.app`
(deploy automático quando dá push no `main` do GitHub).

## Logins

| Papel | E-mail | Senha | Cai em |
|-------|--------|-------|--------|
| Dono do sistema (super admin) | `dono@sistema.com` | `Dono@2026` | `/super` |
| Dono de loja (admin) | `admin@confeitaria.com` | `admin123` | `/admin` |

(Trocar as senhas depois.)

## Os três painéis

- **`/super`** — Painel do Dono do sistema. Cria e gerencia as lojas, define quem
  é dono de cada uma. Visual escuro. Só o super admin entra.
- **`/admin`** — Painel da loja. O dono gerencia produtos, categorias, adicionais,
  clientes, taxas de entrega, relatórios e configurações. Cor da própria loja.
- **`/staff`** — Painel de Pedidos. Tela separada só pra receber e acompanhar os
  pedidos em tempo real (com som de alerta). Usada pelo próprio dono da loja.
- **`/{endereço-da-loja}`** — Cardápio público do cliente (ex: `/confeitaria-livya`).

## O que JÁ FOI FEITO

- **Fase 1 — Base multi-loja no banco:** tabelas `stores` e `store_members`,
  coluna `store_id` em todas as tabelas de negócio, RLS isolando dados por loja,
  papéis `admin` / `super_admin`.
- **Fase 2 — Frontend por loja:** rota pública `/{slug}`, todo o painel filtra e
  grava pela loja ativa.
- **Fase 3 — Painel admin por loja:** admin e staff mostram só os dados da loja;
  pedidos em tempo real filtrados por loja.
- **Fase 4 — Painel super admin (`/super`):** lista/cria/renomeia/suspende lojas,
  define dono. Testado pelo banco (criar loja, trigger de configuração, slug
  duplicado bloqueado).
- **Vocabulário neutralizado:** tirado "confeitaria/cardápio/bolo"; agora usa
  "loja/catálogo/produto" (o SaaS atende vários segmentos).
- **Cor por loja:** cada loja pinta seu painel admin/staff com a própria cor.
- **Sistema de funcionários REMOVIDO** (decisão de 2026-09-03):
  - Tirado o auto-cadastro (a tela `/auth` virou só login).
  - Apagada a tela de equipe, as funções e a Edge Function `manage-employees`.
  - `/staff` virou "Painel de Pedidos", acesso só pro dono da loja.
  - Migração `20260903000000_remove_employee_system.sql` **aplicada no banco em
    2026-09-03**: não apagou nada (não havia nenhum funcionário), e agora cada
    conta só vê o próprio perfil — o dono do sistema vê todos.

- **`/super` testado no navegador (2026-09-03):** login como `dono@sistema.com`
  funcionou, lista de lojas carregou, criar loja funcionou (existe uma loja
  `teste` sem dono, criada só pra testar — pode apagar). Confirmado que depois de
  fechar o RLS o dono do sistema continua vendo e gerenciando todas as lojas.

## O PLANO NOVO (decidido em 2026-09-03)

O usuário trouxe dois documentos de plano (o V2_2 é o completo, o V2_1 é a versão
anterior sem a Central de Pedidos):

- `C:\Users\Alessandro\Downloads\Plano_Mestre_Super_Admin_SaaS_Delivery_Claude_Code_V2_2.txt`

Resumo do que ele pede: transformar o `/super` num painel de SaaS completo
(Dashboard, Lojas, Usuários, Monitoramento, Avisos, **Planos e Funcionalidades**,
Fiscal/Nota Fiscal, Logs, Configurações), fazer o `/admin` obedecer ao plano da
loja (menu dinâmico + rota e banco bloqueados quando o recurso não está no plano),
e criar uma **Central de Pedidos** em colunas (Novos → Aceitos → Em preparo →
Prontos → Entrega).

Regras do documento que valem pra sempre: NÃO reconstruir nada que funciona, NÃO
duplicar tabela/autenticação/permissão, NÃO usar número inventado na tela, e
**bloquear no banco, não só esconder o menu**. Trocar o plano da loja nunca apaga
dados — só corta o acesso.

### Auditoria do código já feita (não precisa repetir)

O que **já existe e deve ser reaproveitado**, não recriado:
- Som de alerta de pedido novo: `public/new-order-alert.mp3`, tocado em
  `src/routes/staff/index.tsx` só no INSERT, com toggle "Som de alerta".
- Impressão de cupom formatado: `src/routes/admin/orders.tsx:694` (`window.open` +
  `window.print()`).
- Loja aberta/fechada: coluna `store_settings.is_open`, editada em
  `/admin/settings`.
- Realtime de pedidos por loja: canal `staff-orders-realtime-${storeId}` com
  `filter: store_id=eq.${storeId}`.
- Dashboard do `/admin` já usa dados reais do banco (nenhum número fixo).
- Loja ativa: `resolveActiveStore()` em `src/lib/store-context.ts` +
  `useActiveStore()` em `src/lib/active-store.tsx`.
- Permissões: `src/lib/auth.functions.ts` (`checkPermission`, `getMyPermissions`)
  e no banco `private.has_permission` / `is_store_admin` / `is_super_admin`.

O que **NÃO existe** no banco (é tudo tabela nova):
- planos, funcionalidades, plano×funcionalidade, loja×plano
- avisos/comunicados
- logs/auditoria
- qualquer coisa fiscal
- também não existe tabela `customers` — "clientes" é derivado de `orders`
  (`customer_phone` distinto).

Detalhes úteis: `orders.status` é `text` sem CHECK, com 7 valores usados
(`pending`, `confirmed`, `preparing`, `ready`, `out_for_delivery`, `delivered`,
`canceled`). Existe `src/lib/permissions.server.ts` que é **arquivo morto** (zero
imports). A tela `/admin/orders` existe mas **não tem item no menu**. A tela de
pedidos de hoje é lista agrupada por dia, **não** kanban — a Central de Pedidos em
colunas é tela nova de verdade.

## ONDE PAROU — pendências

1. **Etapa 1 do plano novo: criar as 5 tabelas novas no banco** (planos,
   funcionalidades, plano×funcionalidade, avisos, logs) + 3 planos de exemplo
   (Básico/Profissional/Premium) e as funcionalidades reais do sistema. É tudo
   adição, não altera nada existente. **Estava aguardando o OK do usuário.**
   Depois disso, a ordem sugerida é: tela de Planos no `/super` → menu dinâmico do
   `/admin` por plano → Central de Pedidos → Avisos → Logs → Fiscal (último, é o
   mais complexo e precisa de provedor fiscal).
2. **Dar push pro GitHub/Vercel** — 28 arquivos mexidos + 9 novos ainda sem
   commit, nada publicado (push dispara deploy automático).
3. Apagar a loja `teste` quando quiser (foi só teste).

## Como aplicar migração no banco (referência)

```bash
export PATH="/c/Program Files/Git/usr/bin:/c/Program Files/nodejs:$PATH"
cd "/c/Users/Alessandro/Documents/PROJETOS CLAUDE/confeitarialivya-saas"
export SUPABASE_ACCESS_TOKEN="<token no memory do projeto>"
npx.cmd --yes supabase@2.116.0 db push --linked
```

## Como buildar (referência)

```bash
export PATH="/c/Program Files/Git/usr/bin:/c/Program Files/nodejs:$PATH"
cd "/c/Users/Alessandro/Documents/PROJETOS CLAUDE/confeitarialivya-saas"
npm.cmd run build
```
(Precisa do `npm.cmd` e do PATH acima — o PATH herdado do Windows não funciona no Git Bash.)

## Supabase (online)

- Projeto: `confeitaria-livya` (conta `alessansantos2026`)
- Project ID: `uivmsigagtzsqomdayys` · URL: `https://uivmsigagtzsqomdayys.supabase.co`
- Chaves no `.env` (protegido pelo `.gitignore`).
- Migrations aplicadas até `20260903000000` (todas em dia).

## Estrutura importante

- `src/routes/index.tsx` e `src/routes/$slug.tsx` — cardápio público do cliente
- `src/routes/super/` — painel do dono do sistema
- `src/routes/admin/` — painel da loja
- `src/routes/staff/` — painel de pedidos
- `src/routes/auth.tsx` — tela de login (só login, sem cadastro)
- `src/lib/*.functions.ts` — funções que puxam dados do Supabase
- `src/lib/store-theme.ts` — cor por loja
- `supabase/migrations/` — migrations do banco

## Como o usuário quer trabalhar

- Português-BR, informal
- NÃO é programador — explicar em linguagem simples, sem jargão
- Uma etapa por vez, ele testa clicando
- Confirmar antes de mudanças grandes/arriscadas
