import { supabase } from "@/integrations/supabase/client";
import type { Store } from "./delivery.functions";

export type StoreStatus = "active" | "inactive" | "suspended";

export type StoreOverview = Store & {
  status: StoreStatus;
  memberCount: number;
  ownerName: string | null;
  settingsName: string | null;
};

export type AssignableUser = {
  id: string;
  full_name: string | null;
  status: string | null;
  role: string | null;
};

export const slugify = (value: string): string =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

export const getAllStores = async (): Promise<StoreOverview[]> => {
  const [storesRes, membersRes, profilesRes, settingsRes] = await Promise.all([
    supabase.from("stores").select("*").order("created_at", { ascending: true }),
    supabase.from("store_members").select("store_id, user_id"),
    supabase.from("profiles").select("id, full_name"),
    supabase.from("store_settings").select("store_id, name"),
  ]);

  if (storesRes.error) throw storesRes.error;

  const memberCounts = new Map<string, number>();
  for (const m of membersRes.data || []) {
    memberCounts.set(m.store_id, (memberCounts.get(m.store_id) || 0) + 1);
  }

  const profileNames = new Map<string, string | null>();
  for (const p of profilesRes.data || []) {
    profileNames.set(p.id, p.full_name);
  }

  const settingsNames = new Map<string, string | null>();
  for (const s of settingsRes.data || []) {
    settingsNames.set(s.store_id, s.name);
  }

  return (storesRes.data || []).map((store) => ({
    ...(store as Store),
    status: store.status as StoreStatus,
    memberCount: memberCounts.get(store.id) || 0,
    ownerName: store.owner_id ? profileNames.get(store.owner_id) ?? null : null,
    settingsName: settingsNames.get(store.id) ?? null,
  }));
};

export const createStore = async (input: { name: string; slug: string }): Promise<Store> => {
  const slug = slugify(input.slug || input.name);
  if (!slug) throw new Error("Informe um endereço (slug) válido para a loja.");

  const { data, error } = await supabase
    .from("stores")
    .insert({ name: input.name.trim(), slug, status: "active" })
    .select()
    .single();

  if (error) {
    if (error.code === "23505" || error.message.includes("duplicate")) {
      throw new Error(`O endereço "${slug}" já está em uso por outra loja.`);
    }
    throw error;
  }

  return data as Store;
};

export const updateStoreStatus = async (storeId: string, status: StoreStatus) => {
  const { error } = await supabase.from("stores").update({ status }).eq("id", storeId);
  if (error) throw error;
};

export const renameStore = async (storeId: string, name: string) => {
  const { error } = await supabase.from("stores").update({ name: name.trim() }).eq("id", storeId);
  if (error) throw error;
};

export const getAssignableUsers = async (): Promise<AssignableUser[]> => {
  const [profilesRes, rolesRes] = await Promise.all([
    supabase.from("profiles").select("id, full_name, status").order("full_name"),
    supabase.from("user_roles").select("user_id, role"),
  ]);

  if (profilesRes.error) throw profilesRes.error;

  const roles = new Map<string, string>();
  for (const r of rolesRes.data || []) {
    roles.set(r.user_id, r.role);
  }

  return (profilesRes.data || []).map((p) => ({
    id: p.id,
    full_name: p.full_name,
    status: p.status,
    role: roles.get(p.id) ?? null,
  }));
};

/**
 * Torna um usuário o dono/administrador da loja: grava owner_id na loja,
 * cria o vínculo em store_members e garante o papel global 'admin'
 * (exigido pelo guard do /admin).
 */
export const assignStoreOwner = async (storeId: string, userId: string) => {
  const { error: storeError } = await supabase
    .from("stores")
    .update({ owner_id: userId })
    .eq("id", storeId);
  if (storeError) throw storeError;

  const { error: memberError } = await supabase
    .from("store_members")
    .upsert({ store_id: storeId, user_id: userId, role: "admin" }, { onConflict: "store_id,user_id" });
  if (memberError) throw memberError;

  const { data: existingRole } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();

  if (!existingRole) {
    const { error: roleError } = await supabase
      .from("user_roles")
      .insert({ user_id: userId, role: "admin" });
    if (roleError) throw roleError;
  }
};
