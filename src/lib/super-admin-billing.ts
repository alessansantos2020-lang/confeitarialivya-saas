import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { logAudit } from "./audit.functions";

export type BillingSubscriptionStatus =
  "pending" | "active" | "past_due" | "canceled" | "suspended";
export type BillingInvoiceStatus =
  "pending" | "confirmed" | "received" | "overdue" | "refunded" | "canceled" | "failed";
export type BillingPeriod = "monthly" | "quarterly" | "yearly";

export type BillingFilters = {
  storeId?: string;
  planId?: string;
  subscriptionStatus?: BillingSubscriptionStatus | "all";
  invoiceStatus?: BillingInvoiceStatus | "all";
};

export type BillingCustomerProfile =
  Database["public"]["Tables"]["billing_customer_profiles"]["Row"];
export type BillingSubscription = Database["public"]["Tables"]["billing_subscriptions"]["Row"];
export type BillingInvoice = Database["public"]["Tables"]["billing_invoices"]["Row"];
export type BillingPaymentMethod = "PIX" | "BOLETO";

export type BillingStore = {
  id: string;
  name: string;
  status: string;
  planId: string | null;
  planName: string | null;
  planPriceCents: number | null;
  subscription: BillingSubscription | null;
  profile: BillingCustomerProfile | null;
  latestInvoice: BillingInvoice | null;
};

export type BillingSummary = {
  contractedCents: number;
  receivedCents: number;
  pendingCents: number;
  overdueCents: number;
  activeCompanies: number;
  subscriptions: number;
};

export type BillingOverview = {
  summary: BillingSummary;
  stores: BillingStore[];
  invoices: BillingInvoice[];
  providerConfigured: boolean;
};

export const summarizeBilling = (
  subscriptions: Array<Pick<BillingSubscription, "status" | "amount_cents">>,
  invoices: Array<Pick<BillingInvoice, "status" | "amount_cents">>,
): BillingSummary => {
  const summary: BillingSummary = {
    contractedCents: 0,
    receivedCents: 0,
    pendingCents: 0,
    overdueCents: 0,
    activeCompanies: 0,
    subscriptions: subscriptions.length,
  };
  for (const subscription of subscriptions) {
    if (subscription.status === "active" || subscription.status === "past_due") {
      summary.contractedCents += subscription.amount_cents;
    }
    if (subscription.status === "active") summary.activeCompanies += 1;
  }
  for (const invoice of invoices) {
    if (invoice.status === "received" || invoice.status === "confirmed") {
      summary.receivedCents += invoice.amount_cents;
    }
    if (invoice.status === "pending") summary.pendingCents += invoice.amount_cents;
    if (invoice.status === "overdue") summary.overdueCents += invoice.amount_cents;
  }
  return summary;
};

export type BillingCustomerInput = {
  storeId: string;
  legalName: string;
  taxId?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  postalCode?: string;
};

export type CreateSubscriptionInput = {
  storeId: string;
  planId: string;
  billingPeriod: BillingPeriod;
  amountCents: number;
  startsOn: string;
  nextDueDate: string;
};

const PAGE_SIZE = 100;

const isSubscriptionStatus = (value: string): value is BillingSubscriptionStatus =>
  ["pending", "active", "past_due", "canceled", "suspended"].includes(value);

const isInvoiceStatus = (value: string): value is BillingInvoiceStatus =>
  ["pending", "confirmed", "received", "overdue", "refunded", "canceled", "failed"].includes(value);

export const moneyFromCents = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

export const billingStatusLabel = (status: string) =>
  ({
    pending: "Pendente",
    active: "Ativa",
    past_due: "Em atraso",
    canceled: "Cancelada",
    suspended: "Suspensa",
    confirmed: "Confirmada",
    received: "Recebida",
    overdue: "Vencida",
    refunded: "Estornada",
    failed: "Falhou",
  })[status] ?? status;

export const billingPeriodLabel = (period: string) =>
  ({ monthly: "Mensal", quarterly: "Trimestral", yearly: "Anual" })[period] ?? period;

