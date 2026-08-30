-- Ensure proper grants for orders and order_items
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_items TO anon, authenticated;

-- Ensure service_role has all permissions
GRANT ALL ON public.orders TO service_role;
GRANT ALL ON public.order_items TO service_role;

-- If RLS is enabled, ensure policies allow anonymous inserts for delivery
DROP POLICY IF EXISTS "Enable insert for everyone" ON public.orders;
CREATE POLICY "Enable insert for everyone" ON public.orders FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Enable read for everyone" ON public.orders;
CREATE POLICY "Enable read for everyone" ON public.orders FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Enable insert for everyone" ON public.order_items;
CREATE POLICY "Enable insert for everyone" ON public.order_items FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Enable read for everyone" ON public.order_items;
CREATE POLICY "Enable read for everyone" ON public.order_items FOR SELECT TO anon, authenticated USING (true);