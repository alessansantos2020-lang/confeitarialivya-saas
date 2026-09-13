-- Atomically claims one WhatsApp notification attempt per order and event.
CREATE OR REPLACE FUNCTION public.claim_order_whatsapp_attempt(
  _order_id uuid,
  _store_id uuid,
  _event text,
  _phone text,
  _message text
)
RETURNS TABLE (id uuid, status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
  IF auth.uid() IS NULL
    OR NOT private.is_store_member(auth.uid(), _store_id)
    OR NOT private.has_permission(auth.uid(), 'manage_orders')
    OR NOT private.can_use_feature(_store_id, 'order_hub')
  THEN
    RAISE EXCEPTION 'Not authorized to claim WhatsApp attempt';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.orders AS order_row
    WHERE order_row.id = _order_id
      AND order_row.store_id = _store_id
  ) THEN
    RAISE EXCEPTION 'Order does not belong to store';
  END IF;

  RETURN QUERY
  INSERT INTO public.order_whatsapp_attempts AS attempts (
    order_id, store_id, event, phone, message, status, error_message
  ) VALUES (
    _order_id, _store_id, _event, _phone, _message, 'started', NULL
  )
  ON CONFLICT (order_id, event) DO UPDATE
  SET phone = EXCLUDED.phone,
      message = EXCLUDED.message,
      status = 'started',
      error_message = NULL,
      updated_at = now()
  WHERE attempts.status = 'failed'
     OR (
       attempts.status = 'started'
       AND attempts.updated_at < now() - interval '10 minutes'
     )
  RETURNING attempts.id, attempts.status;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_order_whatsapp_attempt(uuid, uuid, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_order_whatsapp_attempt(uuid, uuid, text, text, text) TO authenticated;

DROP POLICY IF EXISTS "Store staff can create WhatsApp attempts" ON public.order_whatsapp_attempts;
CREATE POLICY "Store staff can create WhatsApp attempts"
  ON public.order_whatsapp_attempts FOR INSERT TO authenticated
  WITH CHECK (
    private.is_store_member(auth.uid(), order_whatsapp_attempts.store_id)
    AND private.has_permission(auth.uid(), 'manage_orders')
    AND private.can_use_feature(order_whatsapp_attempts.store_id, 'order_hub')
    AND EXISTS (
      SELECT 1
      FROM public.orders AS order_row
      WHERE order_row.id = order_whatsapp_attempts.order_id
        AND order_row.store_id = order_whatsapp_attempts.store_id
    )
  );
