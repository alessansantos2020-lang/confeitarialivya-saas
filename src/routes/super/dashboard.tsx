import { createFileRoute } from "@tanstack/react-router";
import { useState, type ComponentType, type ReactElement } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getSuperDashboard,
  getRecentActivity,
  type DashboardPeriod,
} from "@/lib/super-admin.functions";
import { Button } from "@/components/ui/button";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import {
  Activity,
  ArrowUpRight,
  Ban,
  CheckCircle2,
  CircleAlert,
  Clock3,
  LayoutDashboard,
  Loader2,
  PackageCheck,
  ShoppingBag,
  Sparkles,
  Store as StoreIcon,
  Users,
} from "lucide-react";

export const Route = createFileRoute("/super/dashboard")({
  component: SuperDashboardPage,
});

const PERIODS: DashboardPeriod[] = [7, 30, 90];

function SuperDashboardPage() {
  const [period, setPeriod] = useState<DashboardPeriod>(30);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["super-dashboard", period],
    queryFn: () => getSuperDashboard(period),
  });

  const { data: activity } = useQuery({
    queryKey: ["super-activity"],
    queryFn: () => getRecentActivity(10),
  });

  return (
    <div className="super-dashboard space-y-7">
      <section className="flex flex-col gap-5 border-b border-white/[0.07] pb-7 md:flex-row md:items-end md:justify-between">
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-medium text-red-400">
            <LayoutDashboard size={14} />
            <span>Visão geral da plataforma</span>
          </div>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Bem-vindo, Admin
            </h1>
            <p className="mt-2 max-w-xl text-sm text-slate-400">
              Acompanhe a operação do seu ecossistema em um só lugar.
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <span className="text-xs text-slate-500">Período analisado</span>
          <div
            className="flex rounded-lg border border-white/[0.08] bg-[#11151c] p-1 shadow-inner shadow-black/20"
            role="group"
            aria-label="Período do dashboard"
          >
            {PERIODS.map((p) => (
              <Button
                key={p}
                type="button"
                size="sm"
                variant="ghost"
                aria-pressed={period === p}
                onClick={() => setPeriod(p)}
                className={
                  period === p
                    ? "rounded-md bg-red-600 px-3 text-white shadow-[0_0_18px_rgba(220,38,38,0.22)] hover:bg-red-500"
                    : "rounded-md px-3 text-slate-400 hover:bg-white/[0.06] hover:text-white"
                }
              >
                {p} dias
              </Button>
            ))}
          </div>
        </div>
      </section>

      {isError ? (
        <div className="flex min-h-64 flex-col items-center justify-center gap-4 rounded-2xl border border-red-500/20 bg-red-500/[0.06] p-12 text-center">
          <CircleAlert className="text-red-400" size={24} />
          <div>
            <p className="font-medium text-red-200">Não foi possível carregar o dashboard.</p>
            <p className="mt-1 text-sm text-slate-400">Verifique sua conexão e tente novamente.</p>
          </div>
          <Button
            variant="outline"
            onClick={() => refetch()}
            className="border-white/[0.12] bg-transparent text-slate-200 hover:border-red-500/40 hover:bg-red-500/10"
          >
            Tentar novamente
          </Button>
        </div>
      ) : isLoading || !data ? (
        <DashboardSkeleton />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <StatCard
              label="Total de lojas"
              value={data.totalStores}
              icon={StoreIcon}
              detail="Lojas cadastradas"
            />
            <StatCard
              label="Lojas ativas"
              value={data.activeStores}
              icon={CheckCircle2}
              accent="red"
              detail="Operando normalmente"
            />
            <StatCard
              label="Lojas bloqueadas"
              value={data.blockedStores}
              icon={Ban}
              accent="amber"
              detail="Aguardando ação"
            />
            <StatCard
              label="Total de usuários"
              value={data.totalUsers}
              icon={Users}
              detail="Contas na plataforma"
            />
            <StatCard
              label="Total de pedidos"
              value={data.totalOrders}
              icon={ShoppingBag}
              detail="Pedidos registrados"
            />
            <StatCard
              label={`Novas lojas (${period} dias)`}
              value={data.newStores}
              icon={Sparkles}
              accent="red"
              detail="Entradas no período"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.1fr_0.9fr]">
            <ChartCard
              title="Crescimento de lojas"
              description="Base acumulada ao longo do período"
              icon={StoreIcon}
              hasData={data.storesGrowth.length > 0}
              summary={`A série termina com ${data.storesGrowth.at(-1)?.value ?? 0} lojas cadastradas.`}
            >
              <LineChart
                data={data.storesGrowth}
                margin={{ top: 8, right: 8, left: -18, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="2 5"
                  vertical={false}
                  stroke="rgba(148,163,184,0.10)"
                />
                <XAxis
                  dataKey="date"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: "#778196" }}
                />
                <YAxis
                  allowDecimals={false}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: "#778196" }}
                />
                <Tooltip content={<ChartTooltip seriesLabel="Lojas" />} />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#ef4444"
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 4, fill: "#ef4444", stroke: "#1c1014", strokeWidth: 3 }}
                />
              </LineChart>
            </ChartCard>

            <ChartCard
              title="Pedidos da plataforma"
              description="Volume recebido por dia"
              icon={ShoppingBag}
              hasData={data.ordersChart.some((d) => d.value > 0)}
              summary={`Foram registrados ${data.ordersChart.reduce((total, point) => total + point.value, 0)} pedidos no período.`}
            >
              <BarChart data={data.ordersChart} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid
                  strokeDasharray="2 5"
                  vertical={false}
                  stroke="rgba(148,163,184,0.10)"
                />
                <XAxis
                  dataKey="date"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: "#778196" }}
                />
                <YAxis
                  allowDecimals={false}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: "#778196" }}
                />
                <Tooltip
                  cursor={{ fill: "rgba(239,68,68,0.07)" }}
                  content={<ChartTooltip seriesLabel="Pedidos" />}
                />
                <Bar dataKey="value" fill="#ef4444" radius={[4, 4, 1, 1]} maxBarSize={20} />
              </BarChart>
            </ChartCard>
          </div>

          <section className="rounded-2xl border border-white/[0.08] bg-[#11151c] p-5 shadow-[0_18px_50px_rgba(0,0,0,0.14)] sm:p-6">
            <div className="mb-5 flex flex-col gap-2 border-b border-white/[0.07] pb-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-lg bg-red-500/10 text-red-400">
                  <Activity size={17} />
                </div>
                <div>
                  <h2 className="font-semibold text-white">Atividades recentes</h2>
                  <p className="text-xs text-slate-500">Últimas ações registradas no sistema</p>
                </div>
              </div>
              <ArrowUpRight className="hidden text-slate-600 sm:block" size={17} />
            </div>
            {!activity || activity.length === 0 ? (
              <div className="flex items-center gap-3 rounded-xl border border-dashed border-white/[0.1] p-5 text-sm text-slate-500">
                <Clock3 size={17} />
                Nenhuma atividade registrada ainda.
              </div>
            ) : (
              <ul className="divide-y divide-white/[0.06]">
                {activity.map((log) => (
                  <li key={log.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                    <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-white/[0.05] text-slate-500">
                      <PackageCheck size={14} />
                    </span>
                    <div className="min-w-0 flex-1 text-sm">
                      <p className="leading-6 text-slate-200">
                        {log.description || log.action}
                        {log.actor_email && (
                          <span className="text-slate-500"> · {log.actor_email}</span>
                        )}
                      </p>
                      <time className="text-xs text-slate-600" dateTime={log.created_at}>
                        {new Date(log.created_at).toLocaleString("pt-BR", {
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </time>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  detail,
  icon: Icon,
  accent = "neutral",
}: {
  label: string;
  value: number;
  detail: string;
  icon: ComponentType<{ size?: number; className?: string }>;
  accent?: "neutral" | "red" | "amber";
}) {
  const accentStyles = {
    neutral: { icon: "text-slate-400", dot: "bg-slate-500", value: "text-white" },
    red: { icon: "text-red-400", dot: "bg-red-500", value: "text-white" },
    amber: { icon: "text-amber-400", dot: "bg-amber-400", value: "text-white" },
  }[accent];

  return (
    <article className="group relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[#11151c] p-5 shadow-[0_14px_40px_rgba(0,0,0,0.12)] transition duration-200 hover:-translate-y-0.5 hover:border-red-500/25 hover:shadow-[0_18px_45px_rgba(0,0,0,0.24)]">
      <div className="absolute -right-10 -top-10 size-28 rounded-full bg-red-500/[0.04] blur-2xl transition group-hover:bg-red-500/[0.09]" />
      <div className="relative flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-slate-400">{label}</p>
          <p className={`mt-4 text-3xl font-semibold tracking-tight ${accentStyles.value}`}>
            {value}
          </p>
          <p className="mt-1 text-xs text-slate-500">{detail}</p>
        </div>
        <div className={`rounded-lg bg-white/[0.05] p-2.5 ${accentStyles.icon}`}>
          <Icon size={17} />
        </div>
      </div>
      <div className="relative mt-5 flex items-center gap-2 text-[11px] text-slate-600">
        <span className={`size-1.5 rounded-full ${accentStyles.dot}`} />
        Dados atualizados em tempo real
      </div>
    </article>
  );
}

function ChartCard({
  title,
  description,
  icon: Icon,
  hasData,
  summary,
  children,
}: {
  title: string;
  description: string;
  icon: ComponentType<{ size?: number; className?: string }>;
  hasData: boolean;
  summary: string;
  children: ReactElement;
}) {
  return (
    <section className="rounded-2xl border border-white/[0.08] bg-[#11151c] p-5 shadow-[0_18px_50px_rgba(0,0,0,0.14)] sm:p-6">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-red-500/10 p-2.5 text-red-400">
          <Icon size={17} />
        </div>
        <div>
          <h2 className="font-semibold text-white">{title}</h2>
          <p className="mt-1 text-xs text-slate-500">{description}</p>
        </div>
      </div>
      <p className="sr-only">{summary}</p>
      <div className="mt-5 h-[250px] min-w-0 sm:h-[280px]">
        {hasData ? (
          <ResponsiveContainer width="100%" height="100%">
            {children}
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-white/[0.1] px-4 text-center text-sm text-slate-500">
            Dados insuficientes para gerar este gráfico.
          </div>
        )}
      </div>
    </section>
  );
}

function ChartTooltip({
  seriesLabel,
  active,
  payload,
  label: tooltipLabel,
}: {
  seriesLabel: string;
  active?: boolean;
  payload?: Array<{ value?: number }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-white/[0.12] bg-[#0b0d12] px-3 py-2 text-xs shadow-xl">
      <p className="mb-1 text-slate-500">{tooltipLabel}</p>
      <p className="font-medium text-white">
        {payload[0]?.value ?? 0} {seriesLabel.toLowerCase()}
      </p>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-4" aria-label="Carregando dashboard" role="status">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <div
            key={index}
            className="h-40 animate-pulse rounded-2xl border border-white/[0.07] bg-white/[0.04]"
          />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {Array.from({ length: 2 }, (_, index) => (
          <div
            key={index}
            className="h-80 animate-pulse rounded-2xl border border-white/[0.07] bg-white/[0.04]"
          />
        ))}
      </div>
    </div>
  );
}
