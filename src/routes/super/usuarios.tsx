import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getSystemUsers,
  setUserStatus,
  renameUser,
  type SystemUser,
} from '@/lib/super-admin.functions'
import { supabase } from '@/integrations/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Loader2,
  MoreHorizontal,
  Pencil,
  Search,
  Eye,
  Ban,
  CheckCircle2,
  Users,
} from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { toast } from 'sonner'

export const Route = createFileRoute('/super/usuarios')({
  component: SuperUsersPage,
})

const ROLE_LABEL: Record<string, string> = {
  super_admin: 'Dono do sistema',
  admin: 'Dono de loja',
  employee: 'Funcionário',
  user: 'Sem painel',
}

const ROLE_CLASS: Record<string, string> = {
  super_admin: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  admin: 'bg-pink-500/15 text-pink-300 border-pink-500/30',
  employee: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  user: 'bg-slate-500/15 text-slate-300 border-slate-500/30',
}

const dateOrDash = (value: string | null, fallback: string) =>
  value && !isNaN(new Date(value).getTime())
    ? format(new Date(value), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
    : fallback

function SuperUsersPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [storeFilter, setStoreFilter] = useState('all')
  const [roleFilter, setRoleFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [detailsTarget, setDetailsTarget] = useState<SystemUser | null>(null)
  const [renameTarget, setRenameTarget] = useState<SystemUser | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [blockTarget, setBlockTarget] = useState<SystemUser | null>(null)

  const { data: users, isLoading, error } = useQuery({
    queryKey: ['super-users'],
    queryFn: getSystemUsers,
  })

  const { data: myId } = useQuery({
    queryKey: ['my-user-id'],
    queryFn: async () => (await supabase.auth.getUser()).data.user?.id ?? null,
  })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['super-users'] })
    queryClient.invalidateQueries({ queryKey: ['super-stores'] })
  }

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'active' | 'blocked' }) =>
      setUserStatus(id, status),
    onSuccess: (_data, variables) => {
      invalidate()
      setBlockTarget(null)
      toast.success(variables.status === 'blocked' ? 'Conta bloqueada.' : 'Conta ativada.')
    },
    onError: (err: any) => toast.error(err.message),
  })

  const renameMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => renameUser(id, name),
    onSuccess: () => {
      invalidate()
      setRenameTarget(null)
      toast.success('Nome atualizado!')
    },
    onError: (err: any) => toast.error(err.message),
  })

  // Última conta de dono do sistema ativa não pode ser bloqueada (o banco também
  // recusa, isto só evita o clique inútil).
  const activeSuperAdmins = (users || []).filter(
    (u) => u.role === 'super_admin' && u.status !== 'blocked',
  ).length

  const blockBlockedReason = (user: SystemUser): string | null => {
    if (user.id === myId) return 'Você não pode bloquear a sua própria conta.'
    if (user.role === 'super_admin' && activeSuperAdmins <= 1)
      return 'É a última conta de dono do sistema ativa.'
    return null
  }

  const storeOptions = Array.from(
    new Map(
      (users || []).flatMap((u) => u.stores.map((s) => [s.id, s.name] as const)),
    ).entries(),
  ).sort((a, b) => a[1].localeCompare(b[1]))

  const filtered = (users || []).filter((u) => {
    const term = search.trim().toLowerCase()
    if (term) {
      const haystack = `${u.full_name || ''} ${u.email || ''}`.toLowerCase()
      if (!haystack.includes(term)) return false
    }
    if (storeFilter !== 'all' && !u.stores.some((s) => s.id === storeFilter)) return false
    if (roleFilter !== 'all' && (u.role || 'user') !== roleFilter) return false
    if (statusFilter !== 'all' && u.status !== statusFilter) return false
    return true
  })

  if (error) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center space-y-2">
        <h2 className="text-slate-100 font-semibold">Não foi possível carregar os usuários</h2>
        <p className="text-slate-400 text-sm">{(error as any).message}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-100 flex items-center gap-2">
          <Users size={20} className="text-pink-400" />
          Usuários
        </h1>
        <p className="text-slate-400 text-sm">
          Contas do sistema. Bloquear corta o acesso na hora e não apaga nada.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome ou e-mail"
            className="pl-9 bg-slate-900 border-slate-800 text-slate-100"
          />
        </div>

        <Select value={storeFilter} onValueChange={setStoreFilter}>
          <SelectTrigger className="w-[170px] bg-slate-900 border-slate-800 text-slate-100">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as lojas</SelectItem>
            {storeOptions.map(([id, name]) => (
              <SelectItem key={id} value={id}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-[170px] bg-slate-900 border-slate-800 text-slate-100">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as funções</SelectItem>
            <SelectItem value="super_admin">Dono do sistema</SelectItem>
            <SelectItem value="admin">Dono de loja</SelectItem>
            <SelectItem value="user">Sem painel</SelectItem>
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px] bg-slate-900 border-slate-800 text-slate-100">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="active">Ativa</SelectItem>
            <SelectItem value="blocked">Bloqueada</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="p-12 flex justify-center">
            <Loader2 className="animate-spin text-pink-500" size={28} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-sm">
            {users?.length ? 'Nenhum usuário encontrado com esses filtros.' : 'Nenhum usuário cadastrado.'}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-slate-800 hover:bg-transparent">
                <TableHead className="text-slate-400">Nome</TableHead>
                <TableHead className="text-slate-400">E-mail</TableHead>
                <TableHead className="text-slate-400">Lojas</TableHead>
                <TableHead className="text-slate-400">Função</TableHead>
                <TableHead className="text-slate-400">Status</TableHead>
                <TableHead className="text-slate-400">Último acesso</TableHead>
                <TableHead className="text-right text-slate-400">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((user) => {
                const role = user.role || 'user'
                const isBlocked = user.status === 'blocked'
                const blockReason = blockBlockedReason(user)
                return (
                  <TableRow key={user.id} className="border-slate-800 hover:bg-slate-800/40">
                    <TableCell className="text-slate-100 font-medium">
                      {user.full_name || <span className="text-slate-600">sem nome</span>}
                    </TableCell>
                    <TableCell className="text-slate-300 text-sm">
                      {user.email || <span className="text-slate-600">—</span>}
                    </TableCell>
                    <TableCell className="text-slate-300 text-sm">
                      {user.stores.length === 0 ? (
                        <span className="text-slate-600">sem loja</span>
                      ) : (
                        user.stores.map((s) => s.name).join(', ')
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={ROLE_CLASS[role] || ROLE_CLASS['user']}>
                        {ROLE_LABEL[role] || role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          isBlocked
                            ? 'bg-red-500/15 text-red-300 border-red-500/30'
                            : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                        }
                      >
                        {isBlocked ? 'Bloqueada' : 'Ativa'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-slate-500 text-xs">
                      {dateOrDash(user.last_sign_in_at, 'nunca acessou')}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="hover:bg-slate-800">
                            <MoreHorizontal size={16} className="text-slate-400" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setDetailsTarget(user)}>
                            <Eye size={14} className="mr-2" />
                            Visualizar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setRenameTarget(user)
                              setRenameValue(user.full_name || '')
                            }}
                          >
                            <Pencil size={14} className="mr-2" />
                            Renomear
                          </DropdownMenuItem>
                          {isBlocked ? (
                            <DropdownMenuItem
                              onClick={() =>
                                statusMutation.mutate({ id: user.id, status: 'active' })
                              }
                            >
                              <CheckCircle2 size={14} className="mr-2" />
                              Ativar conta
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem
                              disabled={!!blockReason}
                              className={blockReason ? undefined : 'text-red-500'}
                              onClick={() => setBlockTarget(user)}
                            >
                              <Ban size={14} className="mr-2" />
                              {blockReason ? blockReason : 'Bloquear conta'}
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Visualizar */}
      <Dialog open={!!detailsTarget} onOpenChange={(open) => !open && setDetailsTarget(null)}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle>{detailsTarget?.full_name || 'Conta sem nome'}</DialogTitle>
            <DialogDescription>{detailsTarget?.email}</DialogDescription>
          </DialogHeader>
          {detailsTarget && (
            <div className="space-y-2 text-sm">
              <DetailRow
                label="Função"
                value={ROLE_LABEL[detailsTarget.role || 'user'] || detailsTarget.role || '—'}
              />
              <DetailRow
                label="Status"
                value={detailsTarget.status === 'blocked' ? 'Bloqueada' : 'Ativa'}
              />
              <DetailRow
                label="Lojas"
                value={
                  detailsTarget.stores.length
                    ? detailsTarget.stores.map((s) => s.name).join(', ')
                    : 'sem loja'
                }
              />
              <DetailRow
                label="Último acesso"
                value={dateOrDash(detailsTarget.last_sign_in_at, 'nunca acessou')}
              />
              <DetailRow
                label="Conta criada em"
                value={dateOrDash(detailsTarget.created_at, '—')}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Renomear */}
      <Dialog open={!!renameTarget} onOpenChange={(open) => !open && setRenameTarget(null)}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Renomear usuário</DialogTitle>
            <DialogDescription>
              Muda apenas o nome exibido. O e-mail de acesso continua o mesmo.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            placeholder="Nome completo"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameTarget(null)}>
              Cancelar
            </Button>
            <Button
              disabled={renameMutation.isPending || !renameValue.trim()}
              onClick={() =>
                renameTarget &&
                renameMutation.mutate({ id: renameTarget.id, name: renameValue })
              }
            >
              {renameMutation.isPending ? <Loader2 className="animate-spin" /> : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bloquear */}
      <AlertDialog open={!!blockTarget} onOpenChange={(open) => !open && setBlockTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bloquear esta conta?</AlertDialogTitle>
            <AlertDialogDescription>
              <b>{blockTarget?.full_name || blockTarget?.email}</b> perde o acesso ao sistema
              na hora. Nada é apagado: pedidos, lojas e registros continuam no lugar, e você
              pode ativar a conta de volta quando quiser.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() =>
                blockTarget && statusMutation.mutate({ id: blockTarget.id, status: 'blocked' })
              }
            >
              Bloquear
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-slate-100 pb-1.5">
      <span className="text-slate-500">{label}</span>
      <span className="text-slate-900 font-medium text-right">{value}</span>
    </div>
  )
}




