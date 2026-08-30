
-- 1. Garantir que novos perfis com status 'pending' sejam criados no signup
-- Nota: O Supabase Auth aciona o trigger de criação de perfil, mas RLS pode bloquear se não houver política.
-- Já existe uma policy "Users can view own profile", mas precisamos de uma para INSERT se não houver.

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'profiles' AND policyname = 'Anyone can create their profile during signup'
    ) THEN
        CREATE POLICY "Anyone can create their profile during signup" 
        ON public.profiles FOR INSERT 
        WITH CHECK (true);
    END IF;
END $$;

GRANT INSERT ON public.profiles TO anon, authenticated;

-- 2. Corrigir a função de aprovação de funcionários
-- Ela deve estar no schema public para ser chamada via RPC se necessário, 
-- ou simplesmente ser atualizada para garantir o fluxo correto.

CREATE OR REPLACE FUNCTION public.approve_employee(employee_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verificar se o perfil existe
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = employee_id) THEN
    RAISE EXCEPTION 'Perfil não encontrado';
  END IF;

  -- 1. Atualizar status do perfil para ativo
  UPDATE public.profiles 
  SET status = 'active' 
  WHERE id = employee_id;

  -- 2. Garantir que tenha a role 'employee'
  -- Removemos qualquer role anterior (se não for admin) para evitar duplicatas estranhas, 
  -- mas o ON CONFLICT já resolve.
  INSERT INTO public.user_roles (user_id, role)
  VALUES (employee_id, 'employee')
  ON CONFLICT (user_id, role) DO NOTHING;

  -- 3. Atribuir permissões básicas operacionais
  INSERT INTO public.user_permissions (user_id, permission_id)
  VALUES 
    (employee_id, 'view_orders'),
    (employee_id, 'manage_orders'),
    (employee_id, 'view_products'),
    (employee_id, 'view_categories')
  ON CONFLICT (user_id, permission_id) DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_employee(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_employee(uuid) TO service_role;

-- 3. Garantir que admins possam ver perfis pendentes
-- A policy "Admins can view all profiles" deve cobrir isso, mas vamos reforçar.
GRANT SELECT ON public.profiles TO authenticated;

-- 4. Adicionar um registro de log/auditoria básico se necessário (opcional, vamos pular para manter simples)
