-- Create delivery_fees table
CREATE TABLE public.delivery_fees (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    neighborhood text NOT NULL UNIQUE,
    fee numeric NOT NULL DEFAULT 0,
    status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Grants
GRANT SELECT ON public.delivery_fees TO anon;
GRANT SELECT ON public.delivery_fees TO authenticated;
GRANT ALL ON public.delivery_fees TO authenticated;
GRANT ALL ON public.delivery_fees TO service_role;

-- RLS
ALTER TABLE public.delivery_fees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to delivery_fees" ON public.delivery_fees FOR SELECT TO anon USING (true);
CREATE POLICY "Admins can manage delivery_fees" ON public.delivery_fees FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Seed some initial data
INSERT INTO public.delivery_fees (neighborhood, fee, status) VALUES
('Centro', 5.00, 'active'),
('Bairro A', 7.00, 'active'),
('Bairro B', 10.00, 'active');
