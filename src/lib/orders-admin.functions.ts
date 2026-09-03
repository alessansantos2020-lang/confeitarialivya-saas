import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_STORE_ID } from "./delivery.functions";

// Convertido para SPA. O RLS do banco continua exigindo autenticação e
// permissões corretas; a checagem no client foi removida.

export const getOrders = async (data: { status: string | undefined; date: string | undefined; storeId?: string }) => {
  const storeId = data.storeId || DEFAULT_STORE_ID;

  let query = supabase
    .from("orders")
    .select(`
      *,
      order_items (
        *,
        product:products (*)
      )
    `)
    .eq("store_id", storeId)
    .order("created_at", { ascending: false });

  if (data.status && data.status !== "all") {
    query = query.eq("status", data.status);
  }

  if (data.date) {
    const startOfDay = new Date(data.date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(data.date);
    endOfDay.setHours(23, 59, 59, 999);

    query = query.gte("created_at", startOfDay.toISOString()).lte("created_at", endOfDay.toISOString());
  }

  const { data: orders, error } = await query;

  if (error) throw error;
  return orders;
};

export const updateOrderStatus = async (data: { id: string; status: string; storeId?: string }) => {
  const storeId = data.storeId || DEFAULT_STORE_ID;

  const { data: order, error } = await (supabase
    .from("orders")
    .update({ status: data.status } as any)
    .eq("id", data.id)
    .eq("store_id", storeId)
    .select(`
      *,
      order_items (
        *,
        product:products (*)
      )
    `) as any)
    .maybeSingle();

  if (error) throw error;
  if (!order) throw new Error("Pedido não encontrado");
  return order;
};

export const updateOrderNotificationStatus = async (data: { id: string; notified: boolean; storeId?: string }) => {
  const storeId = data.storeId || DEFAULT_STORE_ID;

  const { error } = await supabase
    .from("orders")
    .update({ client_notified: data.notified } as any)
    .eq("id", data.id)
    .eq("store_id", storeId);

  if (error) throw error;
  return { success: true };
};
