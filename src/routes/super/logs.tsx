import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  getAuditLogs,
  getAuditOptions,
  AUDIT_PAGE_SIZE,
  type AuditRow,
} from '@/lib/audit.functions'
import { getAllStores } from '@/lib/super-admin.functions'
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, ScrollText, ChevronLeft, ChevronRight, Filter } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export const Route = createFileRoute('/super/logs')({
  component: SuperLogsPage,
})

// Nada de `store_plan_changed` cru na tela.
const ACTION_LABEL: Record<string, string> = {
  store_created: 'Loja criada',
  store_renamed: 'Loja renomeada',
  store_activated: 'Loja ativada',
  store_deactivated: 'Loja desativada',
  store_blocked: 'Loja bloqueada',
  store_owner_assigned: 'Dono da loja definido',
  store_plan_changed: 'Plano da loja alterado',
  plan_created: 'Plano criado',
  plan_updated: 'Plano alterado',
  plan_activated: 'Plano ativado',
  plan_deactivated: 'Plano desativado',
  plan_deleted: 'Plano excluído',
  user_blocked: 'Conta bloqueada',
  user_activated: 'Conta ativada',
  user_renamed: 'Conta renomeada',
  settings_updated: 'Configuração alterada',
  saas_settings_updated: 'Configuração do sistema alterada',
  maintenance_enabled: 'Modo manutenção ligado',
  maintenance_disabled: 'Modo manutenção desligado',
  announcement_created: 'Aviso criado',
  announcement_updated: 'Aviso alterado',
  announcement_activated: 'Aviso ativado',
  announcement_deactivated: 'Aviso desativado',
  announcement_deleted: 'Aviso excluído',
  support_access_start: 'Entrou como suporte',
  support_access_end: 'Saiu do modo suporte',
  order_canceled: 'Pedido cancelado',
  order_reopened: 'Pedido reaberto',
  order_status_changed: 'Status do pedido alterado',
}

const MODULE_LABEL: Record<string, string> = {
  lojas: 'Lojas',
  planos: 'Planos',
  usuarios: 'Usuários',
  avisos: 'Avisos',
  suporte: 'Suporte',
  configuracoes: 'Configurações',
  pedidos: 'Pedidos',
}

const MODULE_CLASS: Record<string, string> = {
  lojas: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  planos: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  usuarios: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
  avisos: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  suporte: 'bg-orange-500/15 text-orange-300 border-orange-500/30',
  configuracoes: 'bg-slate-500/15 text-slate-300 border-slate-500/30',
  pedidos: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
}

const PERIODS = [
  { value: 'today', label: 'Hoje' },
  { value: '7', label: '7 dias' },
  { value: '30', label: '30 dias' },
  { value: 'all', label: 'Tudo' },
] as const

type PeriodValue = (typeof PERIODS)[number]['value']

