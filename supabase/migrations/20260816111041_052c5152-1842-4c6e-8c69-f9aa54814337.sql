-- Final attempt to fix linter warnings by moving functions to private schema
-- 1. Create private schema if not exists
CREATE SCHEMA IF NOT EXISTS private;

-- 2. Move handle_new_user to private schema
-- Note: Must drop the trigger first because it depends on the function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Re-create function in private schema
CREATE OR REPLACE FUNCTION private.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, status)
  VALUES (new.id, new.raw_user_meta_data->>'full_name', 'pending')
  ON CONFLICT (id) DO UPDATE
  SET full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
      status = COALESCE(profiles.status, 'pending');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Re-create trigger pointing to the new function
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION private.handle_new_user();

-- Drop old function from public
DROP FUNCTION IF EXISTS public.handle_new_user();

-- 3. Move approve_employee to private schema
-- First, recreate it in private
CREATE OR REPLACE FUNCTION private.approve_employee(employee_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE public.profiles
  SET status = 'active'
  WHERE id = employee_id;
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (employee_id, 'employee'::public.app_role)
  ON CONFLICT (user_id, role) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Drop old function from public
DROP FUNCTION IF EXISTS public.approve_employee(uuid);

-- 4. Revoke all from public on these schemas just in case
REVOKE ALL ON SCHEMA private FROM PUBLIC;
REVOKE ALL ON SCHEMA private FROM authenticated;
GRANT USAGE ON SCHEMA private TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA private TO service_role;
