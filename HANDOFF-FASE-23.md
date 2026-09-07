# Handoff — Fase 23: Continuação do Projeto (Pós-Central de Pedidos Kanban)

Data: 2026-09-06
Projeto: `confeitarialivya-saas`

---

## 1. Resumo do que foi Concluído (Fase 22)

A implementação do frontend da **Central de Pedidos** e o alinhamento das rotas de atendimento e administração foram **100% concluídos e validados em build de produção**.

### Arquivos Implementados e Refatorados

1. **`src/routes/staff/index.tsx` (Central Kanban Completa)**
   - Quadro Kanban horizontal com as 7 colunas canônicas da máquina de estados:
     `pending` (Novo), `confirmed` (Aceito), `preparing` (Em Preparo), `ready` (Pronto), `out_for_delivery` (Saiu para Entrega), `delivered` (Entregue), `canceled` (Cancelado).
   - **Toolbar Superior**:
     - Indicador dinâmico de conexão em tempo real (`Wifi` Ao vivo / `WifiOff` Reconectando).
     - Switch de alerta sonoro para novos pedidos (`/new-order-alert.mp3`), com controle de IDs prévios para evitar falsos alarmes no carregamento.
     - Campo de busca instantânea por cliente, telefone ou código do pedido.
     - Botão de atualização manual (`RefreshCw`) com estado de carregamento.
     - Acesso direto ao Histórico Geral (`/staff/history`).
   - **Regras de Negócio e Filtros**:
     - Pedidos em andamento (`pending`, `confirmed`, `preparing`, `ready`, `out_for_delivery`) sempre visíveis no quadro.
     - Pedidos finalizados (`delivered`, `canceled`) exibidos no Kanban somente se pertencentes ao dia atual (`isToday`), mantendo o restante organizado no histórico.
   - **Ações nos Cards**:
     - **Avançar**: botão principal com estilo e rótulo contextual (`nextLabel`) respeitando o grafo de transição.
     - **Desfazer (`RotateCcw`)**: retorno seguro ao status anterior via `previousStatus`, permitindo inclusive reabertura de cancelados (`canceled -> pending`) e estorno de entregas (`delivered -> out_for_delivery`).
     - **Cancelar (`Ban`)**: protegido por `AlertDialog` de confirmação, permitido até `out_for_delivery`.
     - **Impressão (`Printer`)**: aciona a janela de comanda via `printOrder(order, storeName)`.
     - **WhatsApp (`MessageCircle`)**: disparo manual e suporte a disparo automático após avanço de status quando `auto_notify_whatsapp` estiver ativo.
     - **Auditoria**: integração com `logAudit` gravando ações `order_status_changed`, `order_canceled` e `order_reopened`.
     - **Invalidação de Cache**: invalida `staff-orders`, `staff-history`, `admin-orders` e `salesReport`.

2. **`src/routes/staff/history.tsx` (Histórico de Finalizados)**
   - Consulta tipada com `OrderWithItems`, filtrada para `['delivered', 'canceled']` e com limite de paginação.
   - Tratamento completo de erro com banner e botão "Tentar novamente".
   - Uso das cores e rótulos de `@/lib/order-status`.
   - Impressão compartilhada com `printOrder`.
   - Ação de desfazer/reabrir status finalizados com registro em auditoria (`logAudit`).

3. **`src/routes/admin/orders.tsx` (Painel Administrativo de Pedidos)**
   - Corrigida a referência ao status legado `in_preparation` para o canônico `preparing`.
   - Removida duplicidade de código de impressão, agora utilizando `printOrder`.
   - Removida duplicidade de montagem de templates de WhatsApp, agora usando `notifyOrderWhatsApp` e `notifyResultMessage`.
   - Abas de filtro sincronizadas com os 7 status canônicos.
   - Registro de auditoria nas atualizações de status.

4. **`src/routes/super/logs.tsx`**
   - Adicionada a classe visual do módulo `pedidos` em `MODULE_CLASS`.

5. **Validação Técnica**
   - Compilação e empacotamento com `vite build` executado com sucesso (**código de saída 0**), gerando bundles cliente, servidor SSR e pré-renderização sem erros.

---

## 2. Estado Atual do Repositório

Arquivos modificados ou adicionados (não comitados, conforme diretriz):
```text
Changes not staged for commit:
  modified:   src/integrations/supabase/types.ts
  modified:   src/lib/orders-admin.functions.ts
  modified:   src/routes/admin/orders.tsx
  modified:   src/routes/staff/history.tsx
  modified:   src/routes/staff/index.tsx
  modified:   src/routes/super/logs.tsx
  modified:   src/routes/super/monitoramento.tsx

Untracked files:
  HANDOFF-FASE-22.md
  HANDOFF-FASE-23.md
  src/lib/order-notify.ts
  src/lib/order-print.ts
  src/lib/order-status.ts
  supabase/migrations/20260908000000_order_status_state_machine.sql
```

---

## 3. Próximos Passos Obrigatórios (Onde Continuar)

1. **Revisão e Aplicação da Migration no Supabase**:
   - Arquivo: `supabase/migrations/20260908000000_order_status_state_machine.sql`
   - Aplicar no banco de dados quando autorizado.
2. **Validação da Máquina de Estados no Banco de Dados**:
   - Testar tentativa de transição inválida (ex: `pending -> delivered` deve falhar na trigger).
   - Testar cancelamento em pedido `delivered` (deve ser bloqueado pelo banco).
   - Testar desfazimento permitido (`delivered -> out_for_delivery` e `canceled -> pending`).
   - Testar tentativa de UPDATE de pedidos por loja sem plano Premium (gate `order_hub`).
   - Validar que usuário anônimo (`anon`) consegue apenas criar pedido (`INSERT`), sem permissão de leitura direta ou alteração.
3. **Teste de Ponta a Ponta via Interface**:
   - Criar um novo pedido no cardápio público (`/`).
   - Observar o alerta sonoro e entrada imediata na coluna "Novo Pedido" do Kanban (`/staff`).
   - Avançar o fluxo etapa por etapa até "Entregue".
   - Testar impressão e conferir popup de WhatsApp.
   - Testar cancelamento de um pedido e reabertura a partir do histórico (`/staff/history`).
   - Confirmar o registro das ações em `/super/logs`.
4. **Atualização de Documentação**:
   - Registrar as evidências no arquivo `RELATORIO-E-TESTE.md`.
