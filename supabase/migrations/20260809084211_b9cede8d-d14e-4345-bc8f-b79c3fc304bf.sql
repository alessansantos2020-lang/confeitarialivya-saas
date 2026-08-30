
-- Create categories table
CREATE TABLE public.categories (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    sort_order integer NOT NULL DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Add category_id to products and link it
ALTER TABLE public.products ADD COLUMN category_id uuid REFERENCES public.categories(id);

-- Grants
GRANT SELECT ON public.categories TO anon;
GRANT ALL ON public.categories TO authenticated;
GRANT ALL ON public.categories TO service_role;

-- RLS
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to categories" ON public.categories FOR SELECT TO anon USING (true);
CREATE POLICY "Admins can manage categories" ON public.categories FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
