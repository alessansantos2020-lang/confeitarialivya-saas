-- Sincroniza cobranças recorrentes do Asaas mesmo quando o webhook chega
-- antes de a aplicação conhecer o provider_payment_id.

CREATE OR REPLACE FUNCTION public.sync_billing_provider_payment(
  _provider_subscription_id text,
  _provider_payment_id text,
  _status text,
  _payment_method text DEFAULT NULL,
  _invoice_url text DEFAULT NULL,
  _bank_slip_url text DEFAULT NULL,
  _bank_slip_barcode text DEFAULT NULL,
  _bank_slip_digitable_line text DEFAULT NULL,
  _pix_qr_code text DEFAULT NULL,
  _pix_copy_paste text DEFAULT NULL,
  _amount_cents integer DEFAULT NULL,
  _due_date date DEFAULT NULL,
  _paid_at timestamptz DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE
  v_invoice_id uuid;
  v_subscription_id uuid;
  v_store_id uuid;
  v_amount_cents integer;
  v_period_start date;
  v_period_end date;
  v_due_date date := _due_date;
BEGIN
  IF NULLIF(trim(COALESCE(_provider_payment_id, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Identificador de pagamento ausente.';
  END IF;

  SELECT id INTO v_invoice_id
  FROM public.billing_invoices
  WHERE provider_payment_id = trim(_provider_payment_id)
  FOR UPDATE;

  IF v_invoice_id IS NULL AND NULLIF(trim(COALESCE(_provider_subscription_id, '')), '') IS NOT NULL THEN
    SELECT id, store_id, amount_cents, current_period_start, current_period_end
      INTO v_subscription_id, v_store_id, v_amount_cents, v_period_start, v_period_end
    FROM public.billing_subscriptions
    WHERE provider_subscription_id = trim(_provider_subscription_id)
    FOR UPDATE;

    IF v_subscription_id IS NOT NULL THEN
      v_amount_cents := COALESCE(_amount_cents, v_amount_cents);
      v_due_date := COALESCE(v_due_date, v_period_end, v_period_start, CURRENT_DATE);
      v_period_start := COALESCE(v_period_start, v_due_date);
      v_period_end := COALESCE(v_period_end, v_due_date);

      SELECT id INTO v_invoice_id
      FROM public.billing_invoices
      WHERE subscription_id = v_subscription_id
        AND provider_payment_id IS NULL
      ORDER BY due_date DESC, created_at DESC
      LIMIT 1
      FOR UPDATE;

      IF v_invoice_id IS NULL THEN
        INSERT INTO public.billing_invoices (
          subscription_id, store_id, provider_payment_id,
          period_start, period_end, amount_cents, due_date, status
        ) VALUES (
          v_subscription_id, v_store_id, trim(_provider_payment_id),
          v_period_start, v_period_end, COALESCE(v_amount_cents, 0), v_due_date, 'pending'
        )
        RETURNING id INTO v_invoice_id;
      ELSE
        UPDATE public.billing_invoices
        SET provider_payment_id = trim(_provider_payment_id),
            amount_cents = COALESCE(_amount_cents, amount_cents),
            due_date = COALESCE(_due_date, due_date)
        WHERE id = v_invoice_id;
      END IF;
    END IF;
  END IF;

  IF v_invoice_id IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN public.record_billing_provider_payment(
    trim(_provider_payment_id), _status, _payment_method, _invoice_url,
    _bank_slip_url, _bank_slip_barcode, _bank_slip_digitable_line,
    _pix_qr_code, _pix_copy_paste, _paid_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.sync_billing_provider_payment(text, text, text, text, text, text, text, text, text, text, integer, date, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_billing_provider_payment(text, text, text, text, text, text, text, text, text, text, integer, date, timestamptz) TO service_role;
