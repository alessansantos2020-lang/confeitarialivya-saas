import { setSelectedStoreId } from "./store-context";
import { logAudit } from "./audit.functions";

/**
 * ACESSO DE SUPORTE (Super Admin entra no painel de uma loja)
 *
 * Como funciona: o Super Admin JÁ tem acesso às lojas pelo próprio papel
 * (private.is_super_admin no RLS). Então "entrar como suporte" é só apontar o
 * painel para a loja escolhida — nada de senha do dono, nada de credencial
 * criada ou copiada. A sessão continua sendo a do Super Admin.
 *
 * O marcador fica em sessionStorage: fecha o navegador, acaba o modo suporte.
 */

const SUPPORT_KEY = "livya:support-session";

export type SupportSession = {
  storeId: string;
  storeName: string;
  startedAt: string;
};

export const getSupportSession = (): SupportSession | null => {
  if (typeof sessionStorage === "undefined") return null;
  const raw = sessionStorage.getItem(SUPPORT_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SupportSession;
  } catch {
    sessionStorage.removeItem(SUPPORT_KEY);
    return null;
  }
};

export const startSupportSession = async (storeId: string, storeName: string): Promise<void> => {
  const session: SupportSession = {
    storeId,
    storeName,
    startedAt: new Date().toISOString(),
  };

  sessionStorage.setItem(SUPPORT_KEY, JSON.stringify(session));
  setSelectedStoreId(storeId);

  await logAudit({
    action: "support_access_start",
    module: "suporte",
    storeId,
    description: `Acessou o painel da loja "${storeName}" como suporte`,
  });
};

export const endSupportSession = async (): Promise<void> => {
  const session = getSupportSession();
  sessionStorage.removeItem(SUPPORT_KEY);

  if (session) {
    await logAudit({
      action: "support_access_end",
      module: "suporte",
      storeId: session.storeId,
      description: `Encerrou o acesso de suporte à loja "${session.storeName}"`,
    });
  }
};
