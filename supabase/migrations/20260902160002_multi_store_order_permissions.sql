-- Fase 1 multi-loja (parte 3/3): restaura a granularidade de permissões em orders.
--
-- A migration anterior trocou o teste de permissão (view_orders/manage_orders)
-- por um teste de pertencimento à loja, o que afrouxou o acesso: qualquer
-- funcionário da loja passava a ver e alterar pedidos, mesmo sem a permissão.
-- Agora exige as DUAS coisas: ser da loja E ter a permissão.

DROP POLICY IF EXISTS "Store staff can view orders" ON public.orders;
CREATE POLICY "Store staff can view orders" ON public.orders
  FOR SELECT TO authenticated
  USING (
    private.is_store_member(auth.uid(), store_id)
    AND (
      private.has_permission(auth.uid(), 'view_orders')
      OR private.has_permission(auth.uid(), 'manage_orders')
    )
  );

DROP POLICY IF EXISTS "Store staff can update orders" ON public.orders;
CREATE POLICY "Store staff can update orders" ON public.orders
  FOR UPDATE TO authenticated
  USING (
    private.is_store_member(auth.uid(), store_id)
    AND private.has_permission(auth.uid(), 'manage_orders')
  )
  WITH CHECK (
    private.is_store_member(auth.uid(), store_id)
    AND private.has_permission(auth.uid(), 'manage_orders')
  );

DROP POLICY IF EXISTS "Store admins can delete orders" ON public.orders;
CREATE POLICY "Store admins can delete orders" ON public.orders
  FOR DELETE TO authenticated
  USING (
    private.is_store_admin(auth.uid(), store_id)
    AND private.has_permission(auth.uid(), 'manage_orders')
  );

DROP POLICY IF EXISTS "Store staff can view order items" ON public.order_items;
CREATE POLICY "Store staff can view order items" ON public.order_items
  FOR SELECT TO authenticated
  USING (
    private.is_store_member(auth.uid(), store_id)
    AND (
      private.has_permission(auth.uid(), 'view_orders')
      OR private.has_permission(auth.uid(), 'manage_orders')
    )
  );
