-- ============================================================================
-- PRODUTOS EM PROMOÇÃO
-- ============================================================================
-- 100% aditiva: nenhuma tabela nova, nenhuma tabela apagada, nenhuma coluna
-- existente alterada. A promoção é um estado do próprio produto.
--
-- REGRA CENTRAL: quem decide o preço cobrado é o BANCO, não o navegador.
-- Antes desta migração o preço do item chegava pronto do frontend e a trigger
-- só conferia se não era MENOR que products.price. Isso não serve para
-- promoção (promoção é justamente menor) e nunca serviu como segurança: quem
-- chamasse a API direto podia gravar o preço que quisesse. Agora o banco
-- recalcula e ignora o valor enviado pelo cliente.
--
-- O que NÃO muda de propósito:
--   * Pedidos já gravados: price_at_time nunca é recalculado depois.
--     Só a INSERÇÃO passa pela trigger. Histórico fica congelado.
--   * Preço dos adicionais: promoção do produto não altera adicional.
--   * Carrinho, categorias e telas existentes continuam do mesmo jeito.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. COLUNAS NOVAS EM products
-- ----------------------------------------------------------------------------
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS is_on_sale    boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sale_price    numeric,
  ADD COLUMN IF NOT EXISTS sale_start_at timestamptz,
  ADD COLUMN IF NOT EXISTS sale_end_at   timestamptz;

COMMENT ON COLUMN public.products.is_on_sale IS
  'Promoção ligada pelo dono. Desligar NÃO apaga sale_price.';
COMMENT ON COLUMN public.products.sale_price IS
  'Preço promocional. Continua guardado com a promoção desligada.';
COMMENT ON COLUMN public.products.sale_start_at IS
  'Início da promoção. NULL = vale desde já.';
COMMENT ON COLUMN public.products.sale_end_at IS
  'Fim da promoção. NULL = sem prazo. Passou a data, o preço volta sozinho.';

-- ----------------------------------------------------------------------------
-- 2. VALIDAÇÕES NO BANCO (não só na tela)
-- ----------------------------------------------------------------------------
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_price_positive;
ALTER TABLE public.products ADD CONSTRAINT products_price_positive
  CHECK (price > 0);

ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_sale_price_valid;
ALTER TABLE public.products ADD CONSTRAINT products_sale_price_valid
  CHECK (sale_price IS NULL OR (sale_price > 0 AND sale_price < price));

ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_sale_window_valid;
ALTER TABLE public.products ADD CONSTRAINT products_sale_window_valid
  CHECK (sale_start_at IS NULL OR sale_end_at IS NULL OR sale_end_at > sale_start_at);

ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_sale_needs_price;
ALTER TABLE public.products ADD CONSTRAINT products_sale_needs_price
  CHECK (NOT is_on_sale OR sale_price IS NOT NULL);

-- Índice pensado para a futura seção "Ofertas": consulta os produtos em
-- promoção da loja sem duplicar nada no banco.
CREATE INDEX IF NOT EXISTS idx_products_on_sale
  ON public.products (store_id) WHERE is_on_sale;

