-- Add status to orders if it doesn't already allow these values
-- The current 'pending' status will be mapped to 'novo'
-- Just in case, let's make sure the delivery_fee is captured on the order if it's not already.
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_fee numeric DEFAULT 0;

-- Grant access to orders for authenticated users (admins)
GRANT ALL ON public.orders TO authenticated;
GRANT SELECT ON public.orders TO anon;
GRANT INSERT ON public.orders TO anon;

GRANT ALL ON public.order_items TO authenticated;
GRANT SELECT ON public.order_items TO anon;
GRANT INSERT ON public.order_items TO anon;
