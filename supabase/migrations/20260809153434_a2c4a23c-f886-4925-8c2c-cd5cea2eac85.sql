-- Ensure RLS is enabled and policies allow authenticated admins to select/insert/update/delete
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid duplicates
DROP POLICY IF EXISTS "Admins can manage categories" ON public.categories;
DROP POLICY IF EXISTS "Anyone can view categories" ON public.categories;

-- Policy for admins
CREATE POLICY "Admins can manage categories"
ON public.categories
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Policy for public viewing (needed for the delivery page)
CREATE POLICY "Anyone can view categories"
ON public.categories
FOR SELECT
TO anon, authenticated
USING (true);

-- Ensure grants are correct
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT SELECT ON public.categories TO anon;
GRANT ALL ON public.categories TO service_role;
