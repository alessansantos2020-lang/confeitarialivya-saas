import { supabase } from "@/integrations/supabase/client";
import type { Store } from "./delivery.functions";
import { logAudit } from "./audit.functions";

export type StoreStatus = "active" | "inactive" | "suspended";

export type StoreOverview = Store & {
  status: StoreStatus;
  memberCount: number;
  ownerName: string | null;
  settingsName: string | null;
  planId: string | null;
  planName: string | null;
};

export type AssignableUser = {
  id: string;
  full_name: string | null;
  status: string | null;
  role: string | null;
};

export const slugify = (value: string): string =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

export const getAllStores = async (): Promise<StoreOverview[]> => {
  const [storesRes, membersRes, profilesRes, settingsRes, plansRes] = await Promise.all([
    supabase.from("stores").select("*").order("created_at", { ascending: true }),
    supabase.from("store_members").select("store_id, user_id"),
    supabase.from("profiles").select("id, full_name"),
    supabase.from("store_settings").select("store_id, name"),
    supabase.from("plans").select("id, name"),
  ]);

  if (storesRes.error) throw storesRes.error;

  const memberCounts = new Map<string, number>();
  for (const m of membersRes.data || []) {
    memberCounts.set(m.store_id, (memberCounts.get(m.store_id) || 0) + 1);
  }

  const profileNames = new Map<string, string | null>();
  for (const p of profilesRes.data || []) {
    profileNames.set(p.id, p.full_name);
  }

  const settingsNames = new Map<string, string | null>();
  for (const s of settingsRes.data || []) {
    settingsNames.set(s.store_id, s.name);
  }

  const planNames = new Map<string, string>();
  for (const p of plansRes.data || []) {
    planNames.set(p.id, p.name);
  }

  return (storesRes.data || []).map((store) => ({
    ...(store as Store),
    status: store.status as StoreStatus,
    memberCount: memberCounts.get(store.id) || 0,
    ownerName: store.owner_id ? profileNames.get(store.owner_id) ?? null : null,
    settingsName: settingsNames.get(store.id) ?? null,
    planId: (store as any).plan_id ?? null,
    planName: (store as any).plan_id ? planNames.get((store as any).plan_id) ?? null : null,
  }));
};

export const createStore = async (input: { name: string; slug: string }): Promise<Store> => {
  const slug = slugify(input.slug || input.name);
  if (!slug) throw new Error("Informe um endereço (slug) válido para a loja.");

  const { data, error } = await supabase
    .from("stores")
    .insert({ name: input.name.trim(), slug, status: "active" })
    .select()
    .single();

  if (error) {
    if (error.code === "23505" || error.message.includes("duplicate")) {
      throw new Error(`O endereço "${slug}" já está em uso por outra loja.`);
    }
    throw error;
  }

  await logAudit({
    action: "store_created",
    module: "lojas",
    storeId: data.id,
    description: `Loja "${data.name}" criada (endereço: ${slug})`,
  });

  return data as Store;
};

const STORE_STATUS_ACTION: Record<StoreStatus, string> = {
  active: "store_activated",
  inactive: "store_deactivated",
  suspended: "store_blocked",
};

const STORE_STATUS_TEXT: Record<StoreStatus, string> = {
  active: "ativada",
  inactive: "desativada",
  suspended: "bloqueada",
};

export const updateStoreStatus = async (storeId: string, status: StoreStatus) => {
  const { error } = await supabase.from("stores").update({ status }).eq("id", storeId);
  if (error) throw error;

  await logAudit({
    action: STORE_STATUS_ACTION[status],
    module: "lojas",
    storeId,
    description: `Loja ${STORE_STATUS_TEXT[status]}`,
  });
};

export const renameStore = async (storeId: string, name: string) => {
  const newName = name.trim();
  const { error } = await supabase.from("stores").update({ name: newName }).eq("id", storeId);
  if (error) throw error;

  await logAudit({
    action: "store_renamed",
    module: "lojas",
    storeId,
    description: `Loja renomeada para "${newName}"`,
  });
};

export const getAssignableUsers = async (): Promise<AssignableUser[]> => {
  const [profilesRes, rolesRes] = await Promise.all([
    supabase.from("profiles").select("id, full_name, status").order("full_name"),
    supabase.from("user_roles").select("user_id, role"),
  ]);

  if (profilesRes.error) throw profilesRes.error;

  const roles = new Map<string, string>();
  for (const r of rolesRes.data || []) {
    roles.set(r.user_id, r.role);
  }

  return (profilesRes.data || []).map((p) => ({
    id: p.id,
    full_name: p.full_name,
    status: p.status,
    role: roles.get(p.id) ?? null,
  }));
};

