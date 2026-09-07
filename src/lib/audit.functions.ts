import { supabase } from "@/integrations/supabase/client";

export type AuditEntry = {
  action: string;
  module: string;
  storeId?: string | null;
  description?: string | null;
  metadata?: Record<string, unknown> | null;
};

/**
 * Grava uma linha em public.audit_logs. A tabela é append-only (não existe
 * policy de UPDATE/DELETE), então o registro não pode ser alterado depois.
 * Falha no log nunca derruba a ação do usuário — só avisa no console.
 */
export const logAudit = async (entry: AuditEntry): Promise<void> => {
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) return;

  const { error } = await supabase.from("audit_logs").insert({
    actor_id: user.id,
    actor_email: user.email ?? null,
    action: entry.action,
    module: entry.module,
    store_id: entry.storeId ?? null,
    description: entry.description ?? null,
    metadata: entry.metadata ?? null,
  });

  if (error) console.error("Falha ao registrar log de auditoria:", error);
};

// ---------------------------------------------------------------------------
// LEITURA DOS LOGS (tela /super/logs)
// ---------------------------------------------------------------------------

export type AuditRow = {
  id: string;
  createdAt: string;
  actorId: string | null;
  actorEmail: string | null;
  actorName: string | null;
  action: string;
  module: string;
  storeId: string | null;
  storeName: string | null;
  description: string | null;
};

export type AuditFilters = {
  actor?: string | undefined; // actor_id
  storeId?: string | undefined; // "none" = registros sem loja
  module?: string | undefined;
  action?: string | undefined;
  from?: string | undefined; // ISO
  page: number; // começa em 1
};

export type AuditPage = {
  rows: AuditRow[];
  total: number;
  pageSize: number;
};

export const AUDIT_PAGE_SIZE = 25;

/**
 * Diferente do resto do sistema, os filtros aqui vão para o banco e a lista é
 * paginada. `audit_logs` é a única tabela que cresce sem limite — carregar tudo
 * funcionaria hoje e quebraria com 50 mil linhas. Os índices de created_at,
 * actor_id, store_id, action e module já existem exatamente para isto.
 */
export const getAuditLogs = async (filters: AuditFilters): Promise<AuditPage> => {
  const from = (Math.max(1, filters.page) - 1) * AUDIT_PAGE_SIZE;

  let query = supabase
    .from("audit_logs")
    .select("id, created_at, actor_id, actor_email, action, module, store_id, description", {
      count: "exact",
    })
    .order("created_at", { ascending: false })
    .range(from, from + AUDIT_PAGE_SIZE - 1);

  if (filters.actor) query = query.eq("actor_id", filters.actor);
  if (filters.storeId === "none") query = query.is("store_id", null);
  else if (filters.storeId) query = query.eq("store_id", filters.storeId);
  if (filters.module) query = query.eq("module", filters.module);
  if (filters.action) query = query.eq("action", filters.action);
  if (filters.from) query = query.gte("created_at", filters.from);

  const [logsRes, storesRes, usersRes] = await Promise.all([
    query,
    supabase.from("stores").select("id, name"),
    supabase.from("profiles").select("id, full_name"),
  ]);

  if (logsRes.error) throw logsRes.error;

  const storeNames = new Map<string, string>();
  for (const s of storesRes.data || []) storeNames.set(s.id, s.name);

  const userNames = new Map<string, string | null>();
  for (const p of usersRes.data || []) userNames.set(p.id, p.full_name);

  const rows: AuditRow[] = (logsRes.data || []).map((l) => ({
    id: l.id,
    createdAt: l.created_at,
    actorId: l.actor_id,
    actorEmail: l.actor_email,
    // A conta pode ter sido apagada: actor_id vira nulo e sobra o e-mail.
    actorName: l.actor_id ? userNames.get(l.actor_id) ?? null : null,
    action: l.action,
    module: l.module,
    storeId: l.store_id,
    storeName: l.store_id ? storeNames.get(l.store_id) ?? "Loja removida" : null,
    description: l.description,
  }));

  return { rows, total: logsRes.count ?? 0, pageSize: AUDIT_PAGE_SIZE };
};

/**
 * Valores distintos de ação e módulo para montar os filtros. Lê uma janela
 * recente em vez da tabela inteira: os tipos de ação repetem muito, então uma
 * amostra grande já traz todos, e a consulta continua barata.
 */
export const getAuditOptions = async (): Promise<{ actions: string[]; modules: string[] }> => {
  const { data, error } = await supabase
    .from("audit_logs")
    .select("action, module")
    .order("created_at", { ascending: false })
    .limit(1000);

  if (error) throw error;

  const actions = new Set<string>();
  const modules = new Set<string>();
  for (const row of data || []) {
    actions.add(row.action);
    modules.add(row.module);
  }

  return {
    actions: Array.from(actions).sort(),
    modules: Array.from(modules).sort(),
  };
};
