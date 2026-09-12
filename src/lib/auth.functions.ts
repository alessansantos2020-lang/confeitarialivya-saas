import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

type UserRoleRow = Pick<Tables<"user_roles">, "role">;
type UserPermissionRow = Pick<Tables<"user_permissions">, "permission_id">;

// Convertido para SPA: essas funções eram serverFn com o middleware
// requireSupabaseAuth. Agora rodam no cliente e obtêm o userId diretamente
// da sessão do Supabase; RLS continua garantindo a segurança dos dados.

async function getCurrentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

export const getUserRole = async () => {
  const userId = await getCurrentUserId();
  if (!userId) return null;

  const { data: roleData } = await supabase.from("user_roles").select("role").eq("user_id", userId);

  const roles = new Set((roleData as UserRoleRow[] | null)?.map((row) => row.role) || []);
  if (roles.has("super_admin")) return "super_admin";
  if (roles.has("admin")) return "admin";
  if (roles.has("employee")) return "employee";
  return roles.has("user") ? "user" : null;
};

export const checkPermission = async (permissionId: string) => {
  const userId = await getCurrentUserId();
  if (!userId) return false;

  // A função has_permission foi movida para o schema privado (fora da API),
  // então a verificação é feita consultando as tabelas diretamente.
  const { data: roleData } = await supabase.from("user_roles").select("role").eq("user_id", userId);

  if (roleData?.some((row) => row.role === "admin" || row.role === "super_admin")) return true;

  const { data: perm, error } = await supabase
    .from("user_permissions")
    .select("permission_id")
    .eq("user_id", userId)
    .eq("permission_id", permissionId)
    .maybeSingle();

  if (error) {
    console.error("Erro ao verificar permissão:", error);
    return false;
  }

  return !!perm;
};

export const getMyPermissions = async (): Promise<string[]> => {
  const userId = await getCurrentUserId();
  if (!userId) return [];

  const { data: roleData } = await supabase.from("user_roles").select("role").eq("user_id", userId);

  // Se for admin ou super_admin, retorna "all" (acesso total)
  if (roleData?.some((row) => row.role === "admin" || row.role === "super_admin")) {
    return ["all"];
  }

  const { data: permissions } = await supabase
    .from("user_permissions")
    .select("permission_id")
    .eq("user_id", userId);

  return permissions?.map((p) => p.permission_id) || [];
};
