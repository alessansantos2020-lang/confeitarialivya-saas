-- ============================================================
-- 1. Schema privado para funções de segurança (fora da API)
-- ============================================================
CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO authenticated, anon, service_role;

CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

CREATE OR REPLACE FUNCTION private.has_permission(_user_id uuid, _permission_id text)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'admin') THEN
    RETURN TRUE;
  END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.user_permissions
    WHERE user_id = _user_id AND permission_id = _permission_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION private.has_permission(uuid, text) TO authenticated, anon, service_role;

-- ============================================================
-- 2. Recriar policies usando as funções privadas
-- ============================================================
DROP POLICY IF EXISTS "Admins can manage addon_groups" ON public.addon_groups;
CREATE POLICY "Admins can manage addon_groups" ON public.addon_groups
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin')) WITH CHECK (private.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can manage addons" ON public.addons;
CREATE POLICY "Admins can manage addons" ON public.addons
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin')) WITH CHECK (private.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can manage categories" ON public.categories;
CREATE POLICY "Admins can manage categories" ON public.categories
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin')) WITH CHECK (private.has_role(auth.uid(), 'admin'));

-- Categorias: consolidar leitura pública em UMA única policy
DROP POLICY IF EXISTS "Allow public read access to categories" ON public.categories;
DROP POLICY IF EXISTS "Anyone can view categories" ON public.categories;
CREATE POLICY "Anyone can view categories" ON public.categories
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Admins can manage delivery_fees" ON public.delivery_fees;
DROP POLICY IF EXISTS "Staff with permission can manage delivery_fees" ON public.delivery_fees;
CREATE POLICY "Staff with permission can manage delivery_fees" ON public.delivery_fees
  FOR ALL TO authenticated
  USING (private.has_permission(auth.uid(), 'manage_delivery'))
  WITH CHECK (private.has_permission(auth.uid(), 'manage_delivery'));

