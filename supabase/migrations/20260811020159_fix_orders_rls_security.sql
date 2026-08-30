-- Correção de segurança: as policies antigas permitiam que QUALQUER pessoa
-- (papel "anon", ou seja, sem login) lesse a tabela orders/order_items
-- inteira via API REST do Supabase usando a chave pública (anon key), que
-- fica embutida no bundle do front-end. Isso expunha nome, telefone e
-- endereço de todos os clientes.
--
-- Mantemos o INSERT público (necessário para o checkout da loja), mas
-- restringimos a LEITURA a usuários autenticados com a permissão adequada.

-- 1. Remover todas as policies de leitura pública conhecidas em orders/order_items
DROP POLICY IF EXISTS "Enable read for everyone" ON public.orders;
DROP POLICY IF EXISTS "Allow public read access to orders" ON public.orders;
DROP POLICY IF EXISTS "Enable read for everyone" ON public.order_items;
DROP POLICY IF EXISTS "Allow public read access to order items" ON public.order_items;

-- 2. Remover a policy de escrita antiga baseada só em role admin (será
--    substituída por uma baseada no sistema de permissões, que já trata
--    admins como "tem todas as permissões" dentro de has_permission()).
DROP POLICY IF EXISTS "Admins can manage orders" ON public.orders;

-- 3. Leitura de pedidos: exige permissão view_orders ou manage_orders
--    (has_permission já retorna true automaticamente para admins).
CREATE POLICY "Staff with permission can view orders"
  ON public.orders FOR SELECT TO authenticated
  USING (
    public.has_permission(auth.uid(), 'view_orders')
    OR public.has_permission(auth.uid(), 'manage_orders')
  );

-- 4. Escrita de pedidos (status, notificação, etc.): exige manage_orders.
CREATE POLICY "Staff with permission can manage orders"
  ON public.orders FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), 'manage_orders'))
  WITH CHECK (public.has_permission(auth.uid(), 'manage_orders'));

-- 5. Itens de pedido: leitura segue a mesma regra de orders.
CREATE POLICY "Staff with permission can view order items"
  ON public.order_items FOR SELECT TO authenticated
  USING (
    public.has_permission(auth.uid(), 'view_orders')
    OR public.has_permission(auth.uid(), 'manage_orders')
  );

-- 6. Taxas de entrega: alinhar a policy de gestão ao sistema de permissões
--    (antes só admins conseguiam gerenciar; agora funcionários com a
--    permissão manage_delivery também conseguem, como a tela de admin sugere).
DROP POLICY IF EXISTS "Admins can manage delivery_fees" ON public.delivery_fees;

CREATE POLICY "Staff with permission can manage delivery_fees"
  ON public.delivery_fees FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), 'manage_delivery'))
  WITH CHECK (public.has_permission(auth.uid(), 'manage_delivery'));
