# Resumo — Reestruturação da Aba Pedidos

Data: 2026-09-07  
Projeto: `confeitarialivya-saas`

## Objetivo

Substituir o Kanban de sete colunas por uma central operacional com quatro abas, uma lista visível por vez, fluxo claro e integração consistente com WhatsApp.

## Decisões aprovadas

- **Novos:** pedidos com status `pending`.
- **Em preparo:** pedidos com status `confirmed` ou `preparing`.
- **Prontos:** pedidos com status `ready`.
- **Em entrega:** pedidos com status `out_for_delivery`.
- Pedidos `delivered` e `canceled` ficam somente em `/staff/history`.
- Fluxo principal: `pending` → `confirmed` → `preparing` → `ready` → `out_for_delivery` → `delivered`.
- Cancelamento disponível somente em `pending`, `confirmed`, `preparing` e `ready`.
- Cancelamento aceita motivo opcional.
- WhatsApp deve informar quando a página foi aberta, nunca afirmar que mensagem foi enviada.
- Não alterar checkout, produtos, clientes, histórico ou manifesto antigo.
- Não aplicar migration remota sem autorização.

## Alterações já feitas

### `src/lib/order-status.ts`

- Adicionados `OperationalTabId`, `OperationalTab`, `OPERATIONAL_TABS`.
- Adicionado `OPERATIONAL_ACTION_LABEL`.
- Adicionadas `operationalTabFor()` e `isOperationalStatus()`.
- `canCancel()` agora permite cancelamento somente até `ready`.
- `isActiveStatus()` agora considera somente estados operacionais.

### `src/lib/audit.functions.ts`

- `AuditEntry` aceita `metadata`.
- `logAudit()` grava metadata em `audit_logs`.

### `src/lib/orders-admin.functions.ts`

- `updateOrderStatus()` aceita `cancelReason`.
- Cancelamento grava `cancel_reason`.
- Adicionadas `createWhatsAppAttempt()` e `updateWhatsAppAttempt()`.
- Tentativas de WhatsApp são idempotentes por pedido e evento; falhas podem ser tentadas novamente.

### `src/lib/delivery.functions.ts`

- Configurações novas para habilitar aceite, cancelamento e saída para entrega.
- Templates novos de aceite e cancelamento.
- Fallbacks seguros para configurações antigas ou nulas.

### `src/lib/order-notify.ts`

- Evento `canceled`.
- Mensagens de aceite, cancelamento e saída para entrega.
- Placeholders novos e aliases antigos preservados.
- Flags por evento respeitadas.
- Registro idempotente de tentativa.
- Popup bloqueado registra falha sem alterar status.
- Resultado usa o texto `WhatsApp aberto`.
- `validateWhatsAppTemplate()` adicionada; regex precisa ser conferida no build.

### `src/integrations/supabase/types.ts`

- `orders.cancel_reason` adicionado.
- Tabelas `order_status_history` e `order_whatsapp_attempts` adicionadas.
- Novas colunas aparecem em `store_settings.Row`.
- Conferir se campos novos também precisam entrar em `store_settings.Insert` e `Update`.

### Migration

Arquivo: `supabase/migrations/20260909000000_order_operations_restructure.sql`

Inclui:

- `orders.cancel_reason`.
- Flags e templates de WhatsApp.
- Regra de transição de status.
- Histórico automático de status.
- Tentativas de WhatsApp com chave única por pedido e evento.
- RLS para histórico e tentativas.

A migration ainda não foi aplicada no Supabase remoto.

## Pendências imediatas

1. Reescrever `src/routes/staff/index.tsx`:
   - quatro abas;
   - contadores reais;
   - busca por cliente, telefone e número;
   - cards responsivos;
   - uma ação principal contextual por etapa;
   - cancelamento com motivo;
   - auditoria com metadata;
   - WhatsApp automático em aceite e saída para entrega;
   - realtime, som, refresh, loading, erro e vazio;
   - detalhes e impressão preservados;
   - sem botão Desfazer na operação principal.
2. Rodar `npm run build` e corrigir erros.
3. Transformar `/admin/orders` em rota de compatibilidade para `/staff`.
4. Atualizar configurações de WhatsApp em `src/routes/admin/settings.tsx`.
5. Trocar “Voltar ao Kanban” em `src/routes/staff/history.tsx` por “Voltar aos pedidos”.
6. Revisar tipos e migration.
7. Rodar `npm run lint`.
8. Subir preview local e testar interface no navegador.
9. Atualizar `RELATORIO-E-TESTE.md` somente com evidências reais.

## Arquivos que não devem ser alterados nesta intervenção

- `src/lib/orders.functions.ts`
- `src/components/delivery/store-page.tsx`
- `src/routes/routeTree.gen.ts`
- Checkout, produtos, clientes e dados históricos.

## Validação necessária

- Abrir `/staff`.
- Confirmar quatro abas e ausência do Kanban horizontal.
- Confirmar contadores e busca.
- Criar pedido e confirmar entrada em Novos via realtime.
- Aceitar, iniciar preparo, marcar pronto e sair para entrega.
- Confirmar abertura única do WhatsApp.
- Finalizar e confirmar remoção da operação e entrada no histórico.
- Cancelar em Novos, Em preparo e Prontos com e sem motivo.
- Testar pedido sem telefone e popup bloqueado.
- Testar duplo clique.
- Testar duas lojas e isolamento de dados.
- Testar desktop, tablet e largura pequena.
