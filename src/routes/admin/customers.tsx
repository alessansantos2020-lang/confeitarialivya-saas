import { createFileRoute, redirect } from '@tanstack/react-router';
import { supabase } from '@/integrations/supabase/client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getCustomers, getCustomerHistory } from '@/lib/customers.functions';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Search, 
  User, 
  Phone, 
  MapPin, 
  ShoppingBag, 
  History,
  ChevronRight,
  Loader2,
  Calendar,
  Package,
  Users
} from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute('/admin/customers')({
  beforeLoad: () => {
    return;
  },
  component: CustomersPage
});

function CustomersPage() {
  const [searchTerm, setSearchTerm] = useState('');

  const { data: customers, isLoading } = useQuery({
    queryKey: ['admin-customers', searchTerm],
    queryFn: () => getCustomers({ search: searchTerm || undefined }) as any
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Clientes</h1>
        <p className="text-slate-500">Histórico e gestão de clientes da confeitaria.</p>
      </div>

      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
          <Input 
            placeholder="Pesquisar por nome ou telefone..." 
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center flex flex-col items-center gap-2">
            <Loader2 className="w-8 h-8 animate-spin text-pink-500" />
            <p className="text-slate-500">Carregando lista de clientes...</p>
          </div>
        ) : !customers || customers.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <Users className="w-12 h-12 mx-auto mb-4 text-slate-300" />
            <p className="text-lg font-medium text-slate-600">Nenhum cliente encontrado</p>
            <p>Clientes aparecem aqui automaticamente após o primeiro pedido.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Pedidos</TableHead>
                  <TableHead>Último Pedido</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.map((customer: any) => (
                  <TableRow key={customer.phone} className="hover:bg-slate-50/50">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-pink-100 text-pink-600 flex items-center justify-center font-bold text-xs">
                          {customer.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="text-sm font-medium text-slate-900">{customer.name}</div>
                          <div className="text-xs text-slate-500 flex items-center gap-1">
                            <MapPin className="w-3 h-3" /> {customer.address.split(',')[0]}...
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm text-slate-600 flex items-center gap-1.5">
                        <Phone className="w-3 h-3 text-slate-400" />
                        {customer.phone}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="bg-slate-100 text-slate-700 hover:bg-slate-200 border-none">
                        {customer.total_orders} {customer.total_orders === 1 ? 'pedido' : 'pedidos'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm text-slate-600">
                        {format(new Date(customer.last_order_date), "dd/MM/yyyy", { locale: ptBR })}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <CustomerHistoryDialog customer={customer} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}

function CustomerHistoryDialog({ customer }: { customer: any }) {
  const { data: history, isLoading } = useQuery({
    queryKey: ['customer-history', customer.phone],
    queryFn: () => getCustomerHistory({ phone: customer.phone })
  });

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-pink-600 hover:text-pink-700 hover:bg-pink-50 gap-2">
          <History className="w-4 h-4" />
          Histórico
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-6 border-b bg-slate-50">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-pink-500 text-white flex items-center justify-center font-bold text-lg shadow-sm">
              {customer.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <DialogTitle className="text-xl text-slate-900">{customer.name}</DialogTitle>
              <div className="flex items-center gap-3 text-sm text-slate-500 mt-1">
                <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {customer.phone}</span>
                <span className="flex items-center gap-1"><ShoppingBag className="w-3 h-3" /> {customer.total_orders} pedidos realizados</span>
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="mb-6">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-pink-500" /> Endereço Principal
            </h3>
            <p className="text-slate-600 bg-slate-50 p-3 rounded-lg border text-sm italic">
              {customer.address}
            </p>
          </div>

          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
            <History className="w-4 h-4 text-pink-500" /> Histórico de Pedidos
          </h3>

          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-slate-300" />
            </div>
          ) : (
            <div className="space-y-4">
              {history?.map((order: any) => (
                <div key={order.id} className="border rounded-xl p-4 hover:border-pink-200 transition-colors bg-white">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono font-bold text-slate-400">#{order.id.slice(0, 8).toUpperCase()}</span>
                        <Badge variant="outline" className="text-[10px] uppercase font-bold py-0 h-5">
                          {order.status === 'pending' ? 'Novo' : 
                           order.status === 'delivered' ? 'Entregue' : order.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <Calendar className="w-3.5 h-3.5" />
                        {format(new Date(order.created_at), "dd 'de' MMMM, yyyy 'às' HH:mm", { locale: ptBR })}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-slate-900">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(order.total_amount)}
                      </div>
                      <div className="text-[10px] text-slate-500 uppercase">{order.payment_method}</div>
                    </div>
                  </div>

                  <div className="space-y-2 pt-3 border-t border-slate-50">
                    {order.order_items?.map((item: any) => (
                      <div key={item.id} className="flex justify-between text-sm">
                        <span className="text-slate-700">
                          {item.quantity}x {item.product?.name}
                          {item.selected_addons && item.selected_addons.length > 0 && (
                            <span className="text-xs text-slate-400 block ml-4 italic">
                              + {item.selected_addons.map((a: any) => a.name).join(', ')}
                            </span>
                          )}
                        </span>
                        <span className="font-medium text-slate-900">
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.price_at_time * item.quantity)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
