import { createFileRoute } from '@tanstack/react-router';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getOrders, updateOrderStatus, type OrderWithItems } from '@/lib/orders-admin.functions';
import { getStoreSettings } from '@/lib/delivery.functions';
import { useActiveStore } from '@/lib/active-store';
import { 
  ORDER_STATUS, 
  ORDER_STATUS_LABEL, 
  ORDER_STATUS_STYLE, 
  paymentMethodLabel, 
  nextStatus, 
  type OrderStatus 
} from '@/lib/order-status';
import { notifyOrderWhatsApp, notifyResultMessage, type NotifyEvent } from '@/lib/order-notify';
import { printOrder } from '@/lib/order-print';
import { logAudit } from '@/lib/audit.functions';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Clock, 
  Package, 
  Truck, 
  CheckCircle, 
  XCircle, 
  Loader2, 
  Phone, 
  MapPin, 
  Calendar, 
  Eye, 
  CheckCircle2, 
  Printer, 
  Copy, 
  MessageCircle, 
  Bell, 
  BellOff, 
  Search, 
  ArrowRight, 
  ChevronDown, 
  ChevronRight 
} from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute('/admin/orders')({
  component: OrdersPage
});

const STATUS_TO_NOTIFY_EVENT: Partial<Record<OrderStatus, NotifyEvent>> = {
  confirmed: 'accepted',
  preparing: 'preparing',
  ready: 'ready',
  out_for_delivery: 'shipping',
  delivered: 'delivered',
};

