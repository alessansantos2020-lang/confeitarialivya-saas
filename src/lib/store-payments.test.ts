import { describe, expect, it } from "vitest";
import {
  calculateChange,
  formatChangeDisplay,
  DEFAULT_STORE_PAYMENT_GATEWAYS,
} from "./store-payments";

describe("store-payments utility functions", () => {
  it("defaults accept cash and card delivery to true", () => {
    expect(DEFAULT_STORE_PAYMENT_GATEWAYS.accept_cash).toBe(true);
    expect(DEFAULT_STORE_PAYMENT_GATEWAYS.accept_card_delivery).toBe(true);
    expect(DEFAULT_STORE_PAYMENT_GATEWAYS.accept_manual_pix).toBe(true);
    expect(DEFAULT_STORE_PAYMENT_GATEWAYS.mp_enabled).toBe(false);
    expect(DEFAULT_STORE_PAYMENT_GATEWAYS.asaas_enabled).toBe(false);
  });

  describe("calculateChange", () => {
    it("returns needsChange false when changeFor is null or undefined or 0", () => {
      expect(calculateChange(50, null)).toEqual({
        needsChange: false,
        changeAmount: 0,
        isValid: true,
      });
      expect(calculateChange(50, undefined)).toEqual({
        needsChange: false,
        changeAmount: 0,
        isValid: true,
      });
      expect(calculateChange(50, 0)).toEqual({
        needsChange: false,
        changeAmount: 0,
        isValid: true,
      });
    });

    it("calculates correct change when changeFor is greater than total", () => {
      const result = calculateChange(38.5, 50);
      expect(result.needsChange).toBe(true);
      expect(result.changeAmount).toBe(11.5);
      expect(result.isValid).toBe(true);
    });

    it("handles exact amount with zero change", () => {
      const result = calculateChange(50, 50);
      expect(result.needsChange).toBe(true);
      expect(result.changeAmount).toBe(0);
      expect(result.isValid).toBe(true);
    });

    it("marks invalid when changeFor is less than total", () => {
      const result = calculateChange(50, 40);
      expect(result.needsChange).toBe(true);
      expect(result.isValid).toBe(false);
    });
  });

  describe("formatChangeDisplay", () => {
    it("formats message when no change is needed", () => {
      expect(formatChangeDisplay(null, 50)).toBe("Não precisa de troco");
      expect(formatChangeDisplay(0, 50)).toBe("Não precisa de troco");
    });

    it("formats message with correct change calculation in pt-BR currency", () => {
      const text = formatChangeDisplay(50, 38);
      expect(text).toContain("Troco para R$");
      expect(text).toContain("50,00");
      expect(text).toContain("12,00");
    });

    it("formats warning when change is less than total", () => {
      const text = formatChangeDisplay(30, 50);
      expect(text).toContain("Inválido: menor que o total");
    });
  });
});
