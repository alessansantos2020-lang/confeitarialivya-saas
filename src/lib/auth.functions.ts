import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// Estas funções ficavam quebradas antes: usavam o cliente anônimo do browser
// dentro de um handler de servidor, que nunca tem sessão anexada (auth.getUser()
// sempre retornava null). Agora usam o middleware requireSupabaseAuth, que lê o
// Bearer token enviado pelo cliente (attachSupabaseAuth) e cria um client Supabase
// autenticado como o usuário que fez a chamada.

export const getUserRole = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: roleData } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .maybeSingle();

    return roleData?.role || null;
  });

export const checkPermission = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.string().parse(data))
  .handler(async ({ context, data: permissionId }) => {
    // A função has_permission foi movida para o schema privado (fora da API),
    // então a verificação é feita consultando as tabelas diretamente com o
    // client autenticado do usuário.
    const { data: roleData } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .maybeSingle();

    if (roleData?.role === "admin") return true;

    const { data: perm, error } = await context.supabase
      .from("user_permissions")
      .select("permission_id")
      .eq("user_id", context.userId)
      .eq("permission_id", permissionId)
      .maybeSingle();

    if (error) {
      console.error("Erro ao verificar permissão:", error);
      return false;
    }

    return !!perm;
  });

export const getMyPermissions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: roleData } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .maybeSingle();

    // Se for admin, retorna "all" (acesso total)
    if (roleData?.role === "admin") {
      return ["all"];
    }

    const { data: permissions } = await context.supabase
      .from("user_permissions")
      .select("permission_id")
      .eq("user_id", context.userId);

    return permissions?.map((p) => p.permission_id) || [];
  });
