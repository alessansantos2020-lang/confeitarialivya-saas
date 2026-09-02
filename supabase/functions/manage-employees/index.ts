import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function makeFetch(key: string): typeof fetch {
  const opaque = key.startsWith("sb_secret_") || key.startsWith("sb_publishable_");
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
    );
    if (init?.headers) new Headers(init.headers).forEach((v, k) => headers.set(k, v));
    if (opaque && headers.get("Authorization") === `Bearer ${key}`) headers.delete("Authorization");
    headers.set("apikey", key);
    return fetch(input, { ...init, headers });
  };
}

type Payload = {
  action: "create" | "approve" | "reject" | "delete";
  id?: string;
  fullName?: string;
  email?: string;
  phone?: string;
  password?: string;
  role?: "admin" | "employee";
  permissions?: string[];
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ success: false, error: "Método não permitido." }, 405);

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || serviceKey;
  if (!url || !serviceKey) return json({ success: false, error: "Função mal configurada." }, 500);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return json({ success: false, error: "Não autorizado." }, 401);
  }
  const token = authHeader.replace("Bearer ", "");

  const userClient = createClient(url, anonKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: { Authorization: `Bearer ${token}` },
      fetch: makeFetch(anonKey!),
    },
  });

  const { data: { user }, error: userError } = await userClient.auth.getUser(token);
  if (userError || !user) return json({ success: false, error: "Sessão inválida." }, 401);

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: makeFetch(serviceKey) },
  });

  // Somente admin pode gerenciar funcionários
  const { data: callerRole } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "admin")
    .maybeSingle();

  if (!callerRole) {
    return json({ success: false, error: "Apenas administradores podem gerenciar funcionários." }, 403);
  }

  let body: Payload;
  try {
    body = await req.json();
  } catch {
    return json({ success: false, error: "JSON inválido." }, 400);
  }

  switch (body.action) {
    case "create": {
      if (!body.email || !body.password || !body.fullName) {
        return json({ success: false, error: "Nome, e-mail e senha são obrigatórios." }, 400);
      }
      if (body.password.length < 6) {
        return json({ success: false, error: "Senha deve ter no mínimo 6 caracteres." }, 400);
      }

      const { data: newUser, error: authErr } = await admin.auth.admin.createUser({
        email: body.email,
        password: body.password,
        email_confirm: true,
        user_metadata: { full_name: body.fullName, phone: body.phone || null },
      });

      if (authErr) {
        const already = authErr.status === 422 || /already/i.test(authErr.message);
        return json({
          success: false,
          error: already ? "Este e-mail já está cadastrado." : authErr.message,
        }, 400);
      }
      if (!newUser?.user) return json({ success: false, error: "Falha ao criar conta." }, 500);

      const userId = newUser.user.id;
      await admin.from("profiles").upsert({
        id: userId,
        full_name: body.fullName,
        status: "pending",
      });

      const role = body.role === "admin" ? "admin" : "employee";
      await admin.from("user_roles").upsert({ user_id: userId, role }, { onConflict: "user_id,role" });

      if (Array.isArray(body.permissions) && body.permissions.length > 0) {
        const rows = body.permissions.map((p) => ({ user_id: userId, permission_id: p }));
        await admin.from("user_permissions").insert(rows);
      }

      return json({ success: true, userId });
    }

    case "approve": {
      if (!body.id) return json({ success: false, error: "ID obrigatório." }, 400);
      const { error: pErr } = await admin.from("profiles").update({ status: "active" }).eq("id", body.id);
      if (pErr) return json({ success: false, error: pErr.message }, 500);
      await admin.from("user_roles").upsert({ user_id: body.id, role: "employee" });
      return json({ success: true });
    }

    case "reject": {
      if (!body.id) return json({ success: false, error: "ID obrigatório." }, 400);
      const { error: pErr } = await admin.from("profiles").update({ status: "blocked" }).eq("id", body.id);
      if (pErr) return json({ success: false, error: pErr.message }, 500);
      return json({ success: true });
    }

    case "delete": {
      if (!body.id) return json({ success: false, error: "ID obrigatório." }, 400);
      await admin.auth.admin.deleteUser(body.id);
      await admin.from("profiles").delete().eq("id", body.id);
      await admin.from("user_roles").delete().eq("user_id", body.id);
      await admin.from("user_permissions").delete().eq("user_id", body.id);
      return json({ success: true });
    }

    default:
      return json({ success: false, error: "Ação desconhecida." }, 400);
  }
});
