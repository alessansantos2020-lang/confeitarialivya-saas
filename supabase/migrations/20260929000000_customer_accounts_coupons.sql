-- ============================================================================
-- CONTAS DE CLIENTE + CUPONS (Perfil do cliente na vitrine)
-- ----------------------------------------------------------------------------
-- 1. customer_accounts: marcação/profiling de contas cliente, separada de staff.
-- 2. customer_orders: vínculo pedido ↔ cliente autenticado (ownership).
-- 3. customer_addresses: endereços salvos do cliente (RLS próprio).
-- 4. coupons + coupon_redemptions: cupons da loja com resgate atômico.
-- 5. create_order atualizado: vincula auth.uid() e aplica cupom no servidor.
-- 6. RPCs do cliente: aplicar/validar cupom, listar meus cupons.
-- NÃO altera checkout de visitante (continua funcionando sem login).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. VÍNCULO PEDIDO ↔ CLIENTE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.customer_orders (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, order_id)
);

ALTER TABLE public.customer_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customer reads own order links"
ON public.customer_orders FOR SELECT
USING (auth.uid() = user_id);

-- Não há INSERT direto: create_order cria o vínculo em SECURITY DEFINER.
-- Isso impede que um cliente vincule arbitrariamente pedidos de terceiros.
GRANT SELECT ON public.customer_orders TO authenticated;
REVOKE ALL ON public.customer_orders FROM anon;

-- Clientes só leem pedidos e itens com vínculo explícito do próprio auth.uid().
CREATE POLICY "Customers read own orders"
ON public.orders FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.customer_orders co
    WHERE co.order_id = orders.id AND co.user_id = auth.uid()
  )
);

CREATE POLICY "Customers read own order items"
ON public.order_items FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.customer_orders co
    WHERE co.order_id = order_items.order_id AND co.user_id = auth.uid()
  )
);

GRANT SELECT ON public.orders, public.order_items TO authenticated;

-- ----------------------------------------------------------------------------
-- 2. ENDEREÇOS SALVOS DO CLIENTE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.customer_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  label text,
  neighborhood text NOT NULL,
  street text NOT NULL,
  number text NOT NULL,
  complement text,
  reference text,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS customer_addresses_user_idx
ON public.customer_addresses (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS customer_addresses_one_default_per_user_idx
ON public.customer_addresses (user_id) WHERE is_default = true;

ALTER TABLE public.customer_addresses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customer manages own addresses"
ON public.customer_addresses FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_addresses TO authenticated;
REVOKE ALL ON public.customer_addresses FROM anon;

-- ----------------------------------------------------------------------------
-- 3. CUPONS DA LOJA
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  code text NOT NULL,
  description text,
  discount_type text NOT NULL DEFAULT 'percent' CHECK (discount_type IN ('percent', 'fixed')),
  discount_value numeric NOT NULL CHECK (discount_value > 0),
  min_order_amount numeric NOT NULL DEFAULT 0 CHECK (min_order_amount >= 0),
  max_redemptions integer CHECK (max_redemptions IS NULL OR max_redemptions > 0),
  max_redemptions_per_user integer NOT NULL DEFAULT 1 CHECK (max_redemptions_per_user > 0),
  starts_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, code)
);

CREATE INDEX IF NOT EXISTS coupons_store_active_idx
ON public.coupons (store_id, is_active);

ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

-- Leitura pública APENAS de cupons ativos da loja (a vitrine precisa listar).
CREATE POLICY "Public reads active store coupons"
ON public.coupons FOR SELECT
USING (
  is_active = true
  AND (expires_at IS NULL OR expires_at > now())
  AND (starts_at IS NULL OR starts_at <= now())
);

-- Gestão segue o mesmo padrão das outras telas admin: admin da loja + plano.
CREATE POLICY "Store admins manage coupons"
ON public.coupons FOR ALL
USING (
  private.is_store_admin(auth.uid(), store_id)
  AND private.can_use_feature(store_id, 'promotions')
)
WITH CHECK (
  private.is_store_admin(auth.uid(), store_id)
  AND private.can_use_feature(store_id, 'promotions')
);

GRANT SELECT ON public.coupons TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.coupons TO authenticated;

