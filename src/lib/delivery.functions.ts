import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export const DEFAULT_STORE_ID = "00000000-0000-0000-0000-000000000001";
export const DEFAULT_STORE_SLUG = "confeitaria-livya";

export type StoreStatus = "active" | "inactive" | "suspended";

export type Store = {
  id: string;
  name: string;
  slug: string;
  owner_id: string | null;
  status: StoreStatus;
  created_at: string;
};

export const isStoreStatus = (value: string): value is StoreStatus =>
  value === "active" || value === "inactive" || value === "suspended";

export const toStore = (store: Tables<"stores">): Store => {
  if (!isStoreStatus(store.status)) throw new Error("Status de loja inválido.");
  return { ...store, status: store.status };
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

export type PublicStoreResponse = StoreData;
export type StoreSettingsRow = Tables<"store_settings">;

const isPublicStoreResponse = (value: unknown): value is PublicStoreResponse => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const response = value as Record<string, unknown>;
  return (
    typeof response["store"] === "object" &&
    response["store"] !== null &&
    typeof response["settings"] === "object" &&
    response["settings"] !== null
  );
};

const toStoreSettings = (data: StoreSettingsRow): StoreSettings => ({
  store_id: data.store_id,
  name: data.name || "Minha Loja",
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
  whatsapp_accept_enabled: data.whatsapp_accept_enabled ?? true,
  whatsapp_cancel_enabled: data.whatsapp_cancel_enabled ?? true,
  whatsapp_shipping_enabled: data.whatsapp_shipping_enabled ?? true,
  whatsapp_template_aceito: data.whatsapp_template_aceito,
  whatsapp_template_cancelado: data.whatsapp_template_cancelado,
  whatsapp_template_recebido: data.whatsapp_template_recebido,
  whatsapp_template_saida_entrega: data.whatsapp_template_saida_entrega,
});

export type PublicCatalogAddon = {
  id: string;
  name: string;
  price: number;
  status: string;
};

export type PublicCatalogAddonGroup = {
  id: string;
  name: string;
  min_quantity: number;
  max_quantity: number;
  is_required: boolean;
  status: string;
  items: PublicCatalogAddon[];
};

export type PublicCatalogProduct = {
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
  addons: Array<{ group: PublicCatalogAddonGroup }>;
};

export type PublicCatalogCategory = {
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

const isPublicCatalog = (value: unknown): value is PublicCatalogCategory[] => Array.isArray(value);

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

export const getStoreBySlug = async (slug: string): Promise<StoreData | null> => {
  const cleanSlug = (slug || "").trim().toLowerCase();
  if (!cleanSlug) return null;

  const { data, error } = await supabase.rpc("get_public_store_by_slug", {
    _slug: cleanSlug,
  });

  if (error || !data || !isPublicStoreResponse(data)) return null;
  return {
    store: toStore(data.store as Tables<"stores">),
    settings: toStoreSettings(data.settings as StoreSettingsRow),
  };
};

export const getPublicStoreSettings = async (
  storeId: string = DEFAULT_STORE_ID,
): Promise<StoreSettings> => {
  const { data, error } = await supabase.rpc("get_public_store", {
    _store_id: storeId,
  });

  if (error) {
    console.error("Falha ao carregar configurações públicas:", error);
    return defaultSettings("Minha Loja", storeId);
  }
  if (!isPublicStoreResponse(data)) return defaultSettings("Minha Loja", storeId);
  return toStoreSettings(data.settings as StoreSettingsRow);
};

export const getStoreSettings = async (
  storeId: string = DEFAULT_STORE_ID,
): Promise<StoreSettings> => {
  const { data, error } = await supabase
    .from("store_settings")
    .select("*")
    .eq("store_id", storeId)
    .maybeSingle();

  if (error) {
    console.error("Falha ao carregar configurações da loja:", error);
    return defaultSettings("Minha Loja", storeId);
  }
  if (!data) return defaultSettings("Minha Loja", storeId);
  return toStoreSettings(data);
};

export const getCategoriesWithProducts = async (
  storeId: string = DEFAULT_STORE_ID,
): Promise<PublicCatalogCategory[]> => {
  const { data, error } = await supabase.rpc("get_public_catalog", {
    _store_id: storeId,
  });

  if (error) throw error;
  return isPublicCatalog(data) ? data : [];
};
