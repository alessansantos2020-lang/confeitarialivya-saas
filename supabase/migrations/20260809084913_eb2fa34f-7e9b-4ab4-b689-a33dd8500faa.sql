
-- Create addon groups table
CREATE TABLE public.addon_groups (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    min_quantity integer NOT NULL DEFAULT 0,
    max_quantity integer NOT NULL DEFAULT 1,
    is_required boolean NOT NULL DEFAULT false,
    status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Create addons table
CREATE TABLE public.addons (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id uuid REFERENCES public.addon_groups(id) ON DELETE CASCADE NOT NULL,
    name text NOT NULL,
    price numeric NOT NULL DEFAULT 0,
    status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Relationship table for products and addon groups
CREATE TABLE public.product_addon_groups (
    product_id uuid REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
    group_id uuid REFERENCES public.addon_groups(id) ON DELETE CASCADE NOT NULL,
    PRIMARY KEY (product_id, group_id)
);

-- Grants
GRANT ALL ON public.addon_groups TO authenticated;
GRANT ALL ON public.addon_groups TO service_role;
GRANT SELECT ON public.addon_groups TO anon;

GRANT ALL ON public.addons TO authenticated;
GRANT ALL ON public.addons TO service_role;
GRANT SELECT ON public.addons TO anon;

GRANT ALL ON public.product_addon_groups TO authenticated;
GRANT ALL ON public.product_addon_groups TO service_role;
GRANT SELECT ON public.product_addon_groups TO anon;

-- RLS
ALTER TABLE public.addon_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.addons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_addon_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to addon_groups" ON public.addon_groups FOR SELECT TO anon USING (true);
CREATE POLICY "Admins can manage addon_groups" ON public.addon_groups FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Allow public read access to addons" ON public.addons FOR SELECT TO anon USING (true);
CREATE POLICY "Admins can manage addons" ON public.addons FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Allow public read access to product_addon_groups" ON public.product_addon_groups FOR SELECT TO anon USING (true);
CREATE POLICY "Admins can manage product_addon_groups" ON public.product_addon_groups FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
