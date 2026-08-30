-- Add payment_method and observation to orders
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_method text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS observation text;

-- Add observation and selected_addons to order_items
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS observation text;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS selected_addons jsonb;
