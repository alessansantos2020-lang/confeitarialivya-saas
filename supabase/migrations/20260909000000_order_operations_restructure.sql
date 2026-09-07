-- Reestruturação operacional de pedidos. Aditiva: preserva pedidos e configurações existentes.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS cancel_reason text;

ALTER TABLE public.store_settings
  ADD COLUMN IF NOT EXISTS whatsapp_accept_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS whatsapp_cancel_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS whatsapp_shipping_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS whatsapp_template_aceito text,
  ADD COLUMN IF NOT EXISTS whatsapp_template_cancelado text;

-- O fluxo operacional permite cancelamento somente até Pronto.
CREATE OR REPLACE FUNCTION public.validate_order_status_transition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  allowed boolean := false;
  next_options text;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  IF OLD.status = 'pending' AND NEW.status IN ('confirmed', 'canceled') THEN
    allowed := true;
    next_options := 'Aceito ou Cancelado';
  ELSIF OLD.status = 'confirmed' AND NEW.status IN ('preparing', 'canceled', 'pending') THEN
    allowed := true;
    next_options := 'Em Preparo, Cancelado ou Novo Pedido';
  ELSIF OLD.status = 'preparing' AND NEW.status IN ('ready', 'canceled', 'confirmed') THEN
    allowed := true;
    next_options := 'Pronto, Cancelado ou Aceito';
  ELSIF OLD.status = 'ready' AND NEW.status IN ('out_for_delivery', 'canceled', 'preparing') THEN
    allowed := true;
    next_options := 'Saiu para Entrega, Cancelado ou Em Preparo';
  ELSIF OLD.status = 'out_for_delivery' AND NEW.status IN ('delivered', 'ready') THEN
    allowed := true;
    next_options := 'Entregue ou Pronto';
  ELSIF OLD.status = 'delivered' AND NEW.status = 'out_for_delivery' THEN
    allowed := true;
    next_options := 'Saiu para Entrega';
  ELSIF OLD.status = 'canceled' AND NEW.status = 'pending' THEN
    allowed := true;
    next_options := 'Novo Pedido';
  END IF;

  IF NOT allowed THEN
    RAISE EXCEPTION
      'Não é possível mudar o pedido de "%" para "%". A partir de "%" só dá para ir para "%".',
      private.order_status_label(OLD.status),
      private.order_status_label(NEW.status),
      private.order_status_label(OLD.status),
      COALESCE(next_options, 'nenhuma etapa permitida')
      USING ERRCODE = 'P0001',
            DETAIL = format('transicao_invalida: %s -> %s', OLD.status, NEW.status);
  END IF;

  IF NEW.status <> 'canceled' AND NEW.cancel_reason IS DISTINCT FROM OLD.cancel_reason THEN
    NEW.cancel_reason := OLD.cancel_reason;
  END IF;

  RETURN NEW;
END;
$$;

-- Histórico append-only da máquina de estados.
CREATE TABLE IF NOT EXISTS public.order_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  from_status text,
  to_status text NOT NULL,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT order_status_history_status_check CHECK (
    (from_status IS NULL OR from_status IN ('pending','confirmed','preparing','ready','out_for_delivery','delivered','canceled'))
    AND to_status IN ('pending','confirmed','preparing','ready','out_for_delivery','delivered','canceled')
  )
);

CREATE INDEX IF NOT EXISTS idx_order_status_history_order
  ON public.order_status_history (order_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_status_history_store
  ON public.order_status_history (store_id, created_at DESC);

ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Store staff can view order status history" ON public.order_status_history;
CREATE POLICY "Store staff can view order status history"
  ON public.order_status_history FOR SELECT TO authenticated
  USING (private.is_store_member(auth.uid(), store_id));

CREATE OR REPLACE FUNCTION public.record_order_status_history()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.order_status_history (
      order_id, store_id, from_status, to_status, actor_id, actor_email
    ) VALUES (
      NEW.id,
      NEW.store_id,
      OLD.status,
      NEW.status,
      auth.uid(),
      COALESCE(auth.jwt() ->> 'email', NULL)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS record_order_status_history_trigger ON public.orders;
CREATE TRIGGER record_order_status_history_trigger
  AFTER UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.record_order_status_history();

-- Uma tentativa automática por pedido e evento. Tentativas falhas podem ser reabertas.
CREATE TABLE IF NOT EXISTS public.order_whatsapp_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  event text NOT NULL CHECK (event IN ('accepted', 'canceled', 'shipping')),
  phone text NOT NULL,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'started' CHECK (status IN ('started', 'opened', 'failed')),
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (order_id, event)
);

CREATE INDEX IF NOT EXISTS idx_order_whatsapp_attempts_store
  ON public.order_whatsapp_attempts (store_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_whatsapp_attempts_order
  ON public.order_whatsapp_attempts (order_id, event);

ALTER TABLE public.order_whatsapp_attempts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Store staff can view WhatsApp attempts" ON public.order_whatsapp_attempts;
CREATE POLICY "Store staff can view WhatsApp attempts"
  ON public.order_whatsapp_attempts FOR SELECT TO authenticated
  USING (
    private.is_store_member(auth.uid(), store_id)
    AND private.has_permission(auth.uid(), 'view_orders')
    AND private.can_use_feature(store_id, 'order_hub')
  );

DROP POLICY IF EXISTS "Store staff can create WhatsApp attempts" ON public.order_whatsapp_attempts;
CREATE POLICY "Store staff can create WhatsApp attempts"
  ON public.order_whatsapp_attempts FOR INSERT TO authenticated
  WITH CHECK (
    private.is_store_member(auth.uid(), store_id)
    AND private.has_permission(auth.uid(), 'manage_orders')
    AND private.can_use_feature(store_id, 'order_hub')
    AND EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_id AND o.store_id = store_id
    )
  );

DROP POLICY IF EXISTS "Store staff can update WhatsApp attempts" ON public.order_whatsapp_attempts;
CREATE POLICY "Store staff can update WhatsApp attempts"
  ON public.order_whatsapp_attempts FOR UPDATE TO authenticated
  USING (
    private.is_store_member(auth.uid(), store_id)
    AND private.has_permission(auth.uid(), 'manage_orders')
    AND private.can_use_feature(store_id, 'order_hub')
  )
  WITH CHECK (
    private.is_store_member(auth.uid(), store_id)
    AND private.has_permission(auth.uid(), 'manage_orders')
    AND private.can_use_feature(store_id, 'order_hub')
  );

CREATE OR REPLACE FUNCTION public.set_order_operations_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_order_whatsapp_attempts_updated_at ON public.order_whatsapp_attempts;
CREATE TRIGGER set_order_whatsapp_attempts_updated_at
  BEFORE UPDATE ON public.order_whatsapp_attempts
  FOR EACH ROW EXECUTE FUNCTION public.set_order_operations_updated_at();
