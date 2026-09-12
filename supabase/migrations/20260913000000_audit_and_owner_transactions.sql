-- Auditoria confiável e atribuição transacional de proprietário.

CREATE OR REPLACE FUNCTION public.append_audit_log(
  _action text,
  _module text,
  _store_id uuid DEFAULT NULL,
  _description text DEFAULT NULL,
  _metadata jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_allowed boolean;
BEGIN
  IF v_actor IS NULL OR NOT private.is_account_active(v_actor) THEN
    RETURN;
  END IF;

  v_allowed := CASE _action
    WHEN 'announcement_created' THEN _module = 'avisos'
    WHEN 'announcement_updated' THEN _module = 'avisos'
    WHEN 'announcement_deleted' THEN _module = 'avisos'
    WHEN 'saas_settings_updated' THEN _module = 'configuracoes'
    WHEN 'store_created' THEN _module = 'lojas'
    WHEN 'store_activated' THEN _module = 'lojas'
    WHEN 'store_deactivated' THEN _module = 'lojas'
    WHEN 'store_blocked' THEN _module = 'lojas'
    WHEN 'store_renamed' THEN _module = 'lojas'
    WHEN 'store_owner_assigned' THEN _module = 'lojas'
    WHEN 'user_blocked' THEN _module = 'usuarios'
    WHEN 'user_activated' THEN _module = 'usuarios'
    WHEN 'user_renamed' THEN _module = 'usuarios'
    WHEN 'plan_created' THEN _module = 'planos'
    WHEN 'plan_updated' THEN _module = 'planos'
    WHEN 'plan_deleted' THEN _module = 'planos'
    WHEN 'store_plan_changed' THEN _module = 'lojas'
    WHEN 'support_access_start' THEN _module = 'suporte'
    WHEN 'support_access_end' THEN _module = 'suporte'
    WHEN 'settings_updated' THEN _module = 'configuracoes'
    WHEN 'order_reopened' THEN _module = 'pedidos'
    WHEN 'order_status_changed' THEN _module = 'pedidos'
    WHEN 'order_canceled' THEN _module = 'pedidos'
    ELSE false
  END;

  IF NOT v_allowed OR length(trim(COALESCE(_action, ''))) > 80
     OR length(trim(COALESCE(_module, ''))) > 80
     OR length(COALESCE(_description, '')) > 2000 THEN
    RAISE EXCEPTION 'Evento de auditoria inválido.';
  END IF;

  IF _store_id IS NOT NULL
     AND NOT private.is_super_admin(v_actor)
     AND NOT private.is_store_member(v_actor, _store_id) THEN
    RAISE EXCEPTION 'Usuário não pertence à loja informada.';
  END IF;

  INSERT INTO public.audit_logs (
    actor_id,
    actor_email,
    action,
    module,
    store_id,
    description,
    metadata
  )
  SELECT
    v_actor,
    u.email::text,
    _action,
    _module,
    _store_id,
    NULLIF(trim(_description), ''),
    _metadata
  FROM auth.users u
  WHERE u.id = v_actor;
END;
$$;

REVOKE ALL ON FUNCTION public.append_audit_log(text, text, uuid, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.append_audit_log(text, text, uuid, text, jsonb)
  TO authenticated;

REVOKE INSERT ON public.audit_logs FROM authenticated;

CREATE OR REPLACE FUNCTION public.assign_store_owner(
  _store_id uuid,
  _user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
BEGIN
  IF NOT private.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Acesso restrito ao administrador do sistema.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.stores WHERE id = _store_id) THEN
    RAISE EXCEPTION 'Loja não encontrada.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = _user_id) THEN
    RAISE EXCEPTION 'Usuário não encontrado.';
  END IF;

  UPDATE public.stores
  SET owner_id = _user_id, updated_at = now()
  WHERE id = _store_id;

  INSERT INTO public.store_members (store_id, user_id, role)
  VALUES (_store_id, _user_id, 'admin')
  ON CONFLICT (store_id, user_id)
  DO UPDATE SET role = 'admin', updated_at = now();

  INSERT INTO public.user_roles (user_id, role)
  VALUES (_user_id, 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;

  PERFORM public.append_audit_log(
    'store_owner_assigned',
    'lojas',
    _store_id,
    'Conta definida como dona da loja.',
    jsonb_build_object('assigned_user_id', _user_id)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.assign_store_owner(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assign_store_owner(uuid, uuid) TO authenticated;