DROP POLICY IF EXISTS "Admins can manage product_addon_groups" ON public.product_addon_groups;
CREATE POLICY "Admins can manage product_addon_groups" ON public.product_addon_groups
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin')) WITH CHECK (private.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can manage products" ON public.products;
CREATE POLICY "Admins can manage products" ON public.products
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin')) WITH CHECK (private.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can manage store settings" ON public.store_settings;
CREATE POLICY "Admins can manage store settings" ON public.store_settings
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin')) WITH CHECK (private.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
CREATE POLICY "Admins can update all profiles" ON public.profiles
  FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'admin')) WITH CHECK (private.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can manage user permissions" ON public.user_permissions;
CREATE POLICY "Admins can manage user permissions" ON public.user_permissions
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin')) WITH CHECK (private.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can view all user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can view roles" ON public.user_roles;
CREATE POLICY "Admins can view all user_roles" ON public.user_roles
  FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can insert user_roles" ON public.user_roles;
CREATE POLICY "Admins can insert user_roles" ON public.user_roles
  FOR INSERT TO authenticated WITH CHECK (private.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can delete user_roles" ON public.user_roles;
CREATE POLICY "Admins can delete user_roles" ON public.user_roles
  FOR DELETE TO authenticated USING (private.has_role(auth.uid(), 'admin'));

-- ============================================================
-- 3. ORDERS / ORDER_ITEMS: remover leitura pública (PII)
-- ============================================================
DROP POLICY IF EXISTS "Enable read for everyone" ON public.orders;
DROP POLICY IF EXISTS "Allow public read access to orders" ON public.orders;
DROP POLICY IF EXISTS "Admins can manage orders" ON public.orders;
DROP POLICY IF EXISTS "Staff with permission can view orders" ON public.orders;
DROP POLICY IF EXISTS "Staff with permission can manage orders" ON public.orders;

CREATE POLICY "Staff with permission can view orders" ON public.orders
  FOR SELECT TO authenticated
  USING (
    private.has_permission(auth.uid(), 'view_orders')
    OR private.has_permission(auth.uid(), 'manage_orders')
  );

CREATE POLICY "Staff with permission can update orders" ON public.orders
  FOR UPDATE TO authenticated
  USING (private.has_permission(auth.uid(), 'manage_orders'))
  WITH CHECK (private.has_permission(auth.uid(), 'manage_orders'));

CREATE POLICY "Staff with permission can delete orders" ON public.orders
  FOR DELETE TO authenticated
  USING (private.has_permission(auth.uid(), 'manage_orders'));

-- Checkout público continua permitido (uma única policy de INSERT)
DROP POLICY IF EXISTS "Enable insert for everyone" ON public.orders;
DROP POLICY IF EXISTS "Allow public inserts for orders" ON public.orders;
CREATE POLICY "Anyone can place an order" ON public.orders
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Enable read for everyone" ON public.order_items;
DROP POLICY IF EXISTS "Allow public read access to order items" ON public.order_items;
DROP POLICY IF EXISTS "Staff with permission can view order items" ON public.order_items;

CREATE POLICY "Staff with permission can view order items" ON public.order_items
  FOR SELECT TO authenticated
  USING (
    private.has_permission(auth.uid(), 'view_orders')
    OR private.has_permission(auth.uid(), 'manage_orders')
  );

DROP POLICY IF EXISTS "Enable insert for everyone" ON public.order_items;
DROP POLICY IF EXISTS "Allow public inserts for order items" ON public.order_items;
CREATE POLICY "Anyone can add items to a new order" ON public.order_items
  FOR INSERT TO anon, authenticated WITH CHECK (true);

-- ============================================================
-- 4. Validação server-side dos pedidos (anti-fraude / anti-adulteração)
-- ============================================================
CREATE OR REPLACE FUNCTION public.validate_new_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Pedidos novos sempre começam como pendentes e não notificados
  NEW.status := 'pending';
  NEW.client_notified := false;

  IF NEW.total_amount IS NULL OR NEW.total_amount <= 0 OR NEW.total_amount > 100000 THEN
    RAISE EXCEPTION 'Valor total do pedido inválido';
  END IF;

  IF COALESCE(NEW.delivery_fee, 0) < 0 THEN
    RAISE EXCEPTION 'Taxa de entrega inválida';
  END IF;

  IF length(trim(NEW.customer_name)) < 2 OR length(NEW.customer_name) > 120 THEN
    RAISE EXCEPTION 'Nome do cliente inválido';
  END IF;

  IF length(regexp_replace(NEW.customer_phone, '\D', '', 'g')) < 10 THEN
    RAISE EXCEPTION 'Telefone do cliente inválido';
  END IF;

  IF length(NEW.address) > 500 OR length(COALESCE(NEW.observation, '')) > 1000 THEN
    RAISE EXCEPTION 'Dados do pedido excedem o tamanho permitido';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_new_order_trigger ON public.orders;
CREATE TRIGGER validate_new_order_trigger
  BEFORE INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.validate_new_order();

CREATE OR REPLACE FUNCTION public.validate_order_item()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  real_price numeric;
BEGIN
  IF NEW.quantity IS NULL OR NEW.quantity < 1 OR NEW.quantity > 200 THEN
    RAISE EXCEPTION 'Quantidade inválida';
  END IF;

  SELECT price INTO real_price FROM public.products WHERE id = NEW.product_id;

  IF real_price IS NULL THEN
    RAISE EXCEPTION 'Produto inexistente';
  END IF;

  -- Impede adulteração de preço para menos (adicionais podem elevar o valor)
  IF NEW.price_at_time IS NULL OR NEW.price_at_time < real_price THEN
    RAISE EXCEPTION 'Preço do item inválido';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_order_item_trigger ON public.order_items;
CREATE TRIGGER validate_order_item_trigger
  BEFORE INSERT ON public.order_items
  FOR EACH ROW EXECUTE FUNCTION public.validate_order_item();

-- ============================================================
-- 5. Storage: escrita apenas para admin/equipe autorizada
-- ============================================================
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Upload" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Update" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Delete" ON storage.objects;
DROP POLICY IF EXISTS "Admin Upload" ON storage.objects;
DROP POLICY IF EXISTS "Admin Update" ON storage.objects;
DROP POLICY IF EXISTS "Admin Delete" ON storage.objects;

CREATE POLICY "Public Access" ON storage.objects
  FOR SELECT TO anon, authenticated USING (bucket_id = 'public');

CREATE POLICY "Admin Upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'public'
    AND (private.has_role(auth.uid(), 'admin') OR private.has_permission(auth.uid(), 'manage_settings'))
  );

CREATE POLICY "Admin Update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'public'
    AND (private.has_role(auth.uid(), 'admin') OR private.has_permission(auth.uid(), 'manage_settings'))
  )
  WITH CHECK (
    bucket_id = 'public'
    AND (private.has_role(auth.uid(), 'admin') OR private.has_permission(auth.uid(), 'manage_settings'))
  );

CREATE POLICY "Admin Delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'public'
    AND (private.has_role(auth.uid(), 'admin') OR private.has_permission(auth.uid(), 'manage_settings'))
  );

-- ============================================================
-- 6. Remover funções expostas na API
-- ============================================================
DROP FUNCTION IF EXISTS public.has_permission(uuid, text);
DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);
