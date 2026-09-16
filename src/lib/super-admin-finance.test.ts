import { describe, expect, it } from "vitest";
import { aggregateFinanceRows, resolveFinanceRange } from "./super-admin-finance";

const storeRows = [
  { id: "store-a", name: "Loja A", status: "active" },
  { id: "store-b", name: "Loja B", status: "active" },
];

const localDate = (year: number, month: number, day: number, hour = 0, minute = 0) =>
  new Date(year, month - 1, day, hour, minute);

const order = (overrides: Partial<Parameters<typeof aggregateFinanceRows>[0][number]> = {}) => ({
  id: "order-1",
  store_id: "store-a",
  created_at: localDate(2026, 9, 10, 10).toISOString(),
  status: "delivered",
  total_amount: 100,
  delivery_fee: 10,
  payment_method: "Pix",
  ...overrides,
});

describe("resolveFinanceRange", () => {
  const now = localDate(2026, 9, 14, 15);

  it("resolves today and rolling periods as local calendar days", () => {
    const today = resolveFinanceRange({ period: "today" }, now);
    expect(today).toEqual({
      from: localDate(2026, 9, 14).toISOString(),
      to: localDate(2026, 9, 15).toISOString(),
    });

    const sevenDays = resolveFinanceRange({ period: 7 }, now);
    expect(sevenDays).toEqual({
      from: localDate(2026, 9, 8).toISOString(),
      to: localDate(2026, 9, 15).toISOString(),
    });
  });

  it("resolves an inclusive custom date range with an exclusive end", () => {
    const range = resolveFinanceRange({
      period: "custom",
      dateFrom: "2026-09-10",
      dateTo: "2026-09-12",
    });
    expect(range).toEqual({
      from: localDate(2026, 9, 10).toISOString(),
      to: localDate(2026, 9, 13).toISOString(),
    });
  });

  it("rejects incomplete and reversed custom ranges", () => {
    expect(() => resolveFinanceRange({ period: "custom" })).toThrow("intervalo de datas válido");
    expect(() =>
      resolveFinanceRange({ period: "custom", dateFrom: "2026-09-12", dateTo: "2026-09-10" }),
    ).toThrow("intervalo de datas válido");
  });
});

describe("aggregateFinanceRows", () => {
  it("excludes canceled orders from financial aggregates but keeps them in transactions", () => {
    const result = aggregateFinanceRows(
      [
        order({ id: "valid-pix", total_amount: 100, payment_method: "Pix" }),
        order({
          id: "valid-card",
          store_id: "store-b",
          total_amount: 50,
          payment_method: " Cartão ",
          created_at: localDate(2026, 9, 11, 11).toISOString(),
        }),
        order({
          id: "valid-unknown",
          total_amount: 25,
          payment_method: "   ",
          created_at: localDate(2026, 9, 10, 12).toISOString(),
        }),
        order({ id: "canceled", total_amount: 900, status: "canceled", payment_method: "Pix" }),
      ],
      storeRows,
      localDate(2026, 9, 10).toISOString(),
      localDate(2026, 9, 12).toISOString(),
    );

    expect(result.revenue).toBe(175);
    expect(result.nonCanceledOrders).toBe(3);
    expect(result.canceledOrders).toBe(1);
    expect(result.averageTicket).toBeCloseTo(175 / 3);
    expect(result.payments).toEqual([
      { method: "Pix", count: 1, amount: 100 },
      { method: "Cartão", count: 1, amount: 50 },
      { method: "Não informado", count: 1, amount: 25 },
    ]);
    expect(result.stores).toEqual([
      { storeId: "store-a", storeName: "Loja A", orders: 2, revenue: 125 },
      { storeId: "store-b", storeName: "Loja B", orders: 1, revenue: 50 },
    ]);
    expect(result.daily).toEqual([
      { date: "09-10", value: 125 },
      { date: "09-11", value: 50 },
    ]);
    expect(result.transactions.map(({ id }) => id)).toEqual([
      "valid-card",
      "valid-unknown",
      "valid-pix",
      "canceled",
    ]);
    expect(result.transactions.find(({ id }) => id === "canceled")?.total).toBe(900);
  });

  it("returns empty aggregates without dividing by zero", () => {
    const result = aggregateFinanceRows(
      [],
      storeRows,
      localDate(2026, 9, 10).toISOString(),
      localDate(2026, 9, 12).toISOString(),
    );

    expect(result.revenue).toBe(0);
    expect(result.averageTicket).toBe(0);
    expect(result.payments).toEqual([]);
    expect(result.stores).toEqual([]);
    expect(result.daily).toEqual([
      { date: "09-10", value: 0 },
      { date: "09-11", value: 0 },
    ]);
    expect(result.transactions).toEqual([]);
    expect(result.truncated).toBe(false);
  });

  it("limits the transaction list to the most recent 100 rows", () => {
    const orders = Array.from({ length: 120 }, (_, index) =>
      order({
        id: `order-${index}`,
        created_at: localDate(2026, 9, 10, 0, index).toISOString(),
        total_amount: index,
      }),
    );

    const result = aggregateFinanceRows(
      orders,
      storeRows,
      localDate(2026, 9, 10).toISOString(),
      localDate(2026, 9, 11).toISOString(),
    );

    expect(result.transactions).toHaveLength(100);
    expect(result.transactions[0]?.id).toBe("order-119");
    expect(result.truncated).toBe(false);
  });
});
