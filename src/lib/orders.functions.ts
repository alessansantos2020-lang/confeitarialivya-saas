import { createServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";

export type CreateOrderInput = {
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
  total_amount: number;
  delivery_fee: number;
  items: Array<{
    product_id: string;
    product_name: string;
    quantity: number;
    price_at_time: number;
    observation?: string | null;
    selected_addons?: any[] | null;
  }>;
};

export const createOrder = createServerFn({ method: "POST" })
  .validator((data: CreateOrderInput) => data)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    console.log("Server side: creating order", data);
    try {
      // 1. Create the order
      const { data: order, error: orderError } = await supabaseAdmin
        .from("orders")
        .insert([
          {
            customer_name: data.customer_name,
            customer_phone: data.customer_phone,
            address: data.address,
            neighborhood: data.neighborhood,
            street: data.street,
            number: data.number,
            complement: data.complement || null,
            reference: data.reference || null,
            total_amount: data.total_amount,
            delivery_fee: data.delivery_fee,
            status: 'pending',
            payment_method: data.payment_method,
            observation: data.observation || null,
          },
        ])
        .select()
        .single();

      if (orderError) {
        console.error("Supabase order insert error:", orderError);
        throw orderError;
      }

      console.log("Server side: order created", order.id);

      // 2. Create order items
      const orderItems = data.items.map((item) => ({
        order_id: order.id,
        product_id: item.product_id,
        product_name: item.product_name,
        quantity: item.quantity,
        price_at_time: item.price_at_time,
        observation: item.observation || null,
        selected_addons: item.selected_addons || null,
      }));

      const { error: itemsError } = await supabaseAdmin
        .from("order_items")
        .insert(orderItems);

      if (itemsError) {
        console.error("Supabase items insert error:", itemsError);
        throw itemsError;
      }

      console.log("Server side: order items created");
      return order;
    } catch (e) {
      console.error("Server side error in createOrder:", e);
      throw e;
    }
  });
