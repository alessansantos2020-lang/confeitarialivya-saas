import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "./audit.functions";

export type UserStatus = "active" | "blocked";

export type SystemUserStore = {
  id: string;
  name: string;
  role: string;
};

export type SystemUser = {
  id: string;
  email: string | null;
  full_name: string | null;
  status: string;
  role: string | null;
  last_sign_in_at: string | null;
  created_at: string | null;
  stores: SystemUserStore[];
};

/**
 * Contas do sistema com e-mail e último acesso. Esses dois campos moram em
 * `auth.users`, que a API não expõe — por isso vem da função
 * `public.super_admin_users`, que checa o papel antes de responder.
 */
export const getSystemUsers = async (): Promise<SystemUser[]> => {
  const { data, error } = await supabase.rpc("super_admin_users");
  if (error) throw error;

  return (data || []).map((u) => ({
    id: u.id,
    email: u.email,
    full_name: u.full_name,
    status: u.status,
    role: u.role,
    last_sign_in_at: u.last_sign_in_at,
    created_at: u.created_at,
    stores: Array.isArray(u.stores) ? (u.stores as SystemUserStore[]) : [],
  }));
};

/**
 * Bloquear corta o acesso no banco (as funções de RLS consultam o status), não
 * só na tela. Nada é apagado: pedidos e logs continuam ligados à conta.
 */
export const setUserStatus = async (userId: string, status: UserStatus): Promise<void> => {
  const { error } = await supabase.from("profiles").update({ status }).eq("id", userId);
  if (error) throw error;

  await logAudit({
    action: status === "blocked" ? "user_blocked" : "user_activated",
    module: "usuarios",
    description: `Conta ${userId} ${status === "blocked" ? "bloqueada" : "ativada"}`,
  });
};

export const renameUser = async (userId: string, fullName: string): Promise<void> => {
  const name = fullName.trim();
  if (!name) throw new Error("Informe o nome do usuário.");

  const { error } = await supabase.from("profiles").update({ full_name: name }).eq("id", userId);
  if (error) throw error;

  await logAudit({
    action: "user_renamed",
    module: "usuarios",
    description: `Conta ${userId} renomeada para "${name}"`,
  });
};
