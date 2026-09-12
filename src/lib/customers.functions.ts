import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_STORE_ID } from "./delivery.functions";

// Convertido para SPA. A checagem de permissão do middleware foi removida —
// o RLS do banco garante que só usuários autorizados leiam os pedidos.

export const getCustomers = async (data: { search: string | undefined; storeId?: string }) => {
  const storeId = data.storeId || DEFAULT_STORE_ID;

  // Derivamos os clientes a partir da tabela de pedidos daquela loja
  // (agrupando por telefone), já que ainda não existe uma tabela dedicada de clientes.
  let query = supabase
    .from("orders")
    .select(`
      customer_name,
      customer_phone,
      address,
      created_at,
      id
    `)
    .eq("store_id", storeId)
    .order("created_at", { ascending: false });

  if (data.search) {
    // Sanitiza caracteres especiais do PostgREST filter syntax para evitar filter injection
    const sanitized = data.search.replace(/[.,()\\*%]/g, "");
    if (!sanitized) return [];
    query = query.or(`customer_name.ilike.%${sanitized}%,customer_phone.ilike.%${sanitized}%`);
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
};

export const getCustomerHistory = async (data: { phone: string; storeId?: string }) => {
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
    .eq("customer_phone", data.phone)
    .order("created_at", { ascending: false });

  const { data: orders, error } = await query;

  if (error) throw error;
  return orders;
};
