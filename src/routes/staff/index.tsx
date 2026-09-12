import { createFileRoute, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getOrders,
  getOrderCounts,
  updateOrderStatus,
  type OrderWithItems,
} from "@/lib/orders-admin.functions";
import { getStoreSettings } from "@/lib/delivery.functions";
import {
  OPERATIONAL_ACTION_LABEL,
  OPERATIONAL_TABS,
  ORDER_STATUS_STYLE,
  canCancel,
  nextStatus,
  paymentMethodLabel,
  type OperationalTabId,
  type OrderStatus,
} from "@/lib/order-status";
import { notifyOrderWhatsApp, notifyResultMessage, type NotifyEvent } from "@/lib/order-notify";
import { printOrder } from "@/lib/order-print";
import { logAudit } from "@/lib/audit.functions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { useActiveStore } from "@/lib/active-store";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertTriangle,
  ArrowRight,
  Ban,
  Bell,
  BellOff,
  CheckCircle,
  CheckCircle2,
  Clock,
  Eye,
  History,
  Loader2,
  MapPin,
  MessageCircle,
  Phone,
  Printer,
  RefreshCw,
  Search,
  ShoppingBag,
  Truck,
  Wifi,
  WifiOff,
  XCircle,
} from "lucide-react";

export const Route = createFileRoute("/staff/")({
  component: StaffOrdersPage,
});

const OPERATIONAL_STATUSES: OrderStatus[] = [
  "pending",
  "confirmed",
  "preparing",
  "ready",
  "out_for_delivery",
];

const AUTOMATIC_NOTIFY_EVENTS: Partial<Record<OrderStatus, NotifyEvent>> = {
  confirmed: "accepted",
  out_for_delivery: "shipping",
};

const normalizeDigits = (value: string | null | undefined) => (value || "").replace(/\D/g, "");

