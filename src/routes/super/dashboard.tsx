import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  getSuperDashboard,
  getRecentActivity,
  type DashboardPeriod,
} from '@/lib/super-admin.functions'
import { Button } from '@/components/ui/button'
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
} from 'recharts'
import {
  Store as StoreIcon,
  CheckCircle2,
  Ban,
  Users,
  ShoppingBag,
  Sparkles,
  Loader2,
  Activity,
} from 'lucide-react'

export const Route = createFileRoute('/super/dashboard')({
  component: SuperDashboardPage,
})

const PERIODS: DashboardPeriod[] = [7, 30, 90]

function SuperDashboardPage() {
  const [period, setPeriod] = useState<DashboardPeriod>(30)

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['super-dashboard', period],
    queryFn: () => getSuperDashboard(period),
  })

  const { data: activity } = useQuery({
    queryKey: ['super-activity'],
    queryFn: () => getRecentActivity(10),
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-slate-400 text-sm">Visão geral da plataforma.</p>
        </div>
        <div className="flex gap-1 bg-slate-900 border border-slate-800 rounded-lg p-1">
          {PERIODS.map((p) => (
            <Button
              key={p}
              size="sm"
              variant="ghost"
              onClick={() => setPeriod(p)}
              className={
                period === p
                  ? 'bg-pink-600 text-white hover:bg-pink-600'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }
            >
              {p} dias
            </Button>
          ))}
        </div>
      </div>

      {isError ? (
        <div className="p-12 flex flex-col items-center justify-center gap-4 text-center">
          <p className="text-red-300">Não foi possível carregar o dashboard.</p>
          <Button
            variant="outline"
            onClick={() => refetch()}
            className="border-slate-700 text-slate-200 hover:bg-slate-800"
          >
            Tentar novamente
          </Button>
        </div>
      ) : isLoading || !data ? (
        <div className="p-12 flex justify-center">
          <Loader2 className="animate-spin text-pink-500" size={32} />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <StatCard label="Total de lojas" value={data.totalStores} icon={StoreIcon} />
            <StatCard
              label="Lojas ativas"
              value={data.activeStores}
              icon={CheckCircle2}
              accent="text-emerald-400"
            />
            <StatCard
              label="Lojas bloqueadas"
              value={data.blockedStores}
              icon={Ban}
              accent="text-red-400"
            />
            <StatCard label="Total de usuários" value={data.totalUsers} icon={Users} />
            <StatCard label="Total de pedidos" value={data.totalOrders} icon={ShoppingBag} />
            <StatCard
              label={`Novas lojas (${period}d)`}
              value={data.newStores}
              icon={Sparkles}
              accent="text-pink-400"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ChartCard
              title="Crescimento de lojas"
              description="Total de lojas ao longo do período"
              hasData={data.storesGrowth.length > 0}
            >
              <LineChart data={data.storesGrowth}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                <XAxis
                  dataKey="date"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: '#64748b' }}
                />
                <YAxis
                  allowDecimals={false}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: '#64748b' }}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: 12,
                    border: '1px solid #334155',
                    background: '#0f172a',
                    color: '#e2e8f0',
                  }}
                  formatter={(v) => [String(v), 'Lojas']}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#1d4ed8"
                  strokeWidth={3}
                  dot={false}
                  activeDot={{ r: 5, strokeWidth: 0 }}
                />
              </LineChart>
            </ChartCard>

            <ChartCard
              title="Pedidos da plataforma"
              description="Pedidos recebidos por dia, todas as lojas"
              hasData={data.ordersChart.some((d) => d.value > 0)}
            >
              <BarChart data={data.ordersChart}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                <XAxis
                  dataKey="date"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: '#64748b' }}
                />
                <YAxis
                  allowDecimals={false}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: '#64748b' }}
                />
                <Tooltip
                  cursor={{ fill: '#1e293b' }}
                  contentStyle={{
                    borderRadius: 12,
                    border: '1px solid #334155',
                    background: '#0f172a',
                    color: '#e2e8f0',
                  }}
                  formatter={(v) => [String(v), 'Pedidos']}
                />
                <Bar dataKey="value" fill="#1d4ed8" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartCard>
          </div>

          <div className="bg-slate-900 rounded-xl border border-slate-800 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Activity size={18} className="text-pink-400" />
              <h2 className="font-semibold text-white">Atividades recentes</h2>
            </div>
            {!activity || activity.length === 0 ? (
              <p className="text-slate-500 text-sm">
                Nenhuma atividade registrada ainda. O registro começa a partir das próximas ações no
                painel.
              </p>
            ) : (
              <ul className="space-y-3">
                {activity.map((log) => (
                  <li key={log.id} className="flex items-start gap-3 text-sm">
                    <span className="text-slate-500 shrink-0 font-mono text-xs pt-0.5">
                      {new Date(log.created_at).toLocaleString('pt-BR', {
                        day: '2-digit',
                        month: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    <span className="text-slate-200">
                      {log.description || log.action}
                      {log.actor_email && (
                        <span className="text-slate-500"> — {log.actor_email}</span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function StatCard({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string
  value: number
  icon: React.ComponentType<{ size?: number; className?: string }>
  accent?: string
}) {
  return (
    <div className="bg-slate-900 rounded-xl border border-slate-800 p-5">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-slate-400">{label}</span>
        <Icon size={16} className={accent ?? 'text-slate-500'} />
      </div>
      <div className={`text-3xl font-bold ${accent ?? 'text-white'}`}>{value}</div>
    </div>
  )
}

function ChartCard({
  title,
  description,
  hasData,
  children,
}: {
  title: string
  description: string
  hasData: boolean
  children: React.ReactElement
}) {
  return (
    <div className="bg-slate-900 rounded-xl border border-slate-800 p-6">
      <h2 className="font-semibold text-white">{title}</h2>
      <p className="text-xs text-slate-500 mb-4">{description}</p>
      <div className="h-[280px]">
        {hasData ? (
          <ResponsiveContainer width="100%" height="100%">
            {children}
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center text-slate-500 text-sm text-center px-4">
            Dados insuficientes para gerar este gráfico.
          </div>
        )}
      </div>
    </div>
  )
}
