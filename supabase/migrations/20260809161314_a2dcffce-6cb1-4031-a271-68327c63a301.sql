-- Restringir execução da função has_role
REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO service_role;

-- Restringir execução da função has_permission
REVOKE ALL ON FUNCTION public.has_permission(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_permission(uuid, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_permission(uuid, text) TO service_role;
