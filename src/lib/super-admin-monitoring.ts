import { supabase } from "@/integrations/supabase/client";
import { getRecentActivity, type ActivityLog } from "./super-admin-activity";

export type MonitoringPeriod = "today" | 7 | 30;

export type StoreActivity = {
  storeId: string;
  storeName: string;
  orders: number;
  revenue: number;
};

export type RecentOrder = {
  id: string;
  storeName: string;
  customerName: string;
  total: number;
  status: string;
  createdAt: string | null;
};

export type Monitoring = {
  totalOrders: number; // todos os tempos
  periodOrders: number;
  periodRevenue: number;
  newStores: number;
  newUsers: number;
  recentOrders: RecentOrder[];
  storeRanking: StoreActivity[];
  activity: ActivityLog[];
};

/**
 * O Dashboard soma a plataforma inteira; aqui a visão é por loja e por pedido.
 * Nada é inventado: quando não há pedido no período, os números são zero de
 * verdade e a tela mostra o aviso em vez de uma tabela vazia.
 */
export const getMonitoring = async (period: MonitoringPeriod): Promise<Monitoring> => {
  const since = new Date();
  if (period === "today") {
    since.setHours(0, 0, 0, 0);
  } else {
    since.setDate(since.getDate() - (period - 1));
    since.setHours(0, 0, 0, 0);
  }
  const sinceIso = since.toISOString();

  const [ordersRes, ordersTotalRes, storesRes, profilesRes, activity] = await Promise.all([
    supabase
      .from("orders")
      .select("id, store_id, customer_name, total_amount, status, created_at")
      .gte("created_at", sinceIso)
      .order("created_at", { ascending: false }),
    supabase.from("orders").select("id", { count: "exact", head: true }),
    supabase.from("stores").select("id, name, created_at"),
    supabase.from("profiles").select("id, created_at"),
    getRecentActivity(12),
  ]);

  if (ordersRes.error) throw ordersRes.error;

  const orders = ordersRes.data || [];
  const stores = storesRes.data || [];

  const storeNames = new Map<string, string>();
  for (const s of stores) {
    storeNames.set(s.id, s.name);
  }

  // Toda loja entra no ranking, mesmo parada: loja sem pedido é informação.
  const tally = new Map<string, { orders: number; revenue: number }>();
  for (const s of stores) {
    tally.set(s.id, { orders: 0, revenue: 0 });
  }

  let periodRevenue = 0;
  for (const o of orders) {
    const entry = tally.get(o.store_id) || { orders: 0, revenue: 0 };
    entry.orders += 1;
    // Pedido cancelado não é faturamento.
    if (o.status !== "canceled") {
      entry.revenue += Number(o.total_amount) || 0;
      periodRevenue += Number(o.total_amount) || 0;
    }
    tally.set(o.store_id, entry);
  }

  const storeRanking: StoreActivity[] = Array.from(tally.entries())
    .map(([storeId, v]) => ({
      storeId,
      storeName: storeNames.get(storeId) ?? "Loja removida",
      orders: v.orders,
      revenue: v.revenue,
    }))
    .sort((a, b) => b.orders - a.orders || b.revenue - a.revenue);

  const recentOrders: RecentOrder[] = orders.slice(0, 10).map((o) => ({
    id: o.id,
    storeName: storeNames.get(o.store_id) ?? "Loja removida",
    customerName: o.customer_name,
    total: Number(o.total_amount) || 0,
    status: o.status || "pending",
    createdAt: o.created_at,
  }));

  return {
    totalOrders: ordersTotalRes.count ?? 0,
    periodOrders: orders.length,
    periodRevenue,
    newStores: stores.filter((s) => s.created_at && s.created_at >= sinceIso).length,
    newUsers: (profilesRes.data || []).filter((p) => p.created_at && p.created_at >= sinceIso)
      .length,
    recentOrders,
    storeRanking,
    activity,
  };
};
