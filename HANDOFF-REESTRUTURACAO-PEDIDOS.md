# Handoff — Reestruturação da Aba Pedidos

Data: 2026-09-07  
Projeto: `confeitarialivya-saas`  
Objetivo: substituir Kanban de sete colunas por quatro abas operacionais e consolidar fluxo WhatsApp.

## Onde paramos

A análise e o planejamento foram concluídos. A implementação começou, mas ainda não foi finalizada nem validada com build, lint, banco ou navegador.

Próximo passo imediato: reescrever `src/routes/staff/index.tsx` para substituir o Kanban por quatro abas.

## Requisitos aprovados

Abas operacionais, uma visível por vez:

- **Novos**: `pending`
- **Em preparo**: `confirmed` + `preparing`
- **Prontos**: `ready`
- **Em entrega**: `out_for_delivery`

Estados `delivered` e `canceled` permanecem somente em `/staff/history`.

Fluxo:

```text
pending -> confirmed -> preparing -> ready -> out_for_delivery -> delivered
```

Cancelamento permitido na interface somente em:

```text
pending | confirmed | preparing | ready
```

Não alterar checkout, produtos, clientes, dados históricos ou manifesto antigo do projeto.

## Arquivos já alterados

### `src/lib/order-status.ts`

Já adicionados:

- `OperationalTabId`
- `OperationalTab`
- `OPERATIONAL_TABS`
- `OPERATIONAL_ACTION_LABEL`
- `operationalTabFor()`
- `isOperationalStatus()`

Também alterado:

- `canCancel()` agora permite cancelamento somente até `ready`.
- `isActiveStatus()` agora usa abas operacionais.

### `src/lib/audit.functions.ts`

`AuditEntry` agora aceita:

```ts
metadata?: Record<string, unknown> | null
```

`logAudit()` grava `metadata` em `audit_logs`.

### `src/lib/orders-admin.functions.ts`

`updateOrderStatus()` agora aceita `cancelReason` e grava `cancel_reason` quando status vira `canceled`.

Também adicionadas funções:

- `createWhatsAppAttempt()`
- `updateWhatsAppAttempt()`

Essas funções registram uma tentativa única de WhatsApp por pedido/evento e permitem nova tentativa quando anterior falhou.

### `src/lib/delivery.functions.ts`

`StoreSettings` e defaults foram ampliados com:

- `whatsapp_accept_enabled`
- `whatsapp_cancel_enabled`
- `whatsapp_shipping_enabled`
- `whatsapp_template_aceito`
- `whatsapp_template_cancelado`

Leituras de configurações usam fallback seguro para valores antigos ou nulos.

### `src/lib/order-notify.ts`

Já alterado:

- Novo evento `canceled`.
- Mensagens padrão para aceite, cancelamento e saída para entrega.
- Variáveis novas:
  - `{nome_cliente}`
  - `{numero_pedido}`
  - `{itens}`
  - `{total}`
  - `{forma_pagamento}`
  - `{endereco}`
  - `{nome_estabelecimento}`
  - `{motivo_cancelamento}`
- Aliases antigos preservados: `{nome}`, `{pagamento}`, `{loja}`.
- Flags por evento respeitadas.
- Tentativas idempotentes por pedido/evento.
- Popup bloqueado registra falha sem alterar status.
- Resultado informa `WhatsApp aberto`, não “enviado”.
- Adicionada `validateWhatsAppTemplate()`.

Ponto para revisar: `validateWhatsAppTemplate()` deve ser conferida no build, principalmente regex de placeholders.

### `src/integrations/supabase/types.ts`

Já adicionados:

- `orders.cancel_reason` em `Row`, `Insert` e `Update`.
- Novas colunas de WhatsApp em `store_settings.Row`.
- Tabelas tipadas:
  - `order_status_history`
  - `order_whatsapp_attempts`

Ainda conferir se novos campos de WhatsApp também precisam entrar em `store_settings.Insert` e `store_settings.Update`.

### Migration criada

Arquivo:

`supabase/migrations/20260909000000_order_operations_restructure.sql`

Inclui:

- `orders.cancel_reason`.
- Flags e templates de WhatsApp em `store_settings`.
- Trigger atualizado para impedir cancelamento após `ready`.
- Tabela `order_status_history`.
- Trigger automático de histórico de status.
- Tabela `order_whatsapp_attempts` com chave única `(order_id, event)`.
- RLS para histórico e tentativas.

Migration ainda NÃO foi aplicada no Supabase remoto.

## Arquivos ainda não alterados

### Principal

