import { createFileRoute, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getOrderCounts,
  getOrders,
  updateOrderStatus,
  type OrderWithItems,
} from "@/lib/orders-admin.functions";
import { getStoreSettings } from "@/lib/delivery.functions";
import {
  OPERATIONAL_ACTION_LABEL,
  OPERATIONAL_TABS,
  ORDER_STATUS_LABEL,
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  Wifi,
  WifiOff,
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

const STATUS_TO_EVENT: Partial<Record<OrderStatus, NotifyEvent>> = {
  pending: "received",
  confirmed: "accepted",
  preparing: "preparing",
  ready: "ready",
  out_for_delivery: "shipping",
  delivered: "delivered",
  canceled: "canceled",
};

const normalizePhone = (value: string | null | undefined): string =>
  (value || "").replace(/\D/g, "");

const money = (value: number | null | undefined): string =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value || 0));

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
  }, []);

  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
  }, [soundEnabled]);

  useEffect(() => {
    if (orders && previousOrderIds.current.size === 0) {
      orders.forEach((order) => previousOrderIds.current.add(order.id));
    }
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

          const newOrder = payload.new as { id: string };
          if (previousOrderIds.current.has(newOrder.id)) return;

          if (soundEnabledRef.current && audioRef.current) {
            audioRef.current
              .play()
              .catch((playError) => console.error("Erro ao tocar som:", playError));
          }
          toast.info(`Novo pedido recebido: #${newOrder.id.slice(0, 8).toUpperCase()}`, {
            icon: <Bell className="w-4 h-4 text-pink-500" />,
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
      fromStatus,
      toStatus,
      cancelReason: reason,
    }: {
      id: string;
      fromStatus: OrderStatus;
      toStatus: OrderStatus;
      cancelReason?: string;
    }) => {
      const updated = await updateOrderStatus({
        id,
        status: toStatus,
        storeId,
        expectedStatus: fromStatus,
        cancelReason: reason,
      });

      const isCancel = toStatus === "canceled";
      await logAudit({
        action: isCancel ? "order_canceled" : "order_status_changed",
        module: "pedidos",
        storeId,
        description: isCancel
          ? `Pedido #${id.slice(0, 8).toUpperCase()} foi cancelado.`
          : `Pedido #${id.slice(0, 8).toUpperCase()} alterado de ${ORDER_STATUS_LABEL[fromStatus]} para ${ORDER_STATUS_LABEL[toStatus]}.`,
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
              to_status: toStatus,
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

      toast.success(
        `Pedido #${updatedOrder.id.slice(0, 8).toUpperCase()}: status atualizado para ${ORDER_STATUS_LABEL[updatedOrder.status]}.`,
      );

      const automaticEvent =
        variables.fromStatus === "pending" && variables.toStatus === "confirmed"
          ? "accepted"
          : variables.fromStatus === "ready" && variables.toStatus === "out_for_delivery"
            ? "shipping"
            : null;

      if (automaticEvent && storeSettings?.auto_notify_whatsapp) {
        const result = await notifyOrderWhatsApp(
          updatedOrder,
          storeSettings,
          automaticEvent,
          "automatic",
          storeId,
        );
        const feedback = notifyResultMessage(result);
        if (feedback) toast.info(feedback);
      }
    },
    onError: (mutationError: Error) => {
      toast.error(mutationError.message || "Falha ao atualizar status do pedido.");
    },
  });

  const ordersByTab = useMemo(() => {
    const normalizedTerm = searchTerm.trim().toLowerCase().replace(/^#/, "");
    const termDigits = normalizePhone(normalizedTerm);

    return OPERATIONAL_TABS.reduce<Record<OperationalTabId, OrderWithItems[]>>(
      (result, tab) => {
        result[tab.id] = (orders || []).filter((order) => {
          if (!tab.statuses.includes(order.status)) return false;
          if (!normalizedTerm) return true;

          const customerName = order.customer_name?.toLowerCase() || "";
          const orderId = order.id.toLowerCase();
          const orderPrefix = order.id.slice(0, 8).toLowerCase();
          const orderPhone = normalizePhone(order.customer_phone);
          const matchesName = customerName.includes(normalizedTerm);
          const matchesId =
            orderId.includes(normalizedTerm) || orderPrefix.includes(normalizedTerm);
          const matchesPhone = termDigits.length > 0 && orderPhone.includes(termDigits);

          return matchesName || matchesId || matchesPhone;
        });
        return result;
      },
      { new: [], preparing: [], ready: [], delivery: [] },
    );
  }, [orders, searchTerm]);

  const countByTab: Record<OperationalTabId, number> = {
    new: orderCounts?.new ?? 0,
    preparing: orderCounts?.preparing ?? 0,
    ready: orderCounts?.ready ?? 0,
    delivery: orderCounts?.delivery ?? 0,
  };

  const handleAdvance = (order: OrderWithItems) => {
    const toStatus = nextStatus(order.status);
    if (!toStatus) return;
    statusMutation.mutate({ id: order.id, fromStatus: order.status, toStatus });
  };

  const handleCancelRequest = (order: OrderWithItems) => {
    setCancelReason("");
    setOrderToCancel(order);
  };

  const handleConfirmCancel = () => {
    if (!orderToCancel) return;
    statusMutation.mutate({
      id: orderToCancel.id,
      fromStatus: orderToCancel.status,
      toStatus: "canceled",
      cancelReason,
    });
    setOrderToCancel(null);
    setCancelReason("");
  };

  const handleManualNotifyWhatsApp = async (order: OrderWithItems) => {
    if (!storeSettings) {
      toast.error("Configurações da loja não carregadas.");
      return;
    }

    const event = STATUS_TO_EVENT[order.status] || "received";
    const result = await notifyOrderWhatsApp(order, storeSettings, event, "manual", storeId);
    const feedback = notifyResultMessage(result);
    if (feedback) {
      if (result.sent) toast.success(feedback);
      else toast.error(feedback);
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

  const hasOrdersData = Boolean(orders);
  const mutationOrderId = statusMutation.variables?.id;

  return (
    <div className="space-y-4 pb-12">
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-800">Central de Pedidos</h1>
            <div
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                realtimeConnected
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  : "bg-slate-100 text-slate-600 border border-slate-200"
              }`}
            >
              {realtimeConnected ? (
                <>
                  <Wifi className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
                  <span>Ao vivo</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3.5 h-3.5 text-slate-400" />
                  <span>Reconectando</span>
                </>
              )}
            </div>
          </div>
          <p className="text-slate-500 text-sm mt-0.5">
            Acompanhe cada pedido em todas as etapas do atendimento.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-50 p-2 px-3 rounded-lg border border-slate-200">
            <Label
              htmlFor="staff-sound-toggle"
              className="text-xs font-medium flex items-center gap-1.5 cursor-pointer text-slate-700"
            >
              {soundEnabled ? (
                <Bell className="w-4 h-4 text-pink-600" />
              ) : (
                <BellOff className="w-4 h-4 text-slate-400" />
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
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
            Atualizar
          </Button>

          <Link to="/staff/history">
            <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs text-slate-700">
              <History className="w-3.5 h-3.5" />
              Histórico Geral
            </Button>
          </Link>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input
          placeholder="Buscar por cliente, telefone ou #pedido..."
          className="pl-10 h-11 bg-white border-slate-200 shadow-sm text-sm"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
        />
      </div>

      {isError && !hasOrdersData && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center justify-between text-red-800 gap-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
            <span>
              Erro ao carregar pedidos: {(error as Error)?.message || "Erro desconhecido."}
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            className="border-red-300 text-red-700 hover:bg-red-100 shrink-0"
          >
            Tentar novamente
          </Button>
        </div>
      )}

      {isError && hasOrdersData && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-2 text-amber-800 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          Atualização falhou. Pedidos anteriores continuam visíveis.
        </div>
      )}

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as OperationalTabId)}>
        <TabsList className="w-full h-auto grid grid-cols-2 sm:grid-cols-4 gap-1 bg-slate-100 p-1">
          {OPERATIONAL_TABS.map((tab) => (
            <TabsTrigger key={tab.id} value={tab.id} className="h-10 gap-2 text-xs sm:text-sm">
              <span>{tab.label}</span>
              <Badge variant="secondary" className="font-mono text-[11px] px-1.5 py-0">
                {countByTab[tab.id]}
              </Badge>
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          {isLoading ? (
            <OrderGridSkeleton />
          ) : ordersByTab[activeTab].length === 0 ? (
            <EmptyTabState hasSearch={Boolean(searchTerm.trim())} />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-start">
              {ordersByTab[activeTab].map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  onAdvance={handleAdvance}
                  onCancelRequest={handleCancelRequest}
                  onPrint={handlePrint}
                  onNotifyWhatsApp={handleManualNotifyWhatsApp}
                  isUpdating={statusMutation.isPending && mutationOrderId === order.id}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <AlertDialog
        open={Boolean(orderToCancel)}
        onOpenChange={(open) => !open && setOrderToCancel(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
              <Ban className="w-5 h-5" />
              Cancelar Pedido #{orderToCancel?.id.slice(0, 8).toUpperCase()}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja cancelar o pedido de{" "}
              <strong>{orderToCancel?.customer_name}</strong> no valor de{" "}
              <strong>{money(orderToCancel?.total_amount)}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            placeholder="Motivo do cancelamento (opcional)"
            value={cancelReason}
            onChange={(event) => setCancelReason(event.target.value)}
            disabled={statusMutation.isPending}
          />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={statusMutation.isPending}>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmCancel}
              disabled={statusMutation.isPending}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {statusMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Confirmar Cancelamento"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function OrderGridSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          key={index}
          className="h-80 bg-white animate-pulse rounded-xl border border-slate-200"
        />
      ))}
    </div>
  );
}

function EmptyTabState({ hasSearch }: { hasSearch: boolean }) {
  return (
    <div className="py-16 text-center text-slate-400 bg-white border border-slate-200 rounded-xl">
      <ShoppingBag className="w-10 h-10 mx-auto mb-3 text-slate-300 stroke-1" />
      <p className="text-sm font-medium">
        {hasSearch ? "Nenhum pedido encontrado." : "Nenhum pedido nesta etapa."}
      </p>
      {hasSearch && <p className="text-xs mt-1">Tente outro nome, telefone ou número.</p>}
    </div>
  );
}

function OrderCard({
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
      className={`overflow-hidden transition-all bg-white border ${isNew ? "border-blue-500 shadow-sm ring-1 ring-blue-400/40" : "border-slate-200 hover:border-slate-300 hover:shadow-sm"}`}
    >
      <div
        className={`p-2 px-3 flex justify-between items-center text-xs ${isNew ? "bg-blue-600 text-white" : "bg-slate-50 border-b border-slate-100 text-slate-600"}`}
      >
        <div className="flex items-center gap-1.5">
          <span className="font-mono font-bold">#{order.id.slice(0, 8).toUpperCase()}</span>
          {isNew && (
            <Badge className="h-4 px-1 bg-white text-blue-700 text-[9px] font-extrabold uppercase animate-pulse">
              Novo
            </Badge>
          )}
        </div>
        <span className="flex items-center gap-1 text-[11px] font-medium opacity-90">
          <Clock className="w-3 h-3" />
          {order.created_at
            ? format(new Date(order.created_at), "HH:mm", { locale: ptBR })
            : "--:--"}
        </span>
      </div>

      <CardContent className="p-3 space-y-2.5">
        <div>
          <h4 className="font-bold text-sm text-slate-900 truncate" title={order.customer_name}>
            {order.customer_name}
          </h4>
          <div className="flex items-center gap-1 text-slate-500 text-xs mt-0.5">
            <MapPin className="w-3 h-3 shrink-0 text-slate-400" />
            <span className="truncate">
              {order.neighborhood || order.address || "Endereço não informado"}
            </span>
          </div>
        </div>

        <div className="bg-slate-50 p-2 rounded-lg text-xs space-y-1 border border-slate-100">
          {order.order_items && order.order_items.length > 0 ? (
            order.order_items.slice(0, 3).map((item, index) => (
              <div key={index} className="flex justify-between text-slate-700 truncate">
                <span className="truncate">
                  <strong>{item.quantity}x</strong>{" "}
                  {item.product_name || item.product?.name || "Produto"}
                </span>
                <span className="font-medium shrink-0 ml-1 text-slate-600">
                  {money(Number(item.price_at_time) * item.quantity)}
                </span>
              </div>
            ))
          ) : (
            <p className="text-slate-400 italic">Sem itens listados</p>
          )}
          {order.order_items && order.order_items.length > 3 && (
            <p className="text-[10px] text-slate-500 font-medium pt-0.5">
              + {order.order_items.length - 3} outro(s) item(ns)...
            </p>
          )}
        </div>

        {order.observation && (
          <div className="p-1.5 bg-amber-50 text-amber-800 text-[11px] rounded border border-amber-200/60 line-clamp-2 italic">
            Obs: {order.observation}
          </div>
        )}

        <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-xs">
          <span className="font-black text-pink-600 text-sm">{money(order.total_amount)}</span>
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
            {paymentMethodLabel(order.payment_method)}
          </span>
        </div>

        {next && actionLabel && (
          <Button
            className={`w-full h-9 text-xs font-bold gap-1.5 shadow-sm text-white ${meta.color}`}
            onClick={() => onAdvance(order)}
            disabled={isUpdating}
          >
            {isUpdating ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <>
                {actionLabel}
                <ArrowRight className="w-3 h-3" />
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
            <Printer className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-2 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
            title="Avisar cliente no WhatsApp"
            onClick={() => onNotifyWhatsApp(order)}
            disabled={isUpdating}
          >
            <MessageCircle className="w-3.5 h-3.5" />
          </Button>
          {cancellable && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 px-2 text-red-500 hover:text-red-700 hover:bg-red-50"
              title="Cancelar pedido"
              onClick={() => onCancelRequest(order)}
              disabled={isUpdating}
            >
              <Ban className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function OrderDetailsDialog({ order, disabled }: { order: OrderWithItems; disabled: boolean }) {
  const meta = ORDER_STATUS_STYLE[order.status];
  const items = order.order_items || [];

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-8 flex-1 text-xs gap-1 text-slate-700"
          disabled={disabled}
        >
          <Eye className="w-3.5 h-3.5" /> Detalhes
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-bold">
              Pedido #{order.id.slice(0, 8).toUpperCase()}
            </DialogTitle>
            <Badge className={`${meta.color} uppercase font-bold text-[10px]`}>{meta.label}</Badge>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2 text-sm">
          <div className="bg-slate-50 p-3.5 rounded-xl space-y-2 border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <div>
                <p className="font-bold text-slate-900">{order.customer_name}</p>
                <p className="text-xs text-slate-500 flex items-center gap-1">
                  <Phone className="w-3 h-3" /> {order.customer_phone || "Sem telefone"}
                </p>
              </div>
              <span className="text-xs text-slate-400">
                {order.created_at
                  ? format(new Date(order.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                  : ""}
              </span>
            </div>
            <div className="text-xs space-y-1 text-slate-600 pt-1">
              <p>
                <strong>Endereço:</strong> {order.address || "Não informado"}
              </p>
              {order.reference && (
                <p>
                  <strong>Referência:</strong> {order.reference}
                </p>
              )}
              {order.observation && (
                <p className="text-amber-800 bg-amber-50 p-2 rounded border border-amber-200 mt-1">
                  <strong>Observação:</strong> {order.observation}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="font-bold text-xs uppercase tracking-wider text-slate-500 border-b pb-1">
              Itens do Pedido ({items.length})
            </h4>
            <div className="space-y-2">
              {items.map((item) => {
                const addons =
                  typeof item.selected_addons === "string"
                    ? (() => {
                        try {
                          return JSON.parse(item.selected_addons);
                        } catch {
                          return [];
                        }
                      })()
                    : Array.isArray(item.selected_addons)
                      ? item.selected_addons
                      : [];

                return (
                  <div
                    key={item.id}
                    className="text-sm bg-white p-2.5 rounded-lg border border-slate-100"
                  >
                    <div className="flex justify-between font-medium text-slate-900">
                      <span>
                        {item.quantity}x {item.product_name || item.product?.name || "Produto"}
                      </span>
                      <span>{money(Number(item.price_at_time) * item.quantity)}</span>
                    </div>
                    {Array.isArray(addons) && addons.length > 0 && (
                      <div className="text-xs text-slate-500 pl-4 pt-1 space-y-0.5">
                        {addons.map((addon: { name?: string; price?: number }, index: number) => (
                          <div key={index} className="flex justify-between italic">
                            <span>+ {addon.name}</span>
                            {addon.price ? <span>{money(addon.price)}</span> : null}
                          </div>
                        ))}
                      </div>
                    )}
                    {item.observation && (
                      <p className="text-xs text-amber-700 bg-amber-50 p-1.5 rounded mt-1.5 italic">
                        Obs: {item.observation}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-slate-900 text-white p-4 rounded-xl space-y-2">
            <div className="flex justify-between text-xs text-slate-400">
              <span>Subtotal dos produtos</span>
              <span>{money((order.total_amount || 0) - Number(order.delivery_fee || 0))}</span>
            </div>
            <div className="flex justify-between text-xs text-slate-400">
              <span>Taxa de entrega</span>
              <span>{money(Number(order.delivery_fee || 0))}</span>
            </div>
            <div className="flex justify-between text-xs text-slate-300 pt-1 border-t border-slate-800">
              <span>Pagamento</span>
              <span className="font-bold uppercase">
                {paymentMethodLabel(order.payment_method)}
              </span>
            </div>
            <div className="flex justify-between text-base font-black text-pink-400 pt-1 border-t border-slate-800">
              <span>Total</span>
              <span>{money(order.total_amount)}</span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
