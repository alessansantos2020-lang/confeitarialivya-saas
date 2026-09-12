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
  whatsapp_accept_enabled: boolean;
  whatsapp_cancel_enabled: boolean;
  whatsapp_shipping_enabled: boolean;
  whatsapp_template_aceito: string | null;
  whatsapp_template_cancelado: string | null;
  whatsapp_template_recebido: string | null;
  whatsapp_template_saida_entrega: string | null;
};

export type StoreData = {
  store: Store;
  settings: StoreSettings;
};

type PublicStoreResponse = {
  store: Store;
  settings: StoreSettings;
};

type PublicCatalogProduct = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  effective_price: number;
  image_url: string | null;
  is_available: boolean | null;
  is_featured: boolean | null;
  is_on_sale: boolean;
  sale_price: number | null;
  sale_start_at: string | null;
  sale_end_at: string | null;
  category_id: string;
  addons: Array<{
    group: {
      id: string;
      name: string;
      min_quantity: number;
      max_quantity: number;
      is_required: boolean;
      status: string;
      items: Array<{ id: string; name: string; price: number; status: string }>;
    };
  }>;
};

type PublicCatalogCategory = {
  id: string;
  name: string;
  image_url: string | null;
  sort_order: number;
  status: string;
  products: PublicCatalogProduct[];
};

export type PublicDeliveryFee = {
  neighborhood: string;
  fee: number;
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
  whatsapp_accept_enabled: true,
  whatsapp_cancel_enabled: true,
  whatsapp_shipping_enabled: true,
  whatsapp_template_aceito: null,
  whatsapp_template_cancelado: null,
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

  const { data, error } = await supabase.rpc("get_public_store_by_slug", {
    _slug: cleanSlug,
  });

  if (error || !data || typeof data !== "object" || Array.isArray(data)) return null;
  return data as unknown as PublicStoreResponse;
};

export const getPublicStoreSettings = async (
  storeId: string = DEFAULT_STORE_ID,
): Promise<StoreSettings> => {
  const { data, error } = await supabase.rpc("get_public_store", {
    _store_id: storeId,
  });

  if (error || !data || typeof data !== "object" || Array.isArray(data)) {
    return defaultSettings("Minha Loja", storeId);
  }

  const response = data as unknown as PublicStoreResponse;
  return response.settings;
};

/**
 * Busca as configurações de uma loja pelo seu store_id.
 * Se store_id for omitido, usa a loja padrão (retrocompatibilidade).
 */
export const getStoreSettings = async (
  storeId: string = DEFAULT_STORE_ID,
): Promise<StoreSettings> => {
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
    whatsapp_accept_enabled: (data as any).whatsapp_accept_enabled ?? true,
    whatsapp_cancel_enabled: (data as any).whatsapp_cancel_enabled ?? true,
    whatsapp_shipping_enabled: (data as any).whatsapp_shipping_enabled ?? true,
    whatsapp_template_aceito: (data as any).whatsapp_template_aceito,
    whatsapp_template_cancelado: (data as any).whatsapp_template_cancelado,
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
export const getCategoriesWithProducts = async (
  storeId: string = DEFAULT_STORE_ID,
): Promise<PublicCatalogCategory[]> => {
  const { data, error } = await supabase.rpc("get_public_catalog", {
    _store_id: storeId,
  });

  if (error) throw error;
  return Array.isArray(data) ? (data as unknown as PublicCatalogCategory[]) : [];
};
