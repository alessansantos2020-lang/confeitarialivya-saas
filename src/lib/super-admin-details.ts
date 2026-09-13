import { supabase } from "@/integrations/supabase/client";

export type StoreDetails = {
  phone: string | null;
  whatsapp: string | null;
  address: string | null;
  userCount: number;
  orderCount: number;
  customerCount: number;
  productCount: number;
};

export const getStoreDetails = async (storeId: string): Promise<StoreDetails> => {
  const [settingsRes, membersRes, ordersRes, productsRes, customerRes] = await Promise.all([
    supabase
      .from("store_settings")
      .select("phone, whatsapp, address")
      .eq("store_id", storeId)
      .maybeSingle(),
    supabase
      .from("store_members")
      .select("id", { count: "exact", head: true })
      .eq("store_id", storeId),
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("store_id", storeId),
    supabase.from("products").select("id", { count: "exact", head: true }).eq("store_id", storeId),
    // Não existe tabela de clientes: "clientes" é telefone distinto nos pedidos.
    supabase.from("orders").select("customer_phone").eq("store_id", storeId),
  ]);

  if (settingsRes.error) throw settingsRes.error;
  if (membersRes.error) throw membersRes.error;
  if (ordersRes.error) throw ordersRes.error;
  if (productsRes.error) throw productsRes.error;
  if (customerRes.error) throw customerRes.error;

  const phones = new Set(
    (customerRes.data || []).map((order) => order.customer_phone).filter(Boolean),
  );

  const settings = settingsRes.data;
  return {
    phone: settings?.phone ?? null,
    whatsapp: settings?.whatsapp ?? null,
    address: settings?.address ?? null,
    userCount: membersRes.count ?? 0,
    orderCount: ordersRes.count ?? 0,
    customerCount: phones.size,
    productCount: productsRes.count ?? 0,
  };
};
