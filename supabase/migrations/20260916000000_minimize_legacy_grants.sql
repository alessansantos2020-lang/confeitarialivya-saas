-- Remove grants legados que permitiam mutações diretas fora dos fluxos protegidos.

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon;

GRANT EXECUTE ON FUNCTION public.create_order(jsonb) TO anon;
GRANT EXECUTE ON FUNCTION public.get_public_store(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_public_store_by_slug(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_public_catalog(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_public_delivery_fees(uuid) TO anon;

REVOKE INSERT, UPDATE, DELETE ON public.orders FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.order_items FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.order_status_history FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.audit_logs FROM anon, authenticated;

GRANT SELECT ON public.orders, public.order_items TO authenticated;
GRANT SELECT ON public.order_status_history, public.audit_logs TO authenticated;
GRANT UPDATE (status, cancel_reason, client_notified) ON public.orders TO authenticated;

DROP POLICY IF EXISTS "Authenticated Insert Access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Update Access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Delete Access" ON storage.objects;

COMMENT ON TABLE public.audit_logs IS
  'Append-only: escrita ocorre somente por funções SECURITY DEFINER autorizadas.';
COMMENT ON TABLE public.order_status_history IS
  'Append-only: escrita ocorre somente pelo trigger da máquina de estados.';
