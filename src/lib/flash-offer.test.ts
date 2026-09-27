import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import {
  pickFlashOffer,
  getFlashCountdown,
  wasFlashDismissed,
  dismissFlashOffer,
  flashDismissKey,
} from "./flash-offer";

// Node não tem sessionStorage; o helper degrada com graça sem ele.
const memoryStore = new Map<string, string>();
vi.stubGlobal("sessionStorage", {
  getItem: (key: string) => memoryStore.get(key) ?? null,
  setItem: (key: string, value: string) => void memoryStore.set(key, value),
  removeItem: (key: string) => void memoryStore.delete(key),
  clear: () => memoryStore.clear(),
});

const base = {
  id: "p1",
  name: "X-Burger Especial",
  description: "Artesanal",
  image_url: null,
  price: 25,
};

describe("pickFlashOffer", () => {
  it("devolve null sem produtos ou sem oferta ativa", () => {
    expect(pickFlashOffer([], new Date("2026-09-25T12:00:00Z"))).toBeNull();
    expect(pickFlashOffer(undefined, new Date("2026-09-25T12:00:00Z"))).toBeNull();
    expect(
      pickFlashOffer(
        [{ ...base, is_on_sale: true, sale_price: 19.9, sale_end_at: "2026-09-20T12:00:00Z" }],
        new Date("2026-09-25T12:00:00Z"),
      ),
    ).toBeNull();
  });

  it("aceita oferta sem data de início (vale desde já) e respeita o fim", () => {
    const now = new Date("2026-09-25T12:00:00Z");
    const offer = {
      ...base,
      is_on_sale: true,
      sale_price: 19.9,
      sale_end_at: "2026-09-26T00:00:00Z",
    };
    expect(pickFlashOffer([offer], now)?.id).toBe("p1");
  });

  it("ignora oferta agendada para o futuro", () => {
    const now = new Date("2026-09-25T12:00:00Z");
    const offer = {
      ...base,
      is_on_sale: true,
      sale_price: 19.9,
      sale_start_at: "2026-09-26T00:00:00Z",
      sale_end_at: "2026-09-27T00:00:00Z",
    };
    expect(pickFlashOffer([offer], now)).toBeNull();
  });

  it("entre várias ativas, escolhe a que termina primeiro", () => {
    const now = new Date("2026-09-25T12:00:00Z");
    const soon = {
      ...base,
      id: "soon",
      is_on_sale: true,
      sale_price: 15,
      sale_end_at: "2026-09-25T13:00:00Z",
    };
    const late = {
      ...base,
      id: "late",
      is_on_sale: true,
      sale_price: 20,
      sale_end_at: "2026-09-25T22:00:00Z",
    };
    expect(pickFlashOffer([late, soon], now)?.id).toBe("soon");
  });
});

describe("getFlashCountdown", () => {
  it("formata o tempo restante como HH:MM:SS", () => {
    const end = new Date("2026-09-25T13:42:35Z");
    const now = new Date("2026-09-25T12:00:00Z");
    expect(getFlashCountdown(end.toISOString(), now)).toBe("01:42:35");
  });

  it("zera quando expirou ou sem data", () => {
    const now = new Date("2026-09-25T12:00:00Z");
    expect(getFlashCountdown("2026-09-25T11:00:00Z", now)).toBe("00:00:00");
    expect(getFlashCountdown(null, now)).toBe("00:00:00");
  });
});

describe("descarte na sessão", () => {
  beforeEach(() => sessionStorage.clear());
  afterEach(() => sessionStorage.clear());

  it("chave separa ofertas diferentes pelo início da promoção", () => {
    expect(flashDismissKey("p1", "2026-09-25T10:00:00Z")).toBe(
      "flash-offer:p1:2026-09-25T10:00:00Z",
    );
    expect(flashDismissKey("p1", null)).toBe("flash-offer:p1:immediate");
  });

  it("não considera descartado antes de fechar", () => {
    expect(wasFlashDismissed("p1", "2026-09-25T10:00:00Z")).toBe(false);
  });

  it("considera descartado depois de fechar, apenas na mesma oferta", () => {
    dismissFlashOffer("p1", "2026-09-25T10:00:00Z");
    expect(wasFlashDismissed("p1", "2026-09-25T10:00:00Z")).toBe(true);
    expect(wasFlashDismissed("p1", "2026-09-26T10:00:00Z")).toBe(false);
    expect(wasFlashDismissed("p2", "2026-09-25T10:00:00Z")).toBe(false);
  });
});
