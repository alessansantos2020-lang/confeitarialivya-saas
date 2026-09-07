import { createFileRoute, Link } from '@tanstack/react-router';
import { supabase } from '@/integrations/supabase/client';
import { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getOrders, updateOrderStatus, type OrderWithItems } from '@/lib/orders-admin.functions';
import { getStoreSettings } from '@/lib/delivery.functions';
import { 
  ORDER_STATUS, 
  ORDER_STATUS_LABEL, 
  ORDER_STATUS_STYLE, 
  canCancel, 
  isActiveStatus, 
  nextStatus, 
  previousStatus, 
  paymentMethodLabel,
  type OrderStatus 
} from '@/lib/order-status';
import { notifyOrderWhatsApp, notifyResultMessage, type NotifyEvent } from '@/lib/order-notify';
import { printOrder } from '@/lib/order-print';
import { logAudit } from '@/lib/audit.functions';
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle,
  AlertDialogTrigger
} from '@/components/ui/alert-dialog';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { useActiveStore } from '@/lib/active-store';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Clock,
  CheckCircle,
  CheckCircle2,
  XCircle,
  Loader2,
  Phone,
  MapPin,
  Calendar,
  Eye,
  Printer,
  MessageCircle,
  Bell,
  BellOff,
  Search,
  ArrowRight,
  ShoppingBag,
  RefreshCw,
  Wifi,
  WifiOff,
  RotateCcw,
  Ban,
  AlertTriangle,
  History
} from 'lucide-react';

export const Route = createFileRoute('/staff/')({
  component: StaffOrdersKanbanPage
});

const KANBAN_STATUSES: OrderStatus[] = [
  'pending',
  'confirmed',
  'preparing',
  'ready',
  'out_for_delivery',
  'delivered',
  'canceled'
];

const STATUS_TO_EVENT: Partial<Record<OrderStatus, NotifyEvent>> = {
  confirmed: 'accepted',
  preparing: 'preparing',
  ready: 'ready',
  out_for_delivery: 'shipping',
  delivered: 'delivered',
};

