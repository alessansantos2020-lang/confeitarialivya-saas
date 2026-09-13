import { afterEach, describe, expect, it } from "vitest";
import { useCart } from "./cart.store";
import { getDiscountPercent, getPromotionStatus, getCatalogPricing } from "./promotions";
import { formatCurrencyBRL, normalizePhone } from "./formatters";
import {
  cartItemIdentityKey,
  orderItemsSummary,
  parseSelectedAddons,
  sortAddons,
} from "./order-utils";
import { canCancel, nextStatus, operationalTabFor, previousStatus } from "./order-status";

const sampleItem = {
  product_id: "product-1",
  name: "Bolo",
  price: 25,
  quantity: 1,
  image_url: null,
  addons: [],
};

afterEach(() => {
  useCart.setState({
    items: [],
    deliveryFee: 0,
    selectedNeighborhood: null,
    storeId: null,
    cartsByStore: {},
  });
});

describe("promotion rules", () => {
  const now = new Date("2026-09-12T12:00:00.000Z");

  it("classifies active, scheduled, expired, and invalid promotions", () => {
    expect(getPromotionStatus({ price: 100, is_on_sale: true, sale_price: 80 }, now)).toBe(
      "active",
    );
    expect(
      getPromotionStatus(
        { price: 100, is_on_sale: true, sale_price: 80, sale_start_at: "2026-09-13T00:00:00Z" },
        now,
      ),
    ).toBe("scheduled");
    expect(
      getPromotionStatus(
        { price: 100, is_on_sale: true, sale_price: 80, sale_end_at: "2026-09-12T11:59:59Z" },
        now,
      ),
    ).toBe("expired");
    expect(getPromotionStatus({ price: 100, is_on_sale: true, sale_price: 100 }, now)).toBe("none");
  });

  it("calculates discount and catalog fallback pricing", () => {
    expect(getDiscountPercent(100, 75)).toBe(25);
    expect(getDiscountPercent(0, 10)).toBe(0);
    expect(getCatalogPricing({ price: 100, effective_price: null })).toEqual({
      price: 100,
      fullPrice: 100,
      onSale: false,
      discountPercent: 0,
    });
  });
});

describe("order status rules", () => {
  it("keeps operational transitions and cancellation rules", () => {
    expect(nextStatus("pending")).toBe("confirmed");
    expect(nextStatus("out_for_delivery")).toBe("delivered");
    expect(previousStatus("canceled")).toBe("pending");
    expect(canCancel("preparing")).toBe(true);
    expect(canCancel("out_for_delivery")).toBe(false);
    expect(operationalTabFor("ready")).toBe("ready");
    expect(operationalTabFor("delivered")).toBeNull();
  });
});

describe("shared formatting and order utilities", () => {
  it("formats Brazilian currency and normalizes phone numbers", () => {
    expect(formatCurrencyBRL(1234.5)).toBe("R$ 1.234,50");
    expect(formatCurrencyBRL(null)).toBe("R$ 0,00");
    expect(normalizePhone("(11) 99888-7766")).toBe("11998887766");
    expect(normalizePhone(null)).toBe("");
  });

  it("parses JSON and array addon snapshots while ignoring malformed values", () => {
    expect(parseSelectedAddons('[{"id":"a1","name":"Granulado","price":2}]')).toEqual([
      { id: "a1", name: "Granulado", price: 2 },
    ]);
    expect(parseSelectedAddons([{ id: "a2", name: "Morango" }])).toEqual([
      { id: "a2", name: "Morango" },
    ]);
    expect(parseSelectedAddons("not-json")).toEqual([]);
    expect(parseSelectedAddons([{ name: "Sem ID" }])).toEqual([{ name: "Sem ID" }]);
  });

  it("creates stable cart identities independent of addon order", () => {
    const first = cartItemIdentityKey("product-1", [{ id: "b" }, { id: "a" }], "");
    const second = cartItemIdentityKey("product-1", [{ id: "a" }, { id: "b" }]);
    expect(first).toBe(second);
    expect(sortAddons([{ id: "b" }, { id: "a" }]).map((addon) => addon.id)).toEqual(["a", "b"]);
  });

  it("builds item summaries with product and addon fallbacks", () => {
    expect(
      orderItemsSummary([
        {
          quantity: 2,
          product_name: null,
          product: { name: "Bolo" },
          selected_addons: [{ id: "a", name: "Morango" }],
        },
        { quantity: 1, product_name: "Suco", product: null },
      ]),
    ).toBe("2x Bolo (Morango)\n1x Suco");
  });

  it("keeps carts isolated when switching stores", () => {
    const cart = useCart.getState();
    cart.setStoreContext("store-a");
    cart.addItem(sampleItem);
    cart.setDeliveryFee(8, "Centro");

    cart.setStoreContext("store-b");
    expect(useCart.getState().items).toEqual([]);
    expect(useCart.getState().deliveryFee).toBe(0);

    cart.addItem({ ...sampleItem, product_id: "product-b" });
    cart.setStoreContext("store-a");
    expect(useCart.getState().items).toHaveLength(1);
    expect(useCart.getState().items[0]?.product_id).toBe("product-1");
    expect(useCart.getState().deliveryFee).toBe(8);

    useCart.getState().clearCart();
    useCart.getState().setStoreContext("store-b");
    expect(useCart.getState().items[0]?.product_id).toBe("product-b");
  });
});