/**
 * Torna um usuário o dono/administrador da loja: grava owner_id na loja,
 * cria o vínculo em store_members e garante o papel global 'admin'
 * (exigido pelo guard do /admin).
 */
export const assignStoreOwner = async (storeId: string, userId: string) => {
  const { error: storeError } = await supabase
    .from("stores")
    .update({ owner_id: userId })
    .eq("id", storeId);
  if (storeError) throw storeError;

  const { error: memberError } = await supabase
    .from("store_members")
    .upsert({ store_id: storeId, user_id: userId, role: "admin" }, { onConflict: "store_id,user_id" });
  if (memberError) throw memberError;

  const { data: existingRole } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();

  if (!existingRole) {
    const { error: roleError } = await supabase
      .from("user_roles")
      .insert({ user_id: userId, role: "admin" });
    if (roleError) throw roleError;
  }

  await logAudit({
    action: "store_owner_assigned",
    module: "lojas",
    storeId,
    description: `Conta ${userId} definida como dona da loja`,
  });
};

// ---------------------------------------------------------------------------
// USUÁRIOS DO SISTEMA
// ---------------------------------------------------------------------------

export type UserStatus = "active" | "blocked";

export type SystemUserStore = {
  id: string;
  name: string;
  role: string;
};

export type SystemUser = {
  id: string;
  email: string | null;
  full_name: string | null;
  status: string;
  role: string | null;
  last_sign_in_at: string | null;
  created_at: string | null;
  stores: SystemUserStore[];
};

/**
 * Contas do sistema com e-mail e último acesso. Esses dois campos moram em
 * `auth.users`, que a API não expõe — por isso vem da função
 * `public.super_admin_users`, que checa o papel antes de responder.
 */
export const getSystemUsers = async (): Promise<SystemUser[]> => {
  const { data, error } = await supabase.rpc("super_admin_users");
  if (error) throw error;

  return ((data || []) as any[]).map((u) => ({
    id: u.id,
    email: u.email,
    full_name: u.full_name,
    status: u.status,
    role: u.role,
    last_sign_in_at: u.last_sign_in_at,
    created_at: u.created_at,
    stores: (u.stores || []) as SystemUserStore[],
  }));
};

/**
 * Bloquear corta o acesso no banco (as funções de RLS consultam o status), não
 * só na tela. Nada é apagado: pedidos e logs continuam ligados à conta.
 */
export const setUserStatus = async (userId: string, status: UserStatus): Promise<void> => {
  const { error } = await supabase.from("profiles").update({ status }).eq("id", userId);
  if (error) throw error;

  await logAudit({
    action: status === "blocked" ? "user_blocked" : "user_activated",
    module: "usuarios",
    description: `Conta ${userId} ${status === "blocked" ? "bloqueada" : "ativada"}`,
  });
};

export const renameUser = async (userId: string, fullName: string): Promise<void> => {
  const name = fullName.trim();
  if (!name) throw new Error("Informe o nome do usuário.");

  const { error } = await supabase.from("profiles").update({ full_name: name }).eq("id", userId);
  if (error) throw error;

  await logAudit({
    action: "user_renamed",
    module: "usuarios",
    description: `Conta ${userId} renomeada para "${name}"`,
  });
};

// ---------------------------------------------------------------------------
// PLANOS E FUNCIONALIDADES
// ---------------------------------------------------------------------------

export type BillingPeriod = "monthly" | "quarterly" | "yearly";

export type Feature = {
  id: string;
  name: string;
  description: string | null;
  module: string;
  is_core: boolean;
  sort_order: number;
};

export type Plan = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price_cents: number;
  billing_period: BillingPeriod;
  is_active: boolean;
  sort_order: number;
};

export type PlanOverview = Plan & {
  featureIds: string[];
  storeCount: number;
};

export const getAllFeatures = async (): Promise<Feature[]> => {
  const { data, error } = await supabase
    .from("features")
    .select("id, name, description, module, is_core, sort_order")
    .order("sort_order");
  if (error) throw error;
  return (data || []) as Feature[];
};