function OrdersPage() {
  const { store, storeId } = useActiveStore();
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [expandedDates, setExpandedDates] = useState<Record<string, boolean>>({});
  const queryClient = useQueryClient();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const previousOrderIds = useRef<Set<string>>(new Set());

  const { data: storeSettings } = useQuery({
    queryKey: ['store-settings', storeId],
    queryFn: () => getStoreSettings(storeId),
  });

  const { data: orders, isLoading } = useQuery({
    queryKey: ['admin-orders', storeId],
    queryFn: () => getOrders({ status: undefined, date: undefined, storeId, limit: 200 })
  });

  // Sound initialization
  useEffect(() => {
    audioRef.current = new Audio('/new-order-alert.mp3');
  }, []);

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel(`admin-orders-realtime-${storeId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `store_id=eq.${storeId}` },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ['admin-orders', storeId] });
          queryClient.invalidateQueries({ queryKey: ['staff-orders', storeId] });
          queryClient.invalidateQueries({ queryKey: ['salesReport'] });

          if (payload.eventType === 'INSERT') {
            const newOrder = payload.new as { id: string };
            if (!previousOrderIds.current.has(newOrder.id)) {
              if (soundEnabled && audioRef.current) {
                audioRef.current.play().catch(e => console.error("Erro ao tocar som:", e));
              }
              toast.info(`Novo pedido recebido: #${newOrder.id.slice(0, 8).toUpperCase()}`, {
                icon: <Bell className="w-4 h-4 text-pink-500" />,
              });
              previousOrderIds.current.add(newOrder.id);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, soundEnabled, storeId]);

  // Sync initial order IDs to avoid alert on first load
  useEffect(() => {
    if (orders && previousOrderIds.current.size === 0) {
      orders.forEach((o) => previousOrderIds.current.add(o.id));
    }
  }, [orders]);

  const mutation = useMutation({
    mutationFn: async (variables: { id: string; status: OrderStatus }) => {
      const updated = await updateOrderStatus({ ...variables, storeId });
      await logAudit({
        action: 'order_status_changed',
        module: 'pedidos',
        storeId,
        description: `Pedido #${variables.id.slice(0, 8).toUpperCase()} atualizado para ${ORDER_STATUS_LABEL[variables.status]}.`
      });
      return updated;
    },
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['admin-orders', storeId] });
      queryClient.invalidateQueries({ queryKey: ['staff-orders', storeId] });
      queryClient.invalidateQueries({ queryKey: ['salesReport'] });
      toast.success(`Status atualizado para ${ORDER_STATUS_LABEL[updated.status]}!`);
    },
    onError: (error: any) => {
      toast.error(error.message || "Erro ao atualizar status.");
    }
  });

  const filteredOrders = (orders || []).filter((order) => {
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    const matchesSearch = 
      order.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (order.customer_phone && order.customer_phone.includes(searchTerm));
    return matchesStatus && matchesSearch;
  });

  const handleNotifyWhatsApp = async (order: OrderWithItems, type?: NotifyEvent) => {
    const settings = storeSettings || await getStoreSettings(storeId);
    if (!settings) {
      toast.error("Configurações da loja não encontradas.");
      return;
    }

    const event = type || STATUS_TO_NOTIFY_EVENT[order.status] || 'received';
    const res = await notifyOrderWhatsApp(order, settings, event, 'manual', storeId);
    const msg = notifyResultMessage(res);
    if (msg) {
      if (res.sent) toast.success(msg);
      else toast.error(msg);
    }
  };

  const handlePrint = (order: OrderWithItems) => {
    const storeName = storeSettings?.name || store.name || 'Loja';
    const ok = printOrder(order, storeName);
    if (!ok) {
      toast.error("Não foi possível abrir a impressão. Verifique bloqueador de pop-ups.");
    }
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            Painel de Pedidos
            <span className="flex h-2 w-2 rounded-full bg-green-500 animate-pulse" title="Sincronizado em tempo real" />
          </h1>
          <p className="text-slate-500">Sincronizado em tempo real • Gerencie o fluxo de produção.</p>
        </div>
        
        <div className="flex items-center gap-4 bg-white p-2 px-4 rounded-lg border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2">
            {soundEnabled ? <Bell className="w-4 h-4 text-pink-500" /> : <BellOff className="w-4 h-4 text-slate-400" />}
            <Label htmlFor="sound-toggle" className="text-sm font-medium cursor-pointer">
              Som de novos pedidos
            </Label>
          </div>
          <Switch 
            id="sound-toggle" 
            checked={soundEnabled} 
            onCheckedChange={setSoundEnabled}
          />
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input 
            placeholder="Buscar por nome do cliente, telefone ou #pedido..." 
            className="pl-10 h-12 bg-white"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="overflow-x-auto pb-2 lg:pb-0">
          <Tabs value={statusFilter} onValueChange={setStatusFilter} className="w-fit">
            <TabsList className="bg-white border border-slate-200 h-12 p-1">
              <TabsTrigger value="all" className="px-4">Todos</TabsTrigger>
              <TabsTrigger value="pending" className="px-4">Novos</TabsTrigger>
              <TabsTrigger value="confirmed" className="px-4">Aceitos</TabsTrigger>
              <TabsTrigger value="preparing" className="px-4">Em Preparo</TabsTrigger>
              <TabsTrigger value="ready" className="px-4">Prontos</TabsTrigger>
              <TabsTrigger value="out_for_delivery" className="px-4">Em Rota</TabsTrigger>
              <TabsTrigger value="delivered" className="px-4">Entregues</TabsTrigger>
              <TabsTrigger value="canceled" className="px-4">Cancelados</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      <div className="space-y-8">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array(6).fill(0).map((_, i) => (
              <div key={i} className="h-64 bg-slate-100 animate-pulse rounded-xl" />
            ))}
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="py-20 text-center text-slate-500 bg-white rounded-xl border border-dashed border-slate-200">
            <Package className="w-16 h-16 mx-auto mb-4 text-slate-200" />
            <h3 className="text-lg font-medium">Nenhum pedido encontrado</h3>
            <p>Os pedidos aparecerão aqui conforme forem realizados.</p>
          </div>
        ) : (
          (() => {
            const grouped = filteredOrders.reduce((acc: Record<string, OrderWithItems[]>, order) => {
              const dateKey = order.created_at ? format(new Date(order.created_at), 'yyyy-MM-dd') : 'outros';
              if (!acc[dateKey]) acc[dateKey] = [];
              acc[dateKey].push(order);
              return acc;
            }, {});

            const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

            return sortedDates.map(dateKey => {
              const ordersList = grouped[dateKey] || [];
              const isExpanded = expandedDates[dateKey] !== false; // Default to expanded
              const dateLabel = dateKey !== 'outros'
                ? format(new Date(dateKey + 'T12:00:00'), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
                : 'Data não informada';

              return (
                <div key={dateKey} className="space-y-4">
                  <button
                    onClick={() => setExpandedDates(prev => ({ ...prev, [dateKey]: !isExpanded }))}
                    className="flex items-center gap-2 w-full text-left group transition-colors"
                  >
                    <div className="p-1 rounded-md group-hover:bg-slate-100">
                      {isExpanded ? (
                        <ChevronDown className="w-5 h-5 text-slate-400" />
                      ) : (
                        <ChevronRight className="w-5 h-5 text-slate-400" />
                      )}
                    </div>
                    <h3 className="text-lg font-bold text-slate-700">
                      {dateLabel} 
                      <span className="ml-2 text-sm font-medium text-slate-400">
                        ({ordersList.length} {ordersList.length === 1 ? 'pedido' : 'pedidos'})
                      </span>
                    </h3>
                    <div className="flex-1 h-px bg-slate-200 ml-4"></div>
                  </button>

                  {isExpanded && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-top-2 duration-300">
                      {ordersList.map((order) => (
                        <OrderCard 
                          key={order.id} 
                          order={order} 
                          onUpdateStatus={(id: string, status: OrderStatus) => mutation.mutate({ id, status })}
                          onNotifyWhatsApp={handleNotifyWhatsApp}
                          onPrint={handlePrint}
                          isUpdating={mutation.isPending && mutation.variables?.id === order.id}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            });
          })()
        )}
      </div>
    </div>
  );
}

function OrderCard({ 
  order, 
  onUpdateStatus, 
  onNotifyWhatsApp, 
  onPrint,
  isUpdating 
}: {
  order: OrderWithItems;
  onUpdateStatus: (id: string, status: OrderStatus) => void;
  onNotifyWhatsApp: (order: OrderWithItems, type?: NotifyEvent) => void;
  onPrint: (order: OrderWithItems) => void;
  isUpdating: boolean;
}) {
  const statusMeta = ORDER_STATUS_STYLE[order.status] || ORDER_STATUS_STYLE.pending;
  const isNew = order.status === 'pending';
  const next = nextStatus(order.status);

  return (
    <Card className={`overflow-hidden border ${isNew ? 'border-blue-500 ring-2 ring-blue-100 animate-in fade-in zoom-in duration-300' : 'border-slate-200'}`}>
      <div className={`p-2 px-3 flex justify-between items-center ${isNew ? 'bg-blue-500 text-white' : 'bg-slate-50 border-b border-slate-200'}`}>
        <div className="flex items-center gap-2">
          <span className="font-mono font-bold text-xs">#{order.id.slice(0, 8).toUpperCase()}</span>
          {isNew && <Badge className="h-5 px-1 bg-white text-blue-600 text-[9px] animate-pulse font-bold">NOVO</Badge>}
        </div>
        <span className="text-[10px] font-medium flex items-center gap-1">
          <Clock className="w-2.5 h-2.5" />
          {order.created_at ? format(new Date(order.created_at), "HH:mm", { locale: ptBR }) : '--:--'}
        </span>
      </div>

      <CardContent className="p-3 space-y-2">
        <div className="flex justify-between items-start gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="font-bold text-sm text-slate-900 truncate">{order.customer_name}</h3>
            <div className="flex items-center gap-1 text-slate-500 text-[10px] mt-0.5">
              <MapPin className="w-2.5 h-2.5" />
              <span className="truncate">{order.neighborhood || "Bairro não informado"}</span>
            </div>
          </div>
          <Badge className={`${statusMeta.color} text-[9px] h-5 px-1.5 uppercase font-bold shrink-0`}>
            {statusMeta.label}
          </Badge>
        </div>

        <div className="flex items-center justify-between pt-1 border-t border-slate-100">
          <div className="text-[11px] font-bold text-pink-600">
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(order.total_amount || 0)}
          </div>
          <div className="text-[10px] text-slate-400 uppercase font-bold">
            {paymentMethodLabel(order.payment_method)}
          </div>
        </div>

        <div className="pt-1 flex flex-col gap-1.5">
          <div className="grid grid-cols-2 gap-1.5">
            <OrderDetailsDialog order={order} onPrint={onPrint} />
            
            {['confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered'].includes(order.status) && (
              <Button 
                variant="outline" 
                size="sm" 
                className="h-8 text-[11px] border-green-600 text-green-600 gap-1"
                onClick={() => onNotifyWhatsApp(order)}
              >
                <MessageCircle className="w-3 h-3" /> Avisar
              </Button>
            )}
          </div>

          {next && (
            <Button 
              className={cn("w-full h-8 text-[11px] font-bold gap-1 text-white", statusMeta.color)}
              onClick={() => onUpdateStatus(order.id, next)}
              disabled={isUpdating}
            >
              {isUpdating ? "..." : (
                <>
                  {statusMeta.nextLabel} <ArrowRight className="w-3 h-3" />
                </>
              )}
            </Button>
          )}

          {order.status === 'delivered' && (
            <div className="bg-green-50 text-green-700 h-8 rounded flex items-center justify-center gap-1 text-[10px] font-bold">
              <CheckCircle className="w-3 h-3" /> ENTREGUE
            </div>
          )}

          {order.status === 'canceled' && (
            <div className="bg-red-50 text-red-700 h-8 rounded flex items-center justify-center gap-1 text-[10px] font-bold">
              <XCircle className="w-3 h-3" /> CANCELADO
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function OrderDetailsDialog({ order, onPrint }: { order: OrderWithItems; onPrint: (order: OrderWithItems) => void }) {
  const statusMeta = ORDER_STATUS_STYLE[order.status] || ORDER_STATUS_STYLE.pending;
  const items = order.order_items || [];
  
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs">
          <Eye className="w-3.5 h-3.5" /> Detalhes
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0">
        <div className={`p-6 text-white ${statusMeta.color}`}>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-2xl font-bold">Pedido #{order.id.slice(0, 8).toUpperCase()}</h2>
            <Badge variant="outline" className="text-white border-white/40 uppercase font-bold">
              {statusMeta.label}
            </Badge>
          </div>
          <p className="text-white/80 text-sm">
            Realizado em {order.created_at ? format(new Date(order.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : ''}
          </p>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Informações do Cliente</h3>
                <div className="bg-slate-50 p-4 rounded-xl space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-pink-100 flex items-center justify-center text-pink-600 font-bold">
                      {order.customer_name ? order.customer_name.charAt(0).toUpperCase() : 'C'}
                    </div>
                    <div>
                      <p className="font-bold text-slate-900">{order.customer_name}</p>
                      <p className="text-sm text-slate-500">{order.customer_phone || 'Sem telefone'}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">📍 Endereço de Entrega</h3>
                <div className="bg-slate-50 p-4 rounded-xl flex gap-3">
                  <MapPin className="w-5 h-5 text-pink-500 shrink-0 mt-0.5" />
                  <div className="text-sm space-y-2 w-full">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-4">
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase font-bold">Rua</p>
                        <p className="font-medium text-slate-900">{order.street || "Não informada"}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase font-bold">Número</p>
                        <p className="font-medium text-slate-900">{order.number || "S/N"}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase font-bold">Bairro</p>
                        <p className="font-medium text-slate-900">{order.neighborhood || "Bairro não informado"}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase font-bold">Complemento</p>
                        <p className="font-medium text-slate-900">{order.complement || "Nenhum"}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase font-bold">Referência</p>
                        <p className="font-medium text-slate-900">{order.reference || "Nenhuma"}</p>
                      </div>
                    </div>
                    <div className="pt-2 border-t border-slate-200 mt-2">
                      <p className="text-[10px] text-slate-400 uppercase font-bold">Endereço Completo</p>
                      <p className="text-xs text-slate-600 italic">{order.address}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Produtos e Itens</h3>
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                  {items.map((item, idx) => (
                    <div key={idx} className={`p-4 ${idx !== items.length - 1 ? 'border-b border-slate-100' : ''}`}>
                      <div className="flex justify-between items-start mb-1">
                        <div className="flex gap-2">
                          <span className="font-bold text-pink-600">{item.quantity}x</span>
                          <span className="font-bold text-slate-900">{item.product_name || item.product?.name || "Produto"}</span>
                        </div>
                        <span className="font-bold text-slate-700">
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(item.price_at_time) * item.quantity)}
                        </span>
                      </div>
                      
                      {item.selected_addons && (
                        <div className="ml-7 text-xs text-slate-500">
                          {(() => {
                            const addons = typeof item.selected_addons === 'string' 
                              ? (() => { try { return JSON.parse(item.selected_addons); } catch { return []; } })()
                              : Array.isArray(item.selected_addons) ? item.selected_addons : [];
                            
                            return Array.isArray(addons) ? addons.map((a: any, i: number) => (
                              <div key={i} className="flex justify-between mt-0.5 italic">
                                <span>+ {a.name}</span>
                                {a.price ? <span>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(a.price)}</span> : null}
                              </div>
                            )) : null;
                          })()}
                        </div>
                      )}

                      {item.observation && (
                        <div className="ml-7 mt-2 p-2 bg-amber-50 text-amber-700 text-[10px] rounded border border-amber-100 italic">
                          Obs: {item.observation}
                        </div>
                      )}
                    </div>
                  ))}

                  {order.observation && (
                    <div className="p-4 bg-pink-50 text-pink-700 border-t border-pink-100">
                      <p className="text-[10px] uppercase font-bold mb-1">Observação do Pedido:</p>
                      <p className="text-sm italic">"{order.observation}"</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-slate-900 text-white p-6 rounded-2xl space-y-2">
            <div className="flex justify-between text-sm text-slate-400">
              <span>Subtotal dos produtos</span>
              <span>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((order.total_amount || 0) - Number(order.delivery_fee || 0))}</span>
            </div>
            <div className="flex justify-between text-sm text-slate-400">
              <span>Frete</span>
              <span>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(order.delivery_fee || 0))}</span>
            </div>
            <div className="flex justify-between text-sm text-slate-400 pt-2 border-t border-white/10">
              <span>Forma de Pagamento</span>
              <span className="uppercase font-bold text-white">{paymentMethodLabel(order.payment_method)}</span>
            </div>
            <div className="flex justify-between items-end pt-2 border-t border-white/20">
              <span className="text-lg font-medium text-slate-300">Total</span>
              <span className="text-3xl font-black text-pink-400">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(order.total_amount || 0)}
              </span>
            </div>
          </div>

          <div className="flex gap-3">
            <Button 
              variant="outline" 
              className="flex-1 gap-2 bg-slate-900 text-white hover:bg-slate-800" 
              onClick={() => onPrint(order)}
            >
              <Printer className="w-4 h-4" /> Imprimir Pedido
            </Button>
            <Button 
              variant="outline" 
              className="flex-1 gap-2" 
              onClick={() => {
                if (order.address) {
                  navigator.clipboard.writeText(order.address);
                  toast.success("Endereço copiado!");
                }
              }}
            >
              <Copy className="w-4 h-4" /> Copiar Endereço
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
