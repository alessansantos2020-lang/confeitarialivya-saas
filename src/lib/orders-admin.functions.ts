import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertPermission } from "@/lib/permissions.server";

// Todas as funções abaixo agora exigem um usuário autenticado com a permissão
// correspondente (o RLS do banco também exige isso — esta checagem só existe
// para devolver um erro claro em vez de um erro genérico do Postgres).

export const getOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data: { status: string | undefined; date: string | undefined }) => data)
  .handler(async ({ context, data }) => {
    await assertPermission(context.supabase, context.userId, "view_orders");

    let query = context.supabase
      .from("orders")
      .select(`
        *,
        order_items (
          *,
          product:products (*)
        )
      `)
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
  });

export const updateOrderStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { id: string; status: string }) => data)
  .handler(async ({ context, data }) => {
    await assertPermission(context.supabase, context.userId, "manage_orders");

    const { data: order, error } = await (context.supabase
      .from("orders")
      .update({ status: data.status } as any)
      .eq("id", data.id)
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
  });

export const updateOrderNotificationStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { id: string; notified: boolean }) => data)
  .handler(async ({ context, data }) => {
    await assertPermission(context.supabase, context.userId, "manage_orders");

    const { error } = await context.supabase
      .from("orders")
      .update({ client_notified: data.notified } as any)
      .eq("id", data.id);

    if (error) throw error;
    return { success: true };
  });
