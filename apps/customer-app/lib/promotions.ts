/**
 * Regras de promoção no lado do app.
 * A verdade sobre o preço cobrado está no banco (`effective_price`, que a RPC
 * `get_public_catalog` já devolve calculado). Aqui é só para saber se a
 * promoção está valendo (Oferta Relâmpago) e o desconto a exibir.
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
export const getDiscountPercent = (fullPrice: number, salePrice: number): number => {
  if (!(fullPrice > 0) || !(salePrice > 0) || salePrice >= fullPrice) return 0;
  return Math.round((1 - salePrice / fullPrice) * 100);
};
