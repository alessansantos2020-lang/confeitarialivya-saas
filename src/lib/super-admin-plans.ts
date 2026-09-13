import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "./audit.functions";
import { slugify } from "./super-admin-stores";

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
    action: "plan_updated",
    module: "planos",
    description: `Plano ${planId} ${isActive ? "ativado" : "desativado"}`,
    metadata: { is_active: isActive },
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

  const { data: plan } = await supabase.from("plans").select("name").eq("id", planId).maybeSingle();

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
    id ? ((plans || []).find((p) => p.id === id)?.name ?? id) : "Sem plano (acesso total)";

  await logAudit({
    action: "store_plan_changed",
    module: "planos",
    storeId,
    description: `Plano da loja: ${planName(before?.plan_id ?? null)} → ${planName(planId)}`,
  });
};
