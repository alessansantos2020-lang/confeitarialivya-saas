import { STORE_SLUG, supabase } from "./supabase";

export type StoreInfo = {
  id: string;
  name: string;
  slug: string;
  status: string;
};

export type StoreSettings = {
  name: string;
  description: string | null;
  logo_url: string | null;
  cover_url: string | null;
  opening_hours: string | null;
  is_open: boolean | null;
  phone: string | null;
  whatsapp: string | null;
  instagram: string | null;
  address: string | null;
  primary_color: string | null;
  secondary_color: string | null;
};

export type CatalogProduct = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  effective_price: number;
  image_url: string | null;
  is_available: boolean | null;
  is_featured: boolean | null;
  category_id: string;
  addons: Array<{ group: AddonGroup }>;
};

export type AddonGroup = {
  id: string;
  name: string;
  min_quantity: number;
  max_quantity: number;
  is_required: boolean;
  items: Array<{ id: string; name: string; price: number }>;
};

export type CatalogCategory = {
  id: string;
  name: string;
  sort_order: number;
  products: CatalogProduct[];
};

export type DeliveryFee = { neighborhood: string; fee: number };

export type PaymentMethods = {
  accept_cash: boolean;
  accept_card_delivery: boolean;
  accept_manual_pix: boolean;
  manual_pix_key: string | null;
  online_pix_available?: boolean;
  online_card_available?: boolean;
};

export async function fetchStore(): Promise<{ store: StoreInfo; settings: StoreSettings } | null> {
  const { data, error } = await supabase
    .rpc("get_public_store_by_slug", { _slug: STORE_SLUG })
    .maybeSingle();
  if (error || !data?.store) return null;
  return data;
}

export async function fetchCatalog(): Promise<CatalogCategory[]> {
  const { data, error } = await supabase.rpc("get_public_catalog", {
    _store_id: (await getStoreId()) || "",
  });
  if (error || !Array.isArray(data)) return [];
  return data;
}

let cachedStoreId: string | null = null;
export async function getStoreId(): Promise<string | null> {
  if (cachedStoreId) return cachedStoreId;
  const store = await fetchStore();
  cachedStoreId = store?.store.id ?? null;
  return cachedStoreId;
}

export async function fetchDeliveryFees(): Promise<DeliveryFee[]> {
  const storeId = await getStoreId();
  if (!storeId) return [];
  const { data, error } = await supabase.rpc("get_public_delivery_fees", { _store_id: storeId });
  if (error || !Array.isArray(data)) return [];
  return data;
}

export async function fetchPaymentMethods(): Promise<PaymentMethods | null> {
  const storeId = await getStoreId();
  if (!storeId) return null;
  const { data } = await supabase.rpc("get_public_store_payment_methods", { _store_id: storeId });
  return (data as PaymentMethods) ?? null;
}

export type CreateOrderInput = {
  customer_name: string;
  customer_phone: string;
  address: string;
  neighborhood: string;
  street: string;
  number: string;
  complement?: string | null;
  reference?: string | null;
  payment_method: "pix" | "money" | "card";
  change_for?: number | null;
  observation?: string | null;
  items: Array<{
    product_id: string;
    quantity: number;
    observation?: string | null;
    selected_addons?: Array<{ id: string }> | null;
  }>;
};

export async function createOrder(input: CreateOrderInput) {
  const storeId = await getStoreId();
  if (!storeId) throw new Error("Loja não encontrada.");
  const { data, error } = await supabase.rpc("create_order", {
    _payload: { store_id: storeId, ...input },
  });
  if (error) throw new Error(friendlyError(error.message));
  return data;
}

function friendlyError(message: string): string {
  if (message.includes("Loja fechada")) return "A loja está fechada no momento.";
  if (message.includes("Bairro não atende")) return "Não entregamos nesse bairro.";
  if (message.includes("troco")) return message;
  if (message.includes("indisponível")) return "A loja está indisponível.";
  return message;
}