const periodStart = (period: PeriodValue): string | undefined => {
  if (period === 'all') return undefined
  const d = new Date()
  if (period !== 'today') d.setDate(d.getDate() - (Number(period) - 1))
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

const ALL = 'all'

function SuperLogsPage() {
  const [period, setPeriod] = useState<PeriodValue>('30')
  const [actorFilter, setActorFilter] = useState(ALL)
  const [storeFilter, setStoreFilter] = useState(ALL)
  const [moduleFilter, setModuleFilter] = useState(ALL)
  const [actionFilter, setActionFilter] = useState(ALL)
  const [page, setPage] = useState(1)

  const filters = {
    actor: actorFilter === ALL ? undefined : actorFilter,
    storeId: storeFilter === ALL ? undefined : storeFilter,
    module: moduleFilter === ALL ? undefined : moduleFilter,
    action: actionFilter === ALL ? undefined : actionFilter,
    from: periodStart(period),
    page,
  }

  const { data, isLoading, error } = useQuery({
    queryKey: ['super-logs', filters],
    queryFn: () => getAuditLogs(filters),
  })

  const { data: options } = useQuery({
    queryKey: ['super-logs-options'],
    queryFn: getAuditOptions,
  })

  const { data: stores } = useQuery({
    queryKey: ['super-stores'],
    queryFn: getAllStores,
  })

  // Quem aparece no filtro de usuário vem dos próprios registros: a conta pode
  // ter sido apagada e ainda constar no log.
  const actorOptions = Array.from(
    new Map(
      (data?.rows || [])
        .filter((r) => r.actorId)
        .map((r) => [r.actorId!, r.actorName || r.actorEmail || r.actorId!]),
    ).entries(),
  )

  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / AUDIT_PAGE_SIZE))
  const hasFilters =
    actorFilter !== ALL ||
    storeFilter !== ALL ||
    moduleFilter !== ALL ||
    actionFilter !== ALL ||
    period !== 'all'

  const resetTo = (fn: () => void) => {
    fn()
    setPage(1)
  }

  const clearFilters = () => {
    setActorFilter(ALL)
    setStoreFilter(ALL)
    setModuleFilter(ALL)
    setActionFilter(ALL)
    setPeriod('all')
    setPage(1)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Logs e Auditoria</h1>
          <p className="text-slate-400 text-sm">
            Tudo que foi feito no sistema. Os registros não podem ser apagados nem alterados.
          </p>
        </div>
        <div className="flex gap-1 bg-slate-900 border border-slate-800 rounded-lg p-1">
          {PERIODS.map((p) => (
            <Button
              key={p.value}
              size="sm"
              variant="ghost"
              onClick={() => resetTo(() => setPeriod(p.value))}
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

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-red-300 text-sm">
          Não foi possível carregar os registros: {(error as Error).message}
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <Select value={actorFilter} onValueChange={(v) => resetTo(() => setActorFilter(v))}>
          <SelectTrigger className="w-[190px] bg-slate-900 border-slate-800 text-slate-100">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos os usuários</SelectItem>
            {actorOptions.map(([id, name]) => (
              <SelectItem key={id} value={id}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={storeFilter} onValueChange={(v) => resetTo(() => setStoreFilter(v))}>
          <SelectTrigger className="w-[190px] bg-slate-900 border-slate-800 text-slate-100">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todas as lojas</SelectItem>
            <SelectItem value="none">Sem loja</SelectItem>
            {(stores || []).map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={moduleFilter} onValueChange={(v) => resetTo(() => setModuleFilter(v))}>
          <SelectTrigger className="w-[170px] bg-slate-900 border-slate-800 text-slate-100">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos os módulos</SelectItem>
            {(options?.modules || []).map((m) => (
              <SelectItem key={m} value={m}>
                {MODULE_LABEL[m] || m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={actionFilter} onValueChange={(v) => resetTo(() => setActionFilter(v))}>
          <SelectTrigger className="w-[210px] bg-slate-900 border-slate-800 text-slate-100">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todas as ações</SelectItem>
            {(options?.actions || []).map((a) => (
              <SelectItem key={a} value={a}>
                {ACTION_LABEL[a] || a}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasFilters && (
          <Button
            variant="outline"
            className="border-slate-800 text-slate-300 hover:bg-slate-800 gap-2"
            onClick={clearFilters}
          >
            <Filter size={14} />
            Limpar filtros
          </Button>
        )}
      </div>

      <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
        {isLoading ? (
          <div className="p-12 flex justify-center">
            <Loader2 className="animate-spin text-pink-500" size={32} />
          </div>
        ) : !data || data.rows.length === 0 ? (
          <div className="p-12 text-center text-slate-400 space-y-3">
            <ScrollText className="w-10 h-10 mx-auto text-slate-600" />
            {hasFilters ? (
              <p>Nenhum registro com esses filtros.</p>
            ) : (
              <>
                <p>Nenhum registro ainda.</p>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  O registro começa a partir das ações feitas no painel: criar loja, trocar
                  plano, bloquear conta, alterar configuração.
                </p>
              </>
            )}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-slate-800 hover:bg-transparent">
                <TableHead className="text-slate-400">Data/hora</TableHead>
                <TableHead className="text-slate-400">Usuário</TableHead>
                <TableHead className="text-slate-400">Ação</TableHead>
                <TableHead className="text-slate-400">Módulo</TableHead>
                <TableHead className="text-slate-400">Loja</TableHead>
                <TableHead className="text-slate-400">Descrição</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.rows.map((row: AuditRow) => (
                <TableRow key={row.id} className="border-slate-800 hover:bg-slate-800/40">
                  <TableCell className="text-slate-400 text-xs font-mono whitespace-nowrap">
                    {format(new Date(row.createdAt), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                  </TableCell>
                  <TableCell className="text-slate-200">
                    {row.actorName || row.actorEmail || (
                      <span className="text-slate-500 italic">conta removida</span>
                    )}
                  </TableCell>
                  <TableCell className="font-medium text-slate-100">
                    {ACTION_LABEL[row.action] || row.action}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={MODULE_CLASS[row.module] || MODULE_CLASS['configuracoes']}
                    >
                      {MODULE_LABEL[row.module] || row.module}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-slate-300">
                    {row.storeName || <span className="text-slate-500">—</span>}
                  </TableCell>
                  <TableCell className="text-slate-400 text-xs max-w-[280px]">
                    {row.description || '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {data && data.total > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <p className="text-slate-500">
            {data.total} registro{data.total === 1 ? '' : 's'} · página {page} de {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="border-slate-800 text-slate-300 hover:bg-slate-800 gap-1"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft size={14} />
              Anterior
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="border-slate-800 text-slate-300 hover:bg-slate-800 gap-1"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Próxima
              <ChevronRight size={14} />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
