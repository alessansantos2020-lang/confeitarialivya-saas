import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "./audit.functions";

export type PixKeyType = "cpf" | "cnpj" | "phone" | "email" | "random";

export type StorePaymentGateways = {
  id?: string;
  store_id: string;

  // Entrega / Offline
  accept_cash: boolean;
  accept_card_delivery: boolean;
  accept_manual_pix: boolean;
  manual_pix_key: string | null;
  manual_pix_key_type: PixKeyType | null;

  // Mercado Pago
  mp_enabled: boolean;
  mp_public_key: string | null;
  mp_access_token: string | null;
  mp_sandbox: boolean;

  // Asaas
  asaas_enabled: boolean;
  asaas_api_key: string | null;
  asaas_sandbox: boolean;

  // Roteamento
  pix_provider: "manual" | "mercadopago" | "asaas";
  card_provider: "delivery" | "mercadopago" | "asaas";
};

export type PublicStorePaymentMethods = {
  accept_cash: boolean;
  accept_card_delivery: boolean;
  accept_manual_pix: boolean;
  manual_pix_key: string | null;
  manual_pix_key_type: string | null;
  pix_provider: "manual" | "mercadopago" | "asaas";
  card_provider: "delivery" | "mercadopago" | "asaas";
  mp_public_key: string | null;
  mp_enabled: boolean;
  asaas_enabled: boolean;
};

export const DEFAULT_STORE_PAYMENT_GATEWAYS: StorePaymentGateways = {
  store_id: "",
  accept_cash: true,
  accept_card_delivery: true,
  accept_manual_pix: true,
  manual_pix_key: null,
  manual_pix_key_type: null,
  mp_enabled: false,
  mp_public_key: null,
  mp_access_token: null,
  mp_sandbox: true,
  asaas_enabled: false,
  asaas_api_key: null,
  asaas_sandbox: true,
  pix_provider: "manual",
  card_provider: "delivery",
};

export const getStorePaymentGateways = async (storeId: string): Promise<StorePaymentGateways> => {
  const { data, error } = await supabase
    .from("store_payment_gateways")
    .select("*")
    .eq("store_id", storeId)
    .maybeSingle();

  if (error) {
    console.error("Falha ao buscar gateways de pagamento da loja:", error);
    return { ...DEFAULT_STORE_PAYMENT_GATEWAYS, store_id: storeId };
  }

  if (!data) {
    return { ...DEFAULT_STORE_PAYMENT_GATEWAYS, store_id: storeId };
  }

  return {
    ...DEFAULT_STORE_PAYMENT_GATEWAYS,
    ...data,
    manual_pix_key_type: (data.manual_pix_key_type as PixKeyType) || null,
    pix_provider: (data.pix_provider as "manual" | "mercadopago" | "asaas") || "manual",
    card_provider: (data.card_provider as "delivery" | "mercadopago" | "asaas") || "delivery",
    store_id: storeId,
  };
};

export const saveStorePaymentGateways = async (
  storeId: string,
  settings: Partial<StorePaymentGateways>,
): Promise<void> => {
  const payload = {
    store_id: storeId,
    accept_cash: settings.accept_cash ?? true,
    accept_card_delivery: settings.accept_card_delivery ?? true,
    accept_manual_pix: settings.accept_manual_pix ?? true,
    manual_pix_key: settings.manual_pix_key ? settings.manual_pix_key.trim() : null,
    manual_pix_key_type: settings.manual_pix_key_type || null,
    mp_enabled: settings.mp_enabled ?? false,
    mp_public_key: settings.mp_public_key ? settings.mp_public_key.trim() : null,
    mp_access_token: settings.mp_access_token ? settings.mp_access_token.trim() : null,
    mp_sandbox: settings.mp_sandbox ?? true,
    asaas_enabled: settings.asaas_enabled ?? false,
    asaas_api_key: settings.asaas_api_key ? settings.asaas_api_key.trim() : null,
    asaas_sandbox: settings.asaas_sandbox ?? true,
    pix_provider: settings.pix_provider || "manual",
    card_provider: settings.card_provider || "delivery",
  };

  const { error } = await supabase
    .from("store_payment_gateways")
    .upsert(payload, { onConflict: "store_id" });

  if (error) throw error;

  await logAudit({
    action: "settings_updated",
    module: "configuracoes",
    storeId,
    description: "Configurações de pagamento (Mercado Pago / Asaas / Entrega) atualizadas.",
    metadata: {
      mp_enabled: payload.mp_enabled,
      asaas_enabled: payload.asaas_enabled,
      pix_provider: payload.pix_provider,
      card_provider: payload.card_provider,
    },
  });
};

export const getPublicStorePaymentMethods = async (
  storeId: string,
): Promise<PublicStorePaymentMethods> => {
  const { data, error } = await supabase.rpc("get_public_store_payment_methods", {
    _store_id: storeId,
  });

  if (error || !data) {
    return {
      accept_cash: true,
      accept_card_delivery: true,
      accept_manual_pix: true,
      manual_pix_key: null,
      manual_pix_key_type: null,
      pix_provider: "manual",
      card_provider: "delivery",
      mp_public_key: null,
      mp_enabled: false,
      asaas_enabled: false,
    };
  }

  return data as unknown as PublicStorePaymentMethods;
};

/**
 * Funções auxiliares para cálculo e exibição de troco em dinheiro
 */
export const calculateChange = (
  total: number,
  changeFor: number | null | undefined,
): { needsChange: boolean; changeAmount: number; isValid: boolean } => {
  if (changeFor === null || changeFor === undefined || Number.isNaN(changeFor) || changeFor <= 0) {
    return { needsChange: false, changeAmount: 0, isValid: true };
  }

  const changeAmount = Number((changeFor - total).toFixed(2));
  return {
    needsChange: true,
    changeAmount: Math.max(0, changeAmount),
    isValid: changeFor >= total,
  };
};

export const formatChangeDisplay = (
  changeFor: number | null | undefined,
  total: number,
): string => {
  if (!changeFor || changeFor <= 0) return "Não precisa de troco";

  const { changeAmount, isValid } = calculateChange(total, changeFor);
  const money = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  if (!isValid) {
    return `Troco para ${money(changeFor)} (Inválido: menor que o total de ${money(total)})`;
  }

  return `Troco para ${money(changeFor)} (Levar ${money(changeAmount)})`;
};
