# Handoff — Pré-publicação

Data: 2026-09-13  
Projeto: `confeitarialivya-saas`  
Branch: `feature/order-operations-restructure`

## Onde paramos

A refatoração incremental foi aplicada na árvore de trabalho, mas ainda não deve ser publicada. A revisão pré-publicação encontrou falhas de comportamento, concorrência e segurança que precisam ser corrigidas antes de commit/push/deploy.

Não foi feito commit, push, deploy ou migration nesta etapa.

## Estado confirmado

- TypeScript: passou (`npm run typecheck`).
- Testes: passaram (`npm test -- --run`).
- Build de produção: passou (`npm run build`).
- Prettier nos arquivos refatorados: passou.
- `git diff --check`: passou.
- Lint direcionado dos arquivos principais refatorados: passou.
- Lint global ainda falha em arquivos legados fora do escopo, principalmente por `any` e formatação antiga.
- A rota `src/routes/staff/index.tsx` foi reduzida e os componentes operacionais foram extraídos para `src/components/staff/`.
- `src/routes/admin/orders.tsx` redireciona para `/staff`.
- O histórico usa o texto “Voltar aos pedidos”.

## Bloqueadores encontrados

### 1. Cancelamento não dispara WhatsApp automático

Arquivo: `src/routes/staff/index.tsx`

`AUTOMATIC_NOTIFY_EVENTS` contém apenas `confirmed: "accepted"` e `out_for_delivery: "shipping"`. A ação de cancelamento atualiza o pedido, mas não dispara o evento `canceled`, mesmo quando a configuração e o template estão habilitados.

### 2. Idempotência do WhatsApp tem corrida concorrente

Arquivo: `src/lib/orders-admin.functions.ts`

`createWhatsAppAttempt` faz consulta e depois `UPDATE`/`INSERT` em operações separadas. Duas abas podem observar o mesmo estado e abrir duas mensagens para o mesmo pedido/evento.

### 3. Tentativa `started` pode ficar presa

Arquivos: `src/lib/order-notify.ts`, `src/lib/orders-admin.functions.ts`

Se a aba fechar depois de registrar `started` e antes de abrir/atualizar o popup, as próximas tentativas tratam a tentativa como duplicada e não conseguem reprocessá-la.

### 4. Super-admin pode perder a lista completa de lojas

Arquivo: `src/lib/store-context.ts`

A função retorna imediatamente quando encontra qualquer registro em `store_members`; por isso, um super-admin que também tenha vínculo em uma loja pode deixar de ver as demais lojas ativas.

### 5. Popup do WhatsApp pode perder ativação do clique

Arquivo: `src/lib/order-notify.ts`

O fluxo aguarda uma chamada ao Supabase antes de executar `window.open`. Em navegadores que exigem ativação transitória do usuário, essa espera pode fazer o popup ser bloqueado mesmo após um clique válido.

### 6. RPC público agora lança erro em vez de usar fallback

Arquivo: `src/lib/delivery.functions.ts`

`getPublicStoreSettings` lança erros do RPC `get_public_store`. Uma falha temporária de rede/RPC pode levar o cardápio público ao error boundary em vez de retornar as configurações padrão anteriores.

### 7. Política de tentativas WhatsApp precisa ser qualificada

Arquivo: `supabase/migrations/20260909000000_order_operations_restructure.sql`

A política de INSERT usa `o.store_id = store_id` sem qualificar explicitamente a coluna externa. A análise classificou como provável risco de correlação entre lojas. Corrigir/validar qualificando a linha externa antes de aplicar migration.

### 8. Configurações privadas sem fallback

Arquivo: `src/lib/delivery.functions.ts`

`getStoreSettings` agora lança erro quando não existe uma linha em `store_settings` ou quando há falha temporária de leitura. Lojas recém-criadas ou ainda não provisionadas podem deixar `/staff`, histórico e configurações administrativas sem dados utilizáveis. Confirmar se o provisionamento sempre cria essa linha; caso contrário, restaurar defaults ou criar a linha de forma transacional.

### 9. Flags de WhatsApp podem ser desabilitados por valores nulos legados

Arquivo: `src/lib/delivery.functions.ts`

`toStoreSettings` mantém os flags nullable sem aplicar defaults, enquanto `order-notify.ts` trata `false` e `null` como desabilitados. Em bases antigas com flags nulos, avisos configurados podem ser silenciosamente suprimidos. Verificar a migration e os dados existentes antes da publicação.

## Outros problemas importantes

- `src/lib/cart.store.ts`: a função `migrate` descarta carrinhos persistidos quando há migração de versão.
- `src/lib/super-admin-plans.ts`: apagar e reinserir `plan_features` não é atômico.
- `src/routes/admin/products.tsx`: salvar produto e sincronizar grupos de adicionais são operações separadas.
- `src/lib/super-admin-dashboard.ts`: erros das consultas de usuários/pedidos não são todos verificados; métricas podem aparecer zeradas.
- `src/lib/super-admin-monitoring.ts`: consultas de pedidos/lojas/perfis/atividade são amplas e algumas falhas podem ser mascaradas.
- `src/lib/super-admin-details.ts`: baixa todos os telefones dos pedidos apenas para contar clientes distintos.
- `src/lib/super-admin-stores.ts`: carrega grandes conjuntos de tabelas relacionadas para montar dados localmente.
- `src/lib/reports.functions.ts`: mantém e percorre pedidos e itens completos várias vezes.
- `src/lib/query-keys.ts`: foi criado, mas não possui uso real no código; integrar de forma consistente ou remover antes do commit.

## Ordem recomendada para continuar

1. Corrigir e testar o contexto de lojas do super-admin.
2. Corrigir a política SQL de `order_whatsapp_attempts` e revisar a migration.
3. Tornar a criação/reivindicação de tentativa WhatsApp atômica, incluindo recuperação de tentativas abandonadas.
4. Ajustar o fluxo de popup sem perder a ativação do clique.
5. Adicionar o evento automático de cancelamento.
6. Decidir e restaurar o fallback público do RPC, se essa disponibilidade continuar sendo requisito.
7. Corrigir migração do carrinho para preservar dados compatíveis.
8. Tornar sincronizações de plano e adicionais transacionais ou usar RPC seguro.
9. Verificar todas as respostas das consultas do super-admin.
10. Rodar novamente typecheck, testes, build, lint direcionado e validação visual no preview.
11. Só depois revisar o diff completo e preparar commit/push/deploy.

## Restrições mantidas

- Não alterar contratos públicos sem necessidade.
- Não fazer migration remota sem autorização explícita.
- Não publicar enquanto os bloqueadores acima não forem corrigidos.
- Não incluir `.env` ou `.env.local` em commit.
- Preservar isolamento por `storeId`, auditoria, permissões, query keys e comportamento da Central de Pedidos.
