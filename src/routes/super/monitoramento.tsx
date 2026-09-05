import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getMonitoring, type MonitoringPeriod } from '@/lib/super-admin.functions'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  ShoppingBag,
  Package,
  DollarSign,
  Store as StoreIcon,
  UserPlus,
  Loader2,
  Activity,
  Trophy,
  Clock,
} from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export const Route = createFileRoute('/super/monitoramento')({
  component: SuperMonitoringPage,
})

const PERIODS: { value: MonitoringPeriod; label: string }[] = [
  { value: 'today', label: 'Hoje' },
  { value: 7, label: '7 dias' },
  { value: 30, label: '30 dias' },
]

// Mesmos rótulos do painel da loja (src/routes/admin/orders.tsx:62), em cores
// que funcionam no tema escuro do /super.
const STATUS_LABEL: Record<string, string> = {
  pending: 'Novo Pedido',
  confirmed: 'Aceito',
  preparing: 'Em Preparo',
  ready: 'Pronto',
  out_for_delivery: 'Saiu para Entrega',
  delivered: 'Entregue',
  canceled: 'Cancelado',
}

const STATUS_CLASS: Record<string, string> = {
  pending: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  confirmed: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
  preparing: 'bg-orange-500/15 text-orange-300 border-orange-500/30',
  ready: 'bg-green-500/15 text-green-300 border-green-500/30',
  out_for_delivery: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
  delivered: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  canceled: 'bg-red-500/15 text-red-300 border-red-500/30',
}

const money = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

