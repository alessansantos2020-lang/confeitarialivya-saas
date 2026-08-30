// Verificação de permissão feita diretamente nas tabelas, já que as funções
// has_role/has_permission foram movidas para o schema privado (fora da API).
export async function assertPermission(supabase: any, userId: string, permissionId: string) {
  const { data: roleData } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();

  if (roleData?.role === "admin") return;

  const { data: perm, error } = await supabase
    .from("user_permissions")
    .select("permission_id")
    .eq("user_id", userId)
    .eq("permission_id", permissionId)
    .maybeSingle();

  if (error) throw error;
  if (!perm) throw new Error("Sem permissão para esta ação.");
}
