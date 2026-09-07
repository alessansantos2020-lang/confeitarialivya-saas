-- ============================================================================
-- FASE 22: STATUS DE PEDIDO COM MAQUINA DE ESTADOS NO BANCO
-- ============================================================================
-- Aditiva: nenhum pedido e apagado ou recalculado.

ALTER TABLE public.orders
  ADD CONSTRAINT orders_status_check
  CHECK (status IN (
    'pending',
    'confirmed',
    'preparing',
    'ready',
    'out_for_delivery',
    'delivered',
    'canceled'
  ));

ALTER TABLE public.orders
  ALTER COLUMN status SET DEFAULT 'pending',
  ALTER COLUMN status SET NOT NULL;

CREATE OR REPLACE FUNCTION private.order_status_label(_status text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE _status
    WHEN 'pending' THEN 'Novo Pedido'
    WHEN 'confirmed' THEN 'Aceito'
    WHEN 'preparing' THEN 'Em Preparo'
    WHEN 'ready' THEN 'Pronto'
    WHEN 'out_for_delivery' THEN 'Saiu para Entrega'
    WHEN 'delivered' THEN 'Entregue'
    WHEN 'canceled' THEN 'Cancelado'
    ELSE _status
  END;
$$;

REVOKE ALL ON FUNCTION private.order_status_label(text) FROM PUBLIC, anon, authenticated;

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
  -- Total e client_notified mudam durante o checkout/notificacao sem mudar status.
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
  ELSIF OLD.status = 'out_for_delivery' AND NEW.status IN ('delivered', 'canceled', 'ready') THEN
    allowed := true;
    next_options := 'Entregue, Cancelado ou Pronto';
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

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.validate_order_status_transition() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS validate_order_status_transition_trigger ON public.orders;
CREATE TRIGGER validate_order_status_transition_trigger
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.validate_order_status_transition();

COMMENT ON FUNCTION public.validate_order_status_transition() IS
  'Impede status invalidos e saltos de etapa em pedidos. Atualizacoes que nao mudam status continuam permitidas.';

DROP POLICY IF EXISTS "Store staff can update orders" ON public.orders;
CREATE POLICY "Store staff can update orders" ON public.orders
  FOR UPDATE TO authenticated
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

-- Checkout anonimo continua inserindo pedidos. Leitura e alteracoes anonimas
-- nao fazem parte do checkout e nao devem depender apenas de RLS.
REVOKE SELECT, UPDATE, DELETE ON public.orders FROM anon;
REVOKE UPDATE, DELETE ON public.order_items FROM anon;
