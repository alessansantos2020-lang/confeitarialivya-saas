import { getPromotionStatus, type PromotionFields } from "./promotions";

/**
 * ⚡ Oferta Relâmpago — regras do lado do app (React Native).
 * Mesmas regras da web (src/lib/flash-offer.ts):
 *  - só produtos com promoção ATIVA;
 *  - vence a que termina primeiro;
 *  - descarte vale pela sessão (memória) e por oferta (chave inclui o início).
 */
export type FlashOfferProduct = PromotionFields & {
  id: string;
  name: string;
  description?: string | null;
  image_url?: string | null;
  flash_headline?: string | null;
  flash_message?: string | null;
};

export const pickFlashOffer = <T extends FlashOfferProduct>(
  products: readonly T[] | undefined,
  now: Date = new Date(),
): T | null => {
  if (!products?.length) return null;
  const active = products.filter((product) => getPromotionStatus(product, now) === "active");
  if (!active.length) return null;
  return active.reduce((soonest, product) => {
    const soonestEnd = soonest.sale_end_at ? new Date(soonest.sale_end_at).getTime() : Infinity;
    const productEnd = product.sale_end_at ? new Date(product.sale_end_at).getTime() : Infinity;
    return productEnd < soonestEnd ? product : soonest;
  });
};

export const getFlashCountdown = (
  endAt: string | null | undefined,
  now: Date = new Date(),
): string => {
  if (!endAt) return "00:00:00";
  const end = new Date(endAt).getTime();
  if (!Number.isFinite(end)) return "00:00:00";
  const remaining = end - now.getTime();
  if (remaining <= 0) return "00:00:00";
  const totalSeconds = Math.floor(remaining / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((part) => String(part).padStart(2, "0")).join(":");
};

export const flashDismissKey = (productId: string, startAt?: string | null): string =>
  `flash-offer:${productId}:${startAt ?? "immediate"}`;

const dismissedInSession = new Set<string>();

export const wasFlashDismissed = (productId: string, startAt?: string | null): boolean =>
  dismissedInSession.has(flashDismissKey(productId, startAt));

export const dismissFlashOffer = (productId: string, startAt?: string | null): void => {
  dismissedInSession.add(flashDismissKey(productId, startAt));
};
