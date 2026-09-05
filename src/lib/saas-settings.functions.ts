import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "./audit.functions";

export type SaasSettings = {
  id: string;
  name: string;
  logo_url: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  support_info: string | null;
  primary_color: string;
  maintenance_mode: boolean;
  maintenance_message: string | null;
};

export type SaasSettingsInput = {
  name: string;
  logoUrl: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  supportInfo: string | null;
  primaryColor: string;
  maintenanceMode: boolean;
  maintenanceMessage: string | null;
};

export const SAAS_NAME_FALLBACK = "Painel do Dono";
export const MAINTENANCE_FALLBACK =
  "O sistema está em manutenção. Volte em alguns minutos.";

const SELECT =
  "id, name, logo_url, contact_email, contact_phone, support_info, primary_color, maintenance_mode, maintenance_message";

/**
 * Configuração da plataforma. A tabela tem uma linha só, semeada na migração,
 * então na prática isto nunca devolve null — mas os painéis tratam null como
 * "sem manutenção" para nunca travar o acesso por causa de uma leitura falha.
 */
export const getSaasSettings = async (): Promise<SaasSettings | null> => {
  const { data, error } = await supabase.from("saas_settings").select(SELECT).maybeSingle();
  if (error) throw error;
  return (data as SaasSettings) ?? null;
};

export const updateSaasSettings = async (input: SaasSettingsInput): Promise<void> => {
  const { data: before } = await supabase
    .from("saas_settings")
    .select("id, maintenance_mode")
    .maybeSingle();

  if (!before) throw new Error("Configuração do sistema não encontrada.");

  const { error } = await supabase
    .from("saas_settings")
    .update({
      name: input.name,
      logo_url: input.logoUrl,
      contact_email: input.contactEmail,
      contact_phone: input.contactPhone,
      support_info: input.supportInfo,
      primary_color: input.primaryColor,
      maintenance_mode: input.maintenanceMode,
      maintenance_message: input.maintenanceMessage,
    })
    .eq("id", before.id);

  if (error) throw error;

  // Ligar/desligar manutenção tira os painéis das lojas do ar: fica com registro
  // próprio, separado da alteração comum de configuração.
  if (before.maintenance_mode !== input.maintenanceMode) {
    await logAudit({
      action: input.maintenanceMode ? "maintenance_enabled" : "maintenance_disabled",
      module: "configuracoes",
      description: input.maintenanceMode
        ? `Modo manutenção ligado${input.maintenanceMessage ? `: ${input.maintenanceMessage}` : ""}`
        : "Modo manutenção desligado",
    });
  }

  await logAudit({
    action: "saas_settings_updated",
    module: "configuracoes",
    description: `Configurações do sistema alteradas (nome: ${input.name})`,
  });
};
