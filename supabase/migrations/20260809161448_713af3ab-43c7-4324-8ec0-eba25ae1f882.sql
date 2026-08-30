-- A política "Admins can update all profiles" pode estar conflitando se o RLS tentar chamar has_role internamente
-- Vamos garantir que o service_role possa fazer tudo
GRANT ALL ON public.profiles TO service_role;
GRANT ALL ON public.user_roles TO service_role;
GRANT ALL ON public.user_permissions TO service_role;
GRANT ALL ON public.permissions TO service_role;

-- Revogar execução pública e garantir ao service_role
REVOKE ALL ON FUNCTION public.has_permission(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_permission(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.has_permission(uuid, text) TO authenticated; -- Para permitir que o usuário verifique suas próprias permissões via RPC
