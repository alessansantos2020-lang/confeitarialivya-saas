-- Ensure tables are enabled for RLS (already done, but reinforcing)
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- Widen grants for anonymous users to ensure Data API can process inserts
GRANT INSERT, SELECT ON public.orders TO anon, authenticated;
GRANT INSERT, SELECT ON public.order_items TO anon, authenticated;
GRANT ALL ON public.orders TO service_role;
GRANT ALL ON public.order_items TO service_role;

-- Ensure policies allow anonymous inserts without restriction for the delivery flow
DROP POLICY IF EXISTS "Allow public inserts for orders" ON public.orders;
CREATE POLICY "Allow public inserts for orders" ON public.orders FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public inserts for order items" ON public.order_items;
CREATE POLICY "Allow public inserts for order items" ON public.order_items FOR INSERT TO anon, authenticated WITH CHECK (true);

-- Ensure public can also select their own order if needed (or just true for simplicity in this stage)
DROP POLICY IF EXISTS "Allow public read access to orders" ON public.orders;
CREATE POLICY "Allow public read access to orders" ON public.orders FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Allow public read access to order items" ON public.order_items;
CREATE POLICY "Allow public read access to order items" ON public.order_items FOR SELECT TO anon, authenticated USING (true);