ALTER TABLE public.store_settings 
ADD COLUMN IF NOT EXISTS auto_notify_whatsapp BOOLEAN DEFAULT false;

ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS client_notified BOOLEAN DEFAULT false;