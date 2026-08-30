import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const employeeSchema = z.object({
  fullName: z.string().min(3),
  email: z.string().email(),
  phone: z.string().optional(),
  password: z.string().min(6),
  role: z.enum(['admin', 'employee']),
  permissions: z.array(z.string())
});

export const createEmployee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => employeeSchema.parse(data))
  .handler(async ({ context, data }) => {
    // 1. Verificar se quem chama é admin
    const { data: callerRole } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();

    if (!callerRole) {
      return { success: false as const, error: "Apenas administradores podem cadastrar funcionários." };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 2. Criar usuário no Auth usando supabaseAdmin
    const { data: newUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: {
        full_name: data.fullName,
      }
    });

    if (authError) {
      console.error("Auth creation error:", authError);
      const alreadyExists =
        authError.status === 422 ||
        /already been registered|already registered|already exists/i.test(authError.message);
      return {
        success: false as const,
        error: alreadyExists
          ? "Este e-mail já está cadastrado. Use outro e-mail ou gerencie o usuário existente na lista."
          : authError.message,
      };
    }

    if (!newUser.user) {
      return { success: false as const, error: "Não foi possível criar a conta do funcionário." };
    }

    // 3. Garantir perfil com status pending
    await supabaseAdmin
      .from('profiles')
      .upsert({ 
        id: newUser.user.id, 
        full_name: data.fullName, 
        status: 'pending' 
      });
    
    // Atualizar role
    const { error: roleError } = await supabaseAdmin
      .from('user_roles')
      .upsert({ user_id: newUser.user.id, role: data.role }, { onConflict: 'user_id,role' });

    if (roleError) console.error("Role update error:", roleError);

    // Adicionar permissões
    if (data.permissions.length > 0) {
      const permsToInsert = data.permissions.map(p => ({
        user_id: newUser.user.id,
        permission_id: p
      }));
      await supabaseAdmin.from('user_permissions').insert(permsToInsert);
    }

    return { success: true as const, userId: newUser.user.id };
  });

export const approveEmployee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string() }).parse(data))
  .handler(async ({ context, data }) => {
    const { data: roleData } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      throw new Error("Unauthorized: Only admins can approve employees");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from('profiles')
      .update({ status: 'active' } as any)
      .eq('id', data.id);

    if (!error) {
      await supabaseAdmin
        .from('user_roles')
        .upsert({ user_id: data.id, role: 'employee' } as any);
    }

    if (error) {
      console.error("RPC Error:", error);
      throw error;
    }

    return { success: true };
  });

export const rejectEmployee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string() }).parse(data))
  .handler(async ({ context, data }) => {
    const { data: roleData } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      throw new Error("Unauthorized: Only admins can reject employees");
    }

    const { error } = await context.supabase
      .from("profiles")
      .update({ status: 'blocked' })
      .eq("id", data.id);

    if (error) throw error;

    return { success: true };
  });

export const deleteEmployee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string() }).parse(data))
  .handler(async ({ context, data }) => {
    const { data: roleData } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      throw new Error("Unauthorized: Only admins can delete employees");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    
    // Delete from Auth
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(data.id);
    
    if (authError) {
      console.error("Auth Delete Error:", authError);
    }

    // Clean up public tables
    await supabaseAdmin.from('profiles').delete().eq('id', data.id);
    await supabaseAdmin.from('user_roles').delete().eq('user_id', data.id);
    await supabaseAdmin.from('user_permissions').delete().eq('user_id', data.id);

    return { success: true };
  });