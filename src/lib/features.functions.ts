import { supabase } from "@/integrations/supabase/client";

/**
 * Funcionalidades do sistema. O id é o mesmo do catálogo `features` no banco,
 * que é a única fonte de verdade sobre o que cada plano libera.
 */
export type FeatureId =
  | "dashboard"
  | "orders"
  | "products"
  | "categories"
  | "promotions"
  | "addons"
  | "customers"
  | "delivery"
  | "reports"
  | "settings"
  | "order_hub";

export const FEATURE_LABEL: Record<FeatureId, string> = {
  dashboard: "Painel Geral",
  orders: "Pedidos",
  products: "Produtos",
  categories: "Categorias",
  promotions: "Promoções de Produtos",
  addons: "Adicionais",
  customers: "Clientes",
  delivery: "Taxas de Entrega",
  reports: "Relatórios",
  settings: "Configurações",
  order_hub: "Central de Pedidos",
};

/**
 * Funcionalidades liberadas para a loja, resolvidas pelo banco
 * (`private.store_has_feature` via RPC `my_store_features`).
 *
 * Loja sem plano definido recebe tudo — é o estado das lojas que já existiam
 * antes dos planos, e trocar isso cortaria acesso sem aviso.
 */
export const getStoreFeatures = async (storeId: string): Promise<FeatureId[]> => {
  const { data, error } = await supabase.rpc("my_store_features", { _store_id: storeId });
  if (error) throw error;
  return (data || []) as FeatureId[];
};
