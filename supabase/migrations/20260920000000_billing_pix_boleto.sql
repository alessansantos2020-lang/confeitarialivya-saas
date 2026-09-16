-- Billing SaaS: dados seguros para pagamento por Pix ou boleto.
-- O pagador escolhe o meio no checkout do provedor; cartão não faz parte do produto.

ALTER TABLE public.billing_invoices
  ADD COLUMN IF NOT EXISTS bank_slip_url text,
  ADD COLUMN IF NOT EXISTS bank_slip_barcode text,
  ADD COLUMN IF NOT EXISTS bank_slip_digitable_line text,
  ADD COLUMN IF NOT EXISTS pix_qr_code text,
  ADD COLUMN IF NOT EXISTS pix_copy_paste text;

ALTER TABLE public.billing_invoices
  DROP CONSTRAINT IF EXISTS billing_invoices_payment_method_check;

ALTER TABLE public.billing_invoices
  ADD CONSTRAINT billing_invoices_payment_method_check
  CHECK (payment_method IS NULL OR payment_method IN ('PIX', 'BOLETO'));

COMMENT ON COLUMN public.billing_invoices.payment_method IS
  'Meio escolhido ou confirmado pelo provedor. Permitidos apenas PIX e BOLETO; null significa ainda não escolhido.';
COMMENT ON COLUMN public.billing_invoices.pix_qr_code IS
  'Código QR ou conteúdo seguro retornado pelo provedor para pagamento Pix.';
COMMENT ON COLUMN public.billing_invoices.pix_copy_paste IS
  'Código Pix copia e cola retornado pelo provedor.';
COMMENT ON COLUMN public.billing_invoices.bank_slip_digitable_line IS
  'Linha digitável do boleto retornada pelo provedor.';

CREATE OR REPLACE FUNCTION public.record_billing_provider_payment(
  _provider_payment_id text,
  _status text,
  _payment_method text DEFAULT NULL,
  _invoice_url text DEFAULT NULL,
  _bank_slip_url text DEFAULT NULL,
  _bank_slip_barcode text DEFAULT NULL,
  _bank_slip_digitable_line text DEFAULT NULL,
  _pix_qr_code text DEFAULT NULL,
  _pix_copy_paste text DEFAULT NULL,
  _paid_at timestamptz DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE
  v_invoice_id uuid;
  v_current_status text;
  v_next_status text := upper(trim(COALESCE(_status, '')));
  v_method text := upper(NULLIF(trim(COALESCE(_payment_method, '')), ''));
BEGIN
  IF v_next_status NOT IN ('PENDING', 'CONFIRMED', 'RECEIVED', 'OVERDUE', 'REFUNDED', 'CANCELED', 'FAILED') THEN
    RAISE EXCEPTION 'Status de cobrança do provedor inválido.';
  END IF;
  IF v_method IS NOT NULL AND v_method NOT IN ('PIX', 'BOLETO') THEN
    RAISE EXCEPTION 'Forma de pagamento inválida. Use Pix ou boleto.';
  END IF;
  IF NULLIF(trim(COALESCE(_provider_payment_id, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Identificador de pagamento ausente.';
  END IF;

  SELECT id, status INTO v_invoice_id, v_current_status
  FROM public.billing_invoices
  WHERE provider_payment_id = trim(_provider_payment_id)
  FOR UPDATE;

  IF v_invoice_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Eventos atrasados não podem regredir uma cobrança já confirmada/recebida.
  IF v_current_status IN ('received', 'refunded')
     AND v_next_status IN ('pending', 'confirmed', 'overdue', 'failed', 'canceled') THEN
    v_next_status := upper(v_current_status);
  END IF;

  UPDATE public.billing_invoices
  SET status = lower(v_next_status),
      payment_method = COALESCE(v_method, payment_method),
      invoice_url = COALESCE(NULLIF(trim(_invoice_url), ''), invoice_url),
      bank_slip_url = COALESCE(NULLIF(trim(_bank_slip_url), ''), bank_slip_url),
      bank_slip_barcode = COALESCE(NULLIF(trim(_bank_slip_barcode), ''), bank_slip_barcode),
      bank_slip_digitable_line = COALESCE(NULLIF(trim(_bank_slip_digitable_line), ''), bank_slip_digitable_line),
      pix_qr_code = COALESCE(NULLIF(trim(_pix_qr_code), ''), pix_qr_code),
      pix_copy_paste = COALESCE(NULLIF(trim(_pix_copy_paste), ''), pix_copy_paste),
      paid_at = CASE
        WHEN lower(v_next_status) IN ('confirmed', 'received') THEN COALESCE(_paid_at, paid_at, now())
        WHEN lower(v_next_status) = 'refunded' THEN paid_at
        ELSE paid_at
      END,
      refunded_at = CASE
        WHEN lower(v_next_status) = 'refunded' THEN COALESCE(_paid_at, refunded_at, now())
        ELSE refunded_at
      END,
      failure_reason = CASE
        WHEN lower(v_next_status) = 'failed' THEN COALESCE(failure_reason, 'Falha informada pelo provedor.')
        ELSE failure_reason
      END
  WHERE id = v_invoice_id;

  RETURN v_invoice_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_billing_provider_payment(text, text, text, text, text, text, text, text, text, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_billing_provider_payment(text, text, text, text, text, text, text, text, text, timestamptz) TO service_role;
