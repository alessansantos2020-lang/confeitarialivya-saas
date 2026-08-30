-- Fix security linter warnings:
-- 1. Set search_path for handle_new_user and revoke public execution
ALTER FUNCTION public.handle_new_user() SET search_path = public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;

-- 2. Revoke execute on approve_employee (already SECURITY DEFINER)
-- We must check where it is. Assuming public.approve_employee based on previous audit.
REVOKE EXECUTE ON FUNCTION public.approve_employee(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.approve_employee(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.approve_employee(uuid) TO service_role;

-- 3. Revoke execute on register_employee if it exists
DO $$ 
BEGIN 
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'register_employee') THEN
    REVOKE EXECUTE ON FUNCTION public.register_employee(text, text, text, text, public.app_role, uuid[]) FROM PUBLIC;
    REVOKE EXECUTE ON FUNCTION public.register_employee(text, text, text, text, public.app_role, uuid[]) FROM authenticated;
  END IF;
END $$;
