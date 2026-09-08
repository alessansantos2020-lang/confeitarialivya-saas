# Continuar aqui — Central de Pedidos

Data: 2026-09-07
Projeto: `confeitarialivya-saas`
Branch: `feature/order-operations-restructure`

## Como continuar

Abra Claude nesta pasta e envie:

```text
@CONTINUAR-AQUI.md continue a Central de Pedidos
```

## Estado atual

- Escopo desta etapa: alterar SOMENTE `src/routes/staff/index.tsx`.
- Auditoria e leitura de dependências CONCLUÍDAS. Falta só reescrever o arquivo.
- Ainda usa Kanban de 7 colunas + `Desfazer`. Precisa virar 4 abas operacionais.
- Não alterar histórico, painel admin, manifesto de rotas, checkout, produtos, clientes ou migrations.

## APIs já prontas (confirmado por leitura)

`src/lib/orders-admin.functions.ts`:
- `getOrders({ storeId, statuses, limit })` — aceita `statuses: OrderStatus[]` e faz `.in("status", ...)`.
- `getOrderCounts(storeId)` → `{ new, preparing, ready, delivery }` em queries `head:true` separadas.
- `updateOrderStatus({ id, status, storeId, cancelReason, expectedStatus })` — `expectedStatus` faz `.eq("status", expectedStatus)`; lança erro se ninguém casar (proteção duplo-clique/concorrência). Grava `cancel_reason` só quando `status === "canceled"`.

`src/lib/order-status.ts`:
- `OPERATIONAL_TABS` = `[{new:[pending]},{preparing:[confirmed,preparing]},{ready:[ready]},{delivery:[out_for_delivery]}]`.
- `OPERATIONAL_ACTION_LABEL[status]` → rótulo da ação principal (ex.: pending→"Aceitar pedido", out_for_delivery→"Finalizar pedido"; delivered/canceled = null).
- `nextStatus()`, `canCancel()` (pending|confirmed|preparing|ready), `isOperationalStatus()`, `operationalTabFor()`.
- `ORDER_STATUS_STYLE[status]` = `{ label, color, icon, nextLabel }`.

`src/lib/order-notify.ts`:
- `notifyOrderWhatsApp(order, settings, event, source, storeId)` → `NotifyResult`. Já é idempotente para `accepted|canceled|shipping` (tabela `order_whatsapp_attempts`). Popup bloqueado → `{ sent:false, reason:"blocked_popup" }`, NÃO altera status.
- `notifyResultMessage(result)` → texto "WhatsApp aberto." etc. (null quando `disabled`).
- `NotifyEvent` = received|accepted|preparing|ready|shipping|delivered|canceled.

`src/lib/audit.functions.ts`:
- `logAudit({ action, module, storeId, description, metadata })`. Falha nunca derruba ação.

`src/lib/delivery.functions.ts`:
- `getStoreSettings(storeId)` → `StoreSettings` (tem `auto_notify_whatsapp`, `whatsapp_accept_enabled`, `whatsapp_shipping_enabled`, etc.).

`src/lib/active-store.tsx`:
- `useActiveStore()` → `{ store, storeId, ... }`.

`src/lib/order-print.ts`:
- `printOrder(order, storeName)` → boolean.

Componentes UI disponíveis: `Tabs/TabsList/TabsTrigger/TabsContent`, `Dialog*`, `AlertDialog*`, `Textarea`, `Card/CardContent`, `Badge`, `Button`, `Input`, `Switch`, `Label`. Ícones lucide-react.

## Reescrita a fazer em `src/routes/staff/index.tsx`

### Abas
| Aba | id | Status do banco |
|---|---|---|
| Novos | `new` | `pending` |
| Em preparo | `preparing` | `confirmed`, `preparing` |
| Prontos | `ready` | `ready` |
| Em entrega | `delivery` | `out_for_delivery` |

`delivered` e `canceled` NÃO aparecem (ficam em `src/routes/staff/history.tsx`).

### Queries (query keys com storeId)
- `['staff-orders', storeId]` → `getOrders({ storeId, statuses: [pending,confirmed,preparing,ready,out_for_delivery], limit: 150 })`.
- `['staff-order-counts', storeId]` → `getOrderCounts(storeId)`. Contadores das abas vêm DAQUI, independentes da busca.

