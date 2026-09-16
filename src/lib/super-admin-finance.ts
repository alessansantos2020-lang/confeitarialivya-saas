import { supabase } from "@/integrations/supabase/client";

export type FinancePeriod = "today" | 7 | 30 | "custom";

export type FinanceFilters = {
  period: FinancePeriod;
  dateFrom?: string;
  dateTo?: string;
  storeId?: string;
};

type FinanceOrder = {
  id: string;
  store_id: string;
  created_at: string | null;
  status: string;
  total_amount: number;
  delivery_fee: number | null;
  payment_method: string | null;
};

type StoreRow = { id: string; name: string; status: string };

export type FinancePayment = { method: string; count: number; amount: number };
export type FinanceStore = { storeId: string; storeName: string; orders: number; revenue: number };
export type FinanceDay = { date: string; value: number };
export type FinanceTransaction = {
  id: string;
  date: string | null;
  storeName: string;
  status: string;
  total: number;
  paymentMethod: string;
};

export type PlatformFinance = {
  from: string;
  to: string;
  revenue: number;
  nonCanceledOrders: number;
  canceledOrders: number;
  averageTicket: number;
  payments: FinancePayment[];
  stores: FinanceStore[];
  daily: FinanceDay[];
  transactions: FinanceTransaction[];
  truncated: boolean;
};

const PAGE_SIZE = 500;
const MAX_ROWS = 5000;

const startOfLocalDay = (value: Date) => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
};

const endExclusiveLocalDay = (value: Date) => {
  const date = startOfLocalDay(value);
  date.setDate(date.getDate() + 1);
  return date;
};

export const resolveFinanceRange = (filters: FinanceFilters, now = new Date()) => {
  let from: Date;
  let to: Date;
  if (filters.period === "today") {
    from = startOfLocalDay(now);
    to = endExclusiveLocalDay(now);
  } else if (filters.period === "custom") {
    if (!filters.dateFrom || !filters.dateTo || filters.dateFrom > filters.dateTo) {
      throw new Error("Informe um intervalo de datas válido.");
    }
    from = startOfLocalDay(new Date(`${filters.dateFrom}T00:00:00`));
    to = endExclusiveLocalDay(new Date(`${filters.dateTo}T00:00:00`));
  } else {
    from = startOfLocalDay(now);
    from.setDate(from.getDate() - (filters.period - 1));
    to = endExclusiveLocalDay(now);
  }
  return { from: from.toISOString(), to: to.toISOString() };
};

const dayKey = (date: string) => {
  const value = new Date(date);
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const aggregateFinanceRows = (
  orders: FinanceOrder[],
  stores: StoreRow[],
  from: string,
  to: string,
): PlatformFinance => {
  const storeNames = new Map(stores.map((store) => [store.id, store.name]));
  const validOrders = orders.filter((order) => order.status !== "canceled");
  const revenue = validOrders.reduce((sum, order) => sum + Number(order.total_amount || 0), 0);
  const paymentMap = new Map<string, FinancePayment>();
  const storeMap = new Map<string, FinanceStore>();
  const dailyMap = new Map<string, number>();

  for (const order of validOrders) {
    const method = order.payment_method?.trim() || "Não informado";
    const payment = paymentMap.get(method) || { method, count: 0, amount: 0 };
    payment.count += 1;
    payment.amount += Number(order.total_amount || 0);
    paymentMap.set(method, payment);

    const store = storeMap.get(order.store_id) || {
      storeId: order.store_id,
      storeName: storeNames.get(order.store_id) || "Loja não identificada",
      orders: 0,
      revenue: 0,
    };
    store.orders += 1;
    store.revenue += Number(order.total_amount || 0);
    storeMap.set(order.store_id, store);

    if (order.created_at) {
      const key = dayKey(order.created_at);
      dailyMap.set(key, (dailyMap.get(key) || 0) + Number(order.total_amount || 0));
    }
  }

  const start = new Date(from);
  const end = new Date(to);
  const daily: FinanceDay[] = [];
  for (const cursor = new Date(start); cursor < end; cursor.setDate(cursor.getDate() + 1)) {
    const key = dayKey(cursor.toISOString());
    daily.push({ date: key.slice(5), value: dailyMap.get(key) || 0 });
  }

  return {
    from,
    to,
    revenue,
    nonCanceledOrders: validOrders.length,
    canceledOrders: orders.length - validOrders.length,
    averageTicket: validOrders.length ? revenue / validOrders.length : 0,
    payments: Array.from(paymentMap.values()).sort((a, b) => b.amount - a.amount),
    stores: Array.from(storeMap.values()).sort((a, b) => b.revenue - a.revenue),
    daily,
    transactions: orders
      .slice()
      .sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""))
      .slice(0, 100)
      .map((order) => ({
        id: order.id,
        date: order.created_at,
        storeName: storeNames.get(order.store_id) || "Loja não identificada",
        status: order.status,
        total: Number(order.total_amount || 0),
        paymentMethod: order.payment_method?.trim() || "Não informado",
      })),
    truncated: orders.length >= MAX_ROWS,
  };
};

export const getPlatformFinance = async (filters: FinanceFilters): Promise<PlatformFinance> => {
  const { from, to } = resolveFinanceRange(filters);
  let query = supabase
    .from("orders")
    .select("id, store_id, created_at, status, total_amount, delivery_fee, payment_method", {
      count: "exact",
    })
    .gte("created_at", from)
    .lt("created_at", to)
    .order("created_at", { ascending: false });
  if (filters.storeId) query = query.eq("store_id", filters.storeId);

  const { data: orders, error: ordersError, count } = await query.limit(MAX_ROWS);
  if (ordersError) throw ordersError;
  if ((count || 0) > MAX_ROWS)
    throw new Error("O período contém muitos pedidos. Reduza o intervalo ou filtre uma loja.");

  const { data: stores, error: storesError } = await supabase
    .from("stores")
    .select("id, name, status")
    .order("name");
  if (storesError) throw storesError;

  return aggregateFinanceRows(
    (orders || []) as FinanceOrder[],
    (stores || []) as StoreRow[],
    from,
    to,
  );
};
