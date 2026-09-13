import { Instagram, MapPin, Phone } from "lucide-react";
import { ImageUpload } from "@/components/admin/ImageUpload";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import type { StoreSettings } from "@/lib/delivery.functions";
import type { QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function StoreGeneralSettings({
  settings,
  setSettings,
  storeId,
  queryClient,
  section = "general",
}: {
  settings: StoreSettings;
  setSettings: React.Dispatch<React.SetStateAction<StoreSettings | null>>;
  storeId: string;
  queryClient: QueryClient;
  section?: "general" | "contact" | "visual";
}) {
  return (
    <>
      {section === "general" && (
        <div data-settings-section="general">
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
        </div>
      )}
      {section === "contact" && (
        <div data-settings-section="contact">
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
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
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
        </div>
      )}
      {section === "visual" && (
        <div data-settings-section="visual">
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
        </div>
      )}
    </>
  );
}
