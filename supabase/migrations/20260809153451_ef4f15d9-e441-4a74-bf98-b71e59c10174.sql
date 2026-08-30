REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO service_role;