function SuperMonitoringPage() {
  const [period, setPeriod] = useState<MonitoringPeriod>(7)

  const { data, isLoading, error } = useQuery({
    queryKey: ['super-monitoring', period],
    queryFn: () => getMonitoring(period),
  })

  const periodLabel = PERIODS.find((p) => p.value === period)?.label ?? ''
  const activeStores = (data?.storeRanking || []).filter((s) => s.orders > 0)
  const topOrders = activeStores[0]?.orders ?? 0

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Monitoramento</h1>
          <p className="text-slate-400 text-sm">
            O que está acontecendo agora nas lojas da plataforma.
          </p>
        </div>
        <div className="flex gap-1 bg-slate-900 border border-slate-800 rounded-lg p-1">
          {PERIODS.map((p) => (
            <Button
              key={String(p.value)}
              size="sm"
              variant="ghost"
              onClick={() => setPeriod(p.value)}
              className={
                period === p.value
                  ? 'bg-pink-600 text-white hover:bg-pink-600'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }
            >
              {p.label}
            </Button>
          ))}
        </div>
      </div>

      {error ? (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-red-300 text-sm">
          Não foi possível carregar o monitoramento: {(error as Error).message}
        </div>
      ) : isLoading || !data ? (
        <div className="p-12 flex justify-center">
          <Loader2 className="animate-spin text-pink-500" size={32} />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <StatCard
              label={`Pedidos (${periodLabel})`}
              value={String(data.periodOrders)}
              icon={ShoppingBag}
              accent="text-pink-400"
            />
            <StatCard
              label="Pedidos no total"
              value={String(data.totalOrders)}
              icon={Package}
            />
            <StatCard
              label={`Faturamento (${periodLabel})`}
              value={money(data.periodRevenue)}
              icon={DollarSign}
              accent="text-emerald-400"
            />
            <StatCard
              label={`Novas lojas (${periodLabel})`}
              value={String(data.newStores)}
              icon={StoreIcon}
            />
            <StatCard
              label={`Novos usuários (${periodLabel})`}
              value={String(data.newUsers)}
              icon={UserPlus}
            />
          </div>

          {/* Lojas mais ativas */}
          <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
            <div className="flex items-center gap-2 p-6 pb-4">
              <Trophy size={18} className="text-amber-400" />
              <div>
                <h2 className="font-semibold text-white">Lojas mais ativas</h2>
                <p className="text-xs text-slate-500">
                  Ordenado por pedidos recebidos em {periodLabel.toLowerCase()}.
                </p>
              </div>
            </div>

            {activeStores.length === 0 ? (
              <div className="p-12 pt-4 text-center text-slate-400 space-y-3">
                <Trophy className="w-10 h-10 mx-auto text-slate-600" />
                <p>
                  {data.totalOrders === 0
                    ? 'Ainda não há pedidos no sistema. O ranking aparece aqui quando as lojas começarem a vender.'
                    : `Nenhuma loja recebeu pedidos em ${periodLabel.toLowerCase()}.`}
                </p>
                {data.totalOrders > 0 && (
                  <p className="text-xs text-slate-500">
                    Escolha um período maior para ver movimento.
                  </p>
                )}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-800 hover:bg-transparent">
                    <TableHead className="text-slate-400 w-14">#</TableHead>
                    <TableHead className="text-slate-400">Loja</TableHead>
                    <TableHead className="text-slate-400 w-[38%]">Pedidos</TableHead>
                    <TableHead className="text-slate-400 text-right">Faturamento</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeStores.map((store, index) => (
                    <TableRow
                      key={store.storeId}
                      className="border-slate-800 hover:bg-slate-800/40"
                    >
                      <TableCell className="font-mono text-slate-500">#{index + 1}</TableCell>
                      <TableCell className="font-medium text-slate-100">
                        {store.storeName}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden min-w-[60px]">
                            <div
                              className="h-full bg-pink-500 rounded-full"
                              style={{
                                width: `${topOrders > 0 ? (store.orders / topOrders) * 100 : 0}%`,
                              }}
                            />
                          </div>
                          <span className="text-slate-300 tabular-nums w-8 text-right">
                            {store.orders}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-slate-300 tabular-nums">
                        {money(store.revenue)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          {/* Pedidos recentes */}
          <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
            <div className="flex items-center gap-2 p-6 pb-4">
              <Clock size={18} className="text-pink-400" />
              <div>
                <h2 className="font-semibold text-white">Pedidos recentes</h2>
                <p className="text-xs text-slate-500">
                  Os últimos pedidos de todas as lojas, do mais novo para o mais antigo.
                </p>
              </div>
            </div>

            {data.recentOrders.length === 0 ? (
              <div className="p-12 pt-4 text-center text-slate-400 space-y-3">
                <ShoppingBag className="w-10 h-10 mx-auto text-slate-600" />
                <p>
                  {data.totalOrders === 0
                    ? 'Nenhum pedido foi feito ainda no sistema.'
                    : `Nenhum pedido em ${periodLabel.toLowerCase()}.`}
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-800 hover:bg-transparent">
                    <TableHead className="text-slate-400">Quando</TableHead>
                    <TableHead className="text-slate-400">Loja</TableHead>
                    <TableHead className="text-slate-400">Cliente</TableHead>
                    <TableHead className="text-slate-400">Status</TableHead>
                    <TableHead className="text-slate-400 text-right">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.recentOrders.map((order) => (
                    <TableRow key={order.id} className="border-slate-800 hover:bg-slate-800/40">
                      <TableCell className="text-slate-400 text-xs font-mono whitespace-nowrap">
                        {order.createdAt
                          ? format(new Date(order.createdAt), "dd/MM 'às' HH:mm", {
                              locale: ptBR,
                            })
                          : '—'}
                      </TableCell>
                      <TableCell className="text-slate-300">{order.storeName}</TableCell>
                      <TableCell className="font-medium text-slate-100">
                        {order.customerName}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={STATUS_CLASS[order.status] || STATUS_CLASS['pending']}
                        >
                          {STATUS_LABEL[order.status] || order.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-slate-300 tabular-nums">
                        {money(order.total)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          {/* Atividade recente */}
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Activity size={18} className="text-pink-400" />
              <h2 className="font-semibold text-white">Atividade recente</h2>
            </div>
            {data.activity.length === 0 ? (
              <p className="text-slate-500 text-sm">
                Nenhuma atividade registrada ainda. O registro começa a partir das próximas
                ações no painel.
              </p>
            ) : (
              <ul className="space-y-3">
                {data.activity.map((log) => (
                  <li key={log.id} className="flex items-start gap-3 text-sm">
                    <span className="text-slate-500 shrink-0 font-mono text-xs pt-0.5">
                      {format(new Date(log.created_at), 'dd/MM HH:mm', { locale: ptBR })}
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
  value: string
  icon: React.ComponentType<{ size?: number; className?: string }>
  accent?: string
}) {
  return (
    <div className="bg-slate-900 rounded-xl border border-slate-800 p-5">
      <div className="flex items-center justify-between mb-2 gap-2">
        <span className="text-xs text-slate-400">{label}</span>
        <Icon size={16} className={accent ?? 'text-slate-500'} />
      </div>
      <div className={`text-2xl font-bold ${accent ?? 'text-white'}`}>{value}</div>
    </div>
  )
}
