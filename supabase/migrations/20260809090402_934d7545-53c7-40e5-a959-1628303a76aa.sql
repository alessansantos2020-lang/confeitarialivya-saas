-- Seeding more products with illustrative images.
-- We use subqueries to find category IDs instead of hardcoded unique constraints.

DO $$
DECLARE
    cat_cakes_id uuid;
    cat_sweets_id uuid;
    cat_beverages_id uuid;
BEGIN
    -- Ensure categories exist (using simple insert or fetch)
    -- If 'Bolos Artesanais' doesn't exist, create it.
    INSERT INTO public.categories (name, status, sort_order)
    SELECT 'Bolos Artesanais', 'active', 1
    WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE name = 'Bolos Artesanais');

    INSERT INTO public.categories (name, status, sort_order)
    SELECT 'Doces Finos', 'active', 2
    WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE name = 'Doces Finos');

    INSERT INTO public.categories (name, status, sort_order)
    SELECT 'Bebidas', 'active', 3
    WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE name = 'Bebidas');

    -- Get IDs
    SELECT id INTO cat_cakes_id FROM public.categories WHERE name = 'Bolos Artesanais' LIMIT 1;
    SELECT id INTO cat_sweets_id FROM public.categories WHERE name = 'Doces Finos' LIMIT 1;
    SELECT id INTO cat_beverages_id FROM public.categories WHERE name = 'Bebidas' LIMIT 1;

    -- Seed Products (using WHERE NOT EXISTS to avoid duplicates if re-run)
    INSERT INTO public.products (name, description, price, image_url, category_id, is_available, is_featured)
    SELECT 'Bolo Red Velvet', 'Massa aveludada com toque de cacau e recheio cremoso de cream cheese.', 85.00, 'https://images.unsplash.com/photo-1586788680434-30d324631ff6?auto=format&fit=crop&q=80&w=800', cat_cakes_id, true, true
    WHERE NOT EXISTS (SELECT 1 FROM public.products WHERE name = 'Bolo Red Velvet');

    INSERT INTO public.products (name, description, price, image_url, category_id, is_available, is_featured)
    SELECT 'Bolo de Cenoura com Brigadeiro', 'O clássico fofinho com cobertura generosa de brigadeiro gourmet.', 45.00, 'https://images.unsplash.com/photo-1621303837174-89787a7d4729?auto=format&fit=crop&q=80&w=800', cat_cakes_id, true, false
    WHERE NOT EXISTS (SELECT 1 FROM public.products WHERE name = 'Bolo de Cenoura com Brigadeiro');

    INSERT INTO public.products (name, description, price, image_url, category_id, is_available, is_featured)
    SELECT 'Brownie de Chocolate Belga', 'Brownie denso e molhadinho feito com chocolate 70% cacau.', 12.00, 'https://images.unsplash.com/photo-1606312619070-d48b4c652a52?auto=format&fit=crop&q=80&w=800', cat_sweets_id, true, true
    WHERE NOT EXISTS (SELECT 1 FROM public.products WHERE name = 'Brownie de Chocolate Belga');

    INSERT INTO public.products (name, description, price, image_url, category_id, is_available, is_featured)
    SELECT 'Combo 6 Brigadeiros Gourmet', 'Caixa com 6 unidades de brigadeiros variados (Tradicional, Ninho, Pistache).', 28.00, 'https://images.unsplash.com/photo-1599599810769-bcde5a160d32?auto=format&fit=crop&q=80&w=800', cat_sweets_id, true, false
    WHERE NOT EXISTS (SELECT 1 FROM public.products WHERE name = 'Combo 6 Brigadeiros Gourmet');

    INSERT INTO public.products (name, description, price, image_url, category_id, is_available, is_featured)
    SELECT 'Cheesecake de Frutas Vermelhas', 'Base crocante de biscoito, creme de queijo leve e calda artesanal de frutas vermelhas.', 75.00, 'https://images.unsplash.com/photo-1533134242443-d4fd215305ad?auto=format&fit=crop&q=80&w=800', cat_cakes_id, true, false
    WHERE NOT EXISTS (SELECT 1 FROM public.products WHERE name = 'Cheesecake de Frutas Vermelhas');

    INSERT INTO public.products (name, description, price, image_url, category_id, is_available, is_featured)
    SELECT 'Cappuccino Especial', 'Café expresso, leite vaporizado e um toque de canela e cacau.', 14.00, 'https://images.unsplash.com/photo-1534778101976-62847782c213?auto=format&fit=crop&q=80&w=800', cat_beverages_id, true, false
    WHERE NOT EXISTS (SELECT 1 FROM public.products WHERE name = 'Cappuccino Especial');

    INSERT INTO public.products (name, description, price, image_url, category_id, is_available, is_featured)
    SELECT 'Soda Italiana Morango', 'Refrescante bebida gaseificada com xarope artesanal de morango.', 16.00, 'https://images.unsplash.com/photo-1556881286-fc6915169721?auto=format&fit=crop&q=80&w=800', cat_beverages_id, true, false
    WHERE NOT EXISTS (SELECT 1 FROM public.products WHERE name = 'Soda Italiana Morango');

    INSERT INTO public.products (name, description, price, image_url, category_id, is_available, is_featured)
    SELECT 'Mil-Folhas de Baunilha', 'Massa folhada crocante intercalada com creme de baunilha Bourbon.', 18.00, 'https://images.unsplash.com/photo-1626803775151-61d756612f97?auto=format&fit=crop&q=80&w=800', cat_sweets_id, true, true
    WHERE NOT EXISTS (SELECT 1 FROM public.products WHERE name = 'Mil-Folhas de Baunilha');
END $$;
