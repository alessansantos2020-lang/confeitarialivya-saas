import { createFileRoute } from '@tanstack/react-router';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getOrders, updateOrderStatus, updateOrderNotificationStatus } from '@/lib/orders-admin.functions';
import { getStoreSettings } from '@/lib/delivery.functions';
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
  Hammer,
  Send,
  Check,
  Ban,
  Bell,
  BellOff,
  Search,
  Filter,
  ArrowRight,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { useServerFn } from '@tanstack/react-start';
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

const statusMap = {
  pending: { label: 'Novo Pedido', color: 'bg-blue-500 text-white', icon: Clock, next: 'confirmed', nextLabel: 'Aceitar Pedido' },
  confirmed: { label: 'Aceito', color: 'bg-indigo-500 text-white', icon: CheckCircle2, next: 'preparing', nextLabel: 'Iniciar Preparo' },
  preparing: { label: 'Em Preparo', color: 'bg-orange-500 text-white', icon: Loader2, next: 'ready', nextLabel: 'Pedido Pronto' },
  ready: { label: 'Pronto', color: 'bg-green-600 text-white', icon: CheckCircle2, next: 'out_for_delivery', nextLabel: 'Sair para Entrega' },
  out_for_delivery: { label: 'Saiu para Entrega', color: 'bg-purple-600 text-white', icon: Truck, next: 'delivered', nextLabel: 'Confirmar Entrega' },
  delivered: { label: 'Entregue', color: 'bg-green-700 text-white', icon: CheckCircle, next: null, nextLabel: null },
  canceled: { label: 'Cancelado', color: 'bg-red-500 text-white', icon: XCircle, next: null, nextLabel: null },
};

export const Route = createFileRoute('/admin/orders')({
  component: OrdersPage
});

