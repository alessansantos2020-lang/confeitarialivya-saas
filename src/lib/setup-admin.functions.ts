import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// SEGURANÇA: antes esta função tinha um e-mail e senha fixos no código-fonte
// e podia ser chamada por qualquer visitante, a qualquer momento, para
// (re)criar a conta admin — um backdoor permanente. Agora:
// 1. As credenciais vêm de variáveis de ambiente do servidor (nunca do bundle do cliente).
// 2. A função só funciona enquanto NENHUM admin existir ainda (bootstrap único).
//    Depois que o primeiro admin é criado, chamadas seguintes são recusadas.
// Configure ADMIN_SETUP_EMAIL e ADMIN_SETUP_PASSWORD no ambiente do servidor
// apenas durante a configuração inicial; pode removê-las depois.
export const ensureAdminUser = createServerFn({ method: "POST" }).handler(async () => {
  const email = process.env["ADMIN_SETUP_EMAIL"];
  const password = process.env["ADMIN_SETUP_PASSWORD"];

  if (!email || !password) {
    return {
      success: false,
      error:
        "Setup inicial não configurado. Defina ADMIN_SETUP_EMAIL e ADMIN_SETUP_PASSWORD nas variáveis de ambiente do servidor.",
    };
  }

  try {
    // Só permite bootstrap se ainda não existir NENHUM admin no sistema.
    const { count, error: countError } = await supabaseAdmin
      .from("user_roles")
      .select("*", { count: "exact", head: true })
      .eq("role", "admin");

    if (countError) throw countError;

    if ((count ?? 0) > 0) {
      return {
        success: false,
        error:
          "Já existe um administrador configurado. Peça a um admin existente para criar novas contas em Configurações > Equipe.",
      };
    }

    // 1. Criar o usuário na Auth do Supabase
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: "Administrador Geral" },
    });

    let userId = authData?.user?.id;

    if (authError) {
      if (authError.message.includes("already registered")) {
        const { data: listData, error: listError } = await supabaseAdmin.auth.admin.listUsers();
        if (listError) throw listError;
        const existingUser = listData.users.find((u) => u.email === email);
        userId = existingUser?.id;
      } else {
        throw authError;
      }
    }

    if (!userId) throw new Error("Não foi possível obter o ID do usuário.");

    // 2. Garantir que o perfil existe
    await supabaseAdmin.from("profiles").upsert({ id: userId, full_name: "Administrador Geral", status: "active" });

    // 3. Atribuir role de admin
    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: userId, role: "admin" }, { onConflict: "user_id,role" });

    if (roleError) throw roleError;

    return { success: true, message: "Admin configurado com sucesso." };
  } catch (error: any) {
    console.error("Erro ao configurar admin:", error);
    return { success: false, error: error.message };
  }
});
