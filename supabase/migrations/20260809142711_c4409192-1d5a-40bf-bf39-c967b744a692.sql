ALTER TABLE public.store_settings ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.store_settings ADD COLUMN IF NOT EXISTS whatsapp TEXT;
ALTER TABLE public.store_settings ADD COLUMN IF NOT EXISTS instagram TEXT;
ALTER TABLE public.store_settings ADD COLUMN IF NOT EXISTS address TEXT;

GRANT ALL ON public.store_settings TO authenticated;
GRANT ALL ON public.store_settings TO service_role;
GRANT SELECT ON public.store_settings TO anon;
