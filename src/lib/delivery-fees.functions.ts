import { createServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { assertPermission } from "@/lib/permissions.server";


export type DeliveryFee = {
  id: string;
  neighborhood: string;
  fee: number;
  status: 'active' | 'inactive';
  created_at?: string;
};

export const getDeliveryFees = createServerFn({ method: "GET" }).handler(async (): Promise<DeliveryFee[]> => {
  const { data, error } = await supabase
    .from("delivery_fees")
    .select("*")
    .order("neighborhood", { ascending: true });

  if (error) throw error;
  return data as DeliveryFee[];
});

export const getActiveDeliveryFees = createServerFn({ method: "GET" }).handler(async (): Promise<DeliveryFee[]> => {
  return [
    { id: "fee-1", neighborhood: "Centro", fee: 5, status: "active" },
    { id: "fee-2", neighborhood: "Jardim das Flores", fee: 8, status: "active" },
    { id: "fee-3", neighborhood: "Vila Nova", fee: 10, status: "active" },
  ];
});

export const createDeliveryFee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({
    neighborhood: z.string().min(1),
    fee: z.number().min(0),
    status: z.enum(['active', 'inactive']).default('active')
  }).parse(data))
  .handler(async ({ context, data }) => {
    await assertPermission(context.supabase, context.userId, "manage_delivery");

    const { error } = await context.supabase
      .from("delivery_fees")
      .insert([data]);

    if (error) throw error;
    return { success: true };
  });

export const updateDeliveryFee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({
    id: z.string().uuid(),
    neighborhood: z.string().min(1),
    fee: z.number().min(0),
    status: z.enum(['active', 'inactive'])
  }).parse(data))
  .handler(async ({ context, data }) => {
    await assertPermission(context.supabase, context.userId, "manage_delivery");

    const { id, ...updateData } = data;
    const { error } = await context.supabase
      .from("delivery_fees")
      .update(updateData)
      .eq("id", id);

    if (error) throw error;
    return { success: true };
  });

export const deleteDeliveryFee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({
    id: z.string().uuid()
  }).parse(data))
  .handler(async ({ context, data }) => {
    await assertPermission(context.supabase, context.userId, "manage_delivery");

    const { error } = await context.supabase
      .from("delivery_fees")
      .delete()
      .eq("id", data.id);

    if (error) throw error;
    return { success: true };
  });
