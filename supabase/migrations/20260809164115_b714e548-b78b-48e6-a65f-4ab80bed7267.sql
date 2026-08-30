
-- 1. Ensure the user_roles table has the 'admin' role and user alessansantos2020@gmail.com is set up
DO $$
DECLARE
    v_user_id UUID;
BEGIN
    SELECT id INTO v_user_id FROM auth.users WHERE email = 'alessansantos2020@gmail.com';
    
    IF v_user_id IS NOT NULL THEN
        -- Link profile
        INSERT INTO public.profiles (id, full_name, status)
        VALUES (v_user_id, 'Administrador Geral', 'active')
        ON CONFLICT (id) DO UPDATE SET full_name = 'Administrador Geral', status = 'active';

        -- Link role
        INSERT INTO public.user_roles (user_id, role)
        VALUES (v_user_id, 'admin')
        ON CONFLICT (user_id, role) DO NOTHING;
    END IF;
END $$;

-- 2. Fix permissions for authenticated users on RBAC tables
GRANT SELECT ON public.user_roles TO authenticated;
GRANT SELECT ON public.user_permissions TO authenticated;
GRANT SELECT ON public.permissions TO authenticated;
GRANT SELECT ON public.profiles TO authenticated;

-- 3. Ensure RLS policies don't cause recursion and allow access
-- Drop existing problematic policies if they exist
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can view all user_roles') THEN
        DROP POLICY "Admins can view all user_roles" ON public.user_roles;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view their own roles') THEN
        DROP POLICY "Users can view their own roles" ON public.user_roles;
    END IF;
END $$;

CREATE POLICY "Admins can view all user_roles" ON public.user_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can view their own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- 4. Fix has_role function to be more robust
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  );
$$;

-- 5. Fix has_permission function
CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _permission_id text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Se for admin, tem todas as permissões
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'admin') THEN
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

-- 6. Re-grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_permission(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO service_role;
GRANT EXECUTE ON FUNCTION public.has_permission(uuid, text) TO service_role;
