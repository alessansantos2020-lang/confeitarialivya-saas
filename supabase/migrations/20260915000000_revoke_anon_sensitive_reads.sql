-- Keep internal order, audit, identity, and membership tables unavailable to anonymous clients.

REVOKE SELECT ON public.orders,
  public.order_items,
  public.order_status_history,
  public.audit_logs,
  public.profiles,
  public.user_roles,
  public.user_permissions,
  public.store_members,
  public.permissions
FROM anon;
