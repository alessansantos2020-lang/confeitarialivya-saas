import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { DEFAULT_STORE_ID } from "./delivery.functions";
import type { OrderStatus } from "./order-status";

export type OrderItem = Tables<"order_items"> & {
  product?: Tables<"products"> | null;
};

export type OrderWithItems = Omit<Tables<"orders">, "status"> & {
  status: OrderStatus;
  order_items: OrderItem[];
};

export type GetOrdersInput = {
  status?: OrderStatus | "all" | undefined;
  statuses?: OrderStatus[] | undefined;
  date?: string | undefined;
  storeId?: string | undefined;
  limit?: number | undefined;
  offset?: number | undefined;
};

const ORDER_SELECT = `
  *,
  order_items (
    *,
    product:products (*)
  )
`;

const dateBounds = (date: string): { start: string; end: string } => {
  const start = new Date(`${date}T00:00:00`);
  const end = new Date(`${date}T23:59:59.999`);
  return { start: start.toISOString(), end: end.toISOString() };
};

/**
 * Busca pedidos da loja com janela limitada. O histórico não deve carregar
 * todas as vendas da loja junto com todos os itens em cada visita.
 */
export const getOrders = async (input: GetOrdersInput = {}): Promise<OrderWithItems[]> => {
  const storeId = input.storeId || DEFAULT_STORE_ID;
  const limit = Math.min(Math.max(input.limit ?? 100, 1), 500);
  const offset = Math.max(input.offset ?? 0, 0);

  let query = supabase
    .from("orders")
    .select(ORDER_SELECT)
    .eq("store_id", storeId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1) as any;

  if (input.status && input.status !== "all") {
    query = query.eq("status", input.status);
  }

  if (input.statuses && input.statuses.length > 0) {
    query = query.in("status", input.statuses);
  }

  if (input.date) {
    const { start, end } = dateBounds(input.date);
    query = query.gte("created_at", start).lte("created_at", end);
  }

  const { data, error } = await query;
  if (error) throw error;

  return ((data || []) as Array<Record<string, unknown>>).map((order) => ({
    ...order,
    status: order.status as OrderStatus,
    order_items: Array.isArray(order.order_items) ? order.order_items : [],
  })) as OrderWithItems[];
};

export type UpdateOrderStatusInput = {
  id: string;
  status: OrderStatus;
  storeId?: string | undefined;
};

export const updateOrderStatus = async ({
  id,
  status,
  storeId: rawStoreId,
}: UpdateOrderStatusInput): Promise<OrderWithItems> => {
  const storeId = rawStoreId || DEFAULT_STORE_ID;

  const { data, error } = await (supabase
    .from("orders")
    .update({ status } as never)
    .eq("id", id)
    .eq("store_id", storeId)
    .select(ORDER_SELECT) as any).maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("Pedido não encontrado ou já foi atualizado por outra pessoa.");

  return {
    ...data,
    status: data.status as OrderStatus,
    order_items: Array.isArray(data.order_items) ? data.order_items : [],
  } as OrderWithItems;
};

export const updateOrderNotificationStatus = async (data: {
  id: string;
  notified: boolean;
  storeId?: string | undefined;
}): Promise<{ success: true }> => {
  const storeId = data.storeId || DEFAULT_STORE_ID;

  const { data: updated, error } = await supabase
    .from("orders")
    .update({ client_notified: data.notified } as never)
    .eq("id", data.id)
    .eq("store_id", storeId)
    .select("id")
    .maybeSingle();

  if (error) throw error;
  if (!updated) throw new Error("Pedido não encontrado.");
  return { success: true };
};
