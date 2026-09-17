-- ============================================================================
-- Gateways de Pagamento da Loja (Mercado Pago e Asaas) e Suporte a Troco
-- ============================================================================
-- Permite que cada estabelecimento configure suas credenciais de recebimento
-- (Mercado Pago e Asaas) para Pix e Cartão de Crédito.
-- Adiciona suporte a troco para pagamentos em dinheiro no checkout de pedidos.
-- ============================================================================

-- 1. Tabela de gateways e preferências da loja
CREATE TABLE IF NOT EXISTS public.store_payment_gateways (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL UNIQUE REFERENCES public.stores(id) ON DELETE CASCADE,

  -- Pagamento na Entrega (Offline)
  accept_cash boolean NOT NULL DEFAULT true,
  accept_card_delivery boolean NOT NULL DEFAULT true,
  accept_manual_pix boolean NOT NULL DEFAULT true,
  manual_pix_key text,
  manual_pix_key_type text,

  -- Mercado Pago
  mp_enabled boolean NOT NULL DEFAULT false,
  mp_public_key text,
  mp_access_token text,
  mp_sandbox boolean NOT NULL DEFAULT true,

  -- Asaas
  asaas_enabled boolean NOT NULL DEFAULT false,
  asaas_api_key text,
  asaas_sandbox boolean NOT NULL DEFAULT true,

  -- Roteamento de cobrança online
  pix_provider text NOT NULL DEFAULT 'manual'
    CHECK (pix_provider IN ('manual', 'mercadopago', 'asaas', 'disabled')),
  card_provider text NOT NULL DEFAULT 'delivery'
    CHECK (card_provider IN ('delivery', 'mercadopago', 'asaas', 'disabled')),

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_store_payment_gateways_store
  ON public.store_payment_gateways(store_id);

-- RLS: Chaves secretas NUNCA acessíveis por clientes (anon)
ALTER TABLE public.store_payment_gateways ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admins manage store payment gateways" ON public.store_payment_gateways;
CREATE POLICY "Super admins manage store payment gateways" ON public.store_payment_gateways
  FOR ALL TO authenticated
  USING (private.is_super_admin(auth.uid()))
  WITH CHECK (private.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Store admins manage own store payment gateways" ON public.store_payment_gateways;
CREATE POLICY "Store admins manage own store payment gateways" ON public.store_payment_gateways
  FOR ALL TO authenticated
  USING (private.is_store_admin(auth.uid(), store_id))
  WITH CHECK (private.is_store_admin(auth.uid(), store_id));

REVOKE ALL ON public.store_payment_gateways FROM anon;

-- Trigger para updated_at
DROP TRIGGER IF EXISTS store_payment_gateways_updated_at ON public.store_payment_gateways;
CREATE TRIGGER store_payment_gateways_updated_at
  BEFORE UPDATE ON public.store_payment_gateways
  FOR EACH ROW EXECUTE FUNCTION public.touch_billing_updated_at();

-- 2. Função pública para o cliente do catálogo consultar apenas opções seguras (sem tokens/chaves secretas)
CREATE OR REPLACE FUNCTION public.get_public_store_payment_methods(_store_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE
  v_rec record;
BEGIN
  SELECT
    accept_cash,
    accept_card_delivery,
    accept_manual_pix,
    manual_pix_key,
    manual_pix_key_type,
    mp_enabled,
    mp_public_key,
    asaas_enabled,
    pix_provider,
    card_provider
  INTO v_rec
  FROM public.store_payment_gateways
  WHERE store_id = _store_id;

  -- Se a loja ainda não configurou, retorna os padrões de entrega tradicionais
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'accept_cash', true,
      'accept_card_delivery', true,
      'accept_manual_pix', true,
      'manual_pix_key', null,
      'manual_pix_key_type', null,
      'pix_provider', 'manual',
      'card_provider', 'delivery',
      'mp_public_key', null,
      'online_pix_available', false,
      'online_card_available', false
    );
  END IF;

  RETURN jsonb_build_object(
    'accept_cash', COALESCE(v_rec.accept_cash, true),
    'accept_card_delivery', COALESCE(v_rec.accept_card_delivery, true),
    'accept_manual_pix', COALESCE(v_rec.accept_manual_pix, true),
    'manual_pix_key', v_rec.manual_pix_key,
    'manual_pix_key_type', v_rec.manual_pix_key_type,
    'pix_provider', v_rec.pix_provider,
    'card_provider', v_rec.card_provider,
    'mp_public_key', CASE WHEN v_rec.mp_enabled THEN v_rec.mp_public_key ELSE null END,
    'online_pix_available', (
      (v_rec.pix_provider = 'mercadopago' AND v_rec.mp_enabled) OR
      (v_rec.pix_provider = 'asaas' AND v_rec.asaas_enabled)
    ),
    'online_card_available', (
      (v_rec.card_provider = 'mercadopago' AND v_rec.mp_enabled) OR
      (v_rec.card_provider = 'asaas' AND v_rec.asaas_enabled)
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_store_payment_methods(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_store_payment_methods(uuid) TO anon, authenticated, service_role;

-- 3. Extensão da tabela de pedidos para troco e rastreamento de pagamento
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS change_for numeric(10,2),
  ADD COLUMN IF NOT EXISTS payment_mode text NOT NULL DEFAULT 'offline' CHECK (payment_mode IN ('offline', 'online')),
  ADD COLUMN IF NOT EXISTS payment_provider text CHECK (payment_provider IS NULL OR payment_provider IN ('manual', 'mercadopago', 'asaas', 'delivery')),
  ADD COLUMN IF NOT EXISTS payment_gateway_id text,
  ADD COLUMN IF NOT EXISTS payment_gateway_status text DEFAULT 'pending' CHECK (payment_gateway_status IN ('pending', 'approved', 'in_process', 'rejected', 'refunded', 'cancelled')),
  ADD COLUMN IF NOT EXISTS pix_qr_code text,
  ADD COLUMN IF NOT EXISTS pix_copy_paste text;

COMMENT ON COLUMN public.orders.change_for IS
  'Valor informado pelo cliente para o qual ele precisa de troco quando a forma de pagamento for dinheiro.';

-- 4. Atualização da RPC create_order para suportar change_for com validação segura
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
  v_addons_total numeric;
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

  -- Valida os itens e calcula subtotal com preços canônicos do banco
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
    v_addons_total := 0;

    IF jsonb_array_length(v_selected_addons) > 0 THEN
      FOR v_addon_record IN SELECT value FROM jsonb_array_elements(v_selected_addons) AS value LOOP
        v_addon_id_text := v_addon_record.value->>'id';
        IF v_addon_id_text IS NULL OR v_addon_id_text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
          RAISE EXCEPTION 'Adicional inválido';
        END IF;
        v_addon_id := v_addon_id_text::uuid;

        SELECT a.name, a.price
        INTO v_addon_name, v_addon_price
        FROM public.addons a
        WHERE a.id = v_addon_id AND a.store_id = v_store_id AND a.status = 'active';

        IF NOT FOUND THEN
          RAISE EXCEPTION 'Adicional não disponível para este pedido';
        END IF;

        v_addons_total := v_addons_total + v_addon_price;
      END LOOP;
    END IF;

    v_subtotal := v_subtotal + ((v_base_price + v_addons_total) * v_quantity);
  END LOOP;

  v_total := v_subtotal + v_delivery_fee;

  -- Validação de troco
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

  -- Grava itens
  FOR v_item_record IN SELECT value FROM jsonb_array_elements(v_items) AS value LOOP
    v_product_id := (v_item_record.value->>'product_id')::uuid;
    v_quantity := (v_item_record.value->>'quantity')::integer;
    v_base_price := private.effective_product_price(v_product_id);
    v_selected_addons := COALESCE(v_item_record.value->'selected_addons', '[]'::jsonb);
    v_addons_total := 0;
    v_canonical_addons := '[]'::jsonb;

    IF jsonb_array_length(v_selected_addons) > 0 THEN
      FOR v_addon_record IN SELECT value FROM jsonb_array_elements(v_selected_addons) AS value LOOP
        v_addon_id := (v_addon_record.value->>'id')::uuid;
        SELECT a.name, a.price INTO v_addon_name, v_addon_price
        FROM public.addons a WHERE a.id = v_addon_id;
        v_addons_total := v_addons_total + v_addon_price;
        v_canonical_addons := v_canonical_addons || jsonb_build_object('id', v_addon_id, 'name', v_addon_name, 'price', v_addon_price);
      END LOOP;
    END IF;

    INSERT INTO public.order_items (
      order_id, product_id, quantity, price_at_time, observation, selected_addons
    ) VALUES (
      v_order_id, v_product_id, v_quantity, v_base_price + v_addons_total,
      NULLIF(trim(v_item_record.value->>'observation'), ''), v_canonical_addons
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
        'product_id', oi.product_id,
        'product_name', p.name,
        'quantity', oi.quantity,
        'price_at_time', oi.price_at_time,
        'observation', oi.observation,
        'selected_addons', oi.selected_addons
      ))
      FROM public.order_items oi
      JOIN public.products p ON p.id = oi.product_id
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
