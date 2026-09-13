import { supabase } from "@/integrations/supabase/client";

export type DashboardPeriod = 7 | 30 | 90;

export type SuperDashboard = {
  totalStores: number;
  activeStores: number;
  blockedStores: number;
  totalUsers: number;
  totalOrders: number;
  newStores: number; // criadas no período
  storesGrowth: { date: string; value: number }[]; // acumulado de lojas por dia
  ordersChart: { date: string; value: number }[]; // pedidos por dia
};

// Chave de dia (YYYY-MM-DD) em horário local.
export const dayKey = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

export const getSuperDashboard = async (period: DashboardPeriod): Promise<SuperDashboard> => {
  const since = new Date();
  since.setDate(since.getDate() - (period - 1));
  since.setHours(0, 0, 0, 0);
  const sinceIso = since.toISOString();

  const [storesRes, usersRes, ordersTotalRes, ordersPeriodRes] = await Promise.all([
    supabase.from("stores").select("id, status, created_at"),
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("orders").select("id", { count: "exact", head: true }),
    supabase.from("orders").select("created_at").gte("created_at", sinceIso),
  ]);

  if (storesRes.error) throw storesRes.error;

  const stores = storesRes.data || [];
  const activeStores = stores.filter((s) => s.status === "active").length;
  const blockedStores = stores.filter((s) => s.status === "suspended").length;
  const newStores = stores.filter((s) => s.created_at && s.created_at >= sinceIso).length;

  // Eixo de dias do período.
  const days: string[] = [];
  for (let i = 0; i < period; i++) {
    const d = new Date(since);
    d.setDate(since.getDate() + i);
    days.push(dayKey(d));
  }

  // Crescimento de lojas: total acumulado até o fim de cada dia.
  const storesGrowth = days.map((key) => {
    const end = new Date(`${key}T23:59:59`);
    const value = stores.filter(
      (s) => s.created_at && new Date(s.created_at).getTime() <= end.getTime(),
    ).length;
    return { date: key.slice(5), value };
  });

  // Pedidos por dia no período.
  const orderCountByDay = new Map<string, number>();
  for (const o of ordersPeriodRes.data || []) {
    if (!o.created_at) continue;
    const key = dayKey(new Date(o.created_at));
    orderCountByDay.set(key, (orderCountByDay.get(key) || 0) + 1);
  }
  const ordersChart = days.map((key) => ({
    date: key.slice(5),
    value: orderCountByDay.get(key) || 0,
  }));

  return {
    totalStores: stores.length,
    activeStores,
    blockedStores,
    totalUsers: usersRes.count ?? 0,
    totalOrders: ordersTotalRes.count ?? 0,
    newStores,
    storesGrowth,
    ordersChart,
  };
};
