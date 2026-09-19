-- ============================================================================
-- TRANSFORMAÇÃO COMPLETA DA LOJA PADRÃO: Confeitaria Livya -> QUENTINHA EXPRES
-- ============================================================================
-- Renomeia loja, slug, configurações, categorias e produtos. Produtos existentes
-- são RENOMEADOS (não apagados) para preservar o histórico de pedidos —
-- order_items guarda snapshot de nome/preço, então pedidos antigos não quebram.
-- Reset de promoções (is_on_sale/sale_price) para não herdar descontos antigos.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. LOJA E CONFIGURAÇÕES
-- ----------------------------------------------------------------------------
UPDATE public.stores
SET name = 'QUENTINHA EXPRES',
    slug = 'quentinha-expres',
    updated_at = now()
WHERE id = '00000000-0000-0000-0000-000000000001';

UPDATE public.store_settings
SET name = 'QUENTINHA EXPRES',
    description = 'Quentinhas caseiras prontas, generosas e feitas na hora. Peça sua marmita!',
    opening_hours = 'Segunda a Sábado: 10:00 - 15:00',
    logo_url = 'https://placehold.co/240x240/EA580C/FFFFFF.png?text=QE',
    cover_url = 'https://placehold.co/1600x400/EA580C/FFFFFF.png?text=QUENTINHA+EXPRES',
    primary_color = '#ea580c',
    secondary_color = '#fff7ed',
    updated_at = now()
WHERE store_id = '00000000-0000-0000-0000-000000000001';

-- ----------------------------------------------------------------------------
-- 2. CATEGORIAS (renomeadas, sem apagar)
-- ----------------------------------------------------------------------------
UPDATE public.categories SET name = 'Quentinhas',  sort_order = 10, image_url = NULL WHERE id = 'a2aced2e-86ec-49c1-ba24-3e152a9f94c0';
UPDATE public.categories SET name = 'Combos',      sort_order = 20, image_url = NULL WHERE id = 'dfebaff4-aa4a-4213-b7cf-7f9a7f29fb1b';
UPDATE public.categories SET name = 'Sobremesas',  sort_order = 30, image_url = NULL WHERE id = 'edfb4dcf-1f8b-4e35-8afd-29ccba9c32aa';
UPDATE public.categories SET name = 'Bebidas',     sort_order = 40, image_url = NULL WHERE id = 'b62ea98b-4d70-43bf-bbf8-65d01b67438b';

-- ----------------------------------------------------------------------------
-- 3. PRODUTOS EXISTENTES RENOMEADOS
-- ----------------------------------------------------------------------------
UPDATE public.products SET
  name = 'Combo Quentinha + Refrigerante',
  description = 'Quentinha tradicional + refrigerante lata 350ml. Almoço completo e gelado.',
  price = 22.90,
  image_url = 'https://placehold.co/600x400/16A34A/FFFFFF.png?text=Combo+Quentinha%2BRefri',
  is_featured = true,
  is_on_sale = false, sale_price = NULL, sale_start_at = NULL, sale_end_at = NULL
WHERE id = '8603b1aa-b2ca-47f6-b8f1-1d1ff89f9e21';

UPDATE public.products SET
  name = 'Combo Família',
  description = '2 quentinhas grandes + 2 refrigerantes lata. Serve bem a família toda.',
  price = 45.90,
  image_url = 'https://placehold.co/600x400/16A34A/FFFFFF.png?text=Combo+Fam%C3%ADlia',
  is_featured = false,
  is_on_sale = false, sale_price = NULL, sale_start_at = NULL, sale_end_at = NULL
WHERE id = '22c03b23-7e9b-4c3d-aedd-2558e97bbd53';

UPDATE public.products SET
  name = 'Pudim de Leite Condensado',
  description = 'Fatia generosa de pudim cremoso com calda de caramelo.',
  price = 8.00,
  image_url = 'https://placehold.co/600x400/DB2777/FFFFFF.png?text=Pudim+de+Leite',
  is_featured = false,
  is_on_sale = false, sale_price = NULL, sale_start_at = NULL, sale_end_at = NULL
WHERE id = '2f19aa08-d89c-4a22-b2d3-9955840f5394';

UPDATE public.products SET
  name = 'Mousse de Maracujá',
  description = 'Mousse cremosa de maracujá com calda da fruta.',
  price = 7.00,
  image_url = 'https://placehold.co/600x400/DB2777/FFFFFF.png?text=Mousse+de+Maracuj%C3%A1',
  is_featured = false,
  is_on_sale = false, sale_price = NULL, sale_start_at = NULL, sale_end_at = NULL
WHERE id = '9fafc6c3-9042-419b-98eb-4c9ade39be05';

UPDATE public.products SET
  name = 'Brownie de Chocolate',
  description = 'Brownie macio por dentro, crocante por fora, com gotas de chocolate.',
  price = 9.00,
  image_url = 'https://placehold.co/600x400/DB2777/FFFFFF.png?text=Brownie',
  is_featured = false,
  is_on_sale = false, sale_price = NULL, sale_start_at = NULL, sale_end_at = NULL
WHERE id = '346b863c-0afe-40ba-bc4b-7867c284f977';

UPDATE public.products SET
  name = 'Água Mineral 500ml',
  description = 'Água mineral gelada, garrafa 500ml.',
  price = 3.00,
  image_url = 'https://placehold.co/600x400/0EA5E9/FFFFFF.png?text=%C3%81gua+Mineral',
  is_featured = false,
  is_on_sale = false, sale_price = NULL, sale_start_at = NULL, sale_end_at = NULL
