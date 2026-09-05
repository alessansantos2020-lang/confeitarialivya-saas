import { createFileRoute } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getStoreSettings, type StoreSettings } from '@/lib/delivery.functions';
import { supabase } from '@/integrations/supabase/client';
import { useActiveStore } from '@/lib/active-store';
import { logAudit } from '@/lib/audit.functions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from 'sonner';
import { useState, useEffect } from 'react';
import { Loader2, Save, Phone, Instagram, MapPin, Layout, Globe, Palette, MessageCircle } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Copy } from 'lucide-react';
import { ImageUpload } from '@/components/admin/ImageUpload';

export const Route = createFileRoute('/admin/settings')({
  beforeLoad: () => {
    return;
  },
  component: AdminSettings,
});

function AdminSettings() {
  const queryClient = useQueryClient();
  const { store, storeId } = useActiveStore();

  const { data: remoteSettings, isLoading } = useQuery({
    queryKey: ["storeSettings", storeId],
    queryFn: () => getStoreSettings(storeId),
  });

  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const siteOrigin = typeof window !== "undefined" ? window.location.origin : "";
  const publicStoreUrl = `${siteOrigin}/${store.slug}`;

  useEffect(() => {
    if (remoteSettings) {
      setSettings(remoteSettings);
    }
  }, [remoteSettings]);

  useEffect(() => {
    const channel = supabase
      .channel(`admin_settings_sync_${storeId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'store_settings',
          filter: `store_id=eq.${storeId}`,
        },
        (payload) => {
          if (payload.new) {
            setSettings(payload.new as StoreSettings);
          }
        }
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
        .from('store_settings')
        .select('id')
        .eq('store_id', storeId)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('store_settings')
          .update(payload as any)
          .eq('store_id', storeId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('store_settings')
          .insert(payload as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["storeSettings", storeId] });
      toast.success("Configurações salvas com sucesso!");
      logAudit({
        action: 'settings_updated',
        module: 'configuracoes',
        storeId,
        description: 'Configurações da loja alteradas',
      });
    },
    onError: (error) => {
      console.error(error);
      toast.error("Erro ao salvar configurações.");
    },
    onSettled: () => {
      setIsSaving(false);
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    setIsSaving(true);
    updateMutation.mutate(settings);
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
        <TabsList className="grid w-full grid-cols-5 md:w-auto md:inline-flex mb-4">
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
              <CardDescription>Estes são os links para acessar as diferentes áreas do sistema.</CardDescription>
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
                  <p className="text-[10px] text-slate-400">Este é o endereço público para os seus clientes.</p>
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
                  <p className="text-[10px] text-slate-400">Tela pra sua equipe acompanhar e atualizar os pedidos.</p>
                </div>

              </div>

              <div className="p-4 bg-pink-50 rounded-xl border border-pink-100">
                <p className="text-sm text-pink-700">
                  <strong>Atenção:</strong> Estes links utilizam o endereço atual do seu site, pronto para ser compartilhado com seus clientes.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>


        <TabsContent value="general" className="space-y-6 outline-none">
          <Card>
            <CardHeader>
              <CardTitle>Informações da Loja</CardTitle>
              <CardDescription>Estes dados serão exibidos na página inicial e no checkout.</CardDescription>
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
                    value={settings.opening_hours || ''} 
                    onChange={(e) => setSettings({ ...settings, opening_hours: e.target.value })}
                    placeholder="Ex: Seg a Sab: 09:00 - 18:00"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Descrição / Bio</Label>
                <Textarea 
                  id="description" 
                  value={settings.description || ''} 
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
                    onChange={async (url) => {
                      setSettings(prev => (prev ? { ...prev, logo_url: url } : prev));
                      // Persist logo change immediately to avoid loss
                      const { error } = await supabase
                        .from('store_settings')
                        .update({ logo_url: url })
                        .eq('store_id', storeId);
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
                    onChange={async (url) => {
                      setSettings(prev => (prev ? { ...prev, cover_url: url } : prev));
                      // Persist cover change immediately to avoid loss
                      const { error } = await supabase
                        .from('store_settings')
                        .update({ cover_url: url })
                        .eq('store_id', storeId);
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
                  <CardDescription className="text-pink-700">Define se a loja está aberta para pedidos agora.</CardDescription>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-sm font-bold ${settings.is_open ? 'text-green-600' : 'text-slate-500'}`}>
                    {settings.is_open ? 'ABERTA' : 'FECHADA'}
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
                    value={settings.phone || ''} 
                    onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
                    placeholder="(00) 0000-0000"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="whatsapp" className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-slate-400" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                    </svg>
                    WhatsApp
                  </Label>
                  <Input 
                    id="whatsapp" 
                    value={settings.whatsapp || ''} 
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
                    value={settings.instagram || ''} 
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
                  value={settings.address || ''} 
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
                      value={settings.primary_color || '#1d4ed8'} 
                      onChange={(e) => setSettings({ ...settings, primary_color: e.target.value })}
                    />
                    <Input 
                      value={settings.primary_color || '#1d4ed8'} 
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
                      value={settings.secondary_color || '#eff6ff'} 
                      onChange={(e) => setSettings({ ...settings, secondary_color: e.target.value })}
                    />
                    <Input 
                      value={settings.secondary_color || '#eff6ff'} 
                      onChange={(e) => setSettings({ ...settings, secondary_color: e.target.value })}
                      placeholder="#000000"
                    />
                  </div>
                  <p className="text-[10px] text-slate-400">Usada em fundos e elementos secundários.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="whatsapp" className="space-y-6 outline-none">
          <Card>
            <CardHeader>
              <CardTitle>Modelos de Mensagem do WhatsApp</CardTitle>
              <CardDescription>Personalize as mensagens automáticas enviadas para os clientes.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="whatsapp_template_recebido">Mensagem: Pedido Recebido</Label>
                  <Textarea 
                    id="whatsapp_template_recebido" 
                    value={settings.whatsapp_template_recebido || ''} 
                    onChange={(e) => setSettings({ ...settings, whatsapp_template_recebido: e.target.value })}
                    rows={6}
                    placeholder="Olá {nome}, seu pedido #{numero_pedido} foi recebido..."
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="whatsapp_template_saida_entrega">Mensagem: Saiu para Entrega</Label>
                  <Textarea 
                    id="whatsapp_template_saida_entrega" 
                    value={settings.whatsapp_template_saida_entrega || ''} 
                    onChange={(e) => setSettings({ ...settings, whatsapp_template_saida_entrega: e.target.value })}
                    rows={6}
                    placeholder="Olá {nome}, boas notícias! Seu pedido #{numero_pedido} saiu para entrega..."
                  />
                </div>

                <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                  <h4 className="text-sm font-bold text-slate-700 mb-2">Placeholders Disponíveis:</h4>
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
                    Esses termos serão substituídos automaticamente pelos dados reais do pedido no momento do envio.
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
