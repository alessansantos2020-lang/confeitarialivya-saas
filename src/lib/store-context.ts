import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { toStore, type Store } from "./delivery.functions";

type StoreMembershipRow = Pick<Tables<"store_members">, "store_id" | "role"> & {
  store: Store | null;
};

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
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  const userId = auth.user?.id;
  if (!userId) return [];

  const [membershipsResult, roleResult] = await Promise.all([
    supabase.from("store_members").select("store_id, role, store:stores(*)").eq("user_id", userId),
    supabase.from("user_roles").select("role").eq("user_id", userId).maybeSingle(),
  ]);
  if (membershipsResult.error) throw membershipsResult.error;
  if (roleResult.error) throw roleResult.error;

  const memberships = (membershipsResult.data || []) as StoreMembershipRow[];
  const isSuperAdmin = roleResult.data?.role === "super_admin";
  const availableMemberships = memberships
    .filter((membership) => membership.store !== null)
    .map((membership) => ({
      store_id: membership.store_id,
      role: membership.role,
      store: membership.store as Store,
    }));

  if (!isSuperAdmin) return availableMemberships;

  const { data: stores, error: storesError } = await supabase
    .from("stores")
    .select("*")
    .eq("status", "active")
    .order("name", { ascending: true });
  if (storesError) throw storesError;

  return (stores || []).map((store) => ({
    store_id: store.id,
    role: "super_admin",
    store: toStore(store),
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
  const saved = savedId ? memberships.find((m) => m.store_id === savedId) : undefined;

  const first = memberships[0];
  if (!first) return { store: null, memberships };

  return { store: (saved || first).store, memberships };
};
