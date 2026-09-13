import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getStoreSettings, type StoreSettings } from "@/lib/delivery.functions";
import { supabase } from "@/integrations/supabase/client";
import { useActiveStore } from "@/lib/active-store";
import { logAudit } from "@/lib/audit.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import {
  FileText,
  Loader2,
  Save,
  Phone,
  Instagram,
  MapPin,
  Layout,
  Globe,
  Palette,
  MessageCircle,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Copy } from "lucide-react";
import { StoreGeneralSettings } from "@/components/admin/settings/store-general-settings";
import { WhatsAppSettings } from "@/components/admin/settings/whatsapp-settings";
import { NfceSettings, type FiscalSettingsForm } from "@/components/admin/settings/nfce-settings";

const EMPTY_FISCAL_SETTINGS: FiscalSettingsForm = {
  cnpj: "",
  legal_name: "",
  trade_name: "",
  state_registration: "",
  tax_regime: "",
  series: "1",
  environment: "homologation",
  provider: "",
};

export const Route = createFileRoute("/admin/settings")({
  beforeLoad: () => {
    return;
  },
  component: AdminSettings,
});

function AdminSettings() {
  const queryClient = useQueryClient();
  const { store, storeId, hasFeature } = useActiveStore();
  const hasNfce = hasFeature("nfce");

  const { data: remoteSettings, isLoading } = useQuery({
    queryKey: ["storeSettings", storeId],
    queryFn: () => getStoreSettings(storeId),
  });

  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [fiscalSettings, setFiscalSettings] = useState<FiscalSettingsForm>(EMPTY_FISCAL_SETTINGS);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingFiscal, setIsSavingFiscal] = useState(false);
  const siteOrigin = typeof window !== "undefined" ? window.location.origin : "";
  const publicStoreUrl = `${siteOrigin}/${store.slug}`;

  useEffect(() => {
    if (remoteSettings) {
      setSettings(remoteSettings);
    }
  }, [remoteSettings]);

  const { data: remoteFiscalSettings, isLoading: isFiscalLoading } = useQuery({
    queryKey: ["fiscal-settings", storeId],
    enabled: hasNfce,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fiscal_settings")
        .select(
          "cnpj, legal_name, trade_name, state_registration, tax_regime, series, environment, provider",
        )
        .eq("store_id", storeId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (remoteFiscalSettings) {
      setFiscalSettings({
        cnpj: remoteFiscalSettings.cnpj || "",
        legal_name: remoteFiscalSettings.legal_name || "",
        trade_name: remoteFiscalSettings.trade_name || "",
        state_registration: remoteFiscalSettings.state_registration || "",
        tax_regime: remoteFiscalSettings.tax_regime || "",
        series: remoteFiscalSettings.series || "1",
        environment:
          remoteFiscalSettings.environment === "production" ? "production" : "homologation",
        provider: remoteFiscalSettings.provider || "",
      });
    }
  }, [remoteFiscalSettings]);

  useEffect(() => {
    const channel = supabase
      .channel(`admin_settings_sync_${storeId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "store_settings",
          filter: `store_id=eq.${storeId}`,
        },
        (payload) => {
          if (payload.new) {
            setSettings(payload.new as StoreSettings);
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [storeId]);

  const updateMutation = useMutation({
    mutationFn: async (newSettings: StoreSettings) => {
      const payload = { ...newSettings, store_id: storeId };

      const { data: existing } = await supabase
        .from("store_settings")
        .select("id")
        .eq("store_id", storeId)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("store_settings")
          .update(payload as never)
          .eq("store_id", storeId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("store_settings").insert(payload as never);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["storeSettings", storeId] });
      toast.success("Configurações salvas com sucesso!");
      logAudit({
        action: "settings_updated",
        module: "configuracoes",
        storeId,
        description: "Configurações da loja alteradas",
      });
    },
    onError: (error) => {
      console.error(error);
      toast.error("Erro ao salvar configurações.");
    },
    onSettled: () => {
      setIsSaving(false);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    setIsSaving(true);
    updateMutation.mutate(settings);
  };

  const handleFiscalSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSavingFiscal(true);
    try {
      const { error } = await supabase.from("fiscal_settings").upsert(
        {
          store_id: storeId,
          document_type: "nfce",
          ...fiscalSettings,
          cnpj: fiscalSettings.cnpj.trim() || null,
          legal_name: fiscalSettings.legal_name.trim() || null,
          trade_name: fiscalSettings.trade_name.trim() || null,
          state_registration: fiscalSettings.state_registration.trim() || null,
          tax_regime: fiscalSettings.tax_regime.trim() || null,
          provider: fiscalSettings.provider.trim() || null,
        } as never,
        { onConflict: "store_id" },
      );
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["fiscal-settings", storeId] });
      toast.success("Configuração NFC-e salva.");
    } catch (error) {
      console.error(error);
      toast.error("Não foi possível salvar a configuração NFC-e.");
    } finally {
      setIsSavingFiscal(false);
    }
  };

  if (isLoading || !settings) {
    return (
      <div className="p-12 flex justify-center">
        <Loader2 className="animate-spin text-pink-600" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Configurações</h1>
          <p className="text-slate-500">Gerencie as informações públicas e visuais da sua loja.</p>
        </div>
        <Button
          onClick={handleSubmit}
          className="bg-pink-600 hover:bg-pink-700 min-w-[150px]"
          disabled={isSaving}
        >
          {isSaving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Salvando...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Salvar Alterações
            </>
          )}
        </Button>
      </div>

      <Tabs defaultValue="general" className="w-full">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 md:w-auto md:inline-flex mb-4">
          <TabsTrigger value="general" className="flex items-center gap-2">
            <Layout className="w-4 h-4" />
            Geral
          </TabsTrigger>
          <TabsTrigger value="contact" className="flex items-center gap-2">
            <Globe className="w-4 h-4" />
            Contato & Redes
          </TabsTrigger>
          <TabsTrigger value="visual" className="flex items-center gap-2">
            <Palette className="w-4 h-4" />
            Visual
          </TabsTrigger>
          {hasNfce && (
            <TabsTrigger value="nfce" className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              NFC-e
            </TabsTrigger>
          )}
          <TabsTrigger value="whatsapp" className="flex items-center gap-2">
            <MessageCircle className="w-4 h-4" />
            Mensagens WhatsApp
          </TabsTrigger>
          <TabsTrigger value="links" className="flex items-center gap-2">
            <Globe className="w-4 h-4" />
            Links do Painel
          </TabsTrigger>
        </TabsList>

        <TabsContent value="links" className="space-y-6 outline-none">
          <Card>
            <CardHeader>
              <CardTitle>Links de Acesso</CardTitle>
              <CardDescription>
                Estes são os links para acessar as diferentes áreas do sistema.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Link do Delivery (Oficial)</Label>
                  <div className="flex gap-2">
                    <Input readOnly value={publicStoreUrl} />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        navigator.clipboard.writeText(publicStoreUrl);
                        toast.success("Link oficial copiado!");
                      }}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-[10px] text-slate-400">
                    Este é o endereço público para os seus clientes.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Link do Painel Administrativo</Label>
                  <div className="flex gap-2">
                    <Input readOnly value={`${siteOrigin}/admin`} />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        navigator.clipboard.writeText(`${siteOrigin}/admin`);
                        toast.success("Link do painel copiado!");
                      }}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Link do Painel de Pedidos</Label>
                  <div className="flex gap-2">
                    <Input readOnly value={`${siteOrigin}/staff`} />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        navigator.clipboard.writeText(`${siteOrigin}/staff`);
                        toast.success("Link do painel de pedidos copiado!");
                      }}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-[10px] text-slate-400">
                    Tela pra sua equipe acompanhar e atualizar os pedidos.
                  </p>
                </div>
              </div>

              <div className="p-4 bg-pink-50 rounded-xl border border-pink-100">
                <p className="text-sm text-pink-700">
                  <strong>Atenção:</strong> Estes links utilizam o endereço atual do seu site,
                  pronto para ser compartilhado com seus clientes.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="general" className="space-y-6 outline-none">
          <StoreGeneralSettings
            settings={settings}
            setSettings={setSettings}
            storeId={storeId}
            queryClient={queryClient}
            section="general"
          />
        </TabsContent>

        <TabsContent value="contact" className="space-y-6 outline-none">
          <StoreGeneralSettings
            settings={settings}
            setSettings={setSettings}
            storeId={storeId}
            queryClient={queryClient}
            section="contact"
          />
        </TabsContent>

        <TabsContent value="visual" className="space-y-6 outline-none">
          <StoreGeneralSettings
            settings={settings}
            setSettings={setSettings}
            storeId={storeId}
            queryClient={queryClient}
            section="visual"
          />
        </TabsContent>
        {hasNfce && (
          <TabsContent value="nfce" className="space-y-6 outline-none">
            <NfceSettings
              fiscalSettings={fiscalSettings}
              setFiscalSettings={setFiscalSettings}
              isLoading={isFiscalLoading}
              isSaving={isSavingFiscal}
              onSubmit={handleFiscalSubmit}
            />
          </TabsContent>
        )}

        <TabsContent value="whatsapp" className="space-y-6 outline-none">
          <WhatsAppSettings settings={settings} setSettings={setSettings} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