### Aba ativa + busca
- `useState<OperationalTabId>('new')` controla `Tabs`.
- Lista visível = pedidos da aba ativa, depois filtro de busca local.
- Busca: cliente, telefone (normalizar `\D` → dígitos, casar com e sem máscara), número/ID do pedido (prefixo `id.slice(0,8)` e id completo).

### Mutation
- `mutationFn`: `updateOrderStatus({ id, status: next, storeId, expectedStatus: fromStatus, cancelReason? })`.
- Depois `logAudit`:
  - avanço → `action: 'order_status_changed'`, `metadata: { order_id, from_status, to_status, source: 'staff_order_hub' }`.
  - cancelamento → `action: 'order_canceled'`, `metadata: { order_id, from_status, to_status:'canceled', source:'staff_order_hub', cancel_reason }`.
- `onSuccess`: invalidar `['staff-orders',storeId]`, `['staff-order-counts',storeId]`, `['staff-history',storeId]`, `['salesReport']`, `['admin-orders',storeId]`.
- WhatsApp automático SÓ em:
  - `pending → confirmed` → evento `accepted`.
  - `ready → out_for_delivery` → evento `shipping`.
  - Nada em confirmed→preparing, preparing→ready, out_for_delivery→delivered.
- Falha de WhatsApp/popup bloqueado → feedback via `notifyResultMessage`, sem rollback.

### Proteção duplo-clique
- `expectedStatus: fromStatus` já cobre no banco.
- Também desabilitar TODOS os controles do card enquanto `statusMutation.isPending && variables?.id === order.id`.

### Card
- Uma ação principal contextual: rótulo de `OPERATIONAL_ACTION_LABEL[order.status]`, avança pra `nextStatus(order.status)`.
- SEM botão `Desfazer` / `RotateCcw`.
- Cancelar: só se `canCancel(order.status)`. Abre `AlertDialog` com `Textarea` opcional pro motivo (grava `cancel_reason`).
- Manter `OrderDetailsDialog` (detalhes completos) e botão de impressão e WhatsApp manual (reaproveitar do arquivo atual, linhas ~734-856).
- Responsivo: 1 coluna no mobile, 2 no tablet (`sm`/`md`), 3 no desktop (`lg`). Grid, não Kanban horizontal.

### Realtime + som
- Canal `staff-orders-<storeId>` filtrado por `store_id=eq.${storeId}`.
- Som só em `INSERT` de pedido novo (id não visto).
- Usar `soundEnabledRef` (`useRef`) pro estado do som, pra assinatura realtime NÃO recriar ao alternar som. (Bug atual: `soundEnabled` está no dep array do useEffect.)
- Invalidar pedidos + contadores + histórico + relatórios no evento realtime.

### Estados
- Loading inicial: skeleton no lugar da lista.
- Erro inicial (sem dados): substitui a lista, com botão "Tentar novamente".
- Erro durante refresh (com dados): preservar dados anteriores, não apagar tela.
- Estado vazio por aba.
- Botão refresh + indicador realtime (Ao vivo / Reconectando).

## Validação (rodar ao terminar)

```bash
npm run build
```

```bash
npm run lint
```

Depois preview `livya-dev`, abrir `/staff`. Conferir:
1. 4 abas, sem Kanban horizontal.
2. 1 lista por vez.
3. Contadores não mudam com busca.
4. Busca por nome, telefone com máscara, ID/prefixo.
5. Fluxo até `delivered`.
6. Cancelamento com e sem motivo.
7. Sem `delivered`/`canceled` na Central.
8. Detalhes e impressão preservados.
9. WhatsApp automático só nas 2 transições.
10. Popup bloqueado sem rollback.
11. Realtime e som só em novo pedido.
12. Duplo clique protegido.
13. Desktop, tablet, 375px.

## Depois da Central

1. `/admin/orders` vira rota de compatibilidade pra `/staff`.
2. Atualizar config WhatsApp em `src/routes/admin/settings.tsx`.
3. Trocar `Voltar ao Kanban` por `Voltar aos pedidos` em `src/routes/staff/history.tsx`.
4. Revisar tipos e migration.
5. Draft PR após build e lint.
