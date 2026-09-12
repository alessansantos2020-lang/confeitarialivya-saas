import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useActiveStore } from "@/lib/active-store";
import {
  ShoppingBag,
  Clock,
  PackageOpen,
  Truck,
  CheckCircle2,
  XCircle,
  DollarSign,
  Users,
  CalendarDays,
  ArrowRight,
  Store as StoreIcon
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/")({
  component: AdminDashboard,
});

const statusMap: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: "Pendente", color: "bg-yellow-100 text-yellow-700 border-yellow-200", icon: Clock },
  confirmed: { label: "Aceito", color: "bg-indigo-100 text-indigo-700 border-indigo-200", icon: CheckCircle2 },
  preparing: { label: "Em preparo", color: "bg-blue-100 text-blue-700 border-blue-200", icon: PackageOpen },
  ready: { label: "Pronto", color: "bg-green-100 text-green-700 border-green-200", icon: CheckCircle2 },
  out_for_delivery: { label: "Saiu para entrega", color: "bg-purple-100 text-purple-700 border-purple-200", icon: Truck },
  delivered: { label: "Entregue", color: "bg-green-100 text-green-700 border-green-200", icon: CheckCircle2 },
  canceled: { label: "Cancelado", color: "bg-red-100 text-red-700 border-red-200", icon: XCircle },
};

const CUSTOMER_PAGE_SIZE = 1000;

const getUniqueCustomerCount = async (storeId: string): Promise<number> => {
  const phones = new Set<string>();

  for (let offset = 0; ; offset += CUSTOMER_PAGE_SIZE) {
    const { data, error } = await supabase
      .from("orders")
      .select("customer_phone")
      .eq("store_id", storeId)
      .order("id", { ascending: true })
      .range(offset, offset + CUSTOMER_PAGE_SIZE - 1);

    if (error) throw error;

    for (const order of data || []) {
      if (order.customer_phone) phones.add(order.customer_phone);
    }

    if (!data || data.length < CUSTOMER_PAGE_SIZE) break;
  }

  return phones.size;
};

function AdminDashboard() {
  const { storeId } = useActiveStore();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { data: stats, isLoading: statsLoading, isError: statsError } = useQuery({
    queryKey: ["admin-stats", storeId],
    queryFn: async () => {
      // Pedidos de hoje e faturamento
      const { data: todayOrders, error: todayOrdersError } = await supabase
        .from("orders")
        .select("status, total_amount")
        .eq("store_id", storeId)
        .gte("created_at", today.toISOString());
      if (todayOrdersError) throw todayOrdersError;

      const uniqueCustomers = await getUniqueCustomerCount(storeId);

      const counts = {
        today: todayOrders?.length || 0,
        pending: todayOrders?.filter(o => o.status === 'pending').length || 0,
        confirmed: todayOrders?.filter(o => o.status === 'confirmed').length || 0,
        preparing: todayOrders?.filter(o => o.status === 'preparing').length || 0,
        ready: todayOrders?.filter(o => o.status === 'ready').length || 0,
        out_for_delivery: todayOrders?.filter(o => o.status === 'out_for_delivery').length || 0,
        delivered: todayOrders?.filter(o => o.status === 'delivered').length || 0,
        canceled: todayOrders?.filter(o => o.status === 'canceled').length || 0,
        revenue: todayOrders?.reduce((acc, o) => o.status !== 'canceled' ? acc + (Number(o.total_amount) || 0) : acc, 0) || 0,
        customers: uniqueCustomers || 0
      };

      return counts;
    }
  });


  const StatCard = ({ title, value, icon: Icon, colorClass, loading }: any) => (
    <Card className="overflow-hidden border-none shadow-sm hover:shadow-md transition-shadow">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500 mb-1">{title}</p>
            {loading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <h3 className="text-2xl font-bold text-slate-900">{value}</h3>
            )}
          </div>
          <div className={`p-3 rounded-xl ${colorClass}`}>
            <Icon size={24} />
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Visão Geral do Negócio</h1>
        <p className="text-slate-500 mt-1">Métricas de faturamento e clientes para hoje, {format(new Date(), "dd 'de' MMMM", { locale: ptBR })}.</p>
      </div>

      {statsError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
          <p className="text-red-700 font-medium">Erro ao carregar dados do painel.</p>
          <p className="text-red-500 text-sm mt-1">Verifique sua conexão e tente recarregar a página.</p>
        </div>
      )}

      {/* Main Indicators */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          title="Faturamento do Dia" 
          value={new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats?.revenue || 0)} 
          icon={DollarSign} 
          colorClass="bg-emerald-100 text-emerald-600"
          loading={statsLoading}
        />
        <StatCard 
          title="Pedidos de Hoje" 
          value={stats?.today || 0} 
          icon={ShoppingBag} 
          colorClass="bg-pink-100 text-pink-600"
          loading={statsLoading}
        />
        <StatCard 
          title="Total de Clientes" 
          value={stats?.customers || 0} 
          icon={Users} 
          colorClass="bg-blue-100 text-blue-600"
          loading={statsLoading}
        />
        <StatCard 
          title="Pedidos Novos" 
          value={stats?.pending || 0} 
          icon={Clock} 
          colorClass="bg-yellow-100 text-yellow-600"
          loading={statsLoading}
        />
      </div>

      {/* Secondary Status Indicators */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { label: "Aceitos", value: stats?.confirmed, icon: CheckCircle2, color: "text-indigo-600 bg-indigo-50" },
          { label: "Em preparo", value: stats?.preparing, icon: PackageOpen, color: "text-blue-600 bg-blue-50" },
          { label: "Prontos", value: stats?.ready, icon: CheckCircle2, color: "text-emerald-600 bg-emerald-50" },
          { label: "Saiu para entrega", value: stats?.out_for_delivery, icon: Truck, color: "text-purple-600 bg-purple-50" },
          { label: "Entregues", value: stats?.delivered, icon: CheckCircle2, color: "text-green-600 bg-green-50" },
          { label: "Cancelados", value: stats?.canceled, icon: XCircle, color: "text-red-600 bg-red-50" },
        ].map((item) => (
          <div key={item.label} className="bg-white p-4 rounded-xl border border-slate-100 flex items-center gap-3">
            <div className={`p-2 rounded-lg ${item.color}`}>
              <item.icon size={18} />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">{item.label}</p>
              <p className="text-lg font-bold text-slate-900">{statsLoading ? "..." : item.value || 0}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white p-8 rounded-2xl border border-slate-100 text-center shadow-sm">
        <div className="h-16 w-16 bg-pink-100 text-pink-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <StoreIcon size={32} />
        </div>
        <h3 className="text-xl font-bold text-slate-900 mb-2">Painel Administrativo da Loja</h3>
        <p className="text-slate-500 max-w-md mx-auto mb-6">
          Bem-vindo ao centro de controle da sua loja. Aqui você gerencia produtos, categorias e configurações.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Button asChild className="bg-pink-600 hover:bg-pink-700">
            <Link to="/admin/products">Gerenciar Produtos</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/staff" className="flex items-center gap-2">
              Receber Pedidos <ArrowRight size={16} />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
