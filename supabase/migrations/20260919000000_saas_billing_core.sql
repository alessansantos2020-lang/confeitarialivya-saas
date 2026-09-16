-- Billing SaaS: contratos, faturas e eventos do provedor.
-- O financeiro de pedidos permanece separado destas tabelas.

CREATE TABLE IF NOT EXISTS public.billing_customer_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL UNIQUE REFERENCES public.stores(id) ON DELETE CASCADE,
  legal_name text NOT NULL,
  tax_id text,
  email text,
  phone text,
  address text,
  city text,
  state text,
  postal_code text,
  provider text NOT NULL DEFAULT 'asaas' CHECK (provider IN ('asaas')),
  provider_customer_id text UNIQUE,
  status text NOT NULL DEFAULT 'incomplete'
    CHECK (status IN ('incomplete', 'active', 'blocked')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.billing_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES public.plans(id) ON DELETE SET NULL,
  provider text NOT NULL DEFAULT 'asaas' CHECK (provider IN ('asaas')),
  provider_customer_id text,
  provider_subscription_id text UNIQUE,
  idempotency_key text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'past_due', 'canceled', 'suspended')),
  billing_period text NOT NULL CHECK (billing_period IN ('monthly', 'quarterly', 'yearly')),
  amount_cents integer NOT NULL CHECK (amount_cents >= 0),
  started_at timestamptz,
  current_period_start date,
  current_period_end date,
  next_due_date date,
  canceled_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_billing_active_subscription_per_store
  ON public.billing_subscriptions(store_id)
  WHERE status IN ('pending', 'active', 'past_due');
CREATE INDEX IF NOT EXISTS idx_billing_subscriptions_store
  ON public.billing_subscriptions(store_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_billing_subscriptions_status
  ON public.billing_subscriptions(status, next_due_date);
CREATE INDEX IF NOT EXISTS idx_billing_subscriptions_plan
  ON public.billing_subscriptions(plan_id);
CREATE INDEX IF NOT EXISTS idx_billing_subscriptions_provider
  ON public.billing_subscriptions(provider_subscription_id);

CREATE TABLE IF NOT EXISTS public.billing_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL REFERENCES public.billing_subscriptions(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'asaas' CHECK (provider IN ('asaas')),
  provider_invoice_id text UNIQUE,
  provider_payment_id text UNIQUE,
  period_start date NOT NULL,
  period_end date NOT NULL,
  amount_cents integer NOT NULL CHECK (amount_cents >= 0),
  due_date date NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'received', 'overdue', 'refunded', 'canceled', 'failed')),
  payment_method text,
  invoice_url text,
  paid_at timestamptz,
  refunded_at timestamptz,
  failure_reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(subscription_id, period_start, period_end)
);

CREATE INDEX IF NOT EXISTS idx_billing_invoices_store_date
  ON public.billing_invoices(store_id, due_date DESC);
CREATE INDEX IF NOT EXISTS idx_billing_invoices_status_date
  ON public.billing_invoices(status, due_date);
CREATE INDEX IF NOT EXISTS idx_billing_invoices_subscription
  ON public.billing_invoices(subscription_id, period_start DESC);

CREATE TABLE IF NOT EXISTS public.billing_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL DEFAULT 'asaas' CHECK (provider IN ('asaas')),
  provider_event_id text NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  signature_valid boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'received'
    CHECK (status IN ('received', 'processed', 'ignored', 'failed')),
  processing_error text,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(provider, provider_event_id)
);

CREATE INDEX IF NOT EXISTS idx_billing_webhooks_status
  ON public.billing_webhook_events(status, created_at);

