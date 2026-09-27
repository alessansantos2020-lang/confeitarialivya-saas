-- ============================================================================
-- OFERTA RELÂMPAGO
-- ============================================================================
-- 100% aditiva: nenhuma tabela nova, nenhum produto duplicado. A Oferta
-- Relâmpago É a promoção que o produto já tem (is_on_sale + sale_price +
-- sale_start_at + sale_end_at, ver 20260904020000_product_promotions.sql).
-- Aqui só entram os dois textos opcionais que o modal promocional exibe:
-- título de impacto (headline) e mensagem curta. Sem eles o modal usa o
-- nome e a descrição do produto.
--
-- Preço cobrado continua sendo decidido pelo banco
-- (private.effective_product_price): fora da janela o preço volta sozinho
-- e o modal simplesmente deixa de ser exibido.
-- ============================================================================

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS flash_headline text,
  ADD COLUMN IF NOT EXISTS flash_message text;

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_flash_headline_length,
  ADD CONSTRAINT products_flash_headline_length
    CHECK (flash_headline IS NULL OR char_length(btrim(flash_headline)) BETWEEN 1 AND 80),
  DROP CONSTRAINT IF EXISTS products_flash_message_length,
  ADD CONSTRAINT products_flash_message_length
    CHECK (flash_message IS NULL OR char_length(btrim(flash_message)) BETWEEN 1 AND 140);

COMMENT ON COLUMN public.products.flash_headline IS
  'Título curto da Oferta Relâmpago no modal. NULL = usa o nome do produto.';
COMMENT ON COLUMN public.products.flash_message IS
  'Texto promocional da Oferta Relâmpago no modal. NULL = usa a descrição do produto.';

-- ----------------------------------------------------------------------------
-- get_public_catalog: passa a devolver também os textos do modal. Restante
-- idêntico à versão de 20260926000000_featured_products.sql.
-- ----------------------------------------------------------------------------
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
            'flash_headline', p.flash_headline,
            'flash_message', p.flash_message,
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
      AND EXISTS (
        SELECT 1 FROM public.stores s
        WHERE s.id = _store_id AND s.status = 'active'
      )
  ) categories_for_store;
$$;
