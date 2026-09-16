import { describe, expect, it } from "vitest";
import {
  isBillingPaymentMethod,
  isPaymentReceived,
  paymentMethodLabel,
  summarizeBilling,
} from "./super-admin-billing";

describe("summarizeBilling", () => {
  it("separates contracted, received, pending, and overdue amounts", () => {
    expect(
      summarizeBilling(
        [
          { status: "active", amount_cents: 4990 },
          { status: "past_due", amount_cents: 9990 },
          { status: "canceled", amount_cents: 19990 },
        ],
        [
          { status: "received", amount_cents: 4990 },
          { status: "confirmed", amount_cents: 1000 },
          { status: "pending", amount_cents: 9990 },
          { status: "overdue", amount_cents: 3000 },
          { status: "refunded", amount_cents: 1000 },
        ],
      ),
    ).toEqual({
      contractedCents: 14980,
      receivedCents: 5990,
      pendingCents: 9990,
      overdueCents: 3000,
      activeCompanies: 1,
      subscriptions: 3,
    });
  });

  it("does not claim receipt from a pending subscription", () => {
    expect(
      summarizeBilling(
        [{ status: "pending", amount_cents: 4990 }],
        [{ status: "pending", amount_cents: 4990 }],
      ),
    ).toMatchObject({ contractedCents: 0, receivedCents: 0, pendingCents: 4990 });
  });

  it("accepts only Pix or boleto as selected payment methods", () => {
    expect(isBillingPaymentMethod("PIX")).toBe(true);
    expect(isBillingPaymentMethod("BOLETO")).toBe(true);
    expect(isBillingPaymentMethod("CREDIT_CARD")).toBe(false);
    expect(paymentMethodLabel(null)).toBe("A escolher");
    expect(paymentMethodLabel("PIX")).toBe("Pix");
    expect(isPaymentReceived("confirmed")).toBe(false);
    expect(isPaymentReceived("received")).toBe(true);
  });
});