WHERE id = '08c0c6d7-6287-4bbf-91f7-37c30efd2712';

UPDATE public.products SET
  name = 'Refrigerante Lata 350ml',
  description = 'Coca-Cola, Guaraná Antarctica, Fanta Laranja ou Sprite. Informe a preferência na observação.',
  price = 5.50,
  image_url = 'https://placehold.co/600x400/0EA5E9/FFFFFF.png?text=Refrigerante+Lata',
  is_featured = true,
  is_on_sale = false, sale_price = NULL, sale_start_at = NULL, sale_end_at = NULL
WHERE id = '9e6fd4bd-7a4d-473b-b48e-06fde0f04d8f';

-- ----------------------------------------------------------------------------
-- 4. NOVAS QUENTINHAS (categoria antiga "Açaí", sem produtos)
-- ----------------------------------------------------------------------------
INSERT INTO public.products (store_id, category_id, name, description, price, image_url, is_available, is_featured) VALUES
('00000000-0000-0000-0000-000000000001', 'a2aced2e-86ec-49c1-ba24-3e152a9f94c0', 'Quentinha Tradicional', 'Arroz, feijão caseiro, bife grelhado e salada fresca.', 18.90, 'https://placehold.co/600x400/EA580C/FFFFFF.png?text=Quentinha+Tradicional', true, true),
('00000000-0000-0000-0000-000000000001', 'a2aced2e-86ec-49c1-ba24-3e152a9f94c0', 'Quentinha de Frango Grelhado', 'Arroz, feijão caseiro, filé de frango grelhado e salada.', 17.90, 'https://placehold.co/600x400/EA580C/FFFFFF.png?text=Quentinha+de+Frango', true, false),
('00000000-0000-0000-0000-000000000001', 'a2aced2e-86ec-49c1-ba24-3e152a9f94c0', 'Quentinha de Carne Moída', 'Arroz, feijão caseiro, carne moída temperada e salada.', 19.90, 'https://placehold.co/600x400/EA580C/FFFFFF.png?text=Carne+Mo%C3%ADda', true, false),
('00000000-0000-0000-0000-000000000001', 'a2aced2e-86ec-49c1-ba24-3e152a9f94c0', 'Quentinha de Linguiça', 'Arroz, feijão caseiro, linguiça calabresa acebolada e salada.', 18.90, 'https://placehold.co/600x400/EA580C/FFFFFF.png?text=Quentinha+de+Lingui%C3%A7a', true, false),
('00000000-0000-0000-0000-000000000001', 'a2aced2e-86ec-49c1-ba24-3e152a9f94c0', 'Quentinha Vegetariana', 'Arroz, feijão caseiro, omelete cremoso e legumes no vapor.', 16.90, 'https://placehold.co/600x400/EA580C/FFFFFF.png?text=Vegetariana', true, false),
('00000000-0000-0000-0000-000000000001', 'a2aced2e-86ec-49c1-ba24-3e152a9f94c0', 'Quentinha de Peixe', 'Arroz, feijão caseiro, filé de peixe grelhado e salada.', 22.90, 'https://placehold.co/600x400/EA580C/FFFFFF.png?text=Quentinha+de+Peixe', true, false),
('00000000-0000-0000-0000-000000000001', 'a2aced2e-86ec-49c1-ba24-3e152a9f94c0', 'Quentinha Fitness', 'Arroz integral, peito de frango grelhado, brócolis e cenoura.', 21.90, 'https://placehold.co/600x400/EA580C/FFFFFF.png?text=Quentinha+Fitness', true, false),
('00000000-0000-0000-0000-000000000001', 'a2aced2e-86ec-49c1-ba24-3e152a9f94c0', 'Quentinha Especial da Casa', 'Arroz, feijão caseiro, contra-filé, bacon crocante e ovo frito.', 24.90, 'https://placehold.co/600x400/EA580C/FFFFFF.png?text=Especial+da+Casa', true, true);

-- ----------------------------------------------------------------------------
-- 5. NOVAS BEBIDAS
-- ----------------------------------------------------------------------------
INSERT INTO public.products (store_id, category_id, name, description, price, image_url, is_available, is_featured) VALUES
('00000000-0000-0000-0000-000000000001', 'b62ea98b-4d70-43bf-bbf8-65d01b67438b', 'Água com Gás 500ml', 'Água mineral com gás, garrafa 500ml.', 4.00, 'https://placehold.co/600x400/0EA5E9/FFFFFF.png?text=%C3%81gua+com+G%C3%A1s', true, false),
('00000000-0000-0000-0000-000000000001', 'b62ea98b-4d70-43bf-bbf8-65d01b67438b', 'Suco Natural de Laranja 500ml', 'Suco natural feito na hora, 500ml.', 8.00, 'https://placehold.co/600x400/0EA5E9/FFFFFF.png?text=Suco+de+Laranja', true, false),
('00000000-0000-0000-0000-000000000001', 'b62ea98b-4d70-43bf-bbf8-65d01b67438b', 'Suco Natural de Maracujá 500ml', 'Suco natural de maracujá feito na hora, 500ml.', 8.50, 'https://placehold.co/600x400/0EA5E9/FFFFFF.png?text=Suco+de+Maracuj%C3%A1', true, false),
('00000000-0000-0000-0000-000000000001', 'b62ea98b-4d70-43bf-bbf8-65d01b67438b', 'Suco Natural de Abacaxi 500ml', 'Suco natural de abacaxi feito na hora, 500ml.', 8.00, 'https://placehold.co/600x400/0EA5E9/FFFFFF.png?text=Suco+de+Abacaxi', true, false);
