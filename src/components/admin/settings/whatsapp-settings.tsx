import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { StoreSettings } from "@/lib/delivery.functions";

export function WhatsAppSettings({
  settings,
  setSettings,
}: {
  settings: StoreSettings;
  setSettings: React.Dispatch<React.SetStateAction<StoreSettings | null>>;
}) {
  return (
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
              Controle quando a Central de Pedidos pode abrir o WhatsApp para avisar o cliente.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {(
              [
                ["auto_notify_whatsapp", "Ativar avisos automáticos"],
                ["whatsapp_accept_enabled", "Pedido aceito"],
                ["whatsapp_shipping_enabled", "Saiu para entrega"],
                ["whatsapp_cancel_enabled", "Pedido cancelado"],
              ] as const
            ).map(([id, label]) => (
              <div
                key={id}
                className="flex items-center justify-between gap-3 rounded-lg bg-white border border-slate-200 p-3"
              >
                <Label htmlFor={id} className="text-xs sm:text-sm cursor-pointer min-w-0 pr-1">
                  {label}
                </Label>
                <Switch
                  id={id}
                  className="shrink-0"
                  checked={settings[id]}
                  onCheckedChange={(checked) => setSettings({ ...settings, [id]: checked })}
                />
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-4">
          {(
            [
              [
                "whatsapp_template_recebido",
                "Mensagem: Pedido Recebido",
                "Olá {nome}, seu pedido #{numero_pedido} foi recebido...",
              ],
              [
                "whatsapp_template_aceito",
                "Mensagem: Pedido Aceito",
                "Olá {nome}, seu pedido #{numero_pedido} foi aceito e já está sendo preparado...",
              ],
              [
                "whatsapp_template_saida_entrega",
                "Mensagem: Saiu para Entrega",
                "Olá {nome}, boas notícias! Seu pedido #{numero_pedido} saiu para entrega...",
              ],
              [
                "whatsapp_template_cancelado",
                "Mensagem: Pedido Cancelado",
                "Olá {nome}, seu pedido #{numero_pedido} foi cancelado. Motivo: {motivo_cancelamento}",
              ],
            ] as const
          ).map(([id, label, placeholder]) => (
            <div key={id} className="space-y-2">
              <Label htmlFor={id}>{label}</Label>
              <Textarea
                id={id}
                value={settings[id] || ""}
                onChange={(e) => setSettings({ ...settings, [id]: e.target.value })}
                rows={6}
                placeholder={placeholder}
              />
            </div>
          ))}
          <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
            <h4 className="text-sm font-bold text-slate-700 mb-2">Placeholders Disponíveis:</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-slate-600">
              {[
                "{nome}",
                "{numero_pedido}",
                "{itens}",
                "{total}",
                "{pagamento}",
                "{endereco}",
                "{loja}",
              ].map((value) => (
                <code key={value}>{value}</code>
              ))}
            </div>
            <p className="mt-3 text-[10px] text-slate-400 italic">
              Esses termos serão substituídos automaticamente pelos dados reais do pedido no momento
              do envio.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
