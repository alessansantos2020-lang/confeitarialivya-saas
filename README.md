# Açaí Livya

SaaS multi-loja para delivery, catálogo público, adicionais e gestão de pedidos.

Projeto baseado na loja padrão `confeitaria-livya`, preparada como demonstração completa de uma açaiteria.

## Estado atual

- Stack TanStack Start, React, TypeScript, Vite e Tailwind CSS.
- Banco Supabase com PostgreSQL e RLS.
- Loja padrão: **Açaí Livya**.
- Slug público mantido: `confeitaria-livya`.
- Catálogo público com categorias, produtos, fotos e adicionais.
- Checkout anônimo com taxa de entrega.
- Central de pedidos em `/staff`.
- Histórico de pedidos em `/staff/history`.
- Painel administrativo em `/admin`.
- Painel do dono do SaaS em `/super`.
- Máquina de estados de pedidos protegida no banco.
- Deploy de produção: <https://confeitarialivya-saas.vercel.app/>

## Stack

- TanStack Start
- React 19
- TypeScript
- Vite
- Tailwind CSS
- Supabase Auth
- Supabase PostgreSQL
- Supabase Storage
- React Query
- Zustand
- Vercel

## Executar localmente

Instale dependências:

```bash
npm install
```

Crie `.env` na raiz. Nunca publique esse arquivo:

```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sua-chave-publica
SEED_ADMIN_EMAIL=seu-email-de-admin
SEED_ADMIN_PASSWORD=sua-senha-de-admin
```

Inicie desenvolvimento:

```bash
npm run dev
```

Rotas locais principais:

- `http://localhost:5173/confeitaria-livya` — cardápio público
- `http://localhost:5173/auth` — login
- `http://localhost:5173/admin` — painel da loja
- `http://localhost:5173/staff` — central de pedidos
- `http://localhost:5173/super` — painel do dono do SaaS

A porta pode mudar se Vite encontrar outra aplicação usando a porta padrão.

## Contas de demonstração

As credenciais ficam fora do repositório e devem ser obtidas no ambiente local ou no painel autorizado.

Não colocar senhas, tokens ou service keys neste arquivo, em scripts versionados ou em commits.

## Catálogo da loja

A loja usa estas entidades do banco:

- `stores` — empresas cadastradas.
- `store_settings` — identidade, horários, contato, cores e imagens.
- `categories` — categorias públicas.
- `products` — produtos, preços, disponibilidade e fotos.
- `addon_groups` — grupos de adicionais.
- `addons` — opções dentro de cada grupo.
- `product_addon_groups` — vínculo entre produtos e grupos.
- `delivery_fees` — taxas por bairro.
- `orders` — pedidos recebidos.
- `order_items` — itens e adicionais escolhidos.

Exemplo de grupos de adicionais:

- **Tamanho** — 300ml, 500ml e 700ml.
- **Frutas grátis** — banana, morango, kiwi e manga.
- **Complementos** — leite em pó, granola, paçoca, Bis picado e Nutella.
- **Calda** — chocolate, morango e sem calda.
- **Especiais** — leite Ninho, Oreo e creme de avelã.

Tamanho e calda podem ser obrigatórios. Limites mínimo e máximo vêm do banco e são aplicados no cardápio.

## Seed seguro do catálogo

Arquivo:

`scripts/seed-acai-exemplo.cjs`

O seed deve ser executado primeiro em modo de simulação:

```bash
node scripts/seed-acai-exemplo.cjs --dry-run
```

A simulação não grava dados. Ela mostra categorias, produtos, grupos, imagens e alterações de configurações.

Aplicação remota só deve ocorrer depois de revisar a simulação:

```bash
node scripts/seed-acai-exemplo.cjs --apply
```

Regras do seed:

- Nunca apagar pedidos.
- Nunca apagar itens ligados a pedidos.
- Preservar IDs e histórico.
- Desativar catálogo antigo em vez de removê-lo.
- Permitir execução repetida sem duplicar registros.
- Usar somente credenciais carregadas de `.env`.
- Validar URLs de imagens antes da aplicação.

## Fluxo de pedido

Status aceitos:

```text
pending
confirmed
preparing
ready
out_for_delivery
delivered
canceled
```

Transições principais:

```text
pending -> confirmed -> preparing -> ready -> out_for_delivery -> delivered
```

Cancelamento é permitido até `out_for_delivery`. O banco bloqueia saltos inválidos e alterações sem permissão da loja.

A migration da máquina de estados está em:

`supabase/migrations/20260908000000_order_status_state_machine.sql`

## Segurança

- RLS ativo nas tabelas de negócio.
- Dados separados por `store_id`.
- Cliente anônimo pode criar pedidos, mas não ler ou alterar pedidos existentes.
- Plano da loja, proprietário e status da loja são controlados pelo super admin.
- Preço final de produto e adicionais é recalculado/protegido no banco.
- Logs de auditoria não podem ser apagados ou alterados pela interface.
- Service role nunca deve ser usada no frontend.
- Dados históricos não devem ser removidos para limpar catálogo.

## Validação

Build de produção:

```bash
npm run build
```

Lint:

```bash
npm run lint
```

O build é obrigatório antes de publicar. O lint pode apontar pendências antigas fora do escopo da alteração atual.

## Publicação

O projeto usa Vercel. Push para `main` dispara o deploy configurado no projeto.

Antes de publicar:

1. Rodar o seed em `--dry-run`.
2. Revisar nomes, preços, imagens e quantidade de registros.
3. Aplicar seed autorizado com `--apply`.
4. Conferir catálogo anônimo.
5. Criar pedido de teste.
6. Conferir pedido em `/staff`.
7. Remover somente o pedido criado para teste.
8. Confirmar preservação do pedido real preexistente.
9. Rodar `npm run build`.
10. Publicar somente depois de todas as verificações.

## Documentação relacionada

- [Relatório e roteiro de teste](RELATORIO-E-TESTE.md)
- [Handoff da Fase 23](HANDOFF-FASE-23.md)
- [Handoff da Fase 22](HANDOFF-FASE-22.md)
- [Convenções de rotas](src/routes/README.md)

## Estrutura principal

```text
src/
  components/          Componentes de interface
  integrations/        Cliente e tipos Supabase
  lib/                  Funções de catálogo, pedidos e permissões
  routes/               Rotas TanStack Start
scripts/                 Seeds e scripts operacionais
supabase/
  migrations/          Migrations do banco
.claude/
  launch.json          Configuração de preview local
```

## Regras de manutenção

- Não usar `reset`, `restore`, `clean` ou checkout para apagar alterações sem autorização explícita.
- Não editar `src/routeTree.gen.ts` manualmente.
- Não criar uma segunda implementação de checkout ou pedidos.
- Não colocar dados fixos de catálogo em componentes React.
- Catálogo deve vir do Supabase.
- Atualizar `RELATORIO-E-TESTE.md` depois de validações reais.
