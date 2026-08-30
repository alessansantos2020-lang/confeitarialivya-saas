import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertPermission } from "@/lib/permissions.server";


export const getCustomers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data: { search: string | undefined }) => data)
  .handler(async ({ context, data }) => {
    await assertPermission(context.supabase, context.userId, "view_customers");

    // Derivamos os clientes a partir da tabela de pedidos (agrupando por telefone),
    // já que ainda não existe uma tabela dedicada de clientes.
    let query = context.supabase
      .from("orders")
      .select(`
        customer_name,
        customer_phone,
        address,
        created_at,
        id
      `)
      .order("created_at", { ascending: false });

    if (data.search) {
      query = query.or(`customer_name.ilike.%${data.search}%,customer_phone.ilike.%${data.search}%`);
    }

    const { data: orders, error } = await query;
    if (error) throw error;

    const customersMap = new Map();

    orders.forEach((order) => {
      const phone = order.customer_phone;
      if (!customersMap.has(phone)) {
        customersMap.set(phone, {
          name: order.customer_name,
          phone: order.customer_phone,
          address: order.address,
          total_orders: 1,
          last_order_date: order.created_at,
          last_order_id: order.id,
        });
      } else {
        const existing = customersMap.get(phone);
        existing.total_orders += 1;
      }
    });

    return Array.from(customersMap.values());
  });

export const getCustomerHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data: { phone: string }) => data)
  .handler(async ({ context, data }) => {
    await assertPermission(context.supabase, context.userId, "view_customers");

    const { data: orders, error } = await context.supabase
      .from("orders")
      .select(`
        *,
        order_items (
          *,
          product:products (*)
        )
      `)
      .eq("customer_phone", data.phone)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return orders;
  });
