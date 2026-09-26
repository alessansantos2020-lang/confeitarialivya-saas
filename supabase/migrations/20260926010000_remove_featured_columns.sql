-- Remove os metadados de produtos em destaque adicionados em
-- 20260926000000_featured_products.sql. Nenhum dado de negócio é afetado:
-- as colunas eram usadas apenas pela funcionalidade revertida.

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_featured_window_valid,
  DROP CONSTRAINT IF EXISTS products_featured_badge_length,
  DROP CONSTRAINT IF EXISTS products_featured_sort_order_nonnegative;

DROP INDEX IF EXISTS public.idx_products_featured_store_order;

ALTER TABLE public.products
  DROP COLUMN IF EXISTS featured_end_at,
  DROP COLUMN IF EXISTS featured_start_at,
  DROP COLUMN IF EXISTS featured_badge,
  DROP COLUMN IF EXISTS featured_sort_order;

ALTER TABLE public.store_settings
  DROP CONSTRAINT IF EXISTS store_settings_featured_title_length;

ALTER TABLE public.store_settings
  DROP COLUMN IF EXISTS featured_section_title;

-- Restaura as RPCs públicas ao estado do commit 9f7af34, sem os campos
-- de destaque nem o filtro extra de loja ativa (a rota web já valida o slug).
CREATE OR REPLACE FUNCTION public.get_public_store(_store_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
  SELECT jsonb_build_object(
    'store', jsonb_build_object(
      'id', s.id,
      'name', s.name,
      'slug', s.slug,
      'owner_id', NULL,
      'status', s.status,
      'created_at', s.created_at
    ),
    'settings', COALESCE((
      SELECT jsonb_build_object(
        'store_id', ss.store_id,
        'name', ss.name,
        'description', ss.description,
        'logo_url', ss.logo_url,
        'cover_url', ss.cover_url,
        'opening_hours', ss.opening_hours,
        'is_open', ss.is_open,
        'phone', ss.phone,
        'whatsapp', ss.whatsapp,
        'instagram', ss.instagram,
        'address', ss.address,
        'primary_color', ss.primary_color,
        'secondary_color', ss.secondary_color,
        'auto_notify_whatsapp', false,
        'whatsapp_accept_enabled', false,
        'whatsapp_cancel_enabled', false,
        'whatsapp_shipping_enabled', false,
        'whatsapp_template_aceito', NULL,
        'whatsapp_template_cancelado', NULL,
        'whatsapp_template_recebido', NULL,
        'whatsapp_template_saida_entrega', NULL
      )
      FROM public.store_settings ss
      WHERE ss.store_id = s.id
    ), jsonb_build_object(
      'store_id', s.id,
      'name', s.name,
      'description', 'Produtos selecionados, entrega rápida.',
      'logo_url', NULL,
      'cover_url', NULL,
      'opening_hours', NULL,
      'is_open', true,
      'phone', NULL,
      'whatsapp', NULL,
      'instagram', NULL,
      'address', NULL,
      'primary_color', '#1d4ed8',
      'secondary_color', '#eff6ff',
      'auto_notify_whatsapp', false,
      'whatsapp_accept_enabled', false,
      'whatsapp_cancel_enabled', false,
      'whatsapp_shipping_enabled', false,
      'whatsapp_template_aceito', NULL,
      'whatsapp_template_cancelado', NULL,
      'whatsapp_template_recebido', NULL,
      'whatsapp_template_saida_entrega', NULL
    ))
  )
  FROM public.stores s
  WHERE s.id = _store_id AND s.status = 'active';
$$;

CREATE OR REPLACE FUNCTION public.get_public_catalog(_store_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
  SELECT COALESCE(jsonb_agg(category_data ORDER BY category_data->>'sort_order'), '[]'::jsonb)
  FROM (
    SELECT jsonb_build_object(
      'id', c.id,
      'name', c.name,
      'image_url', c.image_url,
      'sort_order', c.sort_order,
      'status', c.status,
      'products', COALESCE((
        SELECT jsonb_agg(product_data ORDER BY product_data->>'name')
        FROM (
          SELECT jsonb_build_object(
            'id', p.id,
            'name', p.name,
            'description', p.description,
            'price', p.price,
            'effective_price', private.effective_product_price(p.id),
            'image_url', p.image_url,
            'is_available', p.is_available,
            'is_featured', p.is_featured,
            'is_on_sale', p.is_on_sale,
            'sale_price', p.sale_price,
            'sale_start_at', p.sale_start_at,
            'sale_end_at', p.sale_end_at,
            'category_id', p.category_id,
            'addons', COALESCE((
              SELECT jsonb_agg(jsonb_build_object(
                'group', jsonb_build_object(
                  'id', ag.id,
                  'name', ag.name,
                  'min_quantity', ag.min_quantity,
                  'max_quantity', ag.max_quantity,
                  'is_required', ag.is_required,
                  'status', ag.status,
                  'items', COALESCE((
                    SELECT jsonb_agg(jsonb_build_object(
                      'id', a.id,
                      'name', a.name,
                      'price', a.price,
                      'status', a.status
                    ) ORDER BY a.name)
                    FROM public.addons a
                    WHERE a.group_id = ag.id
                      AND a.store_id = _store_id
                      AND a.status = 'active'
                  ), '[]'::jsonb)
                )
              ) ORDER BY ag.name)
              FROM public.product_addon_groups pag
              JOIN public.addon_groups ag
                ON ag.id = pag.group_id
               AND ag.store_id = _store_id
               AND ag.status = 'active'
              WHERE pag.product_id = p.id
                AND pag.store_id = _store_id
            ), '[]'::jsonb)
          ) AS product_data
          FROM public.products p
          WHERE p.store_id = _store_id
            AND p.category_id = c.id
            AND p.is_available = true
        ) products_for_category
      ), '[]'::jsonb)
    ) AS category_data
    FROM public.categories c
    WHERE c.store_id = _store_id
      AND c.status = 'active'
  ) categories_for_store;
$$;
