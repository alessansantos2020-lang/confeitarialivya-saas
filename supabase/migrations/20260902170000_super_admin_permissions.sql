-- ============================================================================
-- FASE 4 DO SAAS MULTI-LOJA: habilita o papel super_admin de ponta a ponta
-- ============================================================================
-- A Fase 1 criou o valor de enum 'super_admin' e as funções private.is_super_admin
-- / is_store_member / is_store_admin, mas private.has_permission ficou de fora:
-- ela só devolve TRUE para quem tem role = 'admin'. Como as policies de orders e
-- order_items exigem is_store_member AND has_permission(...), um super_admin
-- não conseguia ler pedido de loja nenhuma.
--
-- Esta migração é 100% aditiva (apenas CREATE OR REPLACE / CREATE POLICY):
-- 1. has_permission passa a reconhecer super_admin
-- 2. RLS de leitura em user_roles / user_permissions / permissions para super_admin
-- 3. Trigger que cria store_settings padrão junto com cada loja nova
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. has_permission reconhece super_admin
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.has_permission(_user_id uuid, _permission_id text)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('admin', 'super_admin')
  ) THEN
    RETURN TRUE;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.user_permissions
    WHERE user_id = _user_id AND permission_id = _permission_id
  );
END;
$$;

-- ----------------------------------------------------------------------------
-- 2. Leitura de papéis/permissões para o super_admin
-- ----------------------------------------------------------------------------
-- private.has_role já devolve TRUE para super_admin (ela faz OR is_super_admin),
-- então as policies "Admins can ..." de profiles/user_roles/user_permissions já
-- cobrem o super_admin. Aqui só garantimos a tabela de catálogo `permissions`.
DROP POLICY IF EXISTS "Authenticated can read permissions catalog" ON public.permissions;
CREATE POLICY "Authenticated can read permissions catalog" ON public.permissions
  FOR SELECT TO authenticated
  USING (true);

-- ----------------------------------------------------------------------------
-- 3. Toda loja nova nasce com uma linha em store_settings
-- ----------------------------------------------------------------------------
-- Sem isso o painel da loja recém-criada abre sem configuração e o admin dela
-- precisa salvar o formulário uma vez antes de qualquer coisa funcionar.
CREATE OR REPLACE FUNCTION public.create_default_store_settings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.store_settings (store_id, name, is_open)
  VALUES (NEW.id, NEW.name, true)
  ON CONFLICT (store_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS create_default_store_settings_trigger ON public.stores;
CREATE TRIGGER create_default_store_settings_trigger
  AFTER INSERT ON public.stores
  FOR EACH ROW EXECUTE FUNCTION public.create_default_store_settings();

-- ----------------------------------------------------------------------------
-- 4. Índice para o slug ser sempre comparado em minúsculas
-- ----------------------------------------------------------------------------
-- O cardápio público resolve a loja por slug; sem isso "Loja-X" e "loja-x"
-- seriam duas lojas diferentes.
CREATE UNIQUE INDEX IF NOT EXISTS idx_stores_slug_lower ON public.stores (lower(slug));
