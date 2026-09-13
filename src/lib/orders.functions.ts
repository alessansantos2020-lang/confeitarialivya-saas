import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_STORE_ID } from "./delivery.functions";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isCreatedOrder = (value: unknown): value is CreatedOrder => {
  if (!isRecord(value)) return false;
  return (
    typeof value["id"] === "string" &&
    typeof value["store_id"] === "string" &&
    Array.isArray(value["order_items"])
  );
};

export type CreateOrderInput = {
  store_id?: string;
  customer_name: string;
  customer_phone: string;
  address: string;
  neighborhood: string;
  street: string;
  number: string;
  complement?: string | null;
  reference?: string | null;
  payment_method: string;
  observation?: string | null;
  items: Array<{
    product_id: string;
    quantity: number;
    observation?: string | null;
    selected_addons?: Array<{ id: string }> | null;
  }>;
};

export type CreatedOrder = {
  id: string;
  store_id: string;
  customer_name: string;
  customer_phone: string;
  address: string;
  total_amount: number;
  delivery_fee: number;
  payment_method: string;
  observation: string | null;
  status: string;
  created_at: string;
  order_items: Array<{
    id: string;
    order_id: string;
    store_id: string;
    product_id: string;
    product_name: string;
    quantity: number;
    price_at_time: number;
    observation: string | null;
    selected_addons: unknown;
  }>;
};

export const createOrder = async (data: CreateOrderInput): Promise<CreatedOrder> => {
  const { data: created, error } = await supabase.rpc("create_order", {
    _payload: {
      store_id: data.store_id || DEFAULT_STORE_ID,
      customer_name: data.customer_name,
      customer_phone: data.customer_phone,
      address: data.address,
      neighborhood: data.neighborhood,
      street: data.street,
      number: data.number,
      complement: data.complement || null,
      reference: data.reference || null,
      payment_method: data.payment_method,
      observation: data.observation || null,
      items: data.items,
    },
  });

  if (error) throw error;
  if (!isCreatedOrder(created)) {
    throw new Error("Não foi possível criar o pedido.");
  }

  return created;
};
