-- Fix security linter warnings:
-- 1. Tighten handle_new_user
ALTER FUNCTION public.handle_new_user() SET search_path = public;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;

-- 2. Tighten approve_employee
ALTER FUNCTION public.approve_employee(uuid) SET search_path = public;
REVOKE ALL ON FUNCTION public.approve_employee(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.approve_employee(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.approve_employee(uuid) TO service_role;
