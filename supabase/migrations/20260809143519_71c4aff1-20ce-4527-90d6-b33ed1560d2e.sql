ALTER TABLE public.store_settings ADD COLUMN IF NOT EXISTS primary_color text DEFAULT '#db2777';
ALTER TABLE public.store_settings ADD COLUMN IF NOT EXISTS secondary_color text DEFAULT '#fdf2f8';

-- Ensure authenticated role has access to these new columns if they were created before
GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_settings TO authenticated;
GRANT ALL ON public.store_settings TO service_role;
GRANT SELECT ON public.store_settings TO anon;
