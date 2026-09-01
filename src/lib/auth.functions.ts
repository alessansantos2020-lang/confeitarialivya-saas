import { supabase } from "@/integrations/supabase/client";

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

  const { data: roleData } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();

  return roleData?.role || null;
};

export const checkPermission = async (permissionId: string) => {
  const userId = await getCurrentUserId();
  if (!userId) return false;

  // A função has_permission foi movida para o schema privado (fora da API),
  // então a verificação é feita consultando as tabelas diretamente.
  const { data: roleData } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();

  if (roleData?.role === "admin") return true;

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

  const { data: roleData } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();

  // Se for admin, retorna "all" (acesso total)
  if (roleData?.role === "admin") {
    return ["all"];
  }

  const { data: permissions } = await supabase
    .from("user_permissions")
    .select("permission_id")
    .eq("user_id", userId);

  return permissions?.map((p) => p.permission_id) || [];
};