-- ----------------------------------------------------------------------------
-- 3. FONTE ÚNICA DE VERDADE: qual é o preço válido agora?
-- ----------------------------------------------------------------------------
-- Promoção só vale se: está ligada, tem preço promocional, já começou, ainda
-- não terminou e a loja tem a funcionalidade no plano. Fora disso devolve o
-- preço normal — por isso promoção vencida volta ao preço cheio sozinha, sem o
-- dono precisar desligar nada, e loja sem a funcionalidade no plano não fica
-- com promoção rodando (nada é apagado: voltando o plano, a promoção volta).
CREATE OR REPLACE FUNCTION private.effective_product_price(_product_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
           WHEN p.is_on_sale
            AND p.sale_price IS NOT NULL
            AND p.sale_price < p.price
            AND (p.sale_start_at IS NULL OR p.sale_start_at <= now())
            AND (p.sale_end_at   IS NULL OR p.sale_end_at   >  now())
            AND private.store_has_feature(p.store_id, 'promotions')
           THEN p.sale_price
           ELSE p.price
         END
  FROM public.products p
  WHERE p.id = _product_id;
$$;

REVOKE ALL ON FUNCTION private.effective_product_price(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.effective_product_price(uuid)
  TO anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 4. O BANCO PASSA A DEFINIR O PREÇO DO ITEM DO PEDIDO
-- ----------------------------------------------------------------------------
-- Substitui a validate_order_item antiga, que exigia price_at_time >= preço
-- normal do produto (impossível com promoção). A regra nova é mais forte: o
-- preço enviado pelo frontend é DESCARTADO e recalculado aqui a partir do
-- produto e dos adicionais lidos do banco.
CREATE OR REPLACE FUNCTION public.validate_order_item()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  base_price   numeric;
  addons_total numeric := 0;
  item_addons  jsonb;
BEGIN
  IF NEW.quantity IS NULL OR NEW.quantity < 1 OR NEW.quantity > 200 THEN
    RAISE EXCEPTION 'Quantidade inválida';
  END IF;

  base_price := private.effective_product_price(NEW.product_id);
  IF base_price IS NULL THEN
    RAISE EXCEPTION 'Produto inexistente';
  END IF;

  -- Adicionais: o preço também vem do banco, não do que o cliente mandou.
  -- Adicional que não existe mais simplesmente não soma (nunca cobra a mais).
  item_addons := COALESCE(NEW.selected_addons, '[]'::jsonb);
  IF jsonb_typeof(item_addons) = 'array' THEN
    SELECT COALESCE(SUM(a.price), 0) INTO addons_total
    FROM jsonb_array_elements(item_addons) AS elem
    JOIN public.addons a
      ON a.id = CASE
                  WHEN elem->>'id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                  THEN (elem->>'id')::uuid
                END;
  END IF;

  NEW.price_at_time := base_price + addons_total;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.validate_order_item() FROM PUBLIC, anon, authenticated;

-- Total do pedido recalculado a partir dos itens já validados + taxa de
-- entrega. Sem isso o item sairia com preço certo e o total continuaria sendo
-- o número que o navegador mandou.
CREATE OR REPLACE FUNCTION public.recalc_order_total()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.orders o
  SET total_amount = COALESCE((
        SELECT SUM(i.price_at_time * i.quantity)
        FROM public.order_items i
        WHERE i.order_id = NEW.order_id
      ), 0) + COALESCE(o.delivery_fee, 0)
  WHERE o.id = NEW.order_id;

  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.recalc_order_total() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS recalc_order_total_trigger ON public.order_items;
CREATE TRIGGER recalc_order_total_trigger
  AFTER INSERT ON public.order_items
  FOR EACH ROW EXECUTE FUNCTION public.recalc_order_total();

-- ----------------------------------------------------------------------------
-- 5. CATÁLOGO PÚBLICO VÊ O MESMO PREÇO QUE O PEDIDO VAI COBRAR
-- ----------------------------------------------------------------------------
-- "Computed column" do PostgREST: função que recebe a própria linha de
-- products vira coluna virtual chamável em select=*,effective_price. Não
-- precisa de RPC nova nem de trocar como a tela hoje busca produtos —
-- só adiciona "effective_price" no select existente.
CREATE OR REPLACE FUNCTION public.effective_price(product public.products)
RETURNS numeric
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT private.effective_product_price(product.id);
$$;

REVOKE ALL ON FUNCTION public.effective_price(public.products) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.effective_price(public.products)
  TO anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 6. BLOQUEIO NO BANCO: só liga promoção quem tem a funcionalidade no plano
-- ----------------------------------------------------------------------------
-- A tela pode escolher esconder os campos de promoção, mas isso por si só não
-- impede uma chamada direta à API. Esta trigger é o bloqueio de verdade.
CREATE OR REPLACE FUNCTION public.check_promotion_feature()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_on_sale AND NOT private.can_use_feature(NEW.store_id, 'promotions') THEN
    RAISE EXCEPTION 'Esta funcionalidade não está disponível no seu plano.';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.check_promotion_feature() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS check_promotion_feature_trigger ON public.products;
CREATE TRIGGER check_promotion_feature_trigger
  BEFORE INSERT OR UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.check_promotion_feature();

-- ----------------------------------------------------------------------------
-- 7. A FUNCIONALIDADE NO CATÁLOGO DE PLANOS
-- ----------------------------------------------------------------------------
-- Entra no mesmo sistema que já existe (features / plan_features). Não-core:
-- é um extra, então pode ser cortada por plano.
INSERT INTO public.features (id, name, description, module, is_core, sort_order) VALUES
  ('promotions', 'Promoções de Produtos',
   'Preço promocional com período e destaque no catálogo', 'admin', false, 35)
ON CONFLICT (id) DO NOTHING;

-- Planos que já liberavam tudo continuam liberando tudo.
INSERT INTO public.plan_features (plan_id, feature_id)
SELECT p.id, 'promotions'
FROM public.plans p
WHERE p.slug IN ('profissional', 'premium')
ON CONFLICT DO NOTHING;
