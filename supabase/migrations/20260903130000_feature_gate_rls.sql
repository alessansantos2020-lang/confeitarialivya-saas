-- ============================================================================
-- ETAPA 2: BLOQUEIO NO BANCO POR FUNCIONALIDADE DO PLANO
-- ============================================================================
-- Até aqui o plano só escondia/barrava na tela. Quem chamasse a API direto
-- (fetch no Supabase, Postman, console do navegador) continuava passando.
-- Esta migração fecha isso no RLS: escrever num módulo fora do plano é negado
-- pelo próprio banco.
--
-- O QUE **NÃO** MUDA (de propósito):
--   * Leitura pública (anon) do catálogo — o cliente final precisa ver a loja.
--     O plano controla o que o DONO administra, não o que o cliente compra.
--   * Leitura de pedidos pelo dono — `orders` é essencial.
--   * Nenhum dado é apagado. Plano fora = acesso cortado, dados intactos.
--
-- Módulos sem tabela própria (Clientes e Relatórios são derivados de `orders`)
-- não podem ser bloqueados por RLS — continuam barrados pela rota no frontend.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. HELPER: pode usar esta funcionalidade nesta loja?
-- ----------------------------------------------------------------------------
-- Junta as duas regras num só lugar (a spec pede verificação centralizada):
--   * super_admin passa sempre — é acesso de suporte, não de assinatura;
--   * demais casos caem em private.store_has_feature (plano da loja).
CREATE OR REPLACE FUNCTION private.can_use_feature(_store_id uuid, _feature_id text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT private.is_super_admin(auth.uid())
      OR private.store_has_feature(_store_id, _feature_id);
$$;

-- ----------------------------------------------------------------------------
-- 2. PRODUTOS / CATEGORIAS  (feature: products / categories)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admins can manage products" ON public.products;
CREATE POLICY "Admins can manage products" ON public.products
  FOR ALL TO authenticated
  USING (private.is_store_admin(auth.uid(), store_id)
         AND private.can_use_feature(store_id, 'products'))
  WITH CHECK (private.is_store_admin(auth.uid(), store_id)
         AND private.can_use_feature(store_id, 'products'));

DROP POLICY IF EXISTS "Admins can manage categories" ON public.categories;
CREATE POLICY "Admins can manage categories" ON public.categories
  FOR ALL TO authenticated
  USING (private.is_store_admin(auth.uid(), store_id)
         AND private.can_use_feature(store_id, 'categories'))
  WITH CHECK (private.is_store_admin(auth.uid(), store_id)
         AND private.can_use_feature(store_id, 'categories'));

-- ----------------------------------------------------------------------------
-- 3. ADICIONAIS  (feature: addons)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admins can manage addon_groups" ON public.addon_groups;
CREATE POLICY "Admins can manage addon_groups" ON public.addon_groups
  FOR ALL TO authenticated
  USING (private.is_store_admin(auth.uid(), store_id)
         AND private.can_use_feature(store_id, 'addons'))
  WITH CHECK (private.is_store_admin(auth.uid(), store_id)
         AND private.can_use_feature(store_id, 'addons'));

DROP POLICY IF EXISTS "Admins can manage addons" ON public.addons;
CREATE POLICY "Admins can manage addons" ON public.addons
  FOR ALL TO authenticated
  USING (private.is_store_admin(auth.uid(), store_id)
         AND private.can_use_feature(store_id, 'addons'))
  WITH CHECK (private.is_store_admin(auth.uid(), store_id)
         AND private.can_use_feature(store_id, 'addons'));

DROP POLICY IF EXISTS "Admins can manage product_addon_groups" ON public.product_addon_groups;
CREATE POLICY "Admins can manage product_addon_groups" ON public.product_addon_groups
  FOR ALL TO authenticated
  USING (private.is_store_admin(auth.uid(), store_id)
         AND private.can_use_feature(store_id, 'addons'))
  WITH CHECK (private.is_store_admin(auth.uid(), store_id)
         AND private.can_use_feature(store_id, 'addons'));

-- ----------------------------------------------------------------------------
-- 4. TAXAS DE ENTREGA  (feature: delivery)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Staff with permission can manage delivery_fees" ON public.delivery_fees;
CREATE POLICY "Staff with permission can manage delivery_fees" ON public.delivery_fees
  FOR ALL TO authenticated
  USING (private.is_store_admin(auth.uid(), store_id)
         AND private.can_use_feature(store_id, 'delivery'))
  WITH CHECK (private.is_store_admin(auth.uid(), store_id)
         AND private.can_use_feature(store_id, 'delivery'));

-- ----------------------------------------------------------------------------
-- 5. CONFIGURAÇÕES DA LOJA  (feature: settings)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admins can manage store settings" ON public.store_settings;
CREATE POLICY "Admins can manage store settings" ON public.store_settings
  FOR ALL TO authenticated
  USING (private.is_store_admin(auth.uid(), store_id)
         AND private.can_use_feature(store_id, 'settings'))
  WITH CHECK (private.is_store_admin(auth.uid(), store_id)
         AND private.can_use_feature(store_id, 'settings'));
