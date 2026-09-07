# Handoff — Fase 22: Central de Pedidos

Data: 2026-09-06
Projeto: `confeitarialivya-saas`

## Objetivo

Transformar `/staff` em central kanban com sete colunas de status, transições protegidas pelo banco, cancelamento, desfazer, impressão, WhatsApp, auditoria e realtime.

## Estado atual

Implementação **não concluída**. Não rodar build como prova de conclusão ainda.

`src/routes/staff/index.tsx` está temporariamente quebrado: recebeu imports novos, mas o conteúdo antigo continua no arquivo. Próximo passo obrigatório: substituir arquivo inteiro por implementação kanban única. Não tentar corrigir import por import mantendo tela antiga.

## Arquivos já criados ou alterados

- `supabase/migrations/20260908000000_order_status_state_machine.sql`
  - CHECK dos sete status.
  - `status NOT NULL` e default `pending`.
  - trigger `public.validate_order_status_transition()`.
  - grafo de avanço, cancelamento e desfazer.
  - gate `order_hub` na policy de UPDATE.
  - revoga SELECT/UPDATE/DELETE de `anon` em `orders`; revoga UPDATE/DELETE de `anon` em `order_items`.
- `src/lib/order-status.ts`
  - status canônicos, rótulos, estilos claro/escuro, próximo/anterior, cancelamento, pagamento.
- `src/lib/order-print.ts`
  - impressão em janela separada, escape HTML, itens, adicionais, endereço, pagamento e totais.
- `src/lib/order-notify.ts`
  - templates configurados, placeholders, fallback, `auto_notify_whatsapp`, atualização de `client_notified`.
- `src/lib/orders-admin.functions.ts`
  - `OrderStatus`, `OrderWithItems`, limite/range, filtros, mutation tipada e atualização de aviso.
- `src/integrations/supabase/types.ts`
  - status de `orders` convertido para union dos sete valores.
- `src/routes/super/monitoramento.tsx`
  - usa status compartilhado escuro.
- `src/routes/super/logs.tsx`
  - adiciona rótulos de ações e módulo de pedidos.
- `src/routes/staff/index.tsx`
  - somente imports novos foram adicionados até o momento; arquivo ainda contém implementação antiga e imports duplicados.

## Regras fechadas

Status:

```text
pending -> confirmed, canceled
confirmed -> preparing, canceled, pending
preparing -> ready, canceled, confirmed
ready -> out_for_delivery, canceled, preparing
out_for_delivery -> delivered, canceled, ready
delivered -> out_for_delivery
canceled -> pending
```

- Cancelar permitido até `out_for_delivery`; entregue não cancela.
- Desfazer permitido inclusive `delivered -> out_for_delivery` e `canceled -> pending`.
- Entregues e cancelados no kanban somente do dia atual.
- Histórico continua em `/staff/history`.
- Sem drag-and-drop.
- Cancelamento exige confirmação e auditoria.
- Não apagar dados.
- Não criar segundo sistema de pedidos.
- Não fazer commit, push ou deploy sem autorização atual.

## Próxima sequência

1. Ler novamente `src/routes/staff/index.tsx`, `src/lib/order-status.ts`, `src/lib/order-notify.ts`, `src/lib/order-print.ts` e `src/lib/orders-admin.functions.ts`.
2. Reescrever `src/routes/staff/index.tsx` inteiro.
3. Implementar:
   - toolbar com busca, som e conexão realtime;
   - sete colunas horizontais;
   - cards tipados;
   - avanço usando `nextStatus`;
   - cancelamento com `AlertDialog`;
   - desfazer usando `previousStatus`;
   - `logAudit` para `order_canceled`, `order_reopened` e `order_status_changed`;
   - impressão via `printOrder`;
   - WhatsApp manual/automático via `notifyOrderWhatsApp`;
   - query limitada ao dia atual para kanban;
   - invalidação de `staff-orders`, `staff-history` e `salesReport` quando necessário;
   - estados loading, erro com tentar novamente e vazio por coluna.
4. Corrigir `src/routes/staff/history.tsx` sem mudar visual mais que necessário:
   - filtro/query de histórico limitado e tipado;
   - erro persistente;
   - impressão compartilhada;
   - ações de desfazer quando aplicável.
5. Atualizar `src/routes/admin/orders.tsx` para importar status, impressão e aviso compartilhados; corrigir `in_preparation`.
6. Remover imports e funções mortas dos arquivos tocados.
7. Rodar `npx.cmd tsc --noEmit` e corrigir erros novos, separando erros preexistentes.
8. Rodar `npm run build`.
9. Aplicar migration somente quando autorizado e testar no banco:
   - status inválido;
   - salto inválido;
   - transições válidas;
   - cancelamento antes/depois de entregue;
   - desfazer;
   - loja sem Premium sem UPDATE;
   - anon mantém INSERT e não lê/altera/apaga.
10. Iniciar preview e testar por clique, se configuração MCP reconhecer projeto.
11. Atualizar `RELATORIO-E-TESTE.md` somente após implementação e testes.

## Cuidados

- Working tree já tinha alterações anteriores. Não usar reset, restore, clean ou checkout para apagar mudanças.
- Migration não foi aplicada nem validada contra banco nesta etapa.
- `OrderWithItems` importa tipo gerado; joins Supabase ainda são convertidos no helper por causa do formato inferido.
- `order-print.ts` usa `Date.now()` somente dentro do navegador ao imprimir pedido com `created_at` nulo; não usar esse arquivo em contexto SSR.
- Templates atuais suportam apenas campos `whatsapp_template_recebido` e `whatsapp_template_saida_entrega`; eventos sem template usam fallback.
