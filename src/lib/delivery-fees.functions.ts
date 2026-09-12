import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";
import { DEFAULT_STORE_ID, type PublicDeliveryFee } from "./delivery.functions";

// Convertido para SPA. A checagem "manage_delivery" foi removida — o RLS
// do banco decide quem pode gravar. Se um usuário sem permissão tentar
// escrever, o Supabase retorna erro e o toast exibe.

export type DeliveryFee = {
  id: string;
  store_id?: string;
  neighborhood: string;
  fee: number;
  status: "active" | "inactive";
  created_at?: string;
};

export const getDeliveryFees = async (
  storeId: string = DEFAULT_STORE_ID,
): Promise<DeliveryFee[]> => {
  const { data, error } = await supabase
    .from("delivery_fees")
    .select("*")
    .eq("store_id", storeId)
    .order("neighborhood", { ascending: true });

  if (error) throw error;
  return data as DeliveryFee[];
};

export const getActiveDeliveryFees = async (
  storeId: string = DEFAULT_STORE_ID,
): Promise<PublicDeliveryFee[]> => {
  const { data, error } = await supabase.rpc("get_public_delivery_fees", {
    _store_id: storeId,
  });

  if (error) throw error;
  return (data ?? []) as PublicDeliveryFee[];
};

const createSchema = z.object({
  store_id: z.string().uuid().default(DEFAULT_STORE_ID),
  neighborhood: z.string().min(1),
  fee: z.number().min(0),
  status: z.enum(["active", "inactive"]).default("active"),
});

export const createDeliveryFee = async (input: z.input<typeof createSchema>) => {
  const data = createSchema.parse(input);

  const { error } = await supabase.from("delivery_fees").insert([data]);

  if (error) throw error;
  return { success: true };
};

const updateSchema = z.object({
  id: z.string().uuid(),
  store_id: z.string().uuid().default(DEFAULT_STORE_ID),
  neighborhood: z.string().min(1),
  fee: z.number().min(0),
  status: z.enum(["active", "inactive"]),
});

export const updateDeliveryFee = async (input: z.input<typeof updateSchema>) => {
  const data = updateSchema.parse(input);

  const { id, store_id, ...updateData } = data;
  const { error } = await supabase
    .from("delivery_fees")
    .update(updateData)
    .eq("id", id)
    .eq("store_id", store_id);

  if (error) throw error;
  return { success: true };
};

const deleteSchema = z.object({
  id: z.string().uuid(),
  store_id: z.string().uuid().default(DEFAULT_STORE_ID),
});

export const deleteDeliveryFee = async (input: z.input<typeof deleteSchema>) => {
  const { id, store_id } = deleteSchema.parse(input);

  const { error } = await supabase
    .from("delivery_fees")
    .delete()
    .eq("id", id)
    .eq("store_id", store_id);

  if (error) throw error;
  return { success: true };
};
