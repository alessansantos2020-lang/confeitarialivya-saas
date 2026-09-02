-- ============================================================================
-- FASE 1 DO SAAS MULTI-LOJA: Schema base, store_id e isolamento de dados
-- ============================================================================
-- Migração 100% aditiva e retrocompatível:
-- 1. Cria a tabela `stores`
-- 2. Cria a loja padrão ('confeitaria-livya') e atrela os dados existentes a ela
-- 3. Adiciona a coluna `store_id` (com FK e default pra loja padrão) em todas as
--    tabelas de negócio:
--      - categories
--      - products
--      - orders
--      - order_items
--      - delivery_fees
--      - store_settings
--      - addon_groups
--      - addons
--      - product_addon_groups
--      - user_roles
-- 4. Cria tabela de membros da loja `store_members` (vínculo user <-> loja <-> role)
-- 5. Ajusta constraints de unicidade (ex: neighborhood de delivery_fees passa a
--    ser único POR LOJA, não global)
-- 6. Atualiza helpers de segurança no schema `private` para considerar `store_id`
-- 7. Atualiza as RLS policies para garantir que uma loja nunca veja dados de outra
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. TABELA STORES
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.stores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stores_slug ON public.stores(slug);
CREATE INDEX IF NOT EXISTS idx_stores_owner_id ON public.stores(owner_id);

ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- 2. LOJA PADRÃO + VÍNCULO DOS DADOS ATUAIS
-- ----------------------------------------------------------------------------
-- Cria a loja 'confeitaria-livya' usando o dono admin atual (se existir)
DO $$
DECLARE
  v_owner_id uuid;
  v_store_id uuid;
BEGIN
  -- Tenta pegar o primeiro admin existente
  SELECT user_id INTO v_owner_id
  FROM public.user_roles
  WHERE role = 'admin'
  LIMIT 1;

  -- Se a loja padrão ainda não existir, cria com UUID fixo pra facilitar migrações
  INSERT INTO public.stores (id, name, slug, owner_id, status)
  VALUES (
    '00000000-0000-0000-0000-000000000001'::uuid,
    'Confeitaria Livya',
    'confeitaria-livya',
    v_owner_id,
    'active'
  )
  ON CONFLICT (slug) DO UPDATE
    SET name = EXCLUDED.name,
        owner_id = COALESCE(public.stores.owner_id, EXCLUDED.owner_id);
END $$;

-- ----------------------------------------------------------------------------
-- 3. ADICIONA store_id NAS TABELAS DE NEGÓCIO
-- ----------------------------------------------------------------------------
-- Default aponta pra loja padrão (00000000-0000-0000-0000-00000001), garantindo
-- que nenhum registro fique órfão e que inserts legados continuem funcionando.

