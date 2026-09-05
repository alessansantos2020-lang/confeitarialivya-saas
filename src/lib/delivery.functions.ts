import { supabase } from "@/integrations/supabase/client";

export const DEFAULT_STORE_ID = "00000000-0000-0000-0000-000000000001";
export const DEFAULT_STORE_SLUG = "confeitaria-livya";

export type Store = {
  id: string;
  name: string;
  slug: string;
  owner_id: string | null;
  status: "active" | "inactive" | "suspended";
  created_at: string;
};

export type StoreSettings = {
  store_id?: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  cover_url: string | null;
  opening_hours: string | null;
  is_open: boolean;
  phone: string | null;
  whatsapp: string | null;
  instagram: string | null;
  address: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  auto_notify_whatsapp: boolean;
  whatsapp_template_recebido: string | null;
  whatsapp_template_saida_entrega: string | null;
};

export type StoreData = {
  store: Store;
  settings: StoreSettings;
};

const defaultSettings = (name = "Minha Loja", store_id = DEFAULT_STORE_ID): StoreSettings => ({
  store_id,
  name,
  description: "Produtos selecionados, entrega rápida.",
  logo_url: null,
  cover_url: null,
  opening_hours: "Segunda a Sábado: 09:00 - 18:00",
  is_open: true,
  phone: null,
  whatsapp: null,
  instagram: null,
  address: null,
  primary_color: "#1d4ed8",
  secondary_color: "#eff6ff",
  auto_notify_whatsapp: false,
  whatsapp_template_recebido: null,
  whatsapp_template_saida_entrega: null,
});

/**
 * Busca uma loja pelo seu slug (ex: "confeitaria-livya") e suas configurações.
 * Retorna null se a loja não existir ou não estiver ativa.
 */
export const getStoreBySlug = async (slug: string): Promise<StoreData | null> => {
  const cleanSlug = (slug || "").trim().toLowerCase();
  if (!cleanSlug) return null;

  const { data: store, error: storeError } = await supabase
    .from("stores")
    .select("*")
    .eq("slug", cleanSlug)
    .eq("status", "active")
    .maybeSingle();

  if (storeError || !store) return null;

  const { data: settings } = await supabase
    .from("store_settings")
    .select("*")
    .eq("store_id", store.id)
    .maybeSingle();

  return {
    store: store as Store,
    settings: settings
      ? {
          store_id: store.id,
          name: settings.name || store.name,
          description: settings.description,
          logo_url: settings.logo_url,
          cover_url: settings.cover_url,
          opening_hours: settings.opening_hours,
          is_open: settings.is_open ?? true,
          phone: settings.phone,
          whatsapp: settings.whatsapp,
          instagram: settings.instagram,
          address: settings.address,
          primary_color: settings.primary_color || "#1d4ed8",
          secondary_color: settings.secondary_color || "#eff6ff",
          auto_notify_whatsapp: settings.auto_notify_whatsapp ?? false,
          whatsapp_template_recebido: (settings as any).whatsapp_template_recebido,
          whatsapp_template_saida_entrega: (settings as any).whatsapp_template_saida_entrega,
        }
      : defaultSettings(store.name, store.id),
  };
};

/**
 * Busca as configurações de uma loja pelo seu store_id.
 * Se store_id for omitido, usa a loja padrão (retrocompatibilidade).
 */
export const getStoreSettings = async (storeId: string = DEFAULT_STORE_ID): Promise<StoreSettings> => {
  const { data, error } = await supabase
    .from("store_settings")
    .select("*")
    .eq("store_id", storeId)
    .maybeSingle();

  if (error || !data) {
    return defaultSettings("Minha Loja", storeId);
  }

  return {
    store_id: data.store_id || storeId,
    name: data.name,
    description: data.description,
    logo_url: data.logo_url,
    cover_url: data.cover_url,
    opening_hours: data.opening_hours,
    is_open: data.is_open ?? true,
    phone: data.phone,
    whatsapp: data.whatsapp,
    instagram: data.instagram,
    address: data.address,
    primary_color: data.primary_color,
    secondary_color: data.secondary_color,
    auto_notify_whatsapp: data.auto_notify_whatsapp ?? false,
    whatsapp_template_recebido: (data as any).whatsapp_template_recebido,
    whatsapp_template_saida_entrega: (data as any).whatsapp_template_saida_entrega,
  };
};

/**
 * Busca categorias ativas e seus produtos vinculados a uma loja específica.
 *
 * `effective_price` é coluna calculada pelo banco: já vem com o preço
 * promocional quando a promoção está valendo (e com o preço normal quando não
 * está). Nunca calculamos isso aqui — é o mesmo valor que o pedido vai cobrar.
 *
 * Os apelidos `addons`, `group` e `items` no select existem porque a tela do
 * cliente já espera esse formato: `product.addons[].group.items[]`.
 */
export const getCategoriesWithProducts = async (storeId: string = DEFAULT_STORE_ID) => {
  const { data: categories, error: catError } = await supabase
    .from("categories")
    .select("*")
    .eq("store_id", storeId)
    .eq("status", "active")
    .order("sort_order", { ascending: true });

  if (catError) throw catError;

  const { data: products, error: prodError } = await supabase
    .from("products")
    .select(
      "*, effective_price, category:categories(name), " +
        "addons:product_addon_groups(group:addon_groups(id,name,min_quantity,max_quantity,is_required,status,items:addons(id,name,price,status)))",
    )
    .eq("store_id", storeId)
    .eq("is_available", true);

  if (prodError) throw prodError;

  return (categories || []).map((category) => ({
    ...category,
    products: (products || []).filter((p) => p.category_id === category.id),
  }));
};
