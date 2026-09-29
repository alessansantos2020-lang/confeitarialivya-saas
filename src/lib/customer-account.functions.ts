import { supabase } from "@/integrations/supabase/client";

// ---------------------------------------------------------------------------
// Dados de conta do cliente: pedidos vinculados, endereços salvos e cupons.
// Tudo filtrado por auth.uid() — o cliente só enxerga o que é dele.
// ---------------------------------------------------------------------------

export type CustomerOrder = {
  id: string;
  store_id: string;
  status: string;
  total_amount: number;
  created_at: string | null;
  order_items: { id: string; product_name: string | null; quantity: number }[];
};

export const getMyOrders = async (storeId: string): Promise<CustomerOrder[]> => {
  const { data, error } = await supabase
    .from("customer_orders")
    .select(
      "order_id, created_at, orders:order_id (id, store_id, status, total_amount, created_at, order_items (id, product_name, quantity))",
    )
    .eq("store_id", storeId)
    .order("created_at", { foreignTable: "orders", ascending: false })
    .limit(30);

  if (error) throw new Error("Não foi possível carregar seus pedidos.");

  return (data ?? [])
    .map((row: { orders: CustomerOrder | null }) => row.orders)
    .filter((order): order is CustomerOrder => Boolean(order) && order!.store_id === storeId);
};

export type CustomerAddress = {
  id: string;
  label: string | null;
  neighborhood: string;
  street: string;
  number: string;
  complement: string | null;
  reference: string | null;
  is_default: boolean;
};

export const getMyAddresses = async (): Promise<CustomerAddress[]> => {
  const { data, error } = await supabase
    .from("customer_addresses")
    .select("*")
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) throw new Error("Não foi possível carregar seus endereços.");
  return (data ?? []) as CustomerAddress[];
};

export const saveMyAddress = async (
  address: Omit<CustomerAddress, "id"> & { id?: string },
): Promise<void> => {
  const payload = {
    label: address.label || null,
    neighborhood: address.neighborhood,
    street: address.street,
    number: address.number,
    complement: address.complement || null,
    reference: address.reference || null,
    is_default: address.is_default,
  };

  if (address.id) {
    // Novo padrão: limpa o anterior primeiro (índice único garante 1 por cliente).
    if (address.is_default) {
      await supabase
        .from("customer_addresses")
        .update({ is_default: false })
        .eq("is_default", true);
    }
    const { error } = await supabase
      .from("customer_addresses")
      .update(payload)
      .eq("id", address.id);
    if (error) throw new Error("Não foi possível salvar o endereço.");
    return;
  }

  const { error } = await supabase.from("customer_addresses").insert(payload);
  if (error) throw new Error("Não foi possível adicionar o endereço.");
};

export const deleteMyAddress = async (id: string): Promise<void> => {
  const { error } = await supabase.from("customer_addresses").delete().eq("id", id);
  if (error) throw new Error("Não foi possível excluir o endereço.");
};

export type MyCoupon = {
  coupon_id: string;
  code: string;
  description: string | null;
  discount_type: "percent" | "fixed";
  discount_value: number;
  min_order_amount: number;
  expires_at: string | null;
  times_used: number;
  last_used_at: string | null;
};

export const getMyCoupons = async (storeId: string): Promise<MyCoupon[]> => {
  const { data, error } = await supabase.rpc("get_my_coupons", { _store_id: storeId });
  if (error) throw new Error("Não foi possível carregar seus cupons.");
  return (data ?? []) as MyCoupon[];
};

export const validateCoupon = async (
  storeId: string,
  code: string,
  subtotal: number,
): Promise<{ code: string; discount_amount: number; description: string | null }> => {
  const { data, error } = await supabase.rpc("validate_coupon", {
    _store_id: storeId,
    _code: code,
    _subtotal: subtotal,
  });
  if (error) {
    const message = error.message ?? "";
    if (message.includes("mínimo")) throw new Error(message);
    if (message.includes("conta")) throw new Error(message);
    throw new Error("Cupom inválido ou expirado.");
  }
  return data as { code: string; discount_amount: number; description: string | null };
};

export const copyCouponCode = async (code: string): Promise<void> => {
  try {
    await navigator.clipboard.writeText(code);
  } catch {
    // Fallback para navegadores sem clipboard API
    const input = document.createElement("input");
    input.value = code;
    document.body.appendChild(input);
    input.select();
    document.execCommand("copy");
    document.body.removeChild(input);
  }
};