export const getBillingOverview = async (
  filters: BillingFilters = {},
): Promise<BillingOverview> => {
  let subscriptionsQuery = supabase
    .from("billing_subscriptions")
    .select("*")
    .order("created_at", { ascending: false });
  if (filters.storeId) subscriptionsQuery = subscriptionsQuery.eq("store_id", filters.storeId);
  if (filters.planId) subscriptionsQuery = subscriptionsQuery.eq("plan_id", filters.planId);
  if (filters.subscriptionStatus && filters.subscriptionStatus !== "all") {
    subscriptionsQuery = subscriptionsQuery.eq("status", filters.subscriptionStatus);
  }

  let invoicesQuery = supabase
    .from("billing_invoices")
    .select("*")
    .order("due_date", { ascending: false })
    .limit(PAGE_SIZE);
  if (filters.storeId) invoicesQuery = invoicesQuery.eq("store_id", filters.storeId);
  if (filters.invoiceStatus && filters.invoiceStatus !== "all") {
    invoicesQuery = invoicesQuery.eq("status", filters.invoiceStatus);
  }

  const [
    { data: stores, error: storesError },
    { data: plans, error: plansError },
    subscriptionsResult,
    invoicesResult,
    profilesResult,
  ] = await Promise.all([
    supabase.from("stores").select("id, name, status, plan_id").order("name"),
    supabase.from("plans").select("id, name, price_cents"),
    subscriptionsQuery,
    invoicesQuery,
    supabase.from("billing_customer_profiles").select("*"),
  ]);

  if (storesError) throw storesError;
  if (plansError) throw plansError;
  if (subscriptionsResult.error) throw subscriptionsResult.error;
  if (invoicesResult.error) throw invoicesResult.error;
  if (profilesResult.error) throw profilesResult.error;

  const planMap = new Map((plans || []).map((plan) => [plan.id, plan]));
  const subscriptions = subscriptionsResult.data || [];
  const invoices = invoicesResult.data || [];
  const profileMap = new Map(
    (profilesResult.data || []).map((profile) => [profile.store_id, profile]),
  );
  const subscriptionMap = new Map<string, BillingSubscription>();
  for (const subscription of subscriptions) {
    if (!subscriptionMap.has(subscription.store_id))
      subscriptionMap.set(subscription.store_id, subscription);
  }
  const invoiceMap = new Map<string, BillingInvoice>();
  for (const invoice of invoices) {
    if (!invoiceMap.has(invoice.store_id)) invoiceMap.set(invoice.store_id, invoice);
  }

  const visibleStores = (stores || []).filter((store) => {
    if (filters.storeId && store.id !== filters.storeId) return false;
    if (filters.planId && store.plan_id !== filters.planId) return false;
    return true;
  });
  const billingStores = visibleStores.map((store) => {
    const plan = store.plan_id ? planMap.get(store.plan_id) : undefined;
    return {
      id: store.id,
      name: store.name,
      status: store.status,
      planId: store.plan_id,
      planName: plan?.name ?? null,
      planPriceCents: plan?.price_cents ?? null,
      subscription: subscriptionMap.get(store.id) ?? null,
      profile: profileMap.get(store.id) ?? null,
      latestInvoice: invoiceMap.get(store.id) ?? null,
    } satisfies BillingStore;
  });

  const summary = summarizeBilling(
    subscriptions.filter((subscription) => {
      if (!filters.subscriptionStatus || filters.subscriptionStatus === "all") return true;
      return subscription.status === filters.subscriptionStatus;
    }),
    invoices,
  );

  return { summary, stores: billingStores, invoices, providerConfigured: false };
};

export const upsertBillingCustomer = async (input: BillingCustomerInput) => {
  const args: Database["public"]["Functions"]["upsert_billing_customer_profile"]["Args"] = {
    _store_id: input.storeId,
    _legal_name: input.legalName,
  };
  if (input.taxId) args._tax_id = input.taxId;
  if (input.email) args._email = input.email;
  if (input.phone) args._phone = input.phone;
  if (input.address) args._address = input.address;
  if (input.city) args._city = input.city;
  if (input.state) args._state = input.state;
  if (input.postalCode) args._postal_code = input.postalCode;
  const { data, error } = await supabase.rpc("upsert_billing_customer_profile", args);
  if (error) throw error;
  return data;
};

export const createBillingSubscription = async (input: CreateSubscriptionInput) => {
  const idempotencyKey = crypto.randomUUID();
  const { data, error } = await supabase.rpc("create_billing_subscription", {
    _store_id: input.storeId,
    _plan_id: input.planId,
    _billing_period: input.billingPeriod,
    _amount_cents: input.amountCents,
    _starts_on: input.startsOn,
    _next_due_date: input.nextDueDate,
    _idempotency_key: idempotencyKey,
  });
  if (error) throw error;
  await logAudit({
    action: "billing_subscription_created",
    module: "cobrancas",
    storeId: input.storeId,
    description: "Assinatura criada no modo de preparação; aguardando configuração do Asaas.",
    metadata: { subscription_id: data, amount_cents: input.amountCents },
  });
  return data;
};

export const recordBillingManualEvent = async (
  invoiceId: string,
  status: BillingInvoiceStatus,
  reason: string,
) => {
  if (!isInvoiceStatus(status)) throw new Error("Status de fatura inválido.");
  const { error } = await supabase.rpc("record_billing_manual_event", {
    _invoice_id: invoiceId,
    _status: status,
    _reason: reason,
  });
  if (error) throw error;
};

export const isKnownSubscriptionStatus = isSubscriptionStatus;

export const isBillingPaymentMethod = (value: string): value is BillingPaymentMethod =>
  value === "PIX" || value === "BOLETO";

export const paymentMethodLabel = (value: string | null) =>
  value === "PIX" ? "Pix" : value === "BOLETO" ? "Boleto" : "A escolher";

export const isPaymentReceived = (status: string) => status === "received";

export const getCompanyBilling = async (storeId: string) => {
  const [invoicesResult, profileResult, subscriptionResult] = await Promise.all([
    supabase
      .from("billing_invoices")
      .select("*")
      .eq("store_id", storeId)
      .order("due_date", { ascending: false }),
    supabase.from("billing_customer_profiles").select("*").eq("store_id", storeId).maybeSingle(),
    supabase
      .from("billing_subscriptions")
      .select("*")
      .eq("store_id", storeId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (invoicesResult.error) throw invoicesResult.error;
  if (profileResult.error) throw profileResult.error;
  if (subscriptionResult.error) throw subscriptionResult.error;
  return {
    invoices: invoicesResult.data || [],
    profile: profileResult.data,
    subscription: subscriptionResult.data,
  };
};

export const createAsaasSubscription = async (subscriptionId: string) => {
  const { data, error } = await supabase.functions.invoke("billing-create-subscription", {
    body: { subscriptionId },
  });
  if (error) throw error;
  if (data?.error) {
    const providerError = new Error(data.error);
    Object.assign(providerError, { code: data.code });
    throw providerError;
  }
  return data as {
    subscriptionId: string;
    paymentId: string | null;
    invoiceUrl: string | null;
    bankSlipUrl: string | null;
    paymentOptions: BillingPaymentMethod[];
    status: string;
  };
};
