import { createFileRoute } from "@tanstack/react-router";
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
  ArrowRight,
  Store as StoreIcon,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/")({
  component: AdminDashboard,
});

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

  const {
    data: stats,
    isLoading: statsLoading,
    isError: statsError,
  } = useQuery({
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
        pending: todayOrders?.filter((o) => o.status === "pending").length || 0,
        confirmed: todayOrders?.filter((o) => o.status === "confirmed").length || 0,
        preparing: todayOrders?.filter((o) => o.status === "preparing").length || 0,
        ready: todayOrders?.filter((o) => o.status === "ready").length || 0,
        out_for_delivery: todayOrders?.filter((o) => o.status === "out_for_delivery").length || 0,
        delivered: todayOrders?.filter((o) => o.status === "delivered").length || 0,
        canceled: todayOrders?.filter((o) => o.status === "canceled").length || 0,
        revenue:
          todayOrders?.reduce(
            (acc, o) => (o.status !== "canceled" ? acc + (Number(o.total_amount) || 0) : acc),
            0,
          ) || 0,
        customers: uniqueCustomers || 0,
      };

      return counts;
    },
  });

  const StatCard = ({
    title,
    value,
    icon: Icon,
    accent = false,
    loading,
  }: {
    title: string;
    value: string | number;
    icon: typeof DollarSign;
    accent?: boolean;
    loading: boolean;
  }) => (
    <div className={accent ? "admin-kpi-card admin-kpi-card-accent" : "admin-kpi-card"}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="admin-kpi-label">{title}</p>
          {loading ? (
            <Skeleton className="mt-2 h-8 w-24" />
          ) : (
            <h3 className="mt-1 text-[1.7rem] font-bold leading-tight text-slate-900">{value}</h3>
          )}
        </div>
        <div className="admin-kpi-icon shrink-0">
          <Icon size={20} />
        </div>
      </div>
    </div>
  );

  return (
    <div className="admin-page space-y-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="admin-eyebrow">
            Hoje, {format(new Date(), "dd 'de' MMMM", { locale: ptBR })}
          </p>
          <h1 className="mt-1 text-2xl md:text-[1.75rem] font-bold tracking-tight text-slate-900">
            Visão geral do negócio
          </h1>
          <p className="admin-page-subtitle">Faturamento, pedidos e clientes do dia.</p>
        </div>
      </div>

      {statsError && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-center">
          <p className="font-semibold text-red-700">Erro ao carregar dados do painel.</p>
          <p className="mt-1 text-sm text-red-500">
            Verifique sua conexão e tente recarregar a página.
          </p>
        </div>
      )}

      {/* Indicadores principais */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Faturamento do dia"
          value={new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
            stats?.revenue || 0,
          )}
          icon={DollarSign}
          accent
          loading={statsLoading}
        />
        <StatCard
          title="Pedidos de hoje"
          value={stats?.today || 0}
          icon={ShoppingBag}
          loading={statsLoading}
        />
        <StatCard
          title="Total de clientes"
          value={stats?.customers || 0}
          icon={Users}
          loading={statsLoading}
        />
        <StatCard
          title="Pedidos novos"
          value={stats?.pending || 0}
          icon={Clock}
          loading={statsLoading}
        />
      </div>

      {/* Status dos pedidos de hoje */}
      <section>
        <h2 className="admin-section-title">Pedidos de hoje por status</h2>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
          {[
            { label: "Aceitos", value: stats?.confirmed, icon: CheckCircle2 },
            { label: "Em preparo", value: stats?.preparing, icon: PackageOpen },
            { label: "Prontos", value: stats?.ready, icon: CheckCircle2 },
            { label: "Em entrega", value: stats?.out_for_delivery, icon: Truck },
            { label: "Entregues", value: stats?.delivered, icon: CheckCircle2 },
            { label: "Cancelados", value: stats?.canceled, icon: XCircle, danger: true },
          ].map((item) => (
            <div
              key={item.label}
              className={
                item.danger ? "admin-status-card admin-status-card-danger" : "admin-status-card"
              }
            >
              <div className="admin-status-icon shrink-0">
                <item.icon size={16} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-medium text-slate-500 leading-tight">{item.label}</p>
                <div className="text-base sm:text-lg font-bold leading-tight text-slate-900 mt-0.5">
                  {statsLoading ? <Skeleton className="h-5 w-8" /> : item.value || 0}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Atalhos */}
      <section className="admin-welcome-card">
        <div className="admin-welcome-icon">
          <StoreIcon size={26} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-bold text-slate-900">Central da sua loja</h3>
          <p className="mt-1 text-sm text-slate-500">
            Gerencie produtos, categorias, adicionais e configurações — tudo em um só lugar.
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <Button asChild className="admin-orders-button">
            <Link to="/admin/products">Gerenciar produtos</Link>
          </Button>
          <Button asChild variant="outline" className="admin-outline-button gap-2">
            <Link to="/staff">
              Receber pedidos <ArrowRight size={16} />
            </Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