`src/routes/staff/index.tsx`

Ainda está com Kanban de sete colunas. Deve ser reescrita para:

- quatro abas;
- uma lista por vez;
- contadores reais;
- busca por cliente, telefone e número;
- cards responsivos;
- ações contextuais;
- sem mostrar entregues/cancelados;
- realtime, som, refresh, loading, erro e vazio preservados;
- detalhes e impressão preservados;
- sem botão Desfazer na operação principal;
- cancelamento com motivo opcional;
- auditoria com metadata;
- WhatsApp automático em aceite e saída;
- finalização levando pedido ao histórico.

Reutilizar:

- `getOrders()` / `updateOrderStatus()`;
- `useActiveStore()`;
- `printOrder()`;
- `notifyOrderWhatsApp()`;
- `logAudit()`;
- componentes UI já existentes.

### Compatibilidade

`src/routes/admin/orders.tsx` ainda é implementação duplicada. Deve virar rota de compatibilidade que redireciona para `/staff`, sem query, realtime ou cards próprios.

### Configuração WhatsApp

`src/routes/admin/settings.tsx` ainda mostra apenas dois templates antigos e não mostra switches por evento. Atualizar depois da central:

- habilitar/desabilitar aceite;
- habilitar/desabilitar cancelamento;
- habilitar/desabilitar saída para entrega;
- editar três modelos;
- mostrar variáveis permitidas;
- validar placeholders desconhecidos.

### Histórico

`src/routes/staff/history.tsx` ainda exibe texto “Voltar ao Kanban”. Trocar para “Voltar aos pedidos”. Preservar desfazer/reabrir até validação específica.

### Rota admin

`src/routes/admin/route.tsx` ainda tem `'/admin/orders': 'orders'`, embora não haja item visível no menu. Avaliar redirecionamento sem quebrar gate de plano.

## O que NÃO fazer

- Não editar `src/routes/routeTree.gen.ts` manualmente.
- Não alterar `src/lib/orders.functions.ts`.
- Não alterar checkout em `src/components/delivery/store-page.tsx`.
- Não apagar pedidos, itens, histórico, produtos ou configurações antigas.
- Não criar novos status.
- Não criar regras específicas de confeitaria, pizzaria ou açaí.
- Não aplicar migration remota sem autorização/validação.
- Não criar segunda central de pedidos.
- Não declarar WhatsApp como enviado: implementação atual abre `wa.me` no navegador.

## Alertas técnicos para revisar antes de build

1. A migration nova depende de `private.can_use_feature()` e `private.has_permission()` existentes no banco.
2. A migration altera função de trigger que já existe em migration aplicada; isso é intencional via `CREATE OR REPLACE`, sem editar histórico.
3. Conferir RLS de `order_whatsapp_attempts` e coerência entre `order_id` e `store_id`.
4. Conferir tipos `store_settings.Insert` e `store_settings.Update`.
5. Confirmar regex de `validateWhatsAppTemplate()`.
6. Build deve ser executado antes de aplicar migration.
7. Depois da implementação, rodar lint e preview local.

## Validação obrigatória

### Build e lint

```bash
npm run build
```

```bash
npm run lint
```

### Navegador

Testar:

1. Abrir `/staff`.
2. Confirmar quatro abas e nenhum Kanban horizontal.
3. Confirmar contadores reais.
4. Criar pedido no catálogo.
5. Confirmar entrada em Novos via realtime.
6. Aceitar: sai de Novos e aparece em Em preparo.
7. Iniciar preparo.
8. Marcar pronto: aparece em Prontos.
9. Sair para entrega: aparece em Em entrega e abre WhatsApp uma vez.
10. Finalizar: sai da operação e aparece em Histórico.
11. Cancelar pedido em Novos/Preparo/Prontos.
12. Confirmar cancelado no Histórico.
13. Testar pedido sem telefone e popup bloqueado.
14. Testar duplo clique.
15. Testar duas lojas e isolamento.
16. Testar desktop, tablet e largura pequena.

## Sequência de continuação

1. Reescrever `src/routes/staff/index.tsx`.
2. Rodar `npm run build` e corrigir erros.
3. Ajustar `/admin/orders` para redirecionamento.
4. Atualizar configurações WhatsApp.
5. Revisar tipos e migration.
6. Rodar lint.
7. Aplicar migration somente quando autorizado.
8. Subir preview e testar interface.
9. Atualizar `RELATORIO-E-TESTE.md` apenas com evidências reais.
10. Criar novo handoff ao terminar esta intervenção, sem encerrar sequência do manifesto antigo.