export const getAllPlans = async (): Promise<PlanOverview[]> => {
  const [plansRes, planFeaturesRes, storesRes] = await Promise.all([
    supabase
      .from("plans")
      .select("id, name, slug, description, price_cents, billing_period, is_active, sort_order")
      .order("sort_order"),
    supabase.from("plan_features").select("plan_id, feature_id"),
    supabase.from("stores").select("plan_id"),
  ]);

  if (plansRes.error) throw plansRes.error;

  const featuresByPlan = new Map<string, string[]>();
  for (const pf of planFeaturesRes.data || []) {
    const list = featuresByPlan.get(pf.plan_id) || [];
    list.push(pf.feature_id);
    featuresByPlan.set(pf.plan_id, list);
  }

  const storeCounts = new Map<string, number>();
  for (const s of storesRes.data || []) {
    if (s.plan_id) storeCounts.set(s.plan_id, (storeCounts.get(s.plan_id) || 0) + 1);
  }

  return (plansRes.data || []).map((p) => ({
    ...(p as Plan),
    featureIds: featuresByPlan.get(p.id) || [],
    storeCount: storeCounts.get(p.id) || 0,
  }));
};

export type PlanInput = {
  name: string;
  description: string | null;
  priceCents: number;
  billingPeriod: BillingPeriod;
  featureIds: string[];
};

export const createPlan = async (input: PlanInput): Promise<string> => {
  const slug = slugify(input.name);
  if (!slug) throw new Error("Informe um nome válido para o plano.");

  const { data: maxRow } = await supabase
    .from("plans")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextSort = (maxRow?.sort_order ?? 0) + 10;

  const { data, error } = await supabase
    .from("plans")
    .insert({
      name: input.name.trim(),
      slug,
      description: input.description?.trim() || null,
      price_cents: input.priceCents,
      billing_period: input.billingPeriod,
      sort_order: nextSort,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505" || error.message.includes("duplicate")) {
      throw new Error(`Já existe um plano com o nome "${input.name}".`);
    }
    throw error;
  }

  await setPlanFeatures(data.id, input.featureIds);

  await logAudit({
    action: "plan_created",
    module: "planos",
    description: `Plano "${input.name.trim()}" criado com ${input.featureIds.length} funcionalidade(s)`,
  });

  return data.id;
};

export const updatePlan = async (planId: string, input: PlanInput): Promise<void> => {
  const { error } = await supabase
    .from("plans")
    .update({
      name: input.name.trim(),
      description: input.description?.trim() || null,
      price_cents: input.priceCents,
      billing_period: input.billingPeriod,
    })
    .eq("id", planId);
  if (error) throw error;

  await setPlanFeatures(planId, input.featureIds);

  await logAudit({
    action: "plan_updated",
    module: "planos",
    description: `Plano "${input.name.trim()}" alterado — agora com ${input.featureIds.length} funcionalidade(s)`,
  });
};

export const setPlanActive = async (planId: string, isActive: boolean): Promise<void> => {
  const { error } = await supabase.from("plans").update({ is_active: isActive }).eq("id", planId);
  if (error) throw error;

  await logAudit({
    action: isActive ? "plan_activated" : "plan_deactivated",
    module: "planos",
    description: `Plano ${planId} ${isActive ? "ativado" : "desativado"}`,
  });
};

// Só permite excluir se nenhuma loja usa o plano.
export const deletePlan = async (planId: string): Promise<void> => {
  const { count, error: countError } = await supabase
    .from("stores")
    .select("id", { count: "exact", head: true })
    .eq("plan_id", planId);
  if (countError) throw countError;
  if ((count ?? 0) > 0) {
    throw new Error("Não é possível excluir: há lojas usando este plano.");
  }

  const { data: plan } = await supabase
    .from("plans")
    .select("name")
    .eq("id", planId)
    .maybeSingle();

  const { error } = await supabase.from("plans").delete().eq("id", planId);
  if (error) throw error;

  await logAudit({
    action: "plan_deleted",
    module: "planos",
    description: `Plano "${plan?.name ?? planId}" excluído`,
  });
};

// Reescreve o conjunto de funcionalidades do plano (apaga as antigas, grava as novas).
export const setPlanFeatures = async (planId: string, featureIds: string[]): Promise<void> => {
  const { error: delError } = await supabase.from("plan_features").delete().eq("plan_id", planId);
  if (delError) throw delError;

  if (featureIds.length === 0) return;

  const rows = featureIds.map((feature_id) => ({ plan_id: planId, feature_id }));
  const { error: insError } = await supabase.from("plan_features").insert(rows);
  if (insError) throw insError;
};

/**
 * Define o plano da loja. planId null = sem plano (acesso total, é o estado das
 * lojas antigas). Trocar o plano NUNCA apaga dados — só muda o que fica acessível.
 */