function StaffOrdersPage() {
  const { store, storeId } = useActiveStore();
  const [activeTab, setActiveTab] = useState<OperationalTabId>("new");
  const [searchTerm, setSearchTerm] = useState("");
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const [orderToCancel, setOrderToCancel] = useState<OrderWithItems | null>(null);
  const [cancelReason, setCancelReason] = useState("");

  const queryClient = useQueryClient();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const soundEnabledRef = useRef(soundEnabled);
  const previousOrderIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
  }, [soundEnabled]);

  const { data: storeSettings } = useQuery({
    queryKey: ["store-settings", storeId],
    queryFn: () => getStoreSettings(storeId),
  });

  const {
    data: orders,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["staff-orders", storeId],
    queryFn: () => getOrders({ storeId, statuses: OPERATIONAL_STATUSES, limit: 150 }),
  });

  const { data: orderCounts } = useQuery({
    queryKey: ["staff-order-counts", storeId],
    queryFn: () => getOrderCounts(storeId),
  });

  useEffect(() => {
    audioRef.current = new Audio("/new-order-alert.mp3");
    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!orders) return;
    orders.forEach((order) => previousOrderIds.current.add(order.id));
  }, [orders]);

  useEffect(() => {
    const channel = supabase
      .channel(`staff-orders-${storeId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders", filter: `store_id=eq.${storeId}` },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ["staff-orders", storeId] });
          queryClient.invalidateQueries({ queryKey: ["staff-order-counts", storeId] });
          queryClient.invalidateQueries({ queryKey: ["staff-history", storeId] });
          queryClient.invalidateQueries({ queryKey: ["salesReport"] });
          queryClient.invalidateQueries({ queryKey: ["admin-orders", storeId] });

          if (payload.eventType !== "INSERT") return;
          const newOrder = payload.new as { id?: string };
          if (!newOrder.id || previousOrderIds.current.has(newOrder.id)) return;

          if (soundEnabledRef.current && audioRef.current) {
            audioRef.current
              .play()
              .catch((playError) => console.error("Erro ao tocar som:", playError));
          }
          toast.info(`Novo pedido recebido: #${newOrder.id.slice(0, 8).toUpperCase()}`, {
            icon: <Bell className="h-4 w-4 text-pink-500" />,
          });
          previousOrderIds.current.add(newOrder.id);
        },
      )
      .subscribe((status) => {
        setRealtimeConnected(status === "SUBSCRIBED");
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, storeId]);

  const statusMutation = useMutation({
    mutationFn: async ({
      id,
      status,
      fromStatus,
      cancelReason: reason,
    }: {
      id: string;
      status: OrderStatus;
      fromStatus: OrderStatus;
      cancelReason?: string;
    }) => {
      const updated = await updateOrderStatus({
        id,
        status,
        storeId,
        expectedStatus: fromStatus,
        cancelReason: reason,
      });

      const isCancel = status === "canceled";
      await logAudit({
        action: isCancel ? "order_canceled" : "order_status_changed",
        module: "pedidos",
        storeId,
        description: isCancel
          ? `Pedido #${id.slice(0, 8).toUpperCase()} foi cancelado.`
          : `Pedido #${id.slice(0, 8).toUpperCase()} avançou no fluxo.`,
        metadata: isCancel
          ? {
              order_id: id,
              from_status: fromStatus,
              to_status: "canceled",
              source: "staff_order_hub",
              cancel_reason: reason?.trim() || null,
            }
          : {
              order_id: id,
              from_status: fromStatus,
              to_status: status,
              source: "staff_order_hub",
            },
      });

      return updated;
    },
    onSuccess: async (updatedOrder, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["staff-orders", storeId] }),
        queryClient.invalidateQueries({ queryKey: ["staff-order-counts", storeId] }),
        queryClient.invalidateQueries({ queryKey: ["staff-history", storeId] }),
        queryClient.invalidateQueries({ queryKey: ["salesReport"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-orders", storeId] }),
      ]);

      toast.success(`Pedido #${updatedOrder.id.slice(0, 8).toUpperCase()}: status atualizado.`);

      const event = AUTOMATIC_NOTIFY_EVENTS[variables.status];
      if (!event || !storeSettings?.auto_notify_whatsapp) return;

      try {
        const result = await notifyOrderWhatsApp(
          updatedOrder,
          storeSettings,
          event,
          "automatic",
          storeId,
        );
        const feedback = notifyResultMessage(result);
        if (feedback) toast.info(feedback);
      } catch (notifyError) {
        console.error("Falha na notificação automática de WhatsApp:", notifyError);
        toast.error("Pedido atualizado, mas WhatsApp falhou.");
      }
    },
    onError: (mutationError: Error) => {
      toast.error(mutationError.message || "Falha ao atualizar status do pedido.");
    },
  });

  const filteredOrders = useMemo(() => {
    if (!orders) return [];
    const tab = OPERATIONAL_TABS.find((item) => item.id === activeTab);
    if (!tab) return [];

    const text = searchTerm.trim().toLowerCase().replace(/^#/, "");
    const digits = normalizeDigits(searchTerm);

    return orders.filter((order) => {
      if (!tab.statuses.includes(order.status)) return false;
      if (!text) return true;

      const nameMatch = order.customer_name?.toLowerCase().includes(text);
      const idMatch =
        order.id.toLowerCase().includes(text) || order.id.slice(0, 8).toLowerCase().includes(text);
      const phoneMatch =
        digits.length > 0 && normalizeDigits(order.customer_phone).includes(digits);
      return Boolean(nameMatch || idMatch || phoneMatch);
    });
  }, [activeTab, orders, searchTerm]);

  const handleAdvance = (order: OrderWithItems) => {
    const next = nextStatus(order.status);
    if (!next) return;
    statusMutation.mutate({ id: order.id, status: next, fromStatus: order.status });
  };

  const handleConfirmCancel = () => {
    if (!orderToCancel) return;
    statusMutation.mutate({
      id: orderToCancel.id,
      status: "canceled",
      fromStatus: orderToCancel.status,
      cancelReason,
    });
    setOrderToCancel(null);
    setCancelReason("");
  };

  const requestCancel = (order: OrderWithItems) => {
    setCancelReason("");
    setOrderToCancel(order);
  };

  const handleManualNotifyWhatsApp = async (order: OrderWithItems) => {
    if (!storeSettings) {
      toast.error("Configurações da loja não carregadas.");
      return;
    }
    const event: NotifyEvent = "received";
    try {
      const result = await notifyOrderWhatsApp(order, storeSettings, event, "manual", storeId);
      const feedback = notifyResultMessage(result);
      if (!feedback) return;
      if (result.sent) {
        toast.success(feedback);
      } else {
        toast.error(feedback);
      }
    } catch (notifyError) {
      console.error("Falha no WhatsApp manual:", notifyError);
      toast.error("Não foi possível abrir WhatsApp.");
    }
  };

  const handlePrint = (order: OrderWithItems) => {
    const storeName = storeSettings?.name || store?.name || "Loja";
    if (!printOrder(order, storeName)) {
      toast.error(
        "Não foi possível abrir a janela de impressão. Verifique o bloqueador de pop-ups.",
      );
    }
  };

  const hasPreviousData = Boolean(orders);
  const blockingError = isError && !hasPreviousData;

  return (
    <div className="space-y-4 pb-12">
      <div className="flex flex-col justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:flex-row md:items-center">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-800">
              Central de Pedidos
            </h1>
            <div
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${realtimeConnected ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-100 text-slate-600"}`}
            >
              {realtimeConnected ? (
                <Wifi className="h-3.5 w-3.5 text-emerald-600" />
              ) : (
                <WifiOff className="h-3.5 w-3.5 text-slate-400" />
              )}
              {realtimeConnected ? "Ao vivo" : "Reconectando"}
            </div>
          </div>
          <p className="mt-0.5 text-sm text-slate-500">
            Acompanhe cada pedido em todas etapas atendimento.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            <Label
              htmlFor="staff-sound-toggle"
              className="flex cursor-pointer items-center gap-1.5 text-xs font-medium text-slate-700"
            >
              {soundEnabled ? (
                <Bell className="h-4 w-4 text-pink-600" />
              ) : (
                <BellOff className="h-4 w-4 text-slate-400" />
              )}
              Som
            </Label>
            <Switch
              id="staff-sound-toggle"
              checked={soundEnabled}
              onCheckedChange={setSoundEnabled}
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="h-9 gap-1.5 text-xs text-slate-700"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} /> Atualizar
          </Button>
          <Link to="/staff/history">
            <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs text-slate-700">
              <History className="h-3.5 w-3.5" /> Histórico Geral
            </Button>
          </Link>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          placeholder="Buscar por cliente, telefone ou #pedido..."
          className="h-11 border-slate-200 bg-white pl-10 text-sm shadow-sm"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
        />
      </div>

      {isError && (
        <div className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">
          <div className="flex items-center gap-2 text-sm font-medium">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <span>
              Erro ao atualizar pedidos: {(error as Error)?.message || "Erro desconhecido."}
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            className="border-red-300 text-red-700 hover:bg-red-100"
          >
            Tentar novamente
          </Button>
        </div>
      )}

      {blockingError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-center">
          <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-red-500" />
          <p className="font-semibold text-red-800">Não foi possível carregar pedidos.</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            className="mt-4 border-red-300 text-red-700"
          >
            Tentar novamente
          </Button>
        </div>
      ) : isLoading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="h-72 animate-pulse rounded-xl border border-slate-200 bg-slate-100"
            />
          ))}
        </div>
      ) : (
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as OperationalTabId)}>
          <TabsList className="grid h-auto w-full grid-cols-2 gap-1 bg-slate-100 p-1 sm:grid-cols-4">
            {OPERATIONAL_TABS.map((tab) => (
              <TabsTrigger key={tab.id} value={tab.id} className="gap-2 py-2.5 text-xs sm:text-sm">
                <span>{tab.label}</span>
                <Badge variant="secondary" className="min-w-6 justify-center px-1.5 text-[11px]">
                  {orderCounts?.[tab.id] ?? 0}
                </Badge>
              </TabsTrigger>
            ))}
          </TabsList>

          {OPERATIONAL_TABS.map((tab) => (
            <TabsContent key={tab.id} value={tab.id} className="mt-4">
              {tab.id === activeTab &&
                (filteredOrders.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-16 text-center">
                    <ShoppingBag className="mx-auto mb-3 h-10 w-10 text-slate-300" />
                    <p className="font-semibold text-slate-700">Nenhum pedido nesta aba.</p>
                    {searchTerm && (
                      <p className="mt-1 text-sm text-slate-500">
                        Ajuste busca para ver outros pedidos.
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {filteredOrders.map((order) => (
                      <OperationalOrderCard
                        key={order.id}
                        order={order}
                        onAdvance={handleAdvance}
                        onCancelRequest={requestCancel}
                        onPrint={handlePrint}
                        onNotifyWhatsApp={handleManualNotifyWhatsApp}
                        isUpdating={
                          statusMutation.isPending && statusMutation.variables?.id === order.id
                        }
                      />
                    ))}
                  </div>
                ))}
            </TabsContent>
          ))}
        </Tabs>
      )}

      <AlertDialog
        open={Boolean(orderToCancel)}
        onOpenChange={(open) => !open && setOrderToCancel(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
              <Ban className="h-5 w-5" /> Cancelar pedido #
              {orderToCancel?.id.slice(0, 8).toUpperCase()}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Cancelar pedido de <strong>{orderToCancel?.customer_name}</strong>? Motivo opcional.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            value={cancelReason}
            onChange={(event) => setCancelReason(event.target.value)}
            placeholder="Motivo do cancelamento (opcional)"
            className="min-h-20"
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmCancel}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              Confirmar cancelamento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function OperationalOrderCard({
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
            {paymentMethodLabel(order.payment_method)}
          </span>
        </div>

        {next && actionLabel && (
          <Button
            className={`h-9 w-full gap-1.5 text-xs font-bold text-white shadow-sm ${meta.color}`}
            onClick={() => onAdvance(order)}
            disabled={isUpdating}
          >
            <>
              {isUpdating ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <>
                  {actionLabel}
                  <ArrowRight className="h-3 w-3" />
                </>
              )}
            </>
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

function OrderDetailsDialog({ order, disabled }: { order: OrderWithItems; disabled?: boolean }) {
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