function OrdersPage() {
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [expandedDates, setExpandedDates] = useState<Record<string, boolean>>({});
  const queryClient = useQueryClient();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const previousOrderIds = useRef<Set<string>>(new Set());
  
  const fetchOrders = useServerFn(getOrders);
  const mutateStatus = useServerFn(updateOrderStatus);
  const fetchStoreSettings = useServerFn(getStoreSettings);

  const { data: orders, isLoading } = useQuery({
    queryKey: ['admin-orders'],
    queryFn: () => fetchOrders({ data: { status: undefined, date: undefined } })
  });

  // Sound initialization
  useEffect(() => {
    audioRef.current = new Audio('/new-order-alert.mp3');
  }, []);

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel('admin-orders-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        (payload) => {
          console.log('Realtime update received:', payload);
          queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
          
          if (payload.eventType === 'INSERT') {
            const newOrder = payload.new as any;
            if (!previousOrderIds.current.has(newOrder.id)) {
              if (soundEnabled && audioRef.current) {
                audioRef.current.play().catch(e => console.error("Erro ao tocar som:", e));
              }
              toast.info(`Novo pedido recebido: #${newOrder.id.slice(0, 8).toUpperCase()}`, {
                icon: <Bell className="w-4 h-4" />,
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
  }, [queryClient, soundEnabled]);

  // Sync initial order IDs to avoid alert on first load
  useEffect(() => {
    if (orders && previousOrderIds.current.size === 0) {
      orders.forEach((o: any) => previousOrderIds.current.add(o.id));
    }
  }, [orders]);

  const mutation = useMutation({
    mutationFn: (variables: { id: string; status: string }) => mutateStatus({ data: variables }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      queryClient.invalidateQueries({ queryKey: ['salesReport'] });
      toast.success("Status atualizado!");
    },
    onError: (error: any) => {
      toast.error(error.message || "Erro ao atualizar status.");
    }
  });

  const filteredOrders = orders?.filter((order: any) => {
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    const matchesSearch = order.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          order.id.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesSearch;
  }) || [];

  const handleNotifyWhatsApp = async (order: any, type: 'accepted' | 'shipping' | 'ready' | 'delivered') => {
    const settings = await fetchStoreSettings({});
    const storeName = settings?.name || 'Doce Encanto';
    const orderNumber = order.id.slice(0, 8).toUpperCase();
    
    // Format items list
    const itemsResumo = order.order_items?.map((item: any) => {
      let text = `✅ ${item.quantity}x ${item.product?.name}`;
      if (item.selected_addons) {
        const addons = typeof item.selected_addons === 'string' 
          ? JSON.parse(item.selected_addons) 
          : item.selected_addons;
        
        if (Array.isArray(addons) && addons.length > 0) {
          const addonsText = addons.map((a: any) => a.name).join(', ');
          text += ` (${addonsText})`;
        }
      }
      return text;
    }).join('\n');

    const total = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(order.total_amount);
    const subtotal = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(order.total_amount - (order.delivery_fee || 0));
    const fee = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(order.delivery_fee || 0);
    
    const paymentMap: Record<string, string> = { 'pix': 'PIX', 'card': 'Cartão', 'cash': 'Dinheiro' };
    const paymentMethod = paymentMap[order.payment_method] || order.payment_method;

    let message = '';

    if (type === 'accepted') {
      message = `Olá, *${order.customer_name}*! 👋

Seu pedido foi *ACEITO* com sucesso! ✅

📦 *PEDIDO #${orderNumber}*

🛍️ *Itens do pedido:*
${itemsResumo}

💰 *Resumo:*
Subtotal: ${subtotal}
Taxa de entrega: ${fee}
*Total: ${total}*

📍 *Endereço de entrega:*
${order.address}

💳 *Forma de pagamento:*
${paymentMethod}

Seu pedido já foi aceito e será preparado pela nossa equipe. 👨‍🍳

Obrigado pela preferência! ❤️`;
    } else if (type === 'ready') {
      message = `Olá, *${order.customer_name}*! 🧁
      
Seu pedido *#${orderNumber}* já está *PRONTO*! ✅

Aguarde, em breve sairá para entrega ou poderá ser retirado.

Obrigado! ❤️`;
    } else if (type === 'shipping') {
      message = `Olá, *${order.customer_name}*! 🛵💨
      
Seu pedido acabou de sair para entrega! 📦
      
O entregador já está a caminho. 🚀`;
    } else if (type === 'delivered') {
      message = `Olá, *${order.customer_name}*! 👋

Seu pedido foi *ENTREGUE*! ✅

Esperamos que você goste. Se puder nos avaliar, ficaremos muito felizes! ❤️

Bom apetite! 🧁`;
    }

    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/55${order.customer_phone.replace(/\D/g, '')}?text=${encodedMessage}`;
    window.open(whatsappUrl, '_blank');
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
            placeholder="Buscar por nome do cliente ou #pedido..." 
            className="pl-10 h-12 bg-white"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="overflow-x-auto pb-2 lg:pb-0">
          <Tabs value={statusFilter} onValueChange={setStatusFilter} className="w-fit">
            <TabsList className="bg-white border border-slate-200 h-12 p-1">
              <TabsTrigger value="all" className="px-4 hover:bg-transparent hover:text-inherit">Todos</TabsTrigger>
              <TabsTrigger value="pending" className="px-4 hover:bg-transparent hover:text-inherit">Novos</TabsTrigger>
              <TabsTrigger value="confirmed" className="px-4 hover:bg-transparent hover:text-inherit">Aceitos</TabsTrigger>
              <TabsTrigger value="preparing" className="px-4 hover:bg-transparent hover:text-inherit">Em Preparo</TabsTrigger>
              <TabsTrigger value="out_for_delivery" className="px-4 hover:bg-transparent hover:text-inherit">Em Rota</TabsTrigger>
              <TabsTrigger value="delivered" className="px-4 hover:bg-transparent hover:text-inherit">Entregues</TabsTrigger>
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
            const grouped = filteredOrders.reduce((acc: any, order: any) => {
              const dateKey = format(new Date(order.created_at), 'yyyy-MM-dd');
              if (!acc[dateKey]) acc[dateKey] = [];
              acc[dateKey].push(order);
              return acc;
            }, {});

            const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

            return sortedDates.map(dateKey => {
              const orders = grouped[dateKey];
              const isExpanded = expandedDates[dateKey] !== false; // Default to expanded
              const dateLabel = format(new Date(dateKey + 'T12:00:00'), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });

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
                        ({orders.length} {orders.length === 1 ? 'pedido' : 'pedidos'})
                      </span>
                    </h3>
                    <div className="flex-1 h-px bg-slate-200 ml-4"></div>
                  </button>

                  {isExpanded && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-top-2 duration-300">
                      {orders.map((order: any) => (
                        <OrderCard 
                          key={order.id} 
                          order={order} 
                          onUpdateStatus={(id: string, status: string) => mutation.mutate({ id, status })}
                          onNotifyWhatsApp={handleNotifyWhatsApp}
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
function OrderCard({ order, onUpdateStatus, onNotifyWhatsApp, isUpdating }: any) {
  const status = statusMap[order.status as keyof typeof statusMap] || statusMap.pending;
  const isNew = order.status === 'pending';

  return (
    <Card className={`overflow-hidden border ${isNew ? 'border-blue-500 ring-2 ring-blue-100 animate-in fade-in zoom-in duration-300' : 'border-slate-200'}`}>

      <div className={`p-2 flex justify-between items-center ${isNew ? 'bg-blue-500 text-white' : 'bg-slate-50 border-b border-slate-200'}`}>
        <div className="flex items-center gap-2">
          <span className="font-mono font-bold text-xs">#{order.id.slice(0, 8).toUpperCase()}</span>
          {isNew && <Badge className="h-5 px-1 bg-white text-blue-600 text-[9px] animate-pulse">NOVO</Badge>}
        </div>
        <span className="text-[10px] font-medium flex items-center gap-1">
          <Clock className="w-2.5 h-2.5" />
          {format(new Date(order.created_at), "HH:mm", { locale: ptBR })}
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
          <Badge className={`${status.color} text-[9px] h-5 px-1.5 uppercase font-bold shrink-0`}>
            {status.label}
          </Badge>
        </div>

        <div className="flex items-center justify-between pt-1 border-t border-slate-100">
          <div className="text-[11px] font-bold text-pink-600">
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(order.total_amount)}
          </div>
          <div className="text-[10px] text-slate-400 uppercase font-bold">
            {order.payment_method === 'pix' ? 'PIX' : 
             order.payment_method === 'card' ? 'Cartão' : 
             order.payment_method === 'cash' ? 'Dinheiro' : order.payment_method}
          </div>
        </div>

        <div className="pt-1 flex flex-col gap-1.5">
          <div className="grid grid-cols-2 gap-1.5">
            <OrderDetailsDialog order={order} />
            
            {['confirmed', 'in_preparation', 'ready', 'out_for_delivery', 'delivered'].includes(order.status) && (
              <Button 
                variant="outline" 
                size="sm" 
                className="h-8 text-[11px] border-green-600 text-green-600 gap-1"
                onClick={() => {
                  let type: 'accepted' | 'ready' | 'shipping' | 'delivered' = 'accepted';
                  if (order.status === 'ready') type = 'ready';
                  else if (order.status === 'out_for_delivery') type = 'shipping';
                  else if (order.status === 'delivered') type = 'delivered';
                  onNotifyWhatsApp(order, type);
                }}
              >
                <MessageCircle className="w-3 h-3" /> Avisar
              </Button>
            )}
          </div>

          {status.next && (
            <Button 
              className={cn("w-full h-8 text-[11px] font-bold gap-1", status.color, status.color.split(' ').map(c => `hover:${c}`).join(' '))}
              onClick={() => onUpdateStatus(order.id, status.next)}
              disabled={isUpdating}
            >
              {isUpdating ? "..." : (
                <>
                  {status.nextLabel} <ArrowRight className="w-3 h-3" />
                </>
              )}
            </Button>
          )}

          {order.status === 'delivered' && (
            <div className="bg-green-50 text-green-700 h-8 rounded flex items-center justify-center gap-1 text-[10px] font-bold">
              <CheckCircle className="w-3 h-3" /> ENTREGUE
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function OrderDetailsDialog({ order }: { order: any }) {
  const status = statusMap[order.status as keyof typeof statusMap] || statusMap.pending;
  const items = order.order_items || [];
  
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="w-full gap-1.5 hover:bg-background hover:text-foreground">
          <Eye className="w-4 h-4" /> Detalhes
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0">
        <div className={`p-6 text-white ${status.color}`}>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-2xl font-bold">Pedido #{order.id.slice(0, 8).toUpperCase()}</h2>
            <Badge variant="outline" className="text-white border-white/40 uppercase font-bold">
              {status.label}
            </Badge>
          </div>
          <p className="text-white/80 text-sm">Realizado em {format(new Date(order.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Informações do Cliente</h3>
                <div className="bg-slate-50 p-4 rounded-xl space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-pink-100 flex items-center justify-center text-pink-600 font-bold">
                      {order.customer_name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-bold text-slate-900">{order.customer_name}</p>
                      <p className="text-sm text-slate-500">{order.customer_phone}</p>
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
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase font-bold">Cidade</p>
                        <p className="font-medium text-slate-900">Teresina</p>
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
                  {items.map((item: any, idx: number) => (
                    <div key={idx} className={`p-4 ${idx !== items.length - 1 ? 'border-b border-slate-100' : ''}`}>
                      <div className="flex justify-between items-start mb-1">
                        <div className="flex gap-2">
                          <span className="font-bold text-pink-600">{item.quantity}x</span>
                          <span className="font-bold text-slate-900">{item.product_name || item.product?.name || "Produto"}</span>
                        </div>
                        <span className="font-bold text-slate-700">
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.price_at_time * item.quantity)}
                        </span>
                      </div>
                      
                      {item.selected_addons && (
                        <div className="ml-7 text-xs text-slate-500">
                          {(() => {
                            const addons = typeof item.selected_addons === 'string' 
                              ? JSON.parse(item.selected_addons) 
                              : item.selected_addons;
                            
                            return Array.isArray(addons) ? addons.map((a: any) => (
                              <div key={a.id} className="flex justify-between mt-0.5 italic">
                                <span>+ {a.name}</span>
                                <span>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(a.price || 0)}</span>
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

          <div id={`printable-order-${order.id}`} className="bg-slate-900 text-white p-6 rounded-2xl">
            <div className="space-y-2 mb-4">
              <div className="flex justify-between text-sm text-slate-400">
                <span>Subtotal dos produtos</span>
                <span>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(order.total_amount - (order.delivery_fee || 0))}</span>
              </div>
              <div className="flex justify-between text-sm text-slate-400">
                <span>Frete</span>
                <span>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(order.delivery_fee || 0)}</span>
              </div>
              <div className="flex justify-between text-sm text-slate-400 pt-2 border-t border-white/10">
                <span>Forma de Pagamento</span>
                <span className="uppercase font-bold text-white">{order.payment_method === 'pix' ? 'PIX' : 
                                                                order.payment_method === 'card' ? 'Cartão' : 
                                                                order.payment_method === 'cash' ? 'Dinheiro' : order.payment_method}</span>
              </div>
            </div>
            <div className="flex justify-between items-end pt-2 border-t border-white/20">
              <span className="text-lg font-medium text-slate-300">Total</span>
              <span className="text-3xl font-black text-pink-400">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(order.total_amount)}
              </span>
            </div>
          </div>

          <div className="flex gap-3">
            <Button 
              variant="outline" 
              className="flex-1 gap-2 bg-slate-900 text-white" 
              onClick={() => {
                const printContent = document.getElementById(`printable-order-${order.id}`);
                const itemsContent = document.querySelector('.products-print-section');
                const customerContent = document.querySelector('.customer-print-section');
                
                const win = window.open('', '_blank');
                if (win) {
                  win.document.write(`
                    <html>
                      <head>
                        <title>Pedido #${order.id.slice(0, 8).toUpperCase()}</title>
                        <style>
                          body { font-family: sans-serif; padding: 20px; line-height: 1.4; color: #333; }
                          .header { text-align: center; border-bottom: 2px dashed #ccc; padding-bottom: 10px; margin-bottom: 20px; }
                          .order-info { margin-bottom: 20px; font-size: 14px; }
                          .section-title { font-weight: bold; text-transform: uppercase; font-size: 12px; margin-top: 15px; border-bottom: 1px solid #eee; padding-bottom: 5px; }
                          .item { display: flex; justify-between: space-between; margin-bottom: 8px; border-bottom: 1px dotted #eee; padding-bottom: 5px; }
                          .item-qty { font-weight: bold; margin-right: 10px; }
                          .item-name { flex: 1; font-weight: bold; }
                          .addon { font-size: 11px; margin-left: 25px; color: #666; font-style: italic; }
                          .obs { background: #f9f9f9; padding: 8px; font-size: 12px; margin-top: 5px; border-left: 3px solid #ff4d94; }
                          .total-section { margin-top: 20px; border-top: 2px solid #333; padding-top: 10px; }
                          .total-row { display: flex; justify-content: space-between; margin-bottom: 5px; }
                          .final-total { font-size: 20px; font-weight: 900; margin-top: 10px; text-align: right; }
                          @media print { .no-print { display: none; } }
                        </style>
                      </head>
                      <body>
                        <div class="header">
                          <h1>Doce Encanto</h1>
                          <p>Pedido #${order.id.slice(0, 8).toUpperCase()}</p>
                          <p>${format(new Date(order.created_at), "dd/MM/yyyy HH:mm")}</p>
                        </div>
                        
                        <div class="order-info">
                          <strong>Cliente:</strong> ${order.customer_name}<br>
                          <strong>Tel:</strong> ${order.customer_phone}<br>
                          <strong>Endereço:</strong> ${order.street}, ${order.number}${order.complement ? ` - ${order.complement}` : ''}<br>
                          <strong>Bairro:</strong> ${order.neighborhood}<br>
                          ${order.reference ? `<strong>Ref:</strong> ${order.reference}` : ''}
                        </div>

                        <div class="section-title">Itens do Pedido</div>
                        ${items.map((item: any) => `
                          <div style="margin-bottom: 15px;">
                            <div class="item">
                              <span class="item-qty">${item.quantity}x</span>
                              <span class="item-name">${item.product_name || item.product?.name || "Produto"}</span>
                            </div>
                            ${item.selected_addons ? (() => {
                              const addons = typeof item.selected_addons === 'string' ? JSON.parse(item.selected_addons) : item.selected_addons;
                              return Array.isArray(addons) ? addons.map((a: any) => `<div class="addon">+ ${a.name}</div>`).join('') : '';
                            })() : ''}
                            ${item.observation ? `<div class="obs">Obs: ${item.observation}</div>` : ''}
                          </div>
                        `).join('')}

                        ${order.observation ? `
                          <div class="section-title">Observação Geral</div>
                          <div class="obs">${order.observation}</div>
                        ` : ''}

                        <div class="total-section">
                          <div class="total-row">
                            <span>Subtotal dos produtos:</span>
                            <span>${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(order.total_amount - (order.delivery_fee || 0))}</span>
                          </div>
                          <div class="total-row">
                            <span>Frete:</span>
                            <span>${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(order.delivery_fee || 0)}</span>
                          </div>
                          <div class="total-row">
                            <span>Pagamento:</span>
                            <span style="text-transform: uppercase;">${order.payment_method}</span>
                          </div>
                          <div class="final-total">
                            TOTAL: ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(order.total_amount)}
                          </div>
                        </div>

                        <script>
                          window.onload = function() { window.print(); window.close(); }
                        </script>
                      </body>
                    </html>
                  `);
                  win.document.close();
                }
              }}
            >
              <Printer className="w-4 h-4" /> Imprimir Pedido
            </Button>
            <Button variant="outline" className="flex-1 gap-2 hover:bg-background hover:text-foreground" onClick={() => {
              navigator.clipboard.writeText(order.address);
              toast.success("Endereço copiado!");
            }}>
              <Copy className="w-4 h-4" /> Copiar Endereço
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
