-- Permissões para anon e authenticated nas tabelas
GRANT INSERT ON public.orders TO anon, authenticated;
GRANT INSERT ON public.order_items TO anon, authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- Políticas para orders
DROP POLICY IF EXISTS "Allow public inserts for orders" ON public.orders;
CREATE POLICY "Allow public inserts for orders" ON public.orders 
  FOR INSERT TO anon, authenticated WITH CHECK (true);

-- Políticas para order_items
DROP POLICY IF EXISTS "Allow public inserts for order items" ON public.order_items;
CREATE POLICY "Allow public inserts for order items" ON public.order_items 
  FOR INSERT TO anon, authenticated WITH CHECK (true);
