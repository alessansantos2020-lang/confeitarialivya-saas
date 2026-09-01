import { createFileRoute } from '@tanstack/react-router';
import { supabase } from '@/integrations/supabase/client';
import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getOrders, updateOrderStatus } from '@/lib/orders-admin.functions';
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
  MessageCircle,
  Bell,
  BellOff,
  Search,
  ArrowRight,
  ShoppingBag,
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

export const Route = createFileRoute('/staff/')({
  component: StaffOrdersPage
});

function StaffOrdersPage() {
  const [statusFilter, setStatusFilter] = useState('active');
  const [searchTerm, setSearchTerm] = useState('');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [expandedDates, setExpandedDates] = useState<Record<string, boolean>>({});
  const queryClient = useQueryClient();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const previousOrderIds = useRef<Set<string>>(new Set());

  const { data: orders, isLoading } = useQuery({
    queryKey: ['staff-orders'],
    queryFn: () => getOrders({ status: undefined, date: undefined })
  });

  useEffect(() => {
    audioRef.current = new Audio('/new-order-alert.mp3');
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel('staff-orders-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ['staff-orders'] });
          if (payload.eventType === 'INSERT') {
            const newOrder = payload.new as any;
            if (!previousOrderIds.current.has(newOrder.id)) {
              if (soundEnabled && audioRef.current) {
                audioRef.current.play().catch((e: any) => console.error("Erro ao tocar som:", e));
              }
              toast.info(`Novo pedido recebido: #${newOrder.id.slice(0, 8).toUpperCase()}`);
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

  useEffect(() => {
    if (orders && previousOrderIds.current.size === 0) {
      orders.forEach((o: any) => previousOrderIds.current.add(o.id));
    }
  }, [orders]);

  const mutation = useMutation({
    mutationFn: (variables: { id: string; status: string }) => updateOrderStatus(variables),
    onSuccess: async (updatedOrder) => {
      queryClient.invalidateQueries({ queryKey: ['staff-orders'] });
      toast.success("Status atualizado!");
      
      // Automatic WhatsApp notification on progress
      if (updatedOrder) {
        let type: 'preparing' | 'ready' | 'shipping' | 'delivered' | null = null;
        if (updatedOrder.status === 'preparing') type = 'preparing';
        else if (updatedOrder.status === 'ready') type = 'ready';
        else if (updatedOrder.status === 'out_for_delivery') type = 'shipping';
        else if (updatedOrder.status === 'delivered') type = 'delivered';
        
        if (type) {
          handleNotifyWhatsApp(updatedOrder, type);
        }
      }
    },
    onError: (error: any) => {
      toast.error(error.message || "Erro ao atualizar status.");
    }
  });

  const filteredOrders = orders?.filter((order: any) => {
    const isActive = ['pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery'].includes(order.status);
    const matchesFilter = statusFilter === 'active' ? isActive : order.status === statusFilter;
    const matchesSearch = order.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          order.id.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  }) || [];

  const handleNotifyWhatsApp = async (order: any, type: 'preparing' | 'ready' | 'shipping' | 'delivered' | 'accepted') => {
    if (!order.customer_phone) {
      toast.error("Cliente não possui telefone cadastrado para WhatsApp.");
      return;
    }

    const settings = await getStoreSettings();
    const storeName = settings?.name || 'Doce Encanto';
    const orderNumber = order.id.slice(0, 8).toUpperCase();
    
    const itemsResumo = order.order_items?.map((item: any) => {
      let text = `✅ ${item.quantity}x ${item.product?.name}`;
      if (item.selected_addons) {
        const addons = typeof item.selected_addons === 'string' ? JSON.parse(item.selected_addons) : item.selected_addons;
        if (Array.isArray(addons) && addons.length > 0) {
          const addonsText = addons.map((a: any) => a.name).join(', ');
          text += ` (${addonsText})`;
        }
      }
      return text;
    }).join('\n');

    const total = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(order.total_amount);
    
    let message = '';
    if (type === 'accepted') {
      message = `Olá, *${order.customer_name}*! 👋 Seu pedido *#${orderNumber}* foi *ACEITO*! ✅\n\n🛍️ *Itens:*\n${itemsResumo}\n\n*Total: ${total}*\n\nJá estamos preparando seu pedido com muito carinho! ❤️`;
    } else if (type === 'preparing') {
      message = `Olá, *${order.customer_name}*! 🧁 Seu pedido *#${orderNumber}* está sendo *PREPARADO*! 👨‍🍳`;
    } else if (type === 'ready') {
      message = `Olá, *${order.customer_name}*! 🧁 Seu pedido *#${orderNumber}* já está *PRONTO*! ✅`;
    } else if (type === 'shipping') {
      message = `Olá, *${order.customer_name}*! 🛵💨 Seu pedido *#${orderNumber}* acabou de *SAIR PARA ENTREGA*! 📦`;
    } else if (type === 'delivered') {
      message = `Olá, *${order.customer_name}*! 👋 Seu pedido *#${orderNumber}* foi *FINALIZADO/ENTREGUE*! ✅ Bom apetite! ❤️`;
    }

    if (!message) return;

    const phone = order.customer_phone.replace(/\D/g, '');
    const whatsappUrl = `https://wa.me/55${phone}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            Operação de Pedidos
            <span className="flex h-2 w-2 rounded-full bg-green-500 animate-pulse" />
          </h2>
          <p className="text-slate-500 text-sm">Controle operacional da confeitaria.</p>
        </div>
        
        <div className="flex items-center gap-4 bg-white p-2 px-4 rounded-lg border border-slate-200 shadow-sm">
          <Label htmlFor="sound-toggle" className="text-sm font-medium flex items-center gap-2 cursor-pointer">
            {soundEnabled ? <Bell className="w-4 h-4 text-pink-500" /> : <BellOff className="w-4 h-4 text-slate-400" />}
            Som de alerta
          </Label>
          <Switch id="sound-toggle" checked={soundEnabled} onCheckedChange={setSoundEnabled} />
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input 
            placeholder="Buscar por cliente ou pedido..." 
            className="pl-10 h-12 bg-white"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <Tabs value={statusFilter} onValueChange={setStatusFilter} className="w-fit">
          <TabsList className="bg-white border border-slate-200 h-12">
            <TabsTrigger value="active" className="px-4">Ativos</TabsTrigger>
            <TabsTrigger value="pending" className="px-4">Novos</TabsTrigger>
            <TabsTrigger value="ready" className="px-4">Prontos</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="space-y-8">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array(6).fill(0).map((_, i) => <div key={i} className="h-64 bg-slate-100 animate-pulse rounded-xl" />)}
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="py-20 text-center text-slate-500 bg-white rounded-xl border border-dashed border-slate-200">
            <ShoppingBag className="w-12 h-12 mx-auto mb-4 text-slate-200" />
            <p>Nenhum pedido encontrado no momento.</p>
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
              const isExpanded = expandedDates[dateKey] !== false;
              const dateLabel = format(new Date(dateKey + 'T12:00:00'), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });

              return (
                <div key={dateKey} className="space-y-4">
                  <button
                    onClick={() => setExpandedDates(prev => ({ ...prev, [dateKey]: !isExpanded }))}
                    className="flex items-center gap-2 w-full text-left group"
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
    <Card className={`overflow-hidden border transition-all ${isNew ? 'border-blue-500 ring-2 ring-blue-100' : 'border-slate-200'}`}>
      <div className={`p-2 flex justify-between items-center ${isNew ? 'bg-blue-500 text-white' : 'bg-slate-50 border-b border-slate-200'}`}>
        <span className="font-mono font-bold text-xs">#{order.id.slice(0, 8).toUpperCase()}</span>
        <span className="text-[10px] font-medium">{format(new Date(order.created_at), "HH:mm")}</span>
      </div>

      <CardContent className="p-4 space-y-4">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="font-bold text-slate-900">{order.customer_name}</h3>
            <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
              <MapPin className="w-3 h-3" /> {order.neighborhood || "Endereço"}
            </p>
          </div>
          <Badge className={`${status.color} text-[10px] uppercase font-bold`}>{status.label}</Badge>
        </div>

        <div className="flex gap-2">
          <OrderDetailsDialog order={order} />
          {status.next && (
            <Button 
              className={`flex-1 h-9 text-xs font-bold ${status.color}`}
              onClick={() => onUpdateStatus(order.id, status.next)}
              disabled={isUpdating}
            >
              {status.nextLabel}
            </Button>
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
        <Button variant="outline" size="sm" className="flex-1 h-9 text-xs gap-1.5">
          <Eye className="w-4 h-4" /> Detalhes
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Pedido #{order.id.slice(0, 8).toUpperCase()}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="bg-slate-50 p-4 rounded-lg space-y-2 text-sm">
            <p><strong>Cliente:</strong> {order.customer_name}</p>
            <p><strong>Telefone:</strong> {order.customer_phone}</p>
            <p><strong>Endereço:</strong> {order.address}</p>
            {order.observation && <p className="text-red-600"><strong>Obs:</strong> {order.observation}</p>}
          </div>

          <div className="space-y-2">
            <h4 className="font-bold text-sm border-b pb-1">Produtos</h4>
            {items.map((item: any) => (
              <div key={item.id} className="text-sm">
                <div className="flex justify-between font-medium">
                  <span>{item.quantity}x {item.product_name || item.product?.name || "Produto"}</span>
                  <span>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.price_at_time * item.quantity)}</span>
                </div>
                {item.selected_addons && (
                  <p className="text-xs text-slate-500 pl-4 italic">
                    {typeof item.selected_addons === 'string' 
                      ? JSON.parse(item.selected_addons).map((a: any) => a.name).join(', ')
                      : Array.isArray(item.selected_addons) ? item.selected_addons.map((a: any) => a.name).join(', ') : ''}
                  </p>
                )}
                {item.observation && <p className="text-xs text-orange-600 pl-4">Obs: {item.observation}</p>}
              </div>
            ))}
          </div>

          <div className="space-y-1 text-sm border-t pt-2">
            <div className="flex justify-between text-slate-500">
              <span>Subtotal dos produtos</span>
              <span>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(order.total_amount - (order.delivery_fee || 0))}</span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>Frete</span>
              <span>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(order.delivery_fee || 0)}</span>
            </div>
            <div className="flex justify-between font-bold text-lg pt-1 border-t mt-1">
              <span>Total</span>
              <span>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(order.total_amount)}</span>
            </div>
          </div>
          
          <Button className="w-full gap-2" variant="outline" onClick={() => window.print()}>
            <Printer className="w-4 h-4" /> Imprimir Cupom
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
