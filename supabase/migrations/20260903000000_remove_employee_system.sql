-- ============================================================================
-- FIM DO SISTEMA DE FUNCIONÁRIOS
-- ============================================================================
-- Decisão de produto: o SaaS não gerencia mais equipe. Cada loja tem um dono
-- (admin) e o painel `/staff` passa a ser apenas uma tela de recebimento de
-- pedidos, usada pelo próprio dono.
--
-- Consequências:
--  - Não existe mais auto-cadastro em /auth (a tela virou só login).
--  - Não existe mais criação de funcionário pelo painel.
--  - `profiles`, `user_roles` e `user_permissions` deixam de ser visíveis entre
--    contas: cada usuário vê só a si mesmo; super admin vê tudo (precisa disso
--    para vincular donos às lojas em /super).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. PROFILES: cada um vê e edita só o seu; super admin vê todos
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Staff can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Own profile or super admin can view" ON public.profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id OR private.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Own profile or super admin can update" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id OR private.is_super_admin(auth.uid()))
  WITH CHECK (auth.uid() = id OR private.is_super_admin(auth.uid()));

-- ----------------------------------------------------------------------------
-- 2. USER_ROLES: mesma regra
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admins can view all user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can view roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
CREATE POLICY "Own role or super admin can view" ON public.user_roles
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR private.is_super_admin(auth.uid()));

-- Só super admin muda papéis (o painel /super faz isso ao vincular um dono).
DROP POLICY IF EXISTS "Admins can insert user_roles" ON public.user_roles;
CREATE POLICY "Super admin can insert user_roles" ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (private.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can delete user_roles" ON public.user_roles;
CREATE POLICY "Super admin can delete user_roles" ON public.user_roles
  FOR DELETE TO authenticated
  USING (private.is_super_admin(auth.uid()));

-- ----------------------------------------------------------------------------
-- 3. USER_PERMISSIONS: idem
-- ----------------------------------------------------------------------------
-- A tabela continua existindo porque `private.has_permission` (usada no RLS de
-- orders/order_items) consulta ela. Para admin e super_admin a função já
-- retorna TRUE antes de olhar aqui, então na prática ficou vazia.
DROP POLICY IF EXISTS "Admins can manage user permissions" ON public.user_permissions;
DROP POLICY IF EXISTS "Users can view their own permissions" ON public.user_permissions;
CREATE POLICY "Own permissions or super admin" ON public.user_permissions
  FOR ALL TO authenticated
  USING (auth.uid() = user_id OR private.is_super_admin(auth.uid()))
  WITH CHECK (private.is_super_admin(auth.uid()));

-- ----------------------------------------------------------------------------
-- 4. FIM DO AUTO-CADASTRO
-- ----------------------------------------------------------------------------
-- O trigger continua criando o perfil quando o super admin cria uma conta pela
-- API Admin, mas o status default deixa de ser 'pending' (não existe mais fila
-- de aprovação).
CREATE OR REPLACE FUNCTION private.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, status)
  VALUES (new.id, new.raw_user_meta_data->>'full_name', 'active')
  ON CONFLICT (id) DO UPDATE
  SET full_name = COALESCE(EXCLUDED.full_name, profiles.full_name);
  RETURN new;
END;
$$;

-- Contas que ficaram 'pending' no fluxo antigo não têm mais como ser aprovadas.
-- Ficam bloqueadas (o login recusa) para o super admin decidir depois.
UPDATE public.profiles
SET status = 'blocked'
WHERE status = 'pending';

-- ----------------------------------------------------------------------------
-- 5. LIMPA O PAPEL 'employee'
-- ----------------------------------------------------------------------------
-- Contas com papel 'employee' não são mais criadas. As que existirem perdem o
-- vínculo de loja e o papel, virando contas inertes (sem acesso a painel).
DELETE FROM public.store_members WHERE role = 'employee';
DELETE FROM public.user_roles WHERE role = 'employee';
