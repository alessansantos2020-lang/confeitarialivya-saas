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
import { ImageUpload } from "@/components/admin/ImageUpload";

type FiscalSettingsForm = {
  cnpj: string;
  legal_name: string;
  trade_name: string;
  state_registration: string;
  tax_regime: string;
  series: string;
  environment: "homologation" | "production";
  provider: string;
};

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
          <Card>
            <CardHeader>
              <CardTitle>Informações da Loja</CardTitle>
              <CardDescription>
                Estes dados serão exibidos na página inicial e no checkout.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome da Loja</Label>
                  <Input
                    id="name"
                    value={settings.name}
                    onChange={(e) => setSettings({ ...settings, name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="opening_hours">Horário de Funcionamento</Label>
                  <Input
                    id="opening_hours"
                    value={settings.opening_hours || ""}
                    onChange={(e) => setSettings({ ...settings, opening_hours: e.target.value })}
                    placeholder="Ex: Seg a Sab: 09:00 - 18:00"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Descrição / Bio</Label>
                <Textarea
                  id="description"
                  value={settings.description || ""}
                  onChange={(e) => setSettings({ ...settings, description: e.target.value })}
                  rows={3}
                  placeholder="Conte um pouco sobre a sua loja..."
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <Label>Logo da Loja</Label>
                  <ImageUpload
                    value={settings.logo_url}
                    storeId={storeId}
                    onChange={async (url) => {
                      setSettings((prev) => (prev ? { ...prev, logo_url: url } : prev));
                      // Persist logo change immediately to avoid loss
                      const { error } = await supabase
                        .from("store_settings")
                        .update({ logo_url: url })
                        .eq("store_id", storeId);
                      if (error) {
                        console.error("Error updating logo:", error);
                        toast.error("Erro ao salvar logo no banco.");
                      }
                      queryClient.invalidateQueries({ queryKey: ["storeSettings", storeId] });
                    }}
                    folder="store"
                  />
                </div>

                <div className="space-y-4">
                  <Label>Imagem de Capa</Label>
                  <ImageUpload
                    value={settings.cover_url}
                    storeId={storeId}
                    onChange={async (url) => {
                      setSettings((prev) => (prev ? { ...prev, cover_url: url } : prev));
                      // Persist cover change immediately to avoid loss
                      const { error } = await supabase
                        .from("store_settings")
                        .update({ cover_url: url })
                        .eq("store_id", storeId);
                      if (error) {
                        console.error("Error updating cover:", error);
                        toast.error("Erro ao salvar capa no banco.");
                      }
                      queryClient.invalidateQueries({ queryKey: ["storeSettings", storeId] });
                    }}
                    folder="store"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between p-4 bg-pink-50 rounded-xl border border-pink-100">
                <div className="space-y-0.5">
                  <Label className="text-base font-bold text-pink-900">Status da Loja</Label>
                  <CardDescription className="text-pink-700">
                    Define se a loja está aberta para pedidos agora.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`text-sm font-bold ${settings.is_open ? "text-green-600" : "text-slate-500"}`}
                  >
                    {settings.is_open ? "ABERTA" : "FECHADA"}
                  </span>
                  <Switch
                    checked={settings.is_open}
                    onCheckedChange={(checked) => setSettings({ ...settings, is_open: checked })}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contact" className="space-y-6 outline-none">
          <Card>
            <CardHeader>
              <CardTitle>Contato e Redes Sociais</CardTitle>
              <CardDescription>Facilite a comunicação com seus clientes.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="phone" className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-slate-400" />
                    Telefone
                  </Label>
                  <Input
                    id="phone"
                    value={settings.phone || ""}
                    onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
                    placeholder="(00) 0000-0000"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="whatsapp" className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-slate-400" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                    </svg>
                    WhatsApp
                  </Label>
                  <Input
                    id="whatsapp"
                    value={settings.whatsapp || ""}
                    onChange={(e) => setSettings({ ...settings, whatsapp: e.target.value })}
                    placeholder="Número com DDD (apenas números)"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="instagram" className="flex items-center gap-2">
                    <Instagram className="w-4 h-4 text-slate-400" />
                    Instagram
                  </Label>
                  <Input
                    id="instagram"
                    value={settings.instagram || ""}
                    onChange={(e) => setSettings({ ...settings, instagram: e.target.value })}
                    placeholder="@sualoja"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="address" className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-slate-400" />
                  Endereço Completo
                </Label>
                <Textarea
                  id="address"
                  value={settings.address || ""}
                  onChange={(e) => setSettings({ ...settings, address: e.target.value })}
                  rows={2}
                  placeholder="Rua, Número, Bairro, Cidade - Estado"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="visual" className="space-y-6 outline-none">
          <Card>
            <CardHeader>
              <CardTitle>Identidade Visual</CardTitle>
              <CardDescription>Personalize as cores da sua marca no delivery.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="primary_color">Cor Principal</Label>
                  <div className="flex gap-2">
                    <Input
                      id="primary_color"
                      type="color"
                      className="w-12 h-10 p-1"
                      value={settings.primary_color || "#1d4ed8"}
                      onChange={(e) => setSettings({ ...settings, primary_color: e.target.value })}
                    />
                    <Input
                      value={settings.primary_color || "#1d4ed8"}
                      onChange={(e) => setSettings({ ...settings, primary_color: e.target.value })}
                      placeholder="#000000"
                    />
                  </div>
                  <p className="text-[10px] text-slate-400">Usada em botões, links e destaques.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="secondary_color">Cor Secundária</Label>
                  <div className="flex gap-2">
                    <Input
                      id="secondary_color"
                      type="color"
                      className="w-12 h-10 p-1"
                      value={settings.secondary_color || "#eff6ff"}
                      onChange={(e) =>
                        setSettings({ ...settings, secondary_color: e.target.value })
                      }
                    />
                    <Input
                      value={settings.secondary_color || "#eff6ff"}
                      onChange={(e) =>
                        setSettings({ ...settings, secondary_color: e.target.value })
                      }
                      placeholder="#000000"
                    />
                  </div>
                  <p className="text-[10px] text-slate-400">
                    Usada em fundos e elementos secundários.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        {hasNfce && (
          <TabsContent value="nfce" className="space-y-6 outline-none">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-pink-600" />
                  Configuração NFC-e
                </CardTitle>
                <CardDescription>
                  Cadastre os dados fiscais básicos da loja para futura integração de emissão.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isFiscalLoading ? (
                  <div className="py-8 flex justify-center">
                    <Loader2 className="animate-spin text-pink-600" />
                  </div>
                ) : (
                  <form onSubmit={handleFiscalSubmit} className="space-y-5">
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                      Esta tela apenas salva configuração. Emissão de NFC-e ainda está indisponível
                      porque nenhum provedor fiscal foi conectado. Não informe certificado digital,
                      senha, token ou chave secreta aqui.
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="fiscal-cnpj">CNPJ</Label>
                        <Input
                          id="fiscal-cnpj"
                          value={fiscalSettings.cnpj}
                          onChange={(e) =>
                            setFiscalSettings({ ...fiscalSettings, cnpj: e.target.value })
                          }
                          placeholder="00.000.000/0000-00"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="fiscal-ie">Inscrição estadual</Label>
                        <Input
                          id="fiscal-ie"
                          value={fiscalSettings.state_registration}
                          onChange={(e) =>
                            setFiscalSettings({
                              ...fiscalSettings,
                              state_registration: e.target.value,
                            })
                          }
                          placeholder="Inscrição estadual"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="fiscal-legal-name">Razão social</Label>
                        <Input
                          id="fiscal-legal-name"
                          value={fiscalSettings.legal_name}
                          onChange={(e) =>
                            setFiscalSettings({ ...fiscalSettings, legal_name: e.target.value })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="fiscal-trade-name">Nome fantasia</Label>
                        <Input
                          id="fiscal-trade-name"
                          value={fiscalSettings.trade_name}
                          onChange={(e) =>
                            setFiscalSettings({ ...fiscalSettings, trade_name: e.target.value })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="fiscal-tax-regime">Regime tributário</Label>
                        <Input
                          id="fiscal-tax-regime"
                          value={fiscalSettings.tax_regime}
                          onChange={(e) =>
                            setFiscalSettings({ ...fiscalSettings, tax_regime: e.target.value })
                          }
                          placeholder="Ex.: Simples Nacional"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="fiscal-series">Série</Label>
                        <Input
                          id="fiscal-series"
                          value={fiscalSettings.series}
                          onChange={(e) =>
                            setFiscalSettings({ ...fiscalSettings, series: e.target.value })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="fiscal-environment">Ambiente</Label>
                        <Select
                          value={fiscalSettings.environment}
                          onValueChange={(value: "homologation" | "production") =>
                            setFiscalSettings({ ...fiscalSettings, environment: value })
                          }
                        >
                          <SelectTrigger id="fiscal-environment">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="homologation">Homologação (testes)</SelectItem>
                            <SelectItem value="production">Produção</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="fiscal-provider">Provedor fiscal</Label>
                        <Input
                          id="fiscal-provider"
                          value={fiscalSettings.provider}
                          onChange={(e) =>
                            setFiscalSettings({ ...fiscalSettings, provider: e.target.value })
                          }
                          placeholder="Ainda não definido"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <Button type="submit" disabled={isSavingFiscal} className="gap-2">
                        {isSavingFiscal ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Save className="w-4 h-4" />
                        )}
                        Salvar configuração NFC-e
                      </Button>
                    </div>
                  </form>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        <TabsContent value="whatsapp" className="space-y-6 outline-none">
          <Card>
            <CardHeader>
              <CardTitle>Modelos de Mensagem do WhatsApp</CardTitle>
              <CardDescription>
                Personalize as mensagens automáticas enviadas para os clientes.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-4">
                <div>
                  <h4 className="font-semibold text-slate-800">Avisos automáticos</h4>
                  <p className="text-xs text-slate-500 mt-1">
                    Controle quando a Central de Pedidos pode abrir o WhatsApp para avisar o
                    cliente.
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="flex items-center justify-between gap-3 rounded-lg bg-white border border-slate-200 p-3">
                    <Label htmlFor="auto_notify_whatsapp" className="text-sm cursor-pointer">
                      Ativar avisos automáticos
                    </Label>
                    <Switch
                      id="auto_notify_whatsapp"
                      checked={settings.auto_notify_whatsapp}
                      onCheckedChange={(checked) =>
                        setSettings({ ...settings, auto_notify_whatsapp: checked })
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between gap-3 rounded-lg bg-white border border-slate-200 p-3">
                    <Label htmlFor="whatsapp_accept_enabled" className="text-sm cursor-pointer">
                      Pedido aceito
                    </Label>
                    <Switch
                      id="whatsapp_accept_enabled"
                      checked={settings.whatsapp_accept_enabled}
                      onCheckedChange={(checked) =>
                        setSettings({ ...settings, whatsapp_accept_enabled: checked })
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between gap-3 rounded-lg bg-white border border-slate-200 p-3">
                    <Label htmlFor="whatsapp_shipping_enabled" className="text-sm cursor-pointer">
                      Saiu para entrega
                    </Label>
                    <Switch
                      id="whatsapp_shipping_enabled"
                      checked={settings.whatsapp_shipping_enabled}
                      onCheckedChange={(checked) =>
                        setSettings({ ...settings, whatsapp_shipping_enabled: checked })
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between gap-3 rounded-lg bg-white border border-slate-200 p-3">
                    <Label htmlFor="whatsapp_cancel_enabled" className="text-sm cursor-pointer">
                      Pedido cancelado
                    </Label>
                    <Switch
                      id="whatsapp_cancel_enabled"
                      checked={settings.whatsapp_cancel_enabled}
                      onCheckedChange={(checked) =>
                        setSettings({ ...settings, whatsapp_cancel_enabled: checked })
                      }
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="whatsapp_template_recebido">Mensagem: Pedido Recebido</Label>
                  <Textarea
                    id="whatsapp_template_recebido"
                    value={settings.whatsapp_template_recebido || ""}
                    onChange={(e) =>
                      setSettings({ ...settings, whatsapp_template_recebido: e.target.value })
                    }
                    rows={6}
                    placeholder="Olá {nome}, seu pedido #{numero_pedido} foi recebido..."
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="whatsapp_template_aceito">Mensagem: Pedido Aceito</Label>
                  <Textarea
                    id="whatsapp_template_aceito"
                    value={settings.whatsapp_template_aceito || ""}
                    onChange={(e) =>
                      setSettings({ ...settings, whatsapp_template_aceito: e.target.value })
                    }
                    rows={6}
                    placeholder="Olá {nome}, seu pedido #{numero_pedido} foi aceito e já está sendo preparado..."
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="whatsapp_template_saida_entrega">
                    Mensagem: Saiu para Entrega
                  </Label>
                  <Textarea
                    id="whatsapp_template_saida_entrega"
                    value={settings.whatsapp_template_saida_entrega || ""}
                    onChange={(e) =>
                      setSettings({ ...settings, whatsapp_template_saida_entrega: e.target.value })
                    }
                    rows={6}
                    placeholder="Olá {nome}, boas notícias! Seu pedido #{numero_pedido} saiu para entrega..."
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="whatsapp_template_cancelado">Mensagem: Pedido Cancelado</Label>
                  <Textarea
                    id="whatsapp_template_cancelado"
                    value={settings.whatsapp_template_cancelado || ""}
                    onChange={(e) =>
                      setSettings({ ...settings, whatsapp_template_cancelado: e.target.value })
                    }
                    rows={6}
                    placeholder="Olá {nome}, seu pedido #{numero_pedido} foi cancelado. Motivo: {motivo_cancelamento}"
                  />
                </div>

                <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                  <h4 className="text-sm font-bold text-slate-700 mb-2">
                    Placeholders Disponíveis:
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-slate-600">
                    <code>{"{nome}"}</code>
                    <code>{"{numero_pedido}"}</code>
                    <code>{"{itens}"}</code>
                    <code>{"{total}"}</code>
                    <code>{"{pagamento}"}</code>
                    <code>{"{endereco}"}</code>
                    <code>{"{loja}"}</code>
                  </div>
                  <p className="mt-3 text-[10px] text-slate-400 italic">
                    Esses termos serão substituídos automaticamente pelos dados reais do pedido no
                    momento do envio.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
