-- 1. Atualizar o enum app_role para incluir 'employee'
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'app_role' AND e.enumlabel = 'employee') THEN
    ALTER TYPE public.app_role ADD VALUE 'employee';
  END IF;
END $$;

-- 2. Criar tabela de permissões (definitions)
CREATE TABLE IF NOT EXISTS public.permissions (
    id text PRIMARY KEY,
    name text NOT NULL,
    description text,
    created_at timestamptz DEFAULT now()
);

GRANT SELECT ON public.permissions TO authenticated;
GRANT ALL ON public.permissions TO service_role;

-- 3. Criar tabela de permissões por usuário
CREATE TABLE IF NOT EXISTS public.user_permissions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    permission_id text REFERENCES public.permissions(id) ON DELETE CASCADE NOT NULL,
    created_at timestamptz DEFAULT now(),
    UNIQUE(user_id, permission_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_permissions TO authenticated;
GRANT ALL ON public.user_permissions TO service_role;

-- 4. Criar tabela de perfis de usuário
CREATE TABLE IF NOT EXISTS public.profiles (
    id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name text,
    status text DEFAULT 'active',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

-- 5. Habilitar RLS
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 6. Atualizar a função has_role
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    from public.user_roles
    where user_id = _user_id
      and role = _role
  )
$$;

-- 7. Criar função para verificar permissão específica
CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _permission_id text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.has_role(_user_id, 'admin') THEN
    RETURN TRUE;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.user_permissions
    WHERE user_id = _user_id
      AND permission_id = _permission_id
  );
END;
$$;

-- 8. Inserir permissões básicas
INSERT INTO public.permissions (id, name, description) VALUES
('view_orders', 'Visualizar pedidos', 'Permite ver a lista e detalhes dos pedidos'),
('manage_orders', 'Gerenciar pedidos', 'Permite alterar status e editar pedidos'),
('view_products', 'Visualizar produtos', 'Permite ver a lista de produtos'),
('manage_products', 'Gerenciar produtos', 'Permite criar, editar e excluir produtos'),
('view_categories', 'Visualizar categorias', 'Permite ver a lista de categorias'),
('manage_categories', 'Gerenciar categorias', 'Permite criar, editar e excluir categorias'),
('view_addons', 'Visualizar adicionais', 'Permite ver a lista de adicionais'),
('manage_addons', 'Gerenciar adicionais', 'Permite criar, editar e excluir adicionais'),
('view_customers', 'Visualizar clientes', 'Permite ver a lista de clientes'),
('view_reports', 'Visualizar relatórios', 'Permite ver os relatórios de vendas'),
('manage_delivery', 'Gerenciar entregas', 'Permite gerenciar taxas e áreas de entrega'),
('manage_settings', 'Gerenciar configurações', 'Permite alterar as configurações da confeitaria')
ON CONFLICT (id) DO NOTHING;

-- 9. Políticas de RLS para profiles
CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update all profiles" ON public.profiles FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- 10. Políticas para user_permissions
CREATE POLICY "Admins can manage user permissions" ON public.user_permissions FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can view their own permissions" ON public.user_permissions FOR SELECT USING (auth.uid() = user_id);

-- 11. Políticas para permissions
CREATE POLICY "Everyone can view permissions" ON public.permissions FOR SELECT TO authenticated USING (true);

-- 12. Garantir que a tabela user_roles tenha permissões corretas
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
