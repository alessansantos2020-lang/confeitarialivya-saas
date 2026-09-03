import { supabase } from "@/integrations/supabase/client";
import type { Store } from "./delivery.functions";

export type StoreMembership = {
  store_id: string;
  role: string;
  store: Store;
};

/**
 * Lojas às quais o usuário logado pertence (via store_members).
 * Super admins não têm vínculo em store_members — para eles, retorna todas
 * as lojas ativas.
 */
export const getMyStores = async (): Promise<StoreMembership[]> => {
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) return [];

  const { data: memberships } = await supabase
    .from("store_members")
    .select("store_id, role, store:stores(*)")
    .eq("user_id", userId);

  if (memberships && memberships.length > 0) {
    return memberships
      .filter((m: any) => m.store)
      .map((m: any) => ({
        store_id: m.store_id,
        role: m.role,
        store: m.store as Store,
      }));
  }

  const { data: roleRow } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();

  if (roleRow?.role !== "super_admin") return [];

  const { data: stores } = await supabase
    .from("stores")
    .select("*")
    .eq("status", "active")
    .order("name", { ascending: true });

  return (stores || []).map((store) => ({
    store_id: store.id,
    role: "super_admin",
    store: store as Store,
  }));
};

const SELECTED_STORE_KEY = "livya:selected-store-id";

export const getSelectedStoreId = (): string | null => {
  if (typeof localStorage === "undefined") return null;
  return localStorage.getItem(SELECTED_STORE_KEY);
};

export const setSelectedStoreId = (storeId: string) => {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(SELECTED_STORE_KEY, storeId);
};

export const clearSelectedStoreId = () => {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(SELECTED_STORE_KEY);
};

/**
 * Resolve qual loja o painel deve exibir: a última escolhida (se o usuário
 * ainda tiver acesso a ela) ou a primeira disponível.
 */
export const resolveActiveStore = async (): Promise<{
  store: Store | null;
  memberships: StoreMembership[];
}> => {
  const memberships = await getMyStores();
  if (memberships.length === 0) return { store: null, memberships };

  const savedId = getSelectedStoreId();
  const saved = savedId
    ? memberships.find((m) => m.store_id === savedId)
    : undefined;

  return { store: (saved || memberships[0]).store, memberships };
};
