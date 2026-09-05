/**
 * Regras de promoção no lado da tela.
 *
 * A verdade sobre o preço cobrado está no banco
 * (`private.effective_product_price`). Isso aqui é só para o painel do dono
 * mostrar em que pé cada promoção está — se está valendo, se ainda vai
 * começar ou se já passou do prazo.
 */

export type PromotionFields = {
  price: number;
  is_on_sale?: boolean | null;
  sale_price?: number | null;
  sale_start_at?: string | null;
  sale_end_at?: string | null;
};

export type PromotionStatus = "none" | "active" | "scheduled" | "expired";

export const getPromotionStatus = (
  product: PromotionFields,
  now: Date = new Date(),
): PromotionStatus => {
  const { is_on_sale, sale_price, price, sale_start_at, sale_end_at } = product;

  if (!is_on_sale || sale_price == null || sale_price <= 0 || sale_price >= price) {
    return "none";
  }
  if (sale_end_at && new Date(sale_end_at) <= now) return "expired";
  if (sale_start_at && new Date(sale_start_at) > now) return "scheduled";
  return "active";
};

export const isPromotionActive = (product: PromotionFields, now?: Date): boolean =>
  getPromotionStatus(product, now) === "active";

/** Desconto em % inteiro. Só faz sentido quando há promoção valendo. */
export const getDiscountPercent = (fullPrice: number, salePrice: number): number => {
  if (!(fullPrice > 0) || !(salePrice > 0) || salePrice >= fullPrice) return 0;
  return Math.round((1 - salePrice / fullPrice) * 100);
};

/**
 * Preço do catálogo. Usa `effective_price`, que vem calculado pelo banco
 * (coluna virtual `public.effective_price`) — ela já considera período da
 * promoção e plano da loja. Se por algum motivo não vier, cai no preço normal,
 * que é sempre o valor mais alto: nunca mostra barato e cobra caro.
 */
export type CatalogProduct = { price: number; effective_price?: number | null };

export const getCatalogPricing = (product: CatalogProduct) => {
  const price = product.effective_price ?? product.price;
  const onSale = price > 0 && price < product.price;
  return {
    price,
    fullPrice: product.price,
    onSale,
    discountPercent: onSale ? getDiscountPercent(product.price, price) : 0,
  };
};
