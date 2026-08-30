
-- Add featured column to products
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS is_featured boolean DEFAULT false;

-- Ensure category_id column exists (already added in previous turn but double checking)
-- Update constraints if necessary
ALTER TABLE public.products ALTER COLUMN category_id SET NOT NULL;

-- Fix the products grants since we updated it
GRANT ALL ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
GRANT SELECT ON public.products TO anon;
