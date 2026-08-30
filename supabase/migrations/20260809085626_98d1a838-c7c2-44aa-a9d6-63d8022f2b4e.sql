CREATE TABLE public.store_settings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL DEFAULT 'Confeitaria Artesanal',
    description text DEFAULT 'Bolos, doces e sobremesas feitas com amor.',
    logo_url text,
    cover_url text,
    opening_hours text DEFAULT 'Segunda a Sábado: 09:00 - 18:00',
    is_open boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

GRANT SELECT ON public.store_settings TO anon;
GRANT SELECT ON public.store_settings TO authenticated;
GRANT ALL ON public.store_settings TO service_role;

ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access for store settings" ON public.store_settings FOR SELECT TO anon USING (true);
CREATE POLICY "Admins can manage store settings" ON public.store_settings FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.store_settings (name, description) 
VALUES ('Confeitaria Artesanal', 'Doces e bolos artesanais feitos com carinho para você.');