export const setStorePlan = async (storeId: string, planId: string | null): Promise<void> => {
  // Lê o plano anterior antes de gravar: o log de-para é o registro que mais
  // importa nesta tabela, porque mexe no que a loja paga e no que ela acessa.
  const [{ data: before }, { data: plans }] = await Promise.all([
    supabase.from("stores").select("plan_id").eq("id", storeId).maybeSingle(),
    supabase.from("plans").select("id, name"),
  ]);

  const { error } = await supabase.from("stores").update({ plan_id: planId }).eq("id", storeId);
  if (error) throw error;

  const planName = (id: string | null) =>
    id ? (plans || []).find((p) => p.id === id)?.name ?? id : "Sem plano (acesso total)";

  await logAudit({
    action: "store_plan_changed",
    module: "planos",
    storeId,
    description: `Plano da loja: ${planName(before?.plan_id ?? null)} → ${planName(planId)}`,
  });
};

// ---------------------------------------------------------------------------
// DASHBOARD DO SUPER ADMIN (dados reais)
// ---------------------------------------------------------------------------

export type DashboardPeriod = 7 | 30 | 90;

export type SuperDashboard = {
  totalStores: number;
  activeStores: number;
  blockedStores: number;
  totalUsers: number;
  totalOrders: number;
  newStores: number; // criadas no período
  storesGrowth: { date: string; value: number }[]; // acumulado de lojas por dia
  ordersChart: { date: string; value: number }[]; // pedidos por dia
};

// Chave de dia (YYYY-MM-DD) em horário local.
export const dayKey = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

export const getSuperDashboard = async (period: DashboardPeriod): Promise<SuperDashboard> => {
  const since = new Date();
  since.setDate(since.getDate() - (period - 1));
  since.setHours(0, 0, 0, 0);
  const sinceIso = since.toISOString();

  const [storesRes, usersRes, ordersTotalRes, ordersPeriodRes] = await Promise.all([
    supabase.from("stores").select("id, status, created_at"),
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("orders").select("id", { count: "exact", head: true }),
    supabase.from("orders").select("created_at").gte("created_at", sinceIso),
  ]);

  if (storesRes.error) throw storesRes.error;

  const stores = storesRes.data || [];
  const activeStores = stores.filter((s) => s.status === "active").length;
  const blockedStores = stores.filter((s) => s.status === "suspended").length;
  const newStores = stores.filter((s) => s.created_at && s.created_at >= sinceIso).length;

  // Eixo de dias do período.
  const days: string[] = [];
  for (let i = 0; i < period; i++) {
    const d = new Date(since);
    d.setDate(since.getDate() + i);
    days.push(dayKey(d));
  }

  // Crescimento de lojas: total acumulado até o fim de cada dia.
  const storesGrowth = days.map((key) => {
    const end = new Date(`${key}T23:59:59`);
    const value = stores.filter(
      (s) => s.created_at && new Date(s.created_at).getTime() <= end.getTime(),
    ).length;
    return { date: key.slice(5), value };
  });

  // Pedidos por dia no período.
  const orderCountByDay = new Map<string, number>();
  for (const o of ordersPeriodRes.data || []) {
    if (!o.created_at) continue;
    const key = dayKey(new Date(o.created_at));
    orderCountByDay.set(key, (orderCountByDay.get(key) || 0) + 1);
  }
  const ordersChart = days.map((key) => ({
    date: key.slice(5),
    value: orderCountByDay.get(key) || 0,
  }));

  return {
    totalStores: stores.length,
    activeStores,
    blockedStores,
    totalUsers: usersRes.count ?? 0,
    totalOrders: ordersTotalRes.count ?? 0,
    newStores,
    storesGrowth,
    ordersChart,
  };
};

export type ActivityLog = {
  id: string;
  action: string;
  module: string;
  description: string | null;
  actor_email: string | null;
  created_at: string;
};

