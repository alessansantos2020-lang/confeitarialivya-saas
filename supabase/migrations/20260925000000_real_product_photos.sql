-- Fotos reais (Unsplash) para todos os produtos, logo e capa da QUENTINHA EXPRES.

UPDATE public.store_settings
SET logo_url = 'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=480&h=480&q=80',
    cover_url = 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=1600&h=400&q=80',
    updated_at = now()
WHERE store_id = '00000000-0000-0000-0000-000000000001';

-- Quentinhas
UPDATE public.products SET image_url = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&h=400&q=80'
WHERE name = 'Quentinha Tradicional' AND store_id = '00000000-0000-0000-0000-000000000001';

UPDATE public.products SET image_url = 'https://images.unsplash.com/photo-1532550907401-a500c9a57435?auto=format&fit=crop&w=600&h=400&q=80'
WHERE name = 'Quentinha de Frango Grelhado' AND store_id = '00000000-0000-0000-0000-000000000001';

UPDATE public.products SET image_url = 'https://images.unsplash.com/photo-1529042410759-befb1204b468?auto=format&fit=crop&w=600&h=400&q=80'
WHERE name = 'Quentinha de Carne Moída' AND store_id = '00000000-0000-0000-0000-000000000001';

UPDATE public.products SET image_url = 'https://images.unsplash.com/photo-1600891964092-4316c288032e?auto=format&fit=crop&w=600&h=400&q=80'
WHERE name = 'Quentinha de Linguiça' AND store_id = '00000000-0000-0000-0000-000000000001';

UPDATE public.products SET image_url = 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=600&h=400&q=80'
WHERE name = 'Quentinha Vegetariana' AND store_id = '00000000-0000-0000-0000-000000000001';

UPDATE public.products SET image_url = 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?auto=format&fit=crop&w=600&h=400&q=80'
WHERE name = 'Quentinha de Peixe' AND store_id = '00000000-0000-0000-0000-000000000001';

UPDATE public.products SET image_url = 'https://images.unsplash.com/photo-1490645935967-10de6ba17061?auto=format&fit=crop&w=600&h=400&q=80'
WHERE name = 'Quentinha Fitness' AND store_id = '00000000-0000-0000-0000-000000000001';

UPDATE public.products SET image_url = 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=600&h=400&q=80'
WHERE name = 'Quentinha Especial da Casa' AND store_id = '00000000-0000-0000-0000-000000000001';

-- Combos
UPDATE public.products SET image_url = 'https://images.unsplash.com/photo-1476224203421-9ac39bcb3327?auto=format&fit=crop&w=600&h=400&q=80'
WHERE name = 'Combo Quentinha + Refrigerante' AND store_id = '00000000-0000-0000-0000-000000000001';

UPDATE public.products SET image_url = 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=600&h=400&q=80'
WHERE name = 'Combo Família' AND store_id = '00000000-0000-0000-0000-000000000001';

-- Sobremesas
UPDATE public.products SET image_url = 'https://images.unsplash.com/photo-1587049352846-4a222e784d38?auto=format&fit=crop&w=600&h=400&q=80'
WHERE name = 'Pudim de Leite Condensado' AND store_id = '00000000-0000-0000-0000-000000000001';

UPDATE public.products SET image_url = 'https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=600&h=400&q=80'
WHERE name = 'Mousse de Maracujá' AND store_id = '00000000-0000-0000-0000-000000000001';

UPDATE public.products SET image_url = 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=600&h=400&q=80'
WHERE name = 'Brownie de Chocolate' AND store_id = '00000000-0000-0000-0000-000000000001';

-- Bebidas
UPDATE public.products SET image_url = 'https://images.unsplash.com/photo-1548839140-29a749e1cf4d?auto=format&fit=crop&w=600&h=400&q=80'
WHERE name = 'Água Mineral 500ml' AND store_id = '00000000-0000-0000-0000-000000000001';

UPDATE public.products SET image_url = 'https://images.unsplash.com/photo-1624552184280-9e9631bbeee9?auto=format&fit=crop&w=600&h=400&q=80'
WHERE name = 'Refrigerante Lata 350ml' AND store_id = '00000000-0000-0000-0000-000000000001';

UPDATE public.products SET image_url = 'https://images.unsplash.com/photo-1523362628745-0c100150b504?auto=format&fit=crop&w=600&h=400&q=80'
WHERE name = 'Água com Gás 500ml' AND store_id = '00000000-0000-0000-0000-000000000001';

UPDATE public.products SET image_url = 'https://images.unsplash.com/photo-1613478223719-2ab802602423?auto=format&fit=crop&w=600&h=400&q=80'
WHERE name = 'Suco Natural de Laranja 500ml' AND store_id = '00000000-0000-0000-0000-000000000001';

UPDATE public.products SET image_url = 'https://images.unsplash.com/photo-1600271886742-f049cd451bba?auto=format&fit=crop&w=600&h=400&q=80'
WHERE name = 'Suco Natural de Maracujá 500ml' AND store_id = '00000000-0000-0000-0000-000000000001';

UPDATE public.products SET image_url = 'https://images.unsplash.com/photo-1553530666-ba11a7da3888?auto=format&fit=crop&w=600&h=400&q=80'
WHERE name = 'Suco Natural de Abacaxi 500ml' AND store_id = '00000000-0000-0000-0000-000000000001';
