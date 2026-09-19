-- Correções da auditoria de segurança:
-- 1. create_order: restaura validação estrita de adicionais (vínculo produto-grupo,
--    duplicados, min/max e grupos obrigatórios) e grava os itens a partir dos
--    dados validados (sem TOCTOU no segundo loop).
-- 2. record_billing_manual_event: guarda de regressão de status financeiro.
-- 3. profiles: remove policy de INSERT órfã e grant residual.
-- 4. private.has_role / has_permission: revoga EXECUTE de anon.

-- ----------------------------------------------------------------------------
-- 1. create_order com validação completa de adicionais
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_order(_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE
  v_store_id uuid;
  v_order_id uuid := gen_random_uuid();
  v_items jsonb;
  v_item_record record;
  v_product_id uuid;
  v_product_name text;
  v_product_store_id uuid;
  v_product_available boolean;
  v_base_price numeric;
  v_quantity integer;
  v_selected_addons jsonb;
  v_canonical_addons jsonb;
  v_addon_record record;
  v_addon_id uuid;
  v_addon_id_text text;
  v_addon_name text;
  v_addon_price numeric;
  v_addon_group_id uuid;
  v_addons_total numeric;
  v_addon_ids text[];
  v_group record;
  v_group_count integer;
  v_subtotal numeric := 0;
  v_delivery_fee numeric;
  v_total numeric;
  v_customer_name text;
  v_customer_phone text;
  v_address text;
  v_neighborhood text;
  v_street text;
  v_number text;
  v_complement text;
  v_reference text;
  v_payment_method text;
  v_change_for numeric;
  v_observation text;
  v_validated_items jsonb := '[]'::jsonb;
  v_item_validated record;
  v_result jsonb;
BEGIN
  IF _payload IS NULL OR jsonb_typeof(_payload) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'Dados do pedido inválidos';
  END IF;

  IF COALESCE(_payload->>'store_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RAISE EXCEPTION 'Loja inválida';
  END IF;
  v_store_id := (_payload->>'store_id')::uuid;

  IF NOT EXISTS (
    SELECT 1 FROM public.stores
    WHERE id = v_store_id AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'Loja indisponível';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.store_settings ss
    WHERE ss.store_id = v_store_id
      AND COALESCE(ss.is_open, true) IS FALSE
  ) THEN
    RAISE EXCEPTION 'Loja fechada no momento';
  END IF;

  v_customer_name := NULLIF(trim(_payload->>'customer_name'), '');
  v_customer_phone := NULLIF(trim(_payload->>'customer_phone'), '');
  v_address := NULLIF(trim(_payload->>'address'), '');
  v_neighborhood := NULLIF(trim(_payload->>'neighborhood'), '');
  v_street := NULLIF(trim(_payload->>'street'), '');
  v_number := NULLIF(trim(_payload->>'number'), '');
  v_complement := NULLIF(trim(_payload->>'complement'), '');
  v_reference := NULLIF(trim(_payload->>'reference'), '');
  v_payment_method := NULLIF(trim(_payload->>'payment_method'), '');
  v_observation := NULLIF(trim(_payload->>'observation'), '');

  IF (_payload->>'change_for') IS NOT NULL AND trim(_payload->>'change_for') <> '' THEN
    v_change_for := (_payload->>'change_for')::numeric;
  ELSE
    v_change_for := NULL;
  END IF;

  IF v_customer_name IS NULL OR length(v_customer_name) < 2 OR length(v_customer_name) > 120 THEN
    RAISE EXCEPTION 'Nome do cliente inválido';
  END IF;
  IF v_customer_phone IS NULL OR length(regexp_replace(v_customer_phone, '\D', '', 'g')) < 10 THEN
    RAISE EXCEPTION 'Telefone do cliente inválido';
  END IF;
  IF v_address IS NULL OR v_neighborhood IS NULL OR v_street IS NULL OR v_number IS NULL THEN
    RAISE EXCEPTION 'Endereço incompleto';
  END IF;
  IF length(v_address) > 500 OR length(v_observation) > 1000 THEN
    RAISE EXCEPTION 'Dados do pedido excedem o tamanho permitido';
  END IF;
  IF v_payment_method IS NULL OR v_payment_method NOT IN ('pix', 'money', 'card') THEN
    RAISE EXCEPTION 'Forma de pagamento inválida';
  END IF;

  SELECT fee
  INTO v_delivery_fee
  FROM public.delivery_fees
  WHERE store_id = v_store_id
    AND neighborhood = v_neighborhood
    AND status = 'active'
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Bairro não atende esta loja';
  END IF;

  v_items := _payload->'items';
  IF jsonb_typeof(v_items) IS DISTINCT FROM 'array'
     OR jsonb_array_length(v_items) < 1
     OR jsonb_array_length(v_items) > 100 THEN
    RAISE EXCEPTION 'Pedido precisa ter entre 1 e 100 itens';
  END IF;

  -- Validação completa: preço canônico + adicionais estritos
  FOR v_item_record IN SELECT value FROM jsonb_array_elements(v_items) AS value LOOP
    IF jsonb_typeof(v_item_record.value) IS DISTINCT FROM 'object'
       OR COALESCE(v_item_record.value->>'product_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      RAISE EXCEPTION 'Produto inválido';
    END IF;
    v_product_id := (v_item_record.value->>'product_id')::uuid;

    IF COALESCE(v_item_record.value->>'quantity', '') !~ '^[0-9]+$' THEN
      RAISE EXCEPTION 'Quantidade inválida';
    END IF;
    v_quantity := (v_item_record.value->>'quantity')::integer;
    IF v_quantity < 1 OR v_quantity > 100 THEN
      RAISE EXCEPTION 'Quantidade do produto fora do limite';
    END IF;

    SELECT p.name, p.store_id, p.is_available, private.effective_product_price(p.id)
    INTO v_product_name, v_product_store_id, v_product_available, v_base_price
    FROM public.products p
    WHERE p.id = v_product_id;

    IF NOT FOUND OR v_product_store_id <> v_store_id OR COALESCE(v_product_available, false) = false OR v_base_price IS NULL THEN
      RAISE EXCEPTION 'Produto não disponível para este pedido';
    END IF;

    v_selected_addons := COALESCE(v_item_record.value->'selected_addons', '[]'::jsonb);
    IF jsonb_typeof(v_selected_addons) IS DISTINCT FROM 'array' THEN
      RAISE EXCEPTION 'Adicionais inválidos';
    END IF;

    v_canonical_addons := '[]'::jsonb;
    v_addons_total := 0;
    v_addon_ids := ARRAY[]::text[];

    FOR v_addon_record IN SELECT value FROM jsonb_array_elements(v_selected_addons) AS value LOOP
      IF jsonb_typeof(v_addon_record.value) IS DISTINCT FROM 'object'
         OR COALESCE(v_addon_record.value->>'id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
        RAISE EXCEPTION 'Adicional inválido';
      END IF;

      v_addon_id_text := v_addon_record.value->>'id';
      IF v_addon_id_text = ANY(v_addon_ids) THEN
        RAISE EXCEPTION 'Adicional repetido';
      END IF;
      v_addon_ids := array_append(v_addon_ids, v_addon_id_text);
      v_addon_id := v_addon_id_text::uuid;

      SELECT a.name, a.price, a.group_id
      INTO v_addon_name, v_addon_price, v_addon_group_id
      FROM public.addons a
      JOIN public.addon_groups ag
        ON ag.id = a.group_id
       AND ag.store_id = v_store_id
       AND ag.status = 'active'
      WHERE a.id = v_addon_id
        AND a.store_id = v_store_id
        AND a.status = 'active'
        AND EXISTS (
          SELECT 1
          FROM public.product_addon_groups pag
          WHERE pag.product_id = v_product_id
            AND pag.group_id = a.group_id
            AND pag.store_id = v_store_id
        );

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Adicional não pertence ao produto';
      END IF;

      v_addons_total := v_addons_total + v_addon_price;
      v_canonical_addons := v_canonical_addons || jsonb_build_array(
        jsonb_build_object('id', v_addon_id, 'name', v_addon_name, 'price', v_addon_price)
      );
    END LOOP;

    FOR v_group IN
      SELECT ag.id, ag.min_quantity, ag.max_quantity, ag.is_required
      FROM public.product_addon_groups pag
      JOIN public.addon_groups ag
        ON ag.id = pag.group_id
       AND ag.store_id = v_store_id
       AND ag.status = 'active'
      WHERE pag.product_id = v_product_id
        AND pag.store_id = v_store_id
    LOOP
      SELECT count(*)
      INTO v_group_count
      FROM jsonb_array_elements(v_selected_addons) selected
      JOIN public.addons a ON a.id = (selected->>'id')::uuid
      WHERE a.group_id = v_group.id;

      IF v_group_count > v_group.max_quantity THEN
        RAISE EXCEPTION 'Quantidade de adicionais inválida';
      END IF;
      IF v_group.is_required AND v_group_count < v_group.min_quantity THEN
        RAISE EXCEPTION 'Adicional obrigatório não selecionado';
      END IF;
    END LOOP;

    v_subtotal := v_subtotal + ((v_base_price + v_addons_total) * v_quantity);

    v_validated_items := v_validated_items || jsonb_build_array(
      jsonb_build_object(
        'product_id', v_product_id,
        'product_name', v_product_name,
        'quantity', v_quantity,
        'price_at_time', v_base_price + v_addons_total,
        'observation', NULLIF(trim(v_item_record.value->>'observation'), ''),
        'selected_addons', v_canonical_addons
      )
    );
  END LOOP;

  v_total := v_subtotal + v_delivery_fee;

  IF v_payment_method = 'money' AND v_change_for IS NOT NULL THEN
    IF v_change_for < v_total THEN
      RAISE EXCEPTION 'O valor para troco (R$ %) não pode ser menor que o total do pedido (R$ %)', v_change_for, v_total;
    END IF;
  END IF;

  INSERT INTO public.orders (
    id, store_id, customer_name, customer_phone, address,
    neighborhood, street, number, complement, reference,
    total_amount, delivery_fee, status, payment_method, observation, change_for
  ) VALUES (
    v_order_id, v_store_id, v_customer_name, v_customer_phone, v_address,
    v_neighborhood, v_street, v_number, v_complement, v_reference,
    v_total, v_delivery_fee, 'pending', v_payment_method, v_observation, v_change_for
  );

  -- Grava itens a partir dos dados JÁ validados (sem reconsulta / TOCTOU)
  FOR v_item_validated IN SELECT value FROM jsonb_array_elements(v_validated_items) AS value LOOP
    INSERT INTO public.order_items (
      order_id, store_id, product_id, product_name, quantity,
      price_at_time, observation, selected_addons
    ) VALUES (
      v_order_id,
      v_store_id,
      (v_item_validated.value->>'product_id')::uuid,
      v_item_validated.value->>'product_name',
      (v_item_validated.value->>'quantity')::integer,
      (v_item_validated.value->>'price_at_time')::numeric,
      v_item_validated.value->>'observation',
      v_item_validated.value->'selected_addons'
    );
  END LOOP;

  SELECT jsonb_build_object(
    'id', o.id,
    'store_id', o.store_id,
    'customer_name', o.customer_name,
    'customer_phone', o.customer_phone,
    'address', o.address,
    'total_amount', o.total_amount,
    'delivery_fee', o.delivery_fee,
    'status', o.status,
    'payment_method', o.payment_method,
    'change_for', o.change_for,
    'observation', o.observation,
    'created_at', o.created_at,
    'order_items', (
      SELECT jsonb_agg(jsonb_build_object(
        'id', oi.id,
        'order_id', oi.order_id,
        'store_id', oi.store_id,
        'product_id', oi.product_id,
        'product_name', oi.product_name,
        'quantity', oi.quantity,
        'price_at_time', oi.price_at_time,
        'observation', oi.observation,
        'selected_addons', oi.selected_addons
      ))
      FROM public.order_items oi
      WHERE oi.order_id = o.id
    )
  )
  INTO v_result
  FROM public.orders o
  WHERE o.id = v_order_id;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.create_order(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_order(jsonb) TO anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 2. record_billing_manual_event: guarda de regressão de status
-- ----------------------------------------------------------------------------
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
  v_current_status text;
BEGIN
  IF NOT private.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Acesso restrito ao administrador do sistema.';
  END IF;
  IF _status NOT IN ('pending', 'confirmed', 'received', 'overdue', 'refunded', 'canceled', 'failed')
     OR length(trim(COALESCE(_reason, ''))) < 5 THEN
    RAISE EXCEPTION 'Evento financeiro inválido.';
  END IF;
  SELECT store_id, status INTO v_store_id, v_current_status
  FROM public.billing_invoices WHERE id = _invoice_id;
  IF v_store_id IS NULL THEN RAISE EXCEPTION 'Fatura não encontrada.'; END IF;

  -- Eventos atrasados/errados não podem regredir uma cobrança já recebida ou estornada.
  IF v_current_status IN ('received', 'refunded')
     AND _status IN ('pending', 'confirmed', 'overdue', 'failed', 'canceled') THEN
    RAISE EXCEPTION 'Não é possível regredir uma fatura já recebida ou estornada.';
  END IF;

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

REVOKE ALL ON FUNCTION public.record_billing_manual_event(uuid, text, text, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_billing_manual_event(uuid, text, text, timestamptz) TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 3. profiles: remove policy de INSERT órfã e grant residual
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Anyone can create their profile during signup" ON public.profiles;
REVOKE INSERT ON public.profiles FROM authenticated;

-- ----------------------------------------------------------------------------
-- 4. Funções privadas: revoga execução anônima
-- ----------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION private.has_permission(uuid, text) FROM anon;
