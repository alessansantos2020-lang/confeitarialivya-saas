import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Eye, Phone } from "lucide-react";
import { ORDER_STATUS_STYLE, paymentMethodLabel } from "@/lib/order-status";
import type { OrderWithItems } from "@/lib/orders-admin.functions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function OrderDetailsDialog({
  order,
  disabled,
}: {
  order: OrderWithItems;
  disabled?: boolean;
}) {
  const meta = ORDER_STATUS_STYLE[order.status];
  const items = order.order_items || [];

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-8 flex-1 gap-1 text-xs text-slate-700"
          disabled={disabled}
        >
          <Eye className="h-3.5 w-3.5" /> Detalhes
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-bold">
              Pedido #{order.id.slice(0, 8).toUpperCase()}
            </DialogTitle>
            <Badge className={`${meta.color} text-[10px] font-bold uppercase`}>{meta.label}</Badge>
          </div>
        </DialogHeader>
        <div className="space-y-4 py-2 text-sm">
          <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3.5">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <div>
                <p className="font-bold text-slate-900">{order.customer_name}</p>
                <p className="flex items-center gap-1 text-xs text-slate-500">
                  <Phone className="h-3 w-3" /> {order.customer_phone || "Sem telefone"}
                </p>
              </div>
              <span className="text-xs text-slate-400">
                {order.created_at
                  ? format(new Date(order.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                  : ""}
              </span>
            </div>
            <div className="space-y-1 pt-1 text-xs text-slate-600">
              <p>
                <strong>Endereço:</strong> {order.address || "Não informado"}
              </p>
              {order.reference && (
                <p>
                  <strong>Referência:</strong> {order.reference}
                </p>
              )}
              {order.observation && (
                <p className="mt-1 rounded border border-amber-200 bg-amber-50 p-2 text-amber-800">
                  <strong>Observação:</strong> {order.observation}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="border-b pb-1 text-xs font-bold uppercase tracking-wider text-slate-500">
              Itens do Pedido ({items.length})
            </h4>
            <div className="space-y-2">
              {items.map((item) => {
                const addons = getAddonPreviews(item.selected_addons);
                return (
                  <div key={item.id} className="rounded-lg border border-slate-100 bg-white p-2.5">
                    <div className="flex justify-between font-medium text-slate-900">
                      <span>
                        {item.quantity}x {item.product_name || item.product?.name || "Produto"}
                      </span>
                      <span>{money(Number(item.price_at_time) * item.quantity)}</span>
                    </div>
                    {addons.length > 0 && (
                      <div className="space-y-0.5 pl-4 pt-1 text-xs text-slate-500">
                        {addons.map((addon, index) => (
                          <div key={index} className="flex justify-between italic">
                            <span>+ {addon.name}</span>
                            {addon.price ? <span>{money(addon.price)}</span> : null}
                          </div>
                        ))}
                      </div>
                    )}
                    {item.observation && (
                      <p className="mt-1.5 rounded bg-amber-50 p-1.5 text-xs italic text-amber-700">
                        Obs: {item.observation}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-2 rounded-xl bg-slate-900 p-4 text-white">
            <div className="flex justify-between text-xs text-slate-400">
              <span>Subtotal dos produtos</span>
              <span>{money((order.total_amount || 0) - Number(order.delivery_fee || 0))}</span>
            </div>
            <div className="flex justify-between text-xs text-slate-400">
              <span>Taxa de entrega</span>
              <span>{money(Number(order.delivery_fee || 0))}</span>
            </div>
            <div className="flex justify-between border-t border-slate-800 pt-1 text-xs text-slate-300">
              <span>Pagamento</span>
              <span className="font-bold uppercase">
                {paymentMethodLabel(order.payment_method)}
              </span>
            </div>
            <div className="flex justify-between border-t border-slate-800 pt-1 text-base font-black text-pink-400">
              <span>Total</span>
              <span>{money(order.total_amount)}</span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

type AddonPreview = { name?: string; price?: number };

function isAddon(value: unknown): value is AddonPreview {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseJson(value: string): AddonPreview[] {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter(isAddon) : [];
  } catch {
    return [];
  }
}

function getAddonPreviews(value: unknown): AddonPreview[] {
  if (typeof value === "string") return parseJson(value);
  return Array.isArray(value) ? value.filter(isAddon) : [];
}

function money(value: number | null | undefined) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0);
}