CREATE TABLE IF NOT EXISTS public.billing_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.billing_invoices(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('discount', 'credit', 'debit', 'refund')),
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  reason text NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_billing_adjustments_invoice
  ON public.billing_adjustments(invoice_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.touch_billing_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS billing_customer_profiles_updated_at ON public.billing_customer_profiles;
CREATE TRIGGER billing_customer_profiles_updated_at
  BEFORE UPDATE ON public.billing_customer_profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_billing_updated_at();

DROP TRIGGER IF EXISTS billing_subscriptions_updated_at ON public.billing_subscriptions;
CREATE TRIGGER billing_subscriptions_updated_at
  BEFORE UPDATE ON public.billing_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.touch_billing_updated_at();

DROP TRIGGER IF EXISTS billing_invoices_updated_at ON public.billing_invoices;
CREATE TRIGGER billing_invoices_updated_at
  BEFORE UPDATE ON public.billing_invoices
  FOR EACH ROW EXECUTE FUNCTION public.touch_billing_updated_at();

CREATE OR REPLACE FUNCTION public.upsert_billing_customer_profile(
  _store_id uuid,
  _legal_name text,
  _tax_id text DEFAULT NULL,
  _email text DEFAULT NULL,
  _phone text DEFAULT NULL,
  _address text DEFAULT NULL,
  _city text DEFAULT NULL,
  _state text DEFAULT NULL,
  _postal_code text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF NOT private.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Acesso restrito ao administrador do sistema.';
  END IF;
  IF _store_id IS NULL OR length(trim(COALESCE(_legal_name, ''))) < 2 THEN
    RAISE EXCEPTION 'Nome legal inválido.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.stores WHERE id = _store_id) THEN
    RAISE EXCEPTION 'Loja não encontrada.';
  END IF;

  INSERT INTO public.billing_customer_profiles (
    store_id, legal_name, tax_id, email, phone, address, city, state, postal_code, status
  ) VALUES (
    _store_id, trim(_legal_name), NULLIF(trim(_tax_id), ''), NULLIF(trim(_email), ''),
    NULLIF(trim(_phone), ''), NULLIF(trim(_address), ''), NULLIF(trim(_city), ''),
    NULLIF(trim(_state), ''), NULLIF(trim(_postal_code), ''), 'active'
  )
  ON CONFLICT (store_id) DO UPDATE SET
    legal_name = EXCLUDED.legal_name,
    tax_id = EXCLUDED.tax_id,
    email = EXCLUDED.email,
    phone = EXCLUDED.phone,
    address = EXCLUDED.address,
    city = EXCLUDED.city,
    state = EXCLUDED.state,
    postal_code = EXCLUDED.postal_code,
    status = 'active'
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_billing_subscription(
  _store_id uuid,
  _plan_id uuid,
  _billing_period text,
  _amount_cents integer,
  _starts_on date,
  _next_due_date date,
  _idempotency_key text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE
  v_id uuid;
  v_existing uuid;
  v_period_end date;
BEGIN
  IF NOT private.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Acesso restrito ao administrador do sistema.';
  END IF;
  IF _store_id IS NULL OR _plan_id IS NULL OR _amount_cents < 0
     OR _idempotency_key IS NULL OR length(trim(_idempotency_key)) < 8 THEN
    RAISE EXCEPTION 'Dados da assinatura inválidos.';
  END IF;
  IF _billing_period NOT IN ('monthly', 'quarterly', 'yearly') THEN
    RAISE EXCEPTION 'Ciclo de cobrança inválido.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.stores WHERE id = _store_id) THEN
    RAISE EXCEPTION 'Loja não encontrada.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.plans WHERE id = _plan_id AND is_active) THEN
    RAISE EXCEPTION 'Plano ativo não encontrado.';
  END IF;

  SELECT id INTO v_existing
  FROM public.billing_subscriptions
  WHERE idempotency_key = trim(_idempotency_key);
  IF v_existing IS NOT NULL THEN
    RETURN v_existing;
  END IF;

  v_period_end := CASE _billing_period
    WHEN 'monthly' THEN (_starts_on + interval '1 month')::date
    WHEN 'quarterly' THEN (_starts_on + interval '3 months')::date
    ELSE (_starts_on + interval '1 year')::date
  END;

  INSERT INTO public.billing_subscriptions (
    store_id, plan_id, idempotency_key, status, billing_period,
    amount_cents, started_at, current_period_start, current_period_end,
    next_due_date
  ) VALUES (
    _store_id, _plan_id, trim(_idempotency_key), 'pending', _billing_period,
    _amount_cents, now(), _starts_on, v_period_end, _next_due_date
  ) RETURNING id INTO v_id;

  INSERT INTO public.billing_invoices (
    subscription_id, store_id, period_start, period_end,
    amount_cents, due_date, status
  ) VALUES (
    v_id, _store_id, _starts_on, v_period_end,
    _amount_cents, _next_due_date, 'pending'
  );

  PERFORM public.append_audit_log(
    'billing_subscription_created', 'cobrancas', _store_id,
    'Assinatura criada pelo administrador; aguardando configuração do provedor.',
    jsonb_build_object('subscription_id', v_id, 'plan_id', _plan_id, 'amount_cents', _amount_cents)
  );
  RETURN v_id;
EXCEPTION
  WHEN unique_violation THEN
    SELECT id INTO v_existing
    FROM public.billing_subscriptions
    WHERE idempotency_key = trim(_idempotency_key);
    IF v_existing IS NOT NULL THEN RETURN v_existing; END IF;
    RAISE;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_billing_manual_event(
  _invoice_id uuid,
  _status text,
  _reason text,
  _paid_at timestamptz DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE
  v_store_id uuid;
BEGIN
  IF NOT private.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Acesso restrito ao administrador do sistema.';
  END IF;
  IF _status NOT IN ('pending', 'confirmed', 'received', 'overdue', 'refunded', 'canceled', 'failed')
     OR length(trim(COALESCE(_reason, ''))) < 5 THEN
    RAISE EXCEPTION 'Evento financeiro inválido.';
  END IF;
  SELECT store_id INTO v_store_id FROM public.billing_invoices WHERE id = _invoice_id;
  IF v_store_id IS NULL THEN RAISE EXCEPTION 'Fatura não encontrada.'; END IF;

  UPDATE public.billing_invoices
  SET status = _status,
      paid_at = CASE WHEN _status IN ('confirmed', 'received') THEN COALESCE(_paid_at, now()) ELSE NULL END,
      refunded_at = CASE WHEN _status = 'refunded' THEN COALESCE(_paid_at, now()) ELSE NULL END,
      failure_reason = CASE WHEN _status IN ('failed', 'overdue') THEN trim(_reason) ELSE NULL END
  WHERE id = _invoice_id;

  PERFORM public.append_audit_log(
    'billing_invoice_status_changed', 'cobrancas', v_store_id,
    trim(_reason), jsonb_build_object('invoice_id', _invoice_id, 'status', _status)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.touch_billing_updated_at() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.upsert_billing_customer_profile(uuid, text, text, text, text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_billing_customer_profile(uuid, text, text, text, text, text, text, text, text) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.create_billing_subscription(uuid, uuid, text, integer, date, date, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_billing_subscription(uuid, uuid, text, integer, date, date, text) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.record_billing_manual_event(uuid, text, text, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_billing_manual_event(uuid, text, text, timestamptz) TO authenticated, service_role;

ALTER TABLE public.billing_customer_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_adjustments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins manage billing profiles" ON public.billing_customer_profiles
  FOR ALL TO authenticated USING (private.is_super_admin(auth.uid()))
  WITH CHECK (private.is_super_admin(auth.uid()));
CREATE POLICY "Store admins read billing profiles" ON public.billing_customer_profiles
  FOR SELECT TO authenticated USING (private.is_store_admin(auth.uid(), store_id));

CREATE POLICY "Super admins manage billing subscriptions" ON public.billing_subscriptions
  FOR ALL TO authenticated USING (private.is_super_admin(auth.uid()))
  WITH CHECK (private.is_super_admin(auth.uid()));
CREATE POLICY "Store admins read billing subscriptions" ON public.billing_subscriptions
  FOR SELECT TO authenticated USING (private.is_store_admin(auth.uid(), store_id));

CREATE POLICY "Super admins manage billing invoices" ON public.billing_invoices
  FOR ALL TO authenticated USING (private.is_super_admin(auth.uid()))
  WITH CHECK (private.is_super_admin(auth.uid()));
CREATE POLICY "Store admins read billing invoices" ON public.billing_invoices
  FOR SELECT TO authenticated USING (private.is_store_admin(auth.uid(), store_id));

CREATE POLICY "Super admins read billing webhooks" ON public.billing_webhook_events
  FOR SELECT TO authenticated USING (private.is_super_admin(auth.uid()));

CREATE POLICY "Super admins manage billing adjustments" ON public.billing_adjustments
  FOR ALL TO authenticated USING (private.is_super_admin(auth.uid()))
  WITH CHECK (private.is_super_admin(auth.uid()));
CREATE POLICY "Store admins read billing adjustments" ON public.billing_adjustments
  FOR SELECT TO authenticated USING (private.is_store_admin(auth.uid(), store_id));

REVOKE ALL ON public.billing_webhook_events FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.billing_customer_profiles FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.billing_subscriptions FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.billing_invoices FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.billing_adjustments FROM authenticated;

-- Mantém a lista fechada de eventos de auditoria e adiciona os eventos de billing.
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
  IF v_actor IS NULL OR NOT private.is_account_active(v_actor) THEN RETURN; END IF;
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
    WHEN 'billing_subscription_created' THEN _module = 'cobrancas'
    WHEN 'billing_invoice_status_changed' THEN _module = 'cobrancas'
    WHEN 'billing_invoice_synced' THEN _module = 'cobrancas'
    WHEN 'billing_subscription_canceled' THEN _module = 'cobrancas'
    WHEN 'billing_adjustment_created' THEN _module = 'cobrancas'
    ELSE false
  END;
  IF NOT v_allowed OR length(trim(COALESCE(_action, ''))) > 80
     OR length(trim(COALESCE(_module, ''))) > 80
     OR length(COALESCE(_description, '')) > 2000 THEN
    RAISE EXCEPTION 'Evento de auditoria inválido.';
  END IF;
  IF _store_id IS NOT NULL AND NOT private.is_super_admin(v_actor)
     AND NOT private.is_store_member(v_actor, _store_id) THEN
    RAISE EXCEPTION 'Usuário não pertence à loja informada.';
  END IF;
  INSERT INTO public.audit_logs (actor_id, actor_email, action, module, store_id, description, metadata)
  SELECT v_actor, u.email::text, _action, _module, _store_id,
         NULLIF(trim(_description), ''), _metadata
  FROM auth.users u WHERE u.id = v_actor;
END;
$$;

REVOKE ALL ON FUNCTION public.append_audit_log(text, text, uuid, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.append_audit_log(text, text, uuid, text, jsonb) TO authenticated;
