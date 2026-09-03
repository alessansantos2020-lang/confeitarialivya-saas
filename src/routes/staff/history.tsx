import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { getOrders } from '@/lib/orders-admin.functions';
import { useActiveStore } from '@/lib/active-store';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  History, 
  Search, 
  Eye, 
  MapPin, 
  Calendar,
  CheckCircle2,
  XCircle,
  Clock
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
import { Card, CardContent } from "@/components/ui/card";
import { useState } from 'react';

const statusMap = {
  delivered: { label: 'Entregue', color: 'bg-green-700 text-white', icon: CheckCircle2 },
  canceled: { label: 'Cancelado', color: 'bg-red-500 text-white', icon: XCircle },
};

export const Route = createFileRoute('/staff/history')({
  component: StaffHistoryPage
});

function StaffHistoryPage() {
  const { storeId } = useActiveStore();
  const [searchTerm, setSearchTerm] = useState('');

  const { data: orders, isLoading } = useQuery({
    queryKey: ['staff-history', storeId],
    queryFn: () => getOrders({ status: undefined, date: undefined, storeId })
  });

  const historyOrders = orders?.filter((order: any) => {
    const isFinished = ['delivered', 'canceled'].includes(order.status);
    const matchesSearch = order.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          order.id.toLowerCase().includes(searchTerm.toLowerCase());
    return isFinished && matchesSearch;
  }) || [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          Histórico de Pedidos
          <History className="w-6 h-6 text-slate-400" />
        </h2>
        <p className="text-slate-500 text-sm">Consulte pedidos finalizados e cancelados.</p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input 
          placeholder="Buscar no histórico por cliente ou pedido..." 
          className="pl-10 h-12 bg-white"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading ? (
          Array(6).fill(0).map((_, i) => <div key={i} className="h-48 bg-slate-100 animate-pulse rounded-xl" />)
        ) : historyOrders.length === 0 ? (
          <div className="col-span-full py-20 text-center text-slate-500 bg-white rounded-xl border border-dashed border-slate-200">
            <History className="w-12 h-12 mx-auto mb-4 text-slate-200" />
            <p>Nenhum pedido finalizado encontrado.</p>
          </div>
        ) : (
          historyOrders.map((order: any) => (
            <HistoryCard key={order.id} order={order} />
          ))
        )}
      </div>
    </div>
  );
}

function HistoryCard({ order }: any) {
  const status = statusMap[order.status as keyof typeof statusMap] || { label: order.status, color: 'bg-slate-500 text-white', icon: Clock };
  
  return (
    <Card className="overflow-hidden border border-slate-200 hover:shadow-md transition-all">
      <div className="bg-slate-50 p-2 flex justify-between items-center border-b border-slate-200">
        <span className="font-mono font-bold text-xs">#{order.id.slice(0, 8).toUpperCase()}</span>
        <span className="text-[10px] text-slate-500 font-medium">
          {format(new Date(order.created_at), "dd/MM/yy HH:mm")}
        </span>
      </div>
      <CardContent className="p-4 space-y-3">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="font-bold text-slate-900 truncate max-w-[150px]">{order.customer_name}</h3>
            <div className="text-[11px] font-bold text-pink-600 mt-1">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(order.total_amount)}
            </div>
          </div>
          <Badge className={`${status.color} text-[9px] uppercase font-bold shrink-0`}>
            {status.label}
          </Badge>
        </div>
        
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="w-full h-8 text-[11px] gap-1.5">
              <Eye className="w-3 h-3" /> Ver Detalhes
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Pedido #{order.id.slice(0, 8).toUpperCase()}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4 text-sm">
               <div className="bg-slate-50 p-3 rounded-lg space-y-1">
                <p><strong>Status:</strong> <span className="uppercase font-bold">{status.label}</span></p>
                <p><strong>Data:</strong> {format(new Date(order.created_at), "dd/MM/yyyy 'às' HH:mm")}</p>
                <p><strong>Cliente:</strong> {order.customer_name}</p>
                <p><strong>Telefone:</strong> {order.customer_phone}</p>
                <p><strong>Endereço:</strong> {order.address}</p>
              </div>
              <div className="space-y-2">
                <h4 className="font-bold border-b pb-1">Produtos</h4>
                {order.order_items?.map((item: any) => (
                  <div key={item.id} className="flex justify-between">
                    <span>{item.quantity}x {item.product?.name}</span>
                    <span>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.price_at_time * item.quantity)}</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between font-bold border-t pt-2">
                <span>Total</span>
                <span>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(order.total_amount)}</span>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
