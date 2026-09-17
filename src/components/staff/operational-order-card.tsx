import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowRight, Ban, Clock, Eye, Loader2, MapPin, MessageCircle, Printer } from "lucide-react";
import {
  OPERATIONAL_ACTION_LABEL,
  ORDER_STATUS_STYLE,
  canCancel,
  nextStatus,
  paymentMethodLabel,
} from "@/lib/order-status";
import type { OrderWithItems } from "@/lib/orders-admin.functions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { OrderDetailsDialog } from "./order-details-dialog";

export function OperationalOrderCard({
  order,
  onAdvance,
  onCancelRequest,
  onPrint,
  onNotifyWhatsApp,
  isUpdating,
}: {
  order: OrderWithItems;
  onAdvance: (order: OrderWithItems) => void;
  onCancelRequest: (order: OrderWithItems) => void;
  onPrint: (order: OrderWithItems) => void;
  onNotifyWhatsApp: (order: OrderWithItems) => void;
  isUpdating: boolean;
}) {
  const meta = ORDER_STATUS_STYLE[order.status];
  const next = nextStatus(order.status);
  const actionLabel = OPERATIONAL_ACTION_LABEL[order.status];
  const cancellable = canCancel(order.status);
  const isNew = order.status === "pending";

  return (
    <Card
      className={`overflow-hidden border bg-white transition-all ${isNew ? "border-blue-500 shadow-sm ring-1 ring-blue-400/40" : "border-slate-200 hover:border-slate-300 hover:shadow-sm"}`}
    >
      <div
        className={`flex items-center justify-between p-2 px-3 text-xs ${isNew ? "bg-blue-600 text-white" : "border-b border-slate-100 bg-slate-50 text-slate-600"}`}
      >
        <div className="flex items-center gap-1.5">
          <span className="font-mono font-bold">#{order.id.slice(0, 8).toUpperCase()}</span>
          {isNew && (
            <Badge className="h-4 bg-white px-1 text-[9px] font-extrabold uppercase text-blue-700">
              Novo
            </Badge>
          )}
        </div>
        <span className="flex items-center gap-1 text-[11px] font-medium">
          <Clock className="h-3 w-3" />
          {order.created_at
            ? format(new Date(order.created_at), "HH:mm", { locale: ptBR })
            : "--:--"}
        </span>
      </div>

      <CardContent className="space-y-2.5 p-3">
        <div>
          <h4 className="truncate text-sm font-bold text-slate-900" title={order.customer_name}>
            {order.customer_name}
          </h4>
          <div className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
            <MapPin className="h-3 w-3 shrink-0 text-slate-400" />
            <span className="truncate">
              {order.neighborhood || order.address || "Endereço não informado"}
            </span>
          </div>
        </div>

        <div className="space-y-1 rounded-lg border border-slate-100 bg-slate-50 p-2 text-xs">
          {order.order_items?.length ? (
            order.order_items.slice(0, 3).map((item, index) => (
              <div key={item.id || index} className="flex justify-between truncate text-slate-700">
                <span className="truncate">
                  <strong>{item.quantity}x</strong>{" "}
                  {item.product_name || item.product?.name || "Produto"}
                </span>
                <span className="ml-1 shrink-0 font-medium text-slate-600">
                  {money(Number(item.price_at_time) * item.quantity)}
                </span>
              </div>
            ))
          ) : (
            <p className="italic text-slate-400">Sem itens listados</p>
          )}
          {order.order_items && order.order_items.length > 3 && (
            <p className="pt-0.5 text-[10px] font-medium text-slate-500">
              + {order.order_items.length - 3} outro(s) item(ns)...
            </p>
          )}
        </div>

        {order.observation && (
          <div className="line-clamp-2 rounded border border-amber-200/60 bg-amber-50 p-1.5 text-[11px] italic text-amber-800">
            Obs: {order.observation}
          </div>
        )}

        <div className="flex items-center justify-between border-t border-slate-100 pt-1 text-xs">
          <span className="text-sm font-black text-pink-600">{money(order.total_amount)}</span>
          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            {paymentMethodLabel(order.payment_method, order.change_for, order.total_amount)}
          </span>
        </div>

        {next && actionLabel && (
          <Button
            className={`h-9 w-full gap-1.5 text-xs font-bold text-white shadow-sm ${meta.color}`}
            onClick={() => onAdvance(order)}
            disabled={isUpdating}
          >
            {isUpdating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <>
                {actionLabel}
                <ArrowRight className="h-3 w-3" />
              </>
            )}
          </Button>
        )}

        <div className="flex items-center gap-1 pt-1">
          <OrderDetailsDialog order={order} disabled={isUpdating} />
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-2 text-slate-600 hover:text-slate-900"
            title="Imprimir comanda"
            onClick={() => onPrint(order)}
            disabled={isUpdating}
          >
            <Printer className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-2 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700"
            title="Avisar cliente no WhatsApp"
            onClick={() => onNotifyWhatsApp(order)}
            disabled={isUpdating}
          >
            <MessageCircle className="h-3.5 w-3.5" />
          </Button>
          {cancellable && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 px-2 text-red-500 hover:bg-red-50 hover:text-red-700"
              title="Cancelar pedido"
              onClick={() => onCancelRequest(order)}
              disabled={isUpdating}
            >
              <Ban className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function money(value: number | null | undefined) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0);
}