export const getRecentActivity = async (limit = 10): Promise<ActivityLog[]> => {
  const { data, error } = await supabase
    .from("audit_logs")
    .select("id, action, module, description, actor_email, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data || []) as ActivityLog[];
};

// ---------------------------------------------------------------------------
// MONITORAMENTO (visão por loja e por pedido)
// ---------------------------------------------------------------------------

export type MonitoringPeriod = "today" | 7 | 30;

export type StoreActivity = {
  storeId: string;
  storeName: string;
  orders: number;
  revenue: number;
};

export type RecentOrder = {
  id: string;
  storeName: string;
  customerName: string;
  total: number;
  status: string;
  createdAt: string | null;
};

export type Monitoring = {
  totalOrders: number; // todos os tempos
  periodOrders: number;
  periodRevenue: number;
  newStores: number;
  newUsers: number;
  recentOrders: RecentOrder[];
  storeRanking: StoreActivity[];
  activity: ActivityLog[];
};

/**
 * O Dashboard soma a plataforma inteira; aqui a visão é por loja e por pedido.
 * Nada é inventado: quando não há pedido no período, os números são zero de
 * verdade e a tela mostra o aviso em vez de uma tabela vazia.
 */
export const getMonitoring = async (period: MonitoringPeriod): Promise<Monitoring> => {
  const since = new Date();
  if (period === "today") {
    since.setHours(0, 0, 0, 0);
  } else {
    since.setDate(since.getDate() - (period - 1));
    since.setHours(0, 0, 0, 0);
  }
  const sinceIso = since.toISOString();

  const [ordersRes, ordersTotalRes, storesRes, profilesRes, activity] = await Promise.all([
    supabase
      .from("orders")
      .select("id, store_id, customer_name, total_amount, status, created_at")
      .gte("created_at", sinceIso)
      .order("created_at", { ascending: false }),
    supabase.from("orders").select("id", { count: "exact", head: true }),
    supabase.from("stores").select("id, name, created_at"),
    supabase.from("profiles").select("id, created_at"),
    getRecentActivity(12),
  ]);

  if (ordersRes.error) throw ordersRes.error;

  const orders = ordersRes.data || [];
  const stores = storesRes.data || [];

  const storeNames = new Map<string, string>();
  for (const s of stores) {
    storeNames.set(s.id, s.name);
  }

  // Toda loja entra no ranking, mesmo parada: loja sem pedido é informação.
  const tally = new Map<string, { orders: number; revenue: number }>();
  for (const s of stores) {
    tally.set(s.id, { orders: 0, revenue: 0 });
  }

  let periodRevenue = 0;
  for (const o of orders) {
    const entry = tally.get(o.store_id) || { orders: 0, revenue: 0 };
    entry.orders += 1;
    // Pedido cancelado não é faturamento.
    if (o.status !== "canceled") {
      entry.revenue += Number(o.total_amount) || 0;
      periodRevenue += Number(o.total_amount) || 0;
    }
    tally.set(o.store_id, entry);
  }

  const storeRanking: StoreActivity[] = Array.from(tally.entries())
    .map(([storeId, v]) => ({
      storeId,
      storeName: storeNames.get(storeId) ?? "Loja removida",
      orders: v.orders,
      revenue: v.revenue,
    }))
    .sort((a, b) => b.orders - a.orders || b.revenue - a.revenue);

  const recentOrders: RecentOrder[] = orders.slice(0, 10).map((o) => ({
    id: o.id,
    storeName: storeNames.get(o.store_id) ?? "Loja removida",
    customerName: o.customer_name,
    total: Number(o.total_amount) || 0,
    status: o.status || "pending",
    createdAt: o.created_at,
  }));

  return {
    totalOrders: ordersTotalRes.count ?? 0,
    periodOrders: orders.length,
    periodRevenue,
    newStores: stores.filter((s) => s.created_at && s.created_at >= sinceIso).length,
    newUsers: (profilesRes.data || []).filter((p) => p.created_at && p.created_at >= sinceIso)
      .length,
    recentOrders,
    storeRanking,
    activity,
  };
};

// ---------------------------------------------------------------------------
// DETALHES DE UMA LOJA
// ---------------------------------------------------------------------------

export type StoreDetails = {
  phone: string | null;
  whatsapp: string | null;
  address: string | null;
  userCount: number;
  orderCount: number;
  customerCount: number;
  productCount: number;
};

export const getStoreDetails = async (storeId: string): Promise<StoreDetails> => {
  const [settingsRes, membersRes, ordersRes, productsRes, customerRes] = await Promise.all([
    supabase
      .from("store_settings")
      .select("phone, whatsapp, address")
      .eq("store_id", storeId)
      .maybeSingle(),
    supabase.from("store_members").select("id", { count: "exact", head: true }).eq("store_id", storeId),
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("store_id", storeId),
    supabase.from("products").select("id", { count: "exact", head: true }).eq("store_id", storeId),
    // Não existe tabela de clientes: "clientes" é telefone distinto nos pedidos.
    supabase.from("orders").select("customer_phone").eq("store_id", storeId),
  ]);

  const phones = new Set(
    (customerRes.data || []).map((o: any) => o.customer_phone).filter(Boolean),
  );

  return {
    phone: (settingsRes.data as any)?.phone ?? null,
    whatsapp: (settingsRes.data as any)?.whatsapp ?? null,
    address: (settingsRes.data as any)?.address ?? null,
    userCount: membersRes.count ?? 0,
    orderCount: ordersRes.count ?? 0,
    customerCount: phones.size,
    productCount: productsRes.count ?? 0,
  };
};
