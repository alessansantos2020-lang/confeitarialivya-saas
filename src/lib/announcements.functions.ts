import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "./audit.functions";

export type AnnouncementSeverity = "info" | "warning" | "critical";

export type Announcement = {
  id: string;
  title: string;
  body: string;
  severity: AnnouncementSeverity;
  store_id: string | null; // null = todas as lojas
  is_active: boolean;
  starts_at: string;
  ends_at: string | null;
  created_at: string;
};

export type AnnouncementWithStore = Announcement & {
  storeName: string | null; // null = todas as lojas
};

export type AnnouncementInput = {
  title: string;
  body: string;
  severity: AnnouncementSeverity;
  storeId: string | null;
  isActive: boolean;
  startsAt: string;
  endsAt: string | null;
};

const SELECT = "id, title, body, severity, store_id, is_active, starts_at, ends_at, created_at";

/**
 * Lista para o painel do dono do sistema. O RLS entrega tudo para ele; o nome da
 * loja vem de um Map sobre `stores`, sem segunda consulta por linha.
 */
export const getAllAnnouncements = async (): Promise<AnnouncementWithStore[]> => {
  const [listRes, storesRes] = await Promise.all([
    supabase.from("announcements").select(SELECT).order("created_at", { ascending: false }),
    supabase.from("stores").select("id, name"),
  ]);

  if (listRes.error) throw listRes.error;

  const storeNames = new Map<string, string>();
  for (const s of storesRes.data || []) {
    storeNames.set(s.id, s.name);
  }

  return (listRes.data || []).map((a) => ({
    ...(a as Announcement),
    storeName: a.store_id ? storeNames.get(a.store_id) ?? "Loja removida" : null,
  }));
};

/**
 * Avisos que a loja deve ver agora. O RLS já limita a avisos ativos, globais ou
 * da própria loja; o filtro de data existe aqui porque a janela
 * `starts_at`/`ends_at` não é checada pelo RLS.
 */
export const getActiveAnnouncements = async (storeId: string): Promise<Announcement[]> => {
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("announcements")
    .select(SELECT)
    .eq("is_active", true)
    .lte("starts_at", now)
    .or(`store_id.is.null,store_id.eq.${storeId}`)
    .or(`ends_at.is.null,ends_at.gt.${now}`)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data || []) as Announcement[];
};

const targetLabel = (storeId: string | null) =>
  storeId ? `loja ${storeId}` : "todas as lojas";

export const createAnnouncement = async (input: AnnouncementInput): Promise<void> => {
  const title = input.title.trim();
  const body = input.body.trim();
  if (!title) throw new Error("Informe o título do aviso.");
  if (!body) throw new Error("Informe a mensagem do aviso.");

  const { data: userRes } = await supabase.auth.getUser();

  const { error } = await supabase.from("announcements").insert({
    title,
    body,
    severity: input.severity,
    store_id: input.storeId,
    is_active: input.isActive,
    starts_at: input.startsAt,
    ends_at: input.endsAt,
    created_by: userRes.user?.id ?? null,
  });
  if (error) throw error;

  await logAudit({
    action: "announcement_created",
    module: "avisos",
    storeId: input.storeId,
    description: `Aviso "${title}" criado para ${targetLabel(input.storeId)}`,
  });
};

export const updateAnnouncement = async (
  id: string,
  input: AnnouncementInput,
): Promise<void> => {
  const title = input.title.trim();
  const body = input.body.trim();
  if (!title) throw new Error("Informe o título do aviso.");
  if (!body) throw new Error("Informe a mensagem do aviso.");

  const { error } = await supabase
    .from("announcements")
    .update({
      title,
      body,
      severity: input.severity,
      store_id: input.storeId,
      is_active: input.isActive,
      starts_at: input.startsAt,
      ends_at: input.endsAt,
    })
    .eq("id", id);
  if (error) throw error;

  await logAudit({
    action: "announcement_updated",
    module: "avisos",
    storeId: input.storeId,
    description: `Aviso "${title}" alterado`,
  });
};

export const setAnnouncementActive = async (id: string, isActive: boolean): Promise<void> => {
  const { error } = await supabase
    .from("announcements")
    .update({ is_active: isActive })
    .eq("id", id);
  if (error) throw error;

  await logAudit({
    action: isActive ? "announcement_activated" : "announcement_deactivated",
    module: "avisos",
    description: `Aviso ${id} ${isActive ? "ativado" : "desativado"}`,
  });
};

export const deleteAnnouncement = async (id: string, title: string): Promise<void> => {
  const { error } = await supabase.from("announcements").delete().eq("id", id);
  if (error) throw error;

  await logAudit({
    action: "announcement_deleted",
    module: "avisos",
    description: `Aviso "${title}" excluído`,
  });
};