-- categories
ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS store_id uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::uuid
  REFERENCES public.stores(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_categories_store_id ON public.categories(store_id);

-- products
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS store_id uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::uuid
  REFERENCES public.stores(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_products_store_id ON public.products(store_id);

-- orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS store_id uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::uuid
  REFERENCES public.stores(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_orders_store_id ON public.orders(store_id);

-- order_items
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS store_id uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::uuid
  REFERENCES public.stores(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_order_items_store_id ON public.order_items(store_id);

-- delivery_fees
ALTER TABLE public.delivery_fees
  ADD COLUMN IF NOT EXISTS store_id uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::uuid
  REFERENCES public.stores(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_delivery_fees_store_id ON public.delivery_fees(store_id);

-- A constraint antiga de neighborhood era global (UNIQUE(neighborhood)).
-- Agora passa a ser única por loja (duas confeitarias podem ter taxa pro mesmo bairro).
ALTER TABLE public.delivery_fees DROP CONSTRAINT IF EXISTS delivery_fees_neighborhood_key;
ALTER TABLE public.delivery_fees DROP CONSTRAINT IF EXISTS delivery_fees_store_neighborhood_key;
ALTER TABLE public.delivery_fees ADD CONSTRAINT delivery_fees_store_neighborhood_key UNIQUE (store_id, neighborhood);

-- store_settings
ALTER TABLE public.store_settings
  ADD COLUMN IF NOT EXISTS store_id uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::uuid
  REFERENCES public.stores(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_store_settings_store_id ON public.store_settings(store_id);
-- Uma única configuração por loja
ALTER TABLE public.store_settings DROP CONSTRAINT IF EXISTS store_settings_store_id_key;
ALTER TABLE public.store_settings ADD CONSTRAINT store_settings_store_id_key UNIQUE (store_id);

-- addon_groups
ALTER TABLE public.addon_groups
  ADD COLUMN IF NOT EXISTS store_id uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::uuid
  REFERENCES public.stores(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_addon_groups_store_id ON public.addon_groups(store_id);

-- addons
ALTER TABLE public.addons
  ADD COLUMN IF NOT EXISTS store_id uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::uuid
  REFERENCES public.stores(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_addons_store_id ON public.addons(store_id);

-- product_addon_groups
ALTER TABLE public.product_addon_groups
  ADD COLUMN IF NOT EXISTS store_id uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::uuid
  REFERENCES public.stores(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_product_addon_groups_store_id ON public.product_addon_groups(store_id);

-- ----------------------------------------------------------------------------
-- 4. TABELA STORE_MEMBERS (vínculo usuário <-> loja com papel específico)
-- ----------------------------------------------------------------------------
-- Um usuário pode ser dono/gerente de uma loja e funcionário de outra.
CREATE TABLE IF NOT EXISTS public.store_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'employee',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (store_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_store_members_user_id ON public.store_members(user_id);
CREATE INDEX IF NOT EXISTS idx_store_members_store_id ON public.store_members(store_id);

ALTER TABLE public.store_members ENABLE ROW LEVEL SECURITY;

-- Popula store_members com os usuários existentes para a loja padrão
INSERT INTO public.store_members (store_id, user_id, role)
SELECT
  '00000000-0000-0000-0000-000000000001'::uuid,
  ur.user_id,
  ur.role
FROM public.user_roles ur
ON CONFLICT (store_id, user_id) DO UPDATE SET role = EXCLUDED.role;

-- ----------------------------------------------------------------------------
-- 5. FUNÇÕES DE SUPORTE NO SCHEMA `private`
-- ----------------------------------------------------------------------------
-- Verifica se o usuário é super_admin (dono do SaaS inteiro)
CREATE OR REPLACE FUNCTION private.is_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'super_admin'
  );
$$;

-- Verifica se o usuário pertence à loja (qualquer papel)
CREATE OR REPLACE FUNCTION private.is_store_member(_user_id uuid, _store_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.store_members
    WHERE user_id = _user_id AND store_id = _store_id
  ) OR private.is_super_admin(_user_id);
$$;

-- Verifica se o usuário é admin daquela loja específica (ou dono dela, ou super_admin)
CREATE OR REPLACE FUNCTION private.is_store_admin(_user_id uuid, _store_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.store_members
    WHERE user_id = _user_id AND store_id = _store_id AND role = 'admin'
  )
  OR EXISTS (
    SELECT 1 FROM public.stores
    WHERE id = _store_id AND owner_id = _user_id
  )
  OR private.is_super_admin(_user_id);
$$;

-- Mantém retrocompatibilidade de private.has_role (ainda usada em alguns lugares legados)
CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  ) OR private.is_super_admin(_user_id);
$$;

-- ----------------------------------------------------------------------------
-- 6. POLICIES RLS ATUALIZADAS (Multi-tenant)
-- ----------------------------------------------------------------------------

-- STORES:
-- Qualquer um pode consultar lojas ativas (usado na rota pública /$slug)
DROP POLICY IF EXISTS "Public can view active stores" ON public.stores;
CREATE POLICY "Public can view active stores" ON public.stores
  FOR SELECT TO anon, authenticated
  USING (status = 'active' OR private.is_store_admin(auth.uid(), id) OR private.is_super_admin(auth.uid()));

-- Dono/admin da loja pode atualizar sua loja
DROP POLICY IF EXISTS "Store admins can update own store" ON public.stores;
CREATE POLICY "Store admins can update own store" ON public.stores
  FOR UPDATE TO authenticated
  USING (private.is_store_admin(auth.uid(), id));

-- Super admin pode fazer tudo em stores
DROP POLICY IF EXISTS "Super admins can manage all stores" ON public.stores;
CREATE POLICY "Super admins can manage all stores" ON public.stores
  FOR ALL TO authenticated
  USING (private.is_super_admin(auth.uid()));

-- STORE_MEMBERS:
DROP POLICY IF EXISTS "Members can view their own memberships" ON public.store_members;
CREATE POLICY "Members can view their own memberships" ON public.store_members
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR private.is_store_admin(auth.uid(), store_id) OR private.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Store admins can manage members" ON public.store_members;
CREATE POLICY "Store admins can manage members" ON public.store_members
  FOR ALL TO authenticated
  USING (private.is_store_admin(auth.uid(), store_id) OR private.is_super_admin(auth.uid()));

-- CATEGORIES:
-- Leitura pública mantida (filtrada no cliente por store_id)
DROP POLICY IF EXISTS "Anyone can view categories" ON public.categories;
CREATE POLICY "Anyone can view categories" ON public.categories
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Admins can manage categories" ON public.categories;
CREATE POLICY "Admins can manage categories" ON public.categories
  FOR ALL TO authenticated
  USING (private.is_store_admin(auth.uid(), store_id))
  WITH CHECK (private.is_store_admin(auth.uid(), store_id));

-- PRODUCTS:
DROP POLICY IF EXISTS "Allow public read access to products" ON public.products;
CREATE POLICY "Allow public read access to products" ON public.products
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Admins can manage products" ON public.products;
CREATE POLICY "Admins can manage products" ON public.products
  FOR ALL TO authenticated
  USING (private.is_store_admin(auth.uid(), store_id))
  WITH CHECK (private.is_store_admin(auth.uid(), store_id));

-- ADDON_GROUPS / ADDONS / PRODUCT_ADDON_GROUPS:
DROP POLICY IF EXISTS "Allow public read access to addon_groups" ON public.addon_groups;
CREATE POLICY "Allow public read access to addon_groups" ON public.addon_groups
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Admins can manage addon_groups" ON public.addon_groups;
CREATE POLICY "Admins can manage addon_groups" ON public.addon_groups
  FOR ALL TO authenticated
  USING (private.is_store_admin(auth.uid(), store_id))
  WITH CHECK (private.is_store_admin(auth.uid(), store_id));

DROP POLICY IF EXISTS "Allow public read access to addons" ON public.addons;
CREATE POLICY "Allow public read access to addons" ON public.addons
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Admins can manage addons" ON public.addons;
CREATE POLICY "Admins can manage addons" ON public.addons
  FOR ALL TO authenticated
  USING (private.is_store_admin(auth.uid(), store_id))
  WITH CHECK (private.is_store_admin(auth.uid(), store_id));

DROP POLICY IF EXISTS "Allow public read access to product_addon_groups" ON public.product_addon_groups;
CREATE POLICY "Allow public read access to product_addon_groups" ON public.product_addon_groups
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Admins can manage product_addon_groups" ON public.product_addon_groups;
CREATE POLICY "Admins can manage product_addon_groups" ON public.product_addon_groups
  FOR ALL TO authenticated
  USING (private.is_store_admin(auth.uid(), store_id))
  WITH CHECK (private.is_store_admin(auth.uid(), store_id));

-- DELIVERY_FEES:
DROP POLICY IF EXISTS "Allow public read access to delivery_fees" ON public.delivery_fees;
CREATE POLICY "Allow public read access to delivery_fees" ON public.delivery_fees
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Staff with permission can manage delivery_fees" ON public.delivery_fees;
CREATE POLICY "Staff with permission can manage delivery_fees" ON public.delivery_fees
  FOR ALL TO authenticated
  USING (private.is_store_admin(auth.uid(), store_id))
  WITH CHECK (private.is_store_admin(auth.uid(), store_id));

-- STORE_SETTINGS:
DROP POLICY IF EXISTS "Public read access for store settings" ON public.store_settings;
CREATE POLICY "Public read access for store settings" ON public.store_settings
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Admins can manage store settings" ON public.store_settings;
CREATE POLICY "Admins can manage store settings" ON public.store_settings
  FOR ALL TO authenticated
  USING (private.is_store_admin(auth.uid(), store_id))
  WITH CHECK (private.is_store_admin(auth.uid(), store_id));

-- ORDERS:
-- Checkout anônimo mantido com permissão de INSERT pra qualquer um
DROP POLICY IF EXISTS "Allow public inserts for orders" ON public.orders;
DROP POLICY IF EXISTS "Anyone can place an order" ON public.orders;
CREATE POLICY "Anyone can place an order" ON public.orders
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

-- Leitura de pedidos restrita aos membros daquela loja
DROP POLICY IF EXISTS "Staff with permission can view orders" ON public.orders;
CREATE POLICY "Store staff can view orders" ON public.orders
  FOR SELECT TO authenticated
  USING (private.is_store_member(auth.uid(), store_id));

-- Atualização e deleção restrita aos membros/admins daquela loja
DROP POLICY IF EXISTS "Staff with permission can update orders" ON public.orders;
CREATE POLICY "Store staff can update orders" ON public.orders
  FOR UPDATE TO authenticated
  USING (private.is_store_member(auth.uid(), store_id))
  WITH CHECK (private.is_store_member(auth.uid(), store_id));

DROP POLICY IF EXISTS "Staff with permission can delete orders" ON public.orders;
CREATE POLICY "Store admins can delete orders" ON public.orders
  FOR DELETE TO authenticated
  USING (private.is_store_admin(auth.uid(), store_id));

-- ORDER_ITEMS:
DROP POLICY IF EXISTS "Allow public inserts for order items" ON public.order_items;
DROP POLICY IF EXISTS "Anyone can add items to a new order" ON public.order_items;
CREATE POLICY "Anyone can add items to a new order" ON public.order_items
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Staff with permission can view order items" ON public.order_items;
CREATE POLICY "Store staff can view order items" ON public.order_items
  FOR SELECT TO authenticated
  USING (private.is_store_member(auth.uid(), store_id));

-- ----------------------------------------------------------------------------
-- 7. REALTIME
-- ----------------------------------------------------------------------------
-- Garante que `stores` e `store_members` também publiquem no realtime se necessário
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'stores'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.stores;
  END IF;
END $$;