function StaffOrdersKanbanPage() {
  const { store, storeId } = useActiveStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const [orderToCancel, setOrderToCancel] = useState<OrderWithItems | null>(null);

  const queryClient = useQueryClient();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const previousOrderIds = useRef<Set<string>>(new Set());

  // Store settings query for WhatsApp notifications & store name
  const { data: storeSettings } = useQuery({
    queryKey: ['store-settings', storeId],
    queryFn: () => getStoreSettings(storeId),
  });

  // Fetch orders with limit: 150
  const { 
    data: orders, 
    isLoading, 
    isError, 
    error, 
    refetch, 
    isFetching 
  } = useQuery({
    queryKey: ['staff-orders', storeId],
    queryFn: () => getOrders({ storeId, limit: 150 })
  });

  // Sound initialization
  useEffect(() => {
    audioRef.current = new Audio('/new-order-alert.mp3');
  }, []);

  // Sync initial order IDs to prevent alert triggers on first load
  useEffect(() => {
    if (orders && previousOrderIds.current.size === 0) {
      orders.forEach((o) => previousOrderIds.current.add(o.id));
    }
  }, [orders]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel(`staff-orders-kanban-${storeId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `store_id=eq.${storeId}` },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ['staff-orders', storeId] });
          queryClient.invalidateQueries({ queryKey: ['staff-history', storeId] });
          queryClient.invalidateQueries({ queryKey: ['salesReport'] });

          if (payload.eventType === 'INSERT') {
            const newOrder = payload.new as { id: string };
            if (!previousOrderIds.current.has(newOrder.id)) {
              if (soundEnabled && audioRef.current) {
                audioRef.current.play().catch((e) => console.error('Erro ao tocar som:', e));
              }
              toast.info(`Novo pedido recebido: #${newOrder.id.slice(0, 8).toUpperCase()}`, {
                icon: <Bell className="w-4 h-4 text-pink-500" />
              });
              previousOrderIds.current.add(newOrder.id);
            }
          }
        }
      )
      .subscribe((status) => {
        setRealtimeConnected(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, soundEnabled, storeId]);

  // Status update mutation
  const statusMutation = useMutation({
    mutationFn: async ({
      id,
      status,
      previousStatusVal,
      isCancel,
      isReopen
    }: {
      id: string;
      status: OrderStatus;
      previousStatusVal: OrderStatus;
      isCancel?: boolean;
      isReopen?: boolean;
    }) => {
      const updated = await updateOrderStatus({ id, status, storeId });

      // Audit log
      if (isCancel) {
        await logAudit({
          action: 'order_canceled',
          module: 'pedidos',
          storeId,
          description: `Pedido #${id.slice(0, 8).toUpperCase()} foi cancelado.`
        });
      } else if (isReopen) {
        await logAudit({
          action: 'order_reopened',
          module: 'pedidos',
          storeId,
          description: `Pedido #${id.slice(0, 8).toUpperCase()} foi reaberto de cancelado para pendente.`
        });
      } else {
        await logAudit({
          action: 'order_status_changed',
          module: 'pedidos',
          storeId,
          description: `Pedido #${id.slice(0, 8).toUpperCase()} alterado de ${ORDER_STATUS_LABEL[previousStatusVal]} para ${ORDER_STATUS_LABEL[status]}.`
        });
      }

      return updated;
    },
    onSuccess: async (updatedOrder, variables) => {
      queryClient.invalidateQueries({ queryKey: ['staff-orders', storeId] });
      queryClient.invalidateQueries({ queryKey: ['staff-history', storeId] });
      queryClient.invalidateQueries({ queryKey: ['salesReport'] });
      queryClient.invalidateQueries({ queryKey: ['admin-orders', storeId] });

      toast.success(`Pedido #${updatedOrder.id.slice(0, 8).toUpperCase()}: status atualizado para ${ORDER_STATUS_LABEL[updatedOrder.status]}!`);

      // Automatic WhatsApp notification if enabled
      if (storeSettings && storeSettings.auto_notify_whatsapp) {
        const event = STATUS_TO_EVENT[updatedOrder.status];
        if (event) {
          const res = await notifyOrderWhatsApp(updatedOrder, storeSettings, event, 'automatic', storeId);
          const feedback = notifyResultMessage(res);
          if (feedback) toast.info(feedback);
        }
      }
    },
    onError: (err: any) => {
      toast.error(err.message || 'Falha ao atualizar status do pedido.');
    }
  });

  // Filter orders for Kanban:
  // 1. Active orders are always shown
  // 2. Delivered / Canceled orders are shown only if created today
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const kanbanOrders = useMemo(() => {
    if (!orders) return [];

    return orders.filter((order) => {
      // Date filter for completed/canceled orders
      if (!isActiveStatus(order.status)) {
        const orderDate = order.created_at ? format(new Date(order.created_at), 'yyyy-MM-dd') : '';
        if (orderDate !== todayStr) return false;
      }

      // Search term filter
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchesName = order.customer_name?.toLowerCase().includes(term);
        const matchesId = order.id.toLowerCase().includes(term);
        const matchesPhone = order.customer_phone?.includes(term);
        if (!matchesName && !matchesId && !matchesPhone) return false;
      }

      return true;
    });
  }, [orders, todayStr, searchTerm]);

  // Group by status
  const ordersByStatus = useMemo(() => {
    const map: Record<OrderStatus, OrderWithItems[]> = {
      pending: [],
      confirmed: [],
      preparing: [],
      ready: [],
      out_for_delivery: [],
      delivered: [],
      canceled: []
    };

    kanbanOrders.forEach((order) => {
      if (map[order.status]) {
        map[order.status].push(order);
      }
    });

    return map;
  }, [kanbanOrders]);

  const handleAdvance = (order: OrderWithItems) => {
    const next = nextStatus(order.status);
    if (!next) return;
    statusMutation.mutate({
      id: order.id,
      status: next,
      previousStatusVal: order.status
    });
  };

  const handleUndo = (order: OrderWithItems) => {
    const prev = previousStatus(order.status);
    if (!prev) return;
    const isReopen = order.status === 'canceled' && prev === 'pending';
    statusMutation.mutate({
      id: order.id,
      status: prev,
      previousStatusVal: order.status,
      isReopen
    });
  };

  const handleConfirmCancel = () => {
    if (!orderToCancel) return;
    statusMutation.mutate({
      id: orderToCancel.id,
      status: 'canceled',
      previousStatusVal: orderToCancel.status,
      isCancel: true
    });
    setOrderToCancel(null);
  };

  const handleManualNotifyWhatsApp = async (order: OrderWithItems) => {
    if (!storeSettings) {
      toast.error('Configurações da loja não carregadas.');
      return;
    }
    const event = STATUS_TO_EVENT[order.status] || 'received';
    const res = await notifyOrderWhatsApp(order, storeSettings, event, 'manual', storeId);
    const feedback = notifyResultMessage(res);
    if (feedback) {
      if (res.sent) toast.success(feedback);
      else toast.error(feedback);
    }
  };

  const handlePrint = (order: OrderWithItems) => {
    const storeName = storeSettings?.name || store?.name || 'Loja';
    const ok = printOrder(order, storeName);
    if (!ok) {
      toast.error('Não foi possível abrir a janela de impressão. Verifique o bloqueador de pop-ups.');
    }
  };

  return (
    <div className="space-y-4 pb-12">
      {/* Top Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              Central de Pedidos
            </h1>
            <div 
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                realtimeConnected 
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                  : 'bg-slate-100 text-slate-600 border border-slate-200'
              }`}
              title={realtimeConnected ? 'Conectado em tempo real' : 'Conectando ao realtime...'}
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
            Quadro Kanban com 7 etapas de atendimento e produção da loja.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Realtime sound toggle */}
          <div className="flex items-center gap-2 bg-slate-50 p-2 px-3 rounded-lg border border-slate-200">
            <Label htmlFor="staff-sound-toggle" className="text-xs font-medium flex items-center gap-1.5 cursor-pointer text-slate-700">
              {soundEnabled ? <Bell className="w-4 h-4 text-pink-600" /> : <BellOff className="w-4 h-4 text-slate-400" />}
              Som
            </Label>
            <Switch 
              id="staff-sound-toggle" 
              checked={soundEnabled} 
              onCheckedChange={setSoundEnabled} 
            />
          </div>

          {/* Refresh button */}
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => refetch()} 
            disabled={isFetching}
            className="h-9 gap-1.5 text-xs text-slate-700"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>

          {/* History link */}
          <Link to="/staff/history">
            <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs text-slate-700">
              <History className="w-3.5 h-3.5" />
              Histórico Geral
            </Button>
          </Link>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input 
          placeholder="Buscar por cliente, telefone ou #pedido..." 
          className="pl-10 h-11 bg-white border-slate-200 shadow-sm text-sm"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Error state */}
      {isError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center justify-between text-red-800">
          <div className="flex items-center gap-2 text-sm font-medium">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <span>Erro ao carregar pedidos: {(error as Error)?.message || 'Erro desconhecido.'}</span>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="border-red-300 text-red-700 hover:bg-red-100">
            Tentar novamente
          </Button>
        </div>
      )}

      {/* Loading Skeletons */}
      {isLoading ? (
        <div className="flex gap-4 overflow-x-auto pb-6">
          {KANBAN_STATUSES.map((status) => (
            <div key={status} className="w-80 shrink-0 bg-slate-100 rounded-xl p-3 space-y-3">
              <div className="h-8 bg-slate-200 animate-pulse rounded-lg" />
              <div className="h-36 bg-white animate-pulse rounded-lg border border-slate-200" />
              <div className="h-36 bg-white animate-pulse rounded-lg border border-slate-200" />
            </div>
          ))}
        </div>
      ) : (
        /* Kanban Board - 7 Columns */
        <div className="flex gap-4 overflow-x-auto pb-6 items-start">
          {KANBAN_STATUSES.map((status) => {
            const meta = ORDER_STATUS_STYLE[status];
            const colOrders = ordersByStatus[status] || [];
            const Icon = meta.icon;

            return (
              <div 
                key={status} 
                className="w-80 shrink-0 flex flex-col bg-slate-50 border border-slate-200/90 rounded-xl max-h-[calc(100vh-230px)] shadow-sm"
              >
                {/* Column Header */}
                <div className="p-3 border-b border-slate-200/90 flex items-center justify-between bg-white rounded-t-xl sticky top-0 z-10">
                  <div className="flex items-center gap-2">
                    <span className={`p-1.5 rounded-md ${meta.color}`}>
                      <Icon className="w-4 h-4" />
                    </span>
                    <span className="font-bold text-sm text-slate-800">
                      {meta.label}
                    </span>
                  </div>
                  <Badge variant="secondary" className="font-mono text-xs font-semibold px-2 py-0.5">
                    {colOrders.length}
                  </Badge>
                </div>

                {/* Column Order Cards */}
                <div className="p-2 space-y-2.5 overflow-y-auto flex-1 min-h-[140px]">
                  {colOrders.length === 0 ? (
                    <div className="py-12 text-center text-slate-400">
                      <ShoppingBag className="w-8 h-8 mx-auto mb-2 text-slate-300 stroke-1" />
                      <p className="text-xs">Nenhum pedido</p>
                    </div>
                  ) : (
                    colOrders.map((order) => (
                      <KanbanOrderCard 
                        key={order.id} 
                        order={order} 
                        onAdvance={handleAdvance}
                        onUndo={handleUndo}
                        onCancelRequest={(o) => setOrderToCancel(o)}
                        onPrint={handlePrint}
                        onNotifyWhatsApp={handleManualNotifyWhatsApp}
                        isUpdating={statusMutation.isPending && statusMutation.variables?.id === order.id}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Cancel Confirmation Dialog */}
      <AlertDialog open={!!orderToCancel} onOpenChange={(open) => !open && setOrderToCancel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
              <Ban className="w-5 h-5" />
              Cancelar Pedido #{orderToCancel?.id.slice(0, 8).toUpperCase()}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja cancelar o pedido de <strong>{orderToCancel?.customer_name}</strong> no valor de{' '}
              <strong>
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(orderToCancel?.total_amount || 0)}
              </strong>?
              <br />
              Esta ação registrará um log de auditoria no sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmCancel}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Confirmar Cancelamento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Card do Kanban
// ---------------------------------------------------------------------------
function KanbanOrderCard({
  order,
  onAdvance,
  onUndo,
  onCancelRequest,
  onPrint,
  onNotifyWhatsApp,
  isUpdating
}: {
  order: OrderWithItems;
  onAdvance: (order: OrderWithItems) => void;
  onUndo: (order: OrderWithItems) => void;
  onCancelRequest: (order: OrderWithItems) => void;
  onPrint: (order: OrderWithItems) => void;
  onNotifyWhatsApp: (order: OrderWithItems) => void;
  isUpdating: boolean;
}) {
  const meta = ORDER_STATUS_STYLE[order.status];
  const next = nextStatus(order.status);
  const prev = previousStatus(order.status);
  const cancellable = canCancel(order.status);
  const isNew = order.status === 'pending';

  return (
    <Card className={`overflow-hidden transition-all bg-white border ${
      isNew 
        ? 'border-blue-500 shadow-sm ring-1 ring-blue-400/40' 
        : 'border-slate-200 hover:border-slate-300 hover:shadow-sm'
    }`}>
      {/* Card Header */}
      <div className={`p-2 px-3 flex justify-between items-center text-xs ${
        isNew ? 'bg-blue-600 text-white' : 'bg-slate-50 border-b border-slate-100 text-slate-600'
      }`}>
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
          {order.created_at ? format(new Date(order.created_at), 'HH:mm', { locale: ptBR }) : '--:--'}
        </span>
      </div>

      <CardContent className="p-3 space-y-2.5">
        {/* Customer & Location */}
        <div>
          <h4 className="font-bold text-sm text-slate-900 truncate" title={order.customer_name}>
            {order.customer_name}
          </h4>
          <div className="flex items-center gap-1 text-slate-500 text-xs mt-0.5">
            <MapPin className="w-3 h-3 shrink-0 text-slate-400" />
            <span className="truncate">{order.neighborhood || order.address || 'Endereço não informado'}</span>
          </div>
        </div>

        {/* Items Summary */}
        <div className="bg-slate-50 p-2 rounded-lg text-xs space-y-1 border border-slate-100">
          {order.order_items && order.order_items.length > 0 ? (
            order.order_items.slice(0, 3).map((item, idx) => (
              <div key={idx} className="flex justify-between text-slate-700 truncate">
                <span className="truncate">
                  <strong>{item.quantity}x</strong> {item.product_name || item.product?.name || 'Produto'}
                </span>
                <span className="font-medium shrink-0 ml-1 text-slate-600">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(item.price_at_time) * item.quantity)}
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

        {/* Observation if present */}
        {order.observation && (
          <div className="p-1.5 bg-amber-50 text-amber-800 text-[11px] rounded border border-amber-200/60 line-clamp-2 italic">
            Obs: {order.observation}
          </div>
        )}

        {/* Total & Payment */}
        <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-xs">
          <span className="font-black text-pink-600 text-sm">
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(order.total_amount || 0)}
          </span>
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
            {paymentMethodLabel(order.payment_method)}
          </span>
        </div>

        {/* Primary Action: Advance status */}
        {next && (
          <Button 
            className={`w-full h-8 text-xs font-bold gap-1.5 shadow-sm text-white ${meta.color}`}
            onClick={() => onAdvance(order)}
            disabled={isUpdating}
          >
            {isUpdating ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <>
                {meta.nextLabel || 'Avançar'} <ArrowRight className="w-3 h-3" />
              </>
            )}
          </Button>
        )}

        {/* Delivered indicator */}
        {order.status === 'delivered' && (
          <div className="bg-emerald-50 text-emerald-700 h-8 rounded-lg flex items-center justify-center gap-1.5 text-xs font-bold border border-emerald-200">
            <CheckCircle className="w-3.5 h-3.5" /> Pedido Entregue
          </div>
        )}

        {/* Canceled indicator */}
        {order.status === 'canceled' && (
          <div className="bg-red-50 text-red-700 h-8 rounded-lg flex items-center justify-center gap-1.5 text-xs font-bold border border-red-200">
            <XCircle className="w-3.5 h-3.5" /> Pedido Cancelado
          </div>
        )}

        {/* Secondary Tool Actions */}
        <div className="flex items-center gap-1 pt-1">
          {/* Order Details Dialog */}
          <OrderDetailsDialog order={order} />

          {/* Print Button */}
          <Button 
            variant="outline" 
            size="sm" 
            className="h-8 px-2 text-slate-600 hover:text-slate-900" 
            title="Imprimir comanda"
            onClick={() => onPrint(order)}
          >
            <Printer className="w-3.5 h-3.5" />
          </Button>

          {/* WhatsApp Button */}
          <Button 
            variant="outline" 
            size="sm" 
            className="h-8 px-2 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50" 
            title="Avisar cliente no WhatsApp"
            onClick={() => onNotifyWhatsApp(order)}
          >
            <MessageCircle className="w-3.5 h-3.5" />
          </Button>

          {/* Undo Button */}
          {prev && (
            <Button 
              variant="outline" 
              size="sm" 
              className="h-8 px-2 text-amber-600 hover:text-amber-700 hover:bg-amber-50" 
              title={order.status === 'canceled' ? 'Reabrir pedido para Novo' : `Desfazer para ${ORDER_STATUS_LABEL[prev]}`}
              onClick={() => onUndo(order)}
              disabled={isUpdating}
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </Button>
          )}

          {/* Cancel Button */}
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

// ---------------------------------------------------------------------------
// Diálogo com detalhes completos do pedido
// ---------------------------------------------------------------------------
function OrderDetailsDialog({ order }: { order: OrderWithItems }) {
  const meta = ORDER_STATUS_STYLE[order.status];
  const items = order.order_items || [];

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 flex-1 text-xs gap-1 text-slate-700">
          <Eye className="w-3.5 h-3.5" /> Detalhes
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-bold">
              Pedido #{order.id.slice(0, 8).toUpperCase()}
            </DialogTitle>
            <Badge className={`${meta.color} uppercase font-bold text-[10px]`}>
              {meta.label}
            </Badge>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2 text-sm">
          {/* Customer & Address */}
          <div className="bg-slate-50 p-3.5 rounded-xl space-y-2 border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <div>
                <p className="font-bold text-slate-900">{order.customer_name}</p>
                <p className="text-xs text-slate-500 flex items-center gap-1">
                  <Phone className="w-3 h-3" /> {order.customer_phone || 'Sem telefone'}
                </p>
              </div>
              <span className="text-xs text-slate-400">
                {order.created_at ? format(new Date(order.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : ''}
              </span>
            </div>

            <div className="text-xs space-y-1 text-slate-600 pt-1">
              <p><strong>Endereço:</strong> {order.address || 'Não informado'}</p>
              {order.reference && <p><strong>Referência:</strong> {order.reference}</p>}
              {order.observation && (
                <p className="text-amber-800 bg-amber-50 p-2 rounded border border-amber-200 mt-1">
                  <strong>Observação:</strong> {order.observation}
                </p>
              )}
            </div>
          </div>

          {/* Products List */}
          <div className="space-y-2">
            <h4 className="font-bold text-xs uppercase tracking-wider text-slate-500 border-b pb-1">
              Itens do Pedido ({items.length})
            </h4>
            <div className="space-y-2">
              {items.map((item) => {
                const addons = typeof item.selected_addons === 'string'
                  ? (() => { try { return JSON.parse(item.selected_addons); } catch { return []; } })()
                  : Array.isArray(item.selected_addons) ? item.selected_addons : [];

                return (
                  <div key={item.id} className="text-sm bg-white p-2.5 rounded-lg border border-slate-100">
                    <div className="flex justify-between font-medium text-slate-900">
                      <span>{item.quantity}x {item.product_name || item.product?.name || 'Produto'}</span>
                      <span>
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(item.price_at_time) * item.quantity)}
                      </span>
                    </div>

                    {Array.isArray(addons) && addons.length > 0 && (
                      <div className="text-xs text-slate-500 pl-4 pt-1 space-y-0.5">
                        {addons.map((a: any, i: number) => (
                          <div key={i} className="flex justify-between italic">
                            <span>+ {a.name}</span>
                            {a.price ? <span>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(a.price)}</span> : null}
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

          {/* Financial Breakdown */}
          <div className="bg-slate-900 text-white p-4 rounded-xl space-y-2">
            <div className="flex justify-between text-xs text-slate-400">
              <span>Subtotal dos produtos</span>
              <span>
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                  (order.total_amount || 0) - Number(order.delivery_fee || 0)
                )}
              </span>
            </div>
            <div className="flex justify-between text-xs text-slate-400">
              <span>Taxa de entrega</span>
              <span>
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(order.delivery_fee || 0))}
              </span>
            </div>
            <div className="flex justify-between text-xs text-slate-300 pt-1 border-t border-slate-800">
              <span>Pagamento</span>
              <span className="font-bold uppercase">{paymentMethodLabel(order.payment_method)}</span>
            </div>
            <div className="flex justify-between text-base font-black text-pink-400 pt-1 border-t border-slate-800">
              <span>Total</span>
              <span>
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(order.total_amount || 0)}
              </span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
