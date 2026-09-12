-- Catálogo público por loja e Storage com isolamento de escrita por tenant.

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

CREATE OR REPLACE FUNCTION public.get_public_store_by_slug(_slug text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
  SELECT public.get_public_store(s.id)
  FROM public.stores s
  WHERE lower(trim(s.slug)) = lower(trim(_slug))
    AND s.status = 'active'
  LIMIT 1;
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

CREATE OR REPLACE FUNCTION public.get_public_delivery_fees(_store_id uuid)
RETURNS TABLE (neighborhood text, fee numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
  SELECT df.neighborhood, df.fee
  FROM public.delivery_fees df
  JOIN public.stores s ON s.id = df.store_id AND s.status = 'active'
  WHERE df.store_id = _store_id AND df.status = 'active'
  ORDER BY df.neighborhood;
$$;

REVOKE ALL ON FUNCTION public.get_public_store(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_public_store_by_slug(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_public_catalog(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_public_delivery_fees(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_store(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_store_by_slug(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_catalog(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_delivery_fees(uuid) TO anon, authenticated;

-- Público consulta somente via RPC. Painel autenticado consulta apenas sua loja.
REVOKE SELECT ON public.stores, public.categories, public.products, public.addon_groups,
  public.addons, public.product_addon_groups, public.delivery_fees,
  public.store_settings FROM anon;

DROP POLICY IF EXISTS "Public can view active stores" ON public.stores;
DROP POLICY IF EXISTS "Allow public read access to categories" ON public.categories;
DROP POLICY IF EXISTS "Anyone can view categories" ON public.categories;
DROP POLICY IF EXISTS "Allow public read access to products" ON public.products;
DROP POLICY IF EXISTS "Allow public read access to addon_groups" ON public.addon_groups;
DROP POLICY IF EXISTS "Allow public read access to addons" ON public.addons;
DROP POLICY IF EXISTS "Allow public read access to product_addon_groups" ON public.product_addon_groups;
DROP POLICY IF EXISTS "Allow public read access to delivery_fees" ON public.delivery_fees;
DROP POLICY IF EXISTS "Allow public read access to store_settings" ON public.store_settings;
DROP POLICY IF EXISTS "Public read access for store settings" ON public.store_settings;

CREATE POLICY "Store members can view stores" ON public.stores
  FOR SELECT TO authenticated
  USING (private.is_store_member(auth.uid(), id));

CREATE POLICY "Store members can view categories" ON public.categories
  FOR SELECT TO authenticated
  USING (private.is_store_member(auth.uid(), store_id));

CREATE POLICY "Store members can view products" ON public.products
  FOR SELECT TO authenticated
  USING (private.is_store_member(auth.uid(), store_id));

CREATE POLICY "Store members can view addon groups" ON public.addon_groups
  FOR SELECT TO authenticated
  USING (private.is_store_member(auth.uid(), store_id));

CREATE POLICY "Store members can view addons" ON public.addons
  FOR SELECT TO authenticated
  USING (private.is_store_member(auth.uid(), store_id));

CREATE POLICY "Store members can view product addon groups" ON public.product_addon_groups
  FOR SELECT TO authenticated
  USING (private.is_store_member(auth.uid(), store_id));

CREATE POLICY "Store members can view delivery fees" ON public.delivery_fees
  FOR SELECT TO authenticated
  USING (private.is_store_member(auth.uid(), store_id));

CREATE POLICY "Store members can view store settings" ON public.store_settings
  FOR SELECT TO authenticated
  USING (private.is_store_member(auth.uid(), store_id));

-- Leitura de imagens permanece pública porque catálogo precisa renderizar sem login.
DROP POLICY IF EXISTS "Public Read Access" ON storage.objects;
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Public read images" ON storage.objects;
CREATE POLICY "Public read images" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'public');

DROP POLICY IF EXISTS "Authenticated Upload" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Update" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Delete" ON storage.objects;
DROP POLICY IF EXISTS "Admin Insert Access" ON storage.objects;
DROP POLICY IF EXISTS "Admin Update Access" ON storage.objects;
DROP POLICY IF EXISTS "Admin Delete Access" ON storage.objects;
DROP POLICY IF EXISTS "Admin Upload" ON storage.objects;
DROP POLICY IF EXISTS "Admin Update" ON storage.objects;
DROP POLICY IF EXISTS "Admin Delete" ON storage.objects;

CREATE POLICY "Store admins upload images" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'public'
    AND (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND private.is_store_admin(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

CREATE POLICY "Store admins update images" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'public'
    AND (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND private.is_store_admin(auth.uid(), ((storage.foldername(name))[1])::uuid)
  )
  WITH CHECK (
    bucket_id = 'public'
    AND (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND private.is_store_admin(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

CREATE POLICY "Store admins delete images" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'public'
    AND (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND private.is_store_admin(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

COMMENT ON FUNCTION public.get_public_catalog(uuid) IS
  'Retorna somente catálogo ativo e campos públicos de uma loja específica.';
