# Contexto atual do projeto

**Projeto:** Confeitaria Livya SaaS
**Diretório:** `D:\CLAUDE\confeitarialivya-saas`
**Data do registro:** 13/09/2026
**Branch de trabalho:** `feature/order-operations-restructure`
**Projeto GitHub:** `alessansantos2020-lang/confeitarialivya-saas`
**Projeto Vercel vinculado:** `a-r-machado/confeitarialivya-saas`

## Estado publicado

O sistema está publicado na Vercel e respondendo normalmente:

- https://confeitarialivya-saas.vercel.app/

A branch `main` foi atualizada e aponta para o commit:

- `39b5187` — Resolve WhatsApp migration version conflict

A migration de WhatsApp foi aplicada no Supabase de produção:

- `20260918000000_order_whatsapp_attempt_claim.sql`

Projeto Supabase de produção:

- Nome: `confeitaria-livya`
- Project ref: `uivmsigagtzsqomdayys`
- Região: `sa-east-1`

## Funcionalidades publicadas

- Catálogo público da loja.
- Checkout anônimo.
- Taxa de entrega.
- Central de pedidos em `/staff`.
- Abas operacionais de pedidos.
- Histórico em `/staff/history`.
- Painel administrativo em `/admin`.
- Painel do dono do SaaS em `/super`.
- Máquina de estados de pedidos protegida no banco.
- Auditoria de operações.
- Impressão de pedidos.
- Notificações WhatsApp manuais e automáticas.
- Proteção contra mensagens WhatsApp duplicadas.
- Fallback para configurações públicas e privadas da loja.
- Suporte a múltiplas lojas e seleção de loja para super-admin.
- Estrutura inicial de configuração NFC-e.

## Segurança e credenciais

- A chave secreta antiga do Supabase foi removida.
- Uma nova chave secreta foi criada no painel do Supabase com o nome `production_rotated_2026`.
- Nenhuma chave secreta deve ser colocada neste arquivo, no frontend ou no GitHub.
- As variáveis públicas da Vercel estão configuradas.
- `.env` e `.env.local` permanecem locais e não devem ser commitados.
- Se uma chave secreta aparecer em captura de tela, terminal ou arquivo público, ela deve ser rotacionada imediatamente.

## Variáveis configuradas na Vercel

As variáveis relacionadas ao Supabase foram encontradas na Vercel para Production e Preview, incluindo:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_PROJECT_ID`
- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_PROJECT_ID`

Os valores não devem ser registrados neste documento.

## Validações já realizadas

- `npm install`: concluído.
- `npm run typecheck`: passou.
- `npm test -- --run`: passou com 8 testes.
- `npm run build`: passou.
- Prettier nos arquivos principais: passou.
- Lint direcionado dos arquivos principais: passou.
- `git diff --check`: passou antes do commit.
- Site online: HTTP `200` confirmado.
- Migration do WhatsApp: aplicada no Supabase.
- CLI do Supabase: instalado globalmente e autenticado.
- CLI da Vercel: instalado globalmente, autenticado e projeto vinculado.

## Correções feitas antes da publicação

- Fallback de configurações quando RPC ou linha de settings não está disponível.
- Defaults para flags WhatsApp nulas.
- Super-admin passou a carregar todas as lojas ativas mesmo quando possui membership.
- Evento automático de cancelamento incluído.
- Popup do WhatsApp preparado antes das operações assíncronas.
- Reivindicação atômica de tentativa WhatsApp via RPC.
- Policy SQL de tentativas WhatsApp qualificada por loja.
- Tipos Supabase atualizados para a nova RPC.

## Teste recomendado no site online

1. Abrir o catálogo público.
2. Criar um pedido de teste.
3. Entrar em `/staff` com a conta da loja.
4. Confirmar o pedido.
5. Iniciar o preparo.
6. Marcar como pronto.
7. Marcar como saiu para entrega.
8. Finalizar como entregue.
9. Testar WhatsApp nas transições configuradas.
10. Criar outro pedido e testar cancelamento com motivo.
11. Conferir o pedido no histórico.
12. Testar reabertura/desfazer.
13. Testar impressão.
14. Testar busca por nome, telefone e código.
15. Testar em celular.
16. Entrar como super-admin e testar troca entre lojas.
17. Conferir as ações em `/super/logs`.

Pedidos criados apenas para teste devem ser removidos somente conforme as regras do sistema e nunca se deve apagar pedidos reais.

## Pendências para considerar o sistema 100% concluído

### NFC-e

A estrutura de NFC-e existe, mas a emissão fiscal real ainda não está concluída:

- escolher um provedor fiscal;
- configurar certificado digital e credenciais no ambiente seguro;
- implementar o provedor real;
- testar emissão em homologação;
- tratar autorização, rejeição, cancelamento e consulta;
- validar requisitos fiscais da operação.

### Testes manuais

Ainda falta concluir o teste autenticado completo por cliques no ambiente online, principalmente:

- fluxo completo do pedido;
- WhatsApp automático ao aceitar, cancelar e sair para entrega;
- prevenção de duplicidade;
- login e troca de lojas;
- comportamento em celular;
- impressão e pop-ups.

## Arquivos de referência

- `README.md` — instalação, arquitetura e publicação.
- `HANDOFF-PRE-PUBLICACAO.md` — problemas encontrados e correções planejadas.
- `RELATORIO-E-TESTE.md` — evidências e roteiro de testes.
- `CONTINUAR-AQUI.md` — histórico da Central de Pedidos.
- `supabase/migrations/20260918000000_order_whatsapp_attempt_claim.sql` — RPC atômica do WhatsApp.

## Comandos úteis

Instalar dependências:

```bash
npm install
```

Validar o projeto:

```bash
npm run typecheck
npm test -- --run
npm run build
```

Iniciar desenvolvimento:

```bash
npm run dev
```

Verificar migrations:

```bash
supabase migration list --linked
```

Aplicar migrations novas autorizadas:

```bash
supabase db push --linked
```

Publicar alterações na produção:

```bash
git push origin feature/order-operations-restructure:main
```

## Cuidados obrigatórios

- Não fazer `git reset --hard`, `git clean`, `restore` ou apagar alterações sem autorização explícita.
- Não commitar `.env`, `.env.local`, tokens, senhas ou chaves.
- Não aplicar migrations remotas sem revisar e autorizar.
- Não fazer force-push.
- Não apagar pedidos reais.
- Não editar `src/routeTree.gen.ts` manualmente.
- Não criar uma segunda implementação de checkout ou pedidos.
- Atualizar `RELATORIO-E-TESTE.md` somente com evidências reais.
