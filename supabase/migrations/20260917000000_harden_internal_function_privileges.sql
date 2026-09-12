-- Fecha superfície de funções internas usadas somente por triggers e RLS.

ALTER FUNCTION public.set_order_operations_updated_at()
  SET search_path = public, pg_temp;

ALTER FUNCTION public.set_fiscal_updated_at()
  SET search_path = public, pg_temp;

ALTER FUNCTION private.order_status_label(text)
  SET search_path = public, private, pg_temp;

ALTER FUNCTION public.create_default_store_settings()
  SET search_path = public, private, pg_temp;

ALTER FUNCTION public.record_order_status_history()
  SET search_path = public, private, pg_temp;

REVOKE ALL ON FUNCTION public.set_order_operations_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_fiscal_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.order_status_label(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_default_store_settings() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_order_status_history() FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.my_store_features(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_store_features(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.super_admin_users() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.super_admin_users() TO authenticated, service_role;
