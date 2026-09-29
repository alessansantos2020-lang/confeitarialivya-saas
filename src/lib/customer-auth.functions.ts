import { supabase } from "@/integrations/supabase/client";

// ---------------------------------------------------------------------------
// Conta do CLIENTE (vitrine). Separada do login de equipe (/auth):
// nenhum papel/permissão de staff é concedido aqui.
// ---------------------------------------------------------------------------

export type CustomerSession = {
  userId: string;
  email: string;
  name: string;
  phone: string;
  avatarUrl: string | null;
};

const CUSTOMER_PHONE_KEY = "phone";

export const getCustomerSession = async (): Promise<CustomerSession | null> => {
  const { data } = await supabase.auth.getSession();
  const user = data.session?.user;
  if (!user) return null;

  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  return {
    userId: user.id,
    email: user.email ?? "",
    name:
      (typeof meta["full_name"] === "string" ? meta["full_name"] : undefined) ||
      (typeof meta["name"] === "string" ? meta["name"] : undefined) ||
      (user.email ? user.email.split("@")[0] : undefined) ||
      "Cliente",
    phone: typeof meta[CUSTOMER_PHONE_KEY] === "string" ? (meta[CUSTOMER_PHONE_KEY] as string) : "",
    avatarUrl: typeof meta["avatar_url"] === "string" ? (meta["avatar_url"] as string) : null,
  };
};

export const onCustomerAuthChange = (
  callback: (session: CustomerSession | null) => void,
): (() => void) => {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    const user = session?.user;
    if (!user) {
      callback(null);
      return;
    }
    const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
    callback({
      userId: user.id,
      email: user.email ?? "",
      name:
        (typeof meta["full_name"] === "string" ? meta["full_name"] : undefined) ||
        (typeof meta["name"] === "string" ? meta["name"] : undefined) ||
        (user.email ? user.email.split("@")[0] : undefined) ||
        "Cliente",
      phone:
        typeof meta[CUSTOMER_PHONE_KEY] === "string" ? (meta[CUSTOMER_PHONE_KEY] as string) : "",
      avatarUrl: typeof meta["avatar_url"] === "string" ? (meta["avatar_url"] as string) : null,
    });
  });

  return () => data.subscription.unsubscribe();
};

export const signInCustomer = async (email: string, password: string): Promise<void> => {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    if (
      error.message === "Invalid login credentials" ||
      error.message.includes("Email not confirmed")
    ) {
      throw new Error("E-mail ou senha incorretos.");
    }
    if (error.status === 429) {
      throw new Error("Muitas tentativas. Tente novamente mais tarde.");
    }
    throw new Error("Não foi possível entrar. Tente novamente.");
  }
};

export const signUpCustomer = async (
  email: string,
  password: string,
  name: string,
  phone: string,
): Promise<void> => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: name,
        [CUSTOMER_PHONE_KEY]: phone,
        role: "customer",
      },
    },
  });
  if (error) {
    if (error.message.includes("already registered")) {
      throw new Error("Este e-mail já possui conta. Faça login.");
    }
    if (error.message.includes("Password")) {
      throw new Error("A senha deve ter pelo menos 6 caracteres.");
    }
    throw new Error("Não foi possível criar a conta. Tente novamente.");
  }
  // Confirmação de e-mail desativada: já nasce logado.
  if (data.user && !data.session) {
    throw new Error("Conta criada! Confirme seu e-mail para entrar.");
  }
};

export const updateCustomerProfile = async (updates: {
  name?: string;
  phone?: string;
}): Promise<void> => {
  const { error } = await supabase.auth.updateUser({
    data: {
      full_name: updates.name,
      [CUSTOMER_PHONE_KEY]: updates.phone,
    },
  });
  if (error) throw new Error("Não foi possível salvar os dados.");
};

export const signOutCustomer = async (): Promise<void> => {
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error("Não foi possível sair. Tente novamente.");
};
