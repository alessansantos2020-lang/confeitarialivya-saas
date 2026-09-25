export type FeaturedProductFields = {
  id: string;
  name: string;
  is_featured?: boolean | null;
  is_available: boolean | null;
  featured_sort_order: number;
  featured_start_at: string | null;
  featured_end_at: string | null;
};

export const isFeaturedProductEligible = (
  product: FeaturedProductFields,
  now: Date = new Date(),
): boolean => {
  if (!product.is_featured || product.is_available !== true) return false;

  const startsAt = product.featured_start_at ? new Date(product.featured_start_at) : null;
  const endsAt = product.featured_end_at ? new Date(product.featured_end_at) : null;

  if (startsAt && (!Number.isFinite(startsAt.getTime()) || startsAt > now)) return false;
  if (endsAt && (!Number.isFinite(endsAt.getTime()) || endsAt <= now)) return false;
  return true;
};

export const getEligibleFeaturedProducts = <T extends FeaturedProductFields>(
  products: readonly T[],
  now: Date = new Date(),
): T[] =>
  products
    .filter((product) => isFeaturedProductEligible(product, now))
    .sort(
      (first, second) =>
        first.featured_sort_order - second.featured_sort_order ||
        first.name.localeCompare(second.name) ||
        first.id.localeCompare(second.id),
    );
