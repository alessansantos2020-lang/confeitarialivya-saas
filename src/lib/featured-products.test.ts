import { describe, expect, it } from "vitest";
import { getCatalogPricing } from "./promotions";
import { getEligibleFeaturedProducts } from "./featured-products";

const now = new Date("2026-09-21T12:00:00.000Z");

const product = (
  overrides: Partial<{
    id: string;
    name: string;
    is_featured: boolean | null;
    is_available: boolean | null;
    featured_sort_order: number;
    featured_start_at: string | null;
    featured_end_at: string | null;
  }> = {},
) => ({
  id: "product-1",
  name: "Produto",
  is_featured: true,
  is_available: true,
  featured_sort_order: 0,
  featured_start_at: null,
  featured_end_at: null,
  ...overrides,
});

describe("featured products", () => {
  it("filters inactive, unavailable, scheduled, and expired products", () => {
    expect(
      getEligibleFeaturedProducts(
        [
          product(),
          product({ id: "inactive", is_featured: false }),
          product({ id: "unavailable", is_available: false }),
          product({ id: "scheduled", featured_start_at: "2026-09-22T00:00:00.000Z" }),
          product({ id: "expired", featured_end_at: "2026-09-21T11:59:59.999Z" }),
        ],
        now,
      ).map(({ id }) => id),
    ).toEqual(["product-1"]);
  });

  it("includes the exact start and excludes the exact end", () => {
    expect(
      getEligibleFeaturedProducts(
        [
          product({ id: "start", featured_start_at: now.toISOString() }),
          product({ id: "end", featured_end_at: now.toISOString() }),
        ],
        now,
      ).map(({ id }) => id),
    ).toEqual(["start"]);
  });

  it("sorts by configured position, then name and id", () => {
    expect(
      getEligibleFeaturedProducts(
        [
          product({ id: "b", name: "B", featured_sort_order: 1 }),
          product({ id: "z", name: "Z", featured_sort_order: 0 }),
          product({ id: "a", name: "A", featured_sort_order: 1 }),
        ],
        now,
      ).map(({ id }) => id),
    ).toEqual(["z", "a", "b"]);
  });

  it("keeps display scheduling separate from the authoritative catalog price", () => {
    expect(
      getEligibleFeaturedProducts(
        [product({ featured_start_at: "2026-09-20T00:00:00.000Z" })],
        now,
      ),
    ).toHaveLength(1);
    expect(getCatalogPricing({ price: 100, effective_price: 75 })).toEqual({
      price: 75,
      fullPrice: 100,
      onSale: true,
      discountPercent: 25,
    });
  });
});