CREATE TABLE IF NOT EXISTS public.coupon_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id uuid NOT NULL REFERENCES public.coupons(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  discount_amount numeric NOT NULL CHECK (discount_amount >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (coupon_id, order_id)
);

CREATE INDEX IF NOT EXISTS coupon_redemptions_user_idx
ON public.coupon_redemptions (user_id, store_id);
CREATE INDEX IF NOT EXISTS coupon_redemptions_coupon_idx
ON public.coupon_redemptions (coupon_id);

ALTER TABLE public.coupon_redemptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customer reads own redemptions"
ON public.coupon_redemptions FOR SELECT
USING (auth.uid() = user_id);

-- Inserção acontece apenas dentro do RPC SECURITY DEFINER (resgate atômico).
REVOKE ALL ON public.coupon_redemptions FROM anon, authenticated;

-- ----------------------------------------------------------------------------
-- 4. CREATE_ORDER: vincula cliente autenticado + aplica cupom no servidor
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
  -- Novos: cliente logado + cupom
  v_user_id uuid := auth.uid();
  v_coupon_code text;
  v_coupon record;
  v_coupon_discount numeric := 0;
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
  v_coupon_code := UPPER(NULLIF(trim(_payload->>'coupon_code'), ''));
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

  -- Cupom: validado no SERVIDOR, com subtotal já canônico (sem confiar no client)
  IF v_coupon_code IS NOT NULL THEN
    IF v_user_id IS NULL THEN
      RAISE EXCEPTION 'Entre na sua conta para usar cupons';
    END IF;

    SELECT * INTO v_coupon
    FROM public.coupons
    WHERE store_id = v_store_id
      AND code = v_coupon_code
      AND is_active = true
      AND (starts_at IS NULL OR starts_at <= now())
      AND (expires_at IS NULL OR expires_at > now())
      AND (max_redemptions IS NULL
           OR (SELECT count(*) FROM public.coupon_redemptions cr
               WHERE cr.coupon_id = coupons.id) < max_redemptions)
    LIMIT 1;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Cupom inválido ou expirado';
    END IF;

    IF v_subtotal < v_coupon.min_order_amount THEN
      RAISE EXCEPTION 'Pedido mínimo de R$ % para este cupom', v_coupon.min_order_amount;
    END IF;

    SELECT count(*) INTO v_group_count
    FROM public.coupon_redemptions
    WHERE coupon_id = v_coupon.id AND user_id = v_user_id;

    IF v_group_count >= v_coupon.max_redemptions_per_user THEN
      RAISE EXCEPTION 'Você já utilizou este cupom';
    END IF;

    v_coupon_discount := CASE
      WHEN v_coupon.discount_type = 'percent'
        THEN round(v_subtotal * v_coupon.discount_value / 100.0, 2)
      ELSE LEAST(v_coupon.discount_value, v_subtotal)
    END;
    IF v_coupon_discount <= 0 THEN
      v_coupon_discount := 0;
    END IF;
  END IF;

  v_total := GREATEST(v_subtotal + v_delivery_fee - v_coupon_discount, 0);

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

  -- Vincula o pedido ao cliente autenticado (quando logado)
  IF v_user_id IS NOT NULL THEN
    INSERT INTO public.customer_orders (user_id, order_id, store_id)
    VALUES (v_user_id, v_order_id, v_store_id);
  END IF;

  -- Registra o resgate do cupom (atômico com o pedido)
  IF v_coupon IS NOT NULL AND v_coupon_discount > 0 THEN
    INSERT INTO public.coupon_redemptions (
      coupon_id, order_id, user_id, store_id, discount_amount
    ) VALUES (v_coupon.id, v_order_id, v_user_id, v_store_id, v_coupon_discount);
  END IF;

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
    'coupon_code', CASE WHEN v_coupon IS NOT NULL AND v_coupon_discount > 0 THEN v_coupon.code ELSE NULL END,
    'coupon_discount', v_coupon_discount,
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
-- 5. RPCs DE CUPOM PARA A VITRINE
-- ----------------------------------------------------------------------------

-- Valida um cupom SEM consumir uso (para preview do desconto no checkout).
CREATE OR REPLACE FUNCTION public.validate_coupon(
  _store_id uuid,
  _code text,
  _subtotal numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_code text := UPPER(NULLIF(trim(_code), ''));
  v_coupon public.coupons%ROWTYPE;
  v_user_id uuid := auth.uid();
  v_discount numeric;
  v_user_uses integer := 0;
BEGIN
  IF v_code IS NULL THEN
    RAISE EXCEPTION 'Informe o código do cupom';
  END IF;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Entre na sua conta para usar cupons';
  END IF;
  IF _subtotal IS NULL OR _subtotal < 0 THEN
    RAISE EXCEPTION 'Subtotal inválido';
  END IF;

  SELECT * INTO v_coupon
  FROM public.coupons
  WHERE store_id = _store_id
    AND code = v_code
    AND is_active = true
    AND (starts_at IS NULL OR starts_at <= now())
    AND (expires_at IS NULL OR expires_at > now())
    AND (max_redemptions IS NULL
         OR (SELECT count(*) FROM public.coupon_redemptions cr
             WHERE cr.coupon_id = coupons.id) < max_redemptions)
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cupom inválido ou expirado';
  END IF;

  IF _subtotal < v_coupon.min_order_amount THEN
    RAISE EXCEPTION 'Pedido mínimo de R$ % para este cupom', v_coupon.min_order_amount;
  END IF;

  SELECT count(*) INTO v_user_uses
  FROM public.coupon_redemptions
  WHERE coupon_id = v_coupon.id AND user_id = v_user_id;

  IF v_user_uses >= v_coupon.max_redemptions_per_user THEN
    RAISE EXCEPTION 'Você já utilizou este cupom';
  END IF;

  v_discount := CASE
    WHEN v_coupon.discount_type = 'percent'
      THEN round(_subtotal * v_coupon.discount_value / 100.0, 2)
    ELSE LEAST(v_coupon.discount_value, _subtotal)
  END;

  RETURN jsonb_build_object(
    'code', v_coupon.code,
    'description', v_coupon.description,
    'discount_type', v_coupon.discount_type,
    'discount_value', v_coupon.discount_value,
    'discount_amount', GREATEST(v_discount, 0),
    'min_order_amount', v_coupon.min_order_amount
  );
END;
$$;

REVOKE ALL ON FUNCTION public.validate_coupon(uuid, text, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_coupon(uuid, text, numeric) TO authenticated;

-- Cupons já usados pelo próprio cliente (para "Utilizados" no Perfil).
CREATE OR REPLACE FUNCTION public.get_my_coupons(_store_id uuid)
RETURNS TABLE (
  coupon_id uuid,
  code text,
  description text,
  discount_type text,
  discount_value numeric,
  min_order_amount numeric,
  expires_at timestamptz,
  times_used bigint,
  last_used_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT c.id, c.code, c.description, c.discount_type, c.discount_value,
         c.min_order_amount, c.expires_at,
         count(cr.id) AS times_used,
         max(cr.created_at) AS last_used_at
  FROM public.coupons c
  LEFT JOIN public.coupon_redemptions cr
    ON cr.coupon_id = c.id AND cr.user_id = auth.uid()
  WHERE c.store_id = _store_id
    AND c.is_active = true
  GROUP BY c.id
  HAVING (
    -- mostra só cupons que o cliente já usou ou que expiraram para ele
    count(cr.id) > 0
    OR (c.expires_at IS NOT NULL AND c.expires_at <= now())
    OR (c.max_redemptions_per_user IS NOT NULL
        AND count(cr.id) >= c.max_redemptions_per_user)
  );
$$;

REVOKE ALL ON FUNCTION public.get_my_coupons(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_coupons(uuid) TO authenticated;

-- ----------------------------------------------------------------------------
-- 6. GATE DE PLANO PARA CRIAR/ATIVAR CUPONS
-- ----------------------------------------------------------------------------
-- Mesma proteção das promoções: a tela pode esconder, mas o banco decide.
CREATE OR REPLACE FUNCTION public.check_coupon_feature()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT private.can_use_feature(NEW.store_id, 'promotions') THEN
    RAISE EXCEPTION 'Esta funcionalidade não está disponível no seu plano.';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.check_coupon_feature() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS check_coupon_feature_trigger ON public.coupons;
CREATE TRIGGER check_coupon_feature_trigger
  BEFORE INSERT OR UPDATE ON public.coupons
  FOR EACH ROW EXECUTE FUNCTION public.check_coupon_feature();
