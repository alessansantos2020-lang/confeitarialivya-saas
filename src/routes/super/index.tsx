import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getAllStores,
  createStore,
  updateStoreStatus,
  renameStore,
  getAssignableUsers,
  assignStoreOwner,
  getAllPlans,
  setStorePlan,
  getStoreDetails,
  slugify,
  type StoreOverview,
  type StoreStatus,
} from '@/lib/super-admin.functions'
import { startSupportSession } from '@/lib/support-session'
import { useNavigate } from '@tanstack/react-router'
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
  DialogTrigger,
} from '@/components/ui/dialog'
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
  Plus,
  Loader2,
  MoreHorizontal,
  ExternalLink,
  UserPlus,
  Pencil,
  Package,
  Search,
  Eye,
  LifeBuoy,
  Store as StoreIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export const Route = createFileRoute('/super/')({
  component: SuperStoresPage,
})

const STATUS_LABEL: Record<StoreStatus, string> = {
  active: 'Ativa',
  inactive: 'Inativa',
  suspended: 'Suspensa',
}

const STATUS_CLASS: Record<StoreStatus, string> = {
  active: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  inactive: 'bg-slate-500/15 text-slate-400 border-slate-500/30',
  suspended: 'bg-red-500/15 text-red-400 border-red-500/30',
}

function SuperStoresPage() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [newSlug, setNewSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)
  const [ownerTarget, setOwnerTarget] = useState<StoreOverview | null>(null)
  const [selectedOwnerId, setSelectedOwnerId] = useState('')
  const [renameTarget, setRenameTarget] = useState<StoreOverview | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [planTarget, setPlanTarget] = useState<StoreOverview | null>(null)
  const [selectedPlanId, setSelectedPlanId] = useState('')
  const [detailsTarget, setDetailsTarget] = useState<StoreOverview | null>(null)
  const [supportTarget, setSupportTarget] = useState<StoreOverview | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StoreStatus | 'all'>('all')
  const [planFilter, setPlanFilter] = useState('all')
  const [sortBy, setSortBy] = useState<'created_desc' | 'created_asc' | 'name'>('created_desc')

  const { data: stores, isLoading } = useQuery({
    queryKey: ['super-stores'],
    queryFn: getAllStores,
  })

  const { data: plans } = useQuery({
    queryKey: ['super-plans'],
    queryFn: getAllPlans,
  })

  const { data: details, isLoading: isDetailsLoading } = useQuery({
    queryKey: ['super-store-details', detailsTarget?.id],
    queryFn: () => getStoreDetails(detailsTarget!.id),
    enabled: !!detailsTarget,
  })

  const { data: users } = useQuery({
    queryKey: ['super-assignable-users'],
    queryFn: getAssignableUsers,
    enabled: !!ownerTarget,
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['super-stores'] })

  const createMutation = useMutation({
    mutationFn: createStore,
    onSuccess: (store) => {
      invalidate()
      setIsCreateOpen(false)
      setNewName('')
      setNewSlug('')
      setSlugTouched(false)
      toast.success(`Loja "${store.name}" criada!`)
    },
    onError: (error: any) => toast.error(error.message),
  })

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: StoreStatus }) =>
      updateStoreStatus(id, status),
    onSuccess: () => {
      invalidate()
      toast.success('Status atualizado!')
    },
    onError: (error: any) => toast.error(error.message),
  })

  const renameMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => renameStore(id, name),
    onSuccess: () => {
      invalidate()
      setRenameTarget(null)
      toast.success('Nome atualizado!')
    },
    onError: (error: any) => toast.error(error.message),
  })

  const ownerMutation = useMutation({
    mutationFn: ({ storeId, userId }: { storeId: string; userId: string }) =>
      assignStoreOwner(storeId, userId),
    onSuccess: () => {
      invalidate()
      setOwnerTarget(null)
      setSelectedOwnerId('')
      toast.success('Dono vinculado à loja!')
    },
    onError: (error: any) => toast.error(error.message),
  })

  const planMutation = useMutation({
    mutationFn: ({ storeId, planId }: { storeId: string; planId: string | null }) =>
      setStorePlan(storeId, planId),
    onSuccess: () => {
      invalidate()
      setPlanTarget(null)
      setSelectedPlanId('')
      toast.success('Plano da loja atualizado!')
    },
    onError: (error: any) => toast.error(error.message),
  })

  const supportMutation = useMutation({
    mutationFn: (store: StoreOverview) => startSupportSession(store.id, store.name),
    onSuccess: () => {
      setSupportTarget(null)
      navigate({ to: '/admin' })
    },
    onError: (error: any) => toast.error(error.message),
  })

  const effectiveSlug = slugify(slugTouched ? newSlug : newName)

  // Busca + filtros + ordenação sobre a lista já carregada (poucas lojas;
  // quando crescer, migrar pra filtro no banco com paginação).
  const visibleStores = (stores || [])
    .filter((s) => {
      if (statusFilter !== 'all' && s.status !== statusFilter) return false
      if (planFilter === 'none' && s.planId) return false
      if (planFilter !== 'all' && planFilter !== 'none' && s.planId !== planFilter) return false
      const q = search.trim().toLowerCase()
      if (!q) return true
      return (
        s.name.toLowerCase().includes(q) ||
        s.slug.toLowerCase().includes(q) ||
        (s.ownerName || '').toLowerCase().includes(q)
      )
    })
    .sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name, 'pt-BR')
      const at = a.created_at ? new Date(a.created_at).getTime() : 0
      const bt = b.created_at ? new Date(b.created_at).getTime() : 0
      return sortBy === 'created_asc' ? at - bt : bt - at
    })

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newName.trim()) return
    createMutation.mutate({ name: newName, slug: slugTouched ? newSlug : newName })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Lojas</h1>
          <p className="text-slate-400 text-sm">
            Cadastre e gerencie as lojas que usam o sistema
          </p>
        </div>

        <Dialog
          open={isCreateOpen}
          onOpenChange={(open) => {
            setIsCreateOpen(open)
            if (!open) {
              setNewName('')
              setNewSlug('')
              setSlugTouched(false)
            }
          }}
        >
          <DialogTrigger asChild>
            <Button className="bg-pink-600 hover:bg-pink-700 text-white gap-2">
              <Plus size={18} />
              Nova Loja
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Criar nova loja</DialogTitle>
              <DialogDescription>
                A loja já nasce com configurações padrão e pode receber um dono depois.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4 py-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Nome da loja</label>
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Ex: Mercado do Bairro"
                  autoFocus
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Endereço no site</label>
                <Input
                  value={slugTouched ? newSlug : effectiveSlug}
                  onChange={(e) => {
                    setSlugTouched(true)
                    setNewSlug(e.target.value)
                  }}
                  placeholder="mercado-do-bairro"
                />
                <p className="text-xs text-slate-500">
                  A loja pública ficará em <span className="font-mono">/{effectiveSlug || '...'}</span>
                </p>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || !newName.trim() || !effectiveSlug}
                >
                  {createMutation.isPending ? <Loader2 className="animate-spin" /> : 'Criar loja'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Busca, filtros e ordenação */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, endereço ou dono"
            className="pl-9 bg-slate-900 border-slate-800 text-slate-100"
          />
        </div>

        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StoreStatus | 'all')}>
          <SelectTrigger className="w-[150px] bg-slate-900 border-slate-800 text-slate-100">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="active">Ativa</SelectItem>
            <SelectItem value="inactive">Inativa</SelectItem>
            <SelectItem value="suspended">Suspensa</SelectItem>
          </SelectContent>
        </Select>

        <Select value={planFilter} onValueChange={setPlanFilter}>
          <SelectTrigger className="w-[170px] bg-slate-900 border-slate-800 text-slate-100">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os planos</SelectItem>
            <SelectItem value="none">Sem plano</SelectItem>
            {(plans || []).map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
          <SelectTrigger className="w-[170px] bg-slate-900 border-slate-800 text-slate-100">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="created_desc">Mais recentes</SelectItem>
            <SelectItem value="created_asc">Mais antigas</SelectItem>
            <SelectItem value="name">Nome (A-Z)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
        {isLoading ? (
          <div className="p-12 flex justify-center">
            <Loader2 className="animate-spin text-pink-500" size={32} />
          </div>
        ) : !stores || stores.length === 0 ? (
          <div className="p-12 text-center text-slate-400 space-y-3">
            <StoreIcon className="w-10 h-10 mx-auto text-slate-600" />
            <p>Nenhuma loja cadastrada ainda.</p>
          </div>
        ) : visibleStores.length === 0 ? (
          <div className="p-12 text-center text-slate-400 space-y-3">
            <Search className="w-10 h-10 mx-auto text-slate-600" />
            <p>Nenhuma loja encontrada com esses filtros.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-slate-800 hover:bg-transparent">
                <TableHead className="text-slate-400">Loja</TableHead>
                <TableHead className="text-slate-400">Endereço</TableHead>
                <TableHead className="text-slate-400">Dono</TableHead>
                <TableHead className="text-slate-400">Plano</TableHead>
                <TableHead className="text-slate-400">Equipe</TableHead>
                <TableHead className="text-slate-400">Status</TableHead>
                <TableHead className="text-slate-400">Criada em</TableHead>
                <TableHead className="text-right text-slate-400">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleStores.map((store) => (
                <TableRow key={store.id} className="border-slate-800">
                  <TableCell className="font-medium text-white">
                    {store.name}
                    {store.settingsName && store.settingsName !== store.name && (
                      <span className="block text-xs text-slate-500">
                        catálogo: {store.settingsName}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <a
                      href={`/${store.slug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-pink-400 hover:underline inline-flex items-center gap-1 font-mono text-xs"
                    >
                      /{store.slug}
                      <ExternalLink size={12} />
                    </a>
                  </TableCell>
                  <TableCell className="text-slate-300 text-sm">
                    {store.ownerName || <span className="text-slate-600">sem dono</span>}
                  </TableCell>
                  <TableCell className="text-sm">
                    {store.planName ? (
                      <Badge
                        variant="outline"
                        className="bg-pink-500/15 text-pink-300 border-pink-500/30"
                      >
                        {store.planName}
                      </Badge>
                    ) : (
                      <span className="text-slate-600">sem plano</span>
                    )}
                  </TableCell>
                  <TableCell className="text-slate-300 text-sm">{store.memberCount}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={STATUS_CLASS[store.status]}>
                      {STATUS_LABEL[store.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-slate-500 text-xs">
                    {store.created_at && !isNaN(new Date(store.created_at).getTime())
                      ? format(new Date(store.created_at), 'dd/MM/yyyy', { locale: ptBR })
                      : '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="hover:bg-slate-800">
                          <MoreHorizontal size={16} className="text-slate-400" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setDetailsTarget(store)}>
                          <Eye size={14} className="mr-2" />
                          Visualizar
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            setRenameTarget(store)
                            setRenameValue(store.name)
                          }}
                        >
                          <Pencil size={14} className="mr-2" />
                          Renomear
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            setOwnerTarget(store)
                            setSelectedOwnerId(store.owner_id || '')
                          }}
                        >
                          <UserPlus size={14} className="mr-2" />
                          Definir dono
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            setPlanTarget(store)
                            setSelectedPlanId(store.planId || 'none')
                          }}
                        >
                          <Package size={14} className="mr-2" />
                          Definir plano
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setSupportTarget(store)}>
                          <LifeBuoy size={14} className="mr-2" />
                          Acessar como suporte
                        </DropdownMenuItem>
                        {store.status !== 'active' && (
                          <DropdownMenuItem
                            onClick={() => statusMutation.mutate({ id: store.id, status: 'active' })}
                          >
                            Ativar loja
                          </DropdownMenuItem>
                        )}
                        {store.status !== 'suspended' && (
                          <DropdownMenuItem
                            className="text-red-500"
                            onClick={() =>
                              statusMutation.mutate({ id: store.id, status: 'suspended' })
                            }
                          >
                            Suspender loja
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Renomear loja */}
      <Dialog
        open={!!renameTarget}
        onOpenChange={(open) => {
          if (!open) setRenameTarget(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Renomear loja</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (renameTarget && renameValue.trim()) {
                renameMutation.mutate({ id: renameTarget.id, name: renameValue })
              }
            }}
            className="space-y-4 py-2"
          >
            <Input
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              autoFocus
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setRenameTarget(null)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={renameMutation.isPending || !renameValue.trim()}>
                {renameMutation.isPending ? <Loader2 className="animate-spin" /> : 'Salvar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Definir dono */}
      <Dialog
        open={!!ownerTarget}
        onOpenChange={(open) => {
          if (!open) {
            setOwnerTarget(null)
            setSelectedOwnerId('')
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Definir dono da loja</DialogTitle>
            <DialogDescription>
              O usuário escolhido vira administrador de <b>{ownerTarget?.name}</b> e passa a ter
              acesso ao painel dessa loja.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <Select value={selectedOwnerId} onValueChange={setSelectedOwnerId}>
              <SelectTrigger>
                <SelectValue placeholder="Escolha um usuário" />
              </SelectTrigger>
              <SelectContent>
                {(users || []).map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.full_name || u.id}
                    {u.status && u.status !== 'active' ? ` (${u.status})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setOwnerTarget(null)
                  setSelectedOwnerId('')
                }}
              >
                Cancelar
              </Button>
              <Button
                disabled={ownerMutation.isPending || !selectedOwnerId}
                onClick={() => {
                  if (ownerTarget && selectedOwnerId) {
                    ownerMutation.mutate({ storeId: ownerTarget.id, userId: selectedOwnerId })
                  }
                }}
              >
                {ownerMutation.isPending ? <Loader2 className="animate-spin" /> : 'Vincular dono'}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Definir plano */}
      <Dialog
        open={!!planTarget}
        onOpenChange={(open) => {
          if (!open) {
            setPlanTarget(null)
            setSelectedPlanId('')
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Definir plano da loja</DialogTitle>
            <DialogDescription>
              Escolha o plano de <b>{planTarget?.name}</b>. Trocar o plano nunca apaga dados — só
              muda o que a loja consegue acessar. Sem plano = acesso a tudo.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
              <SelectTrigger>
                <SelectValue placeholder="Escolha um plano" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem plano (acesso total)</SelectItem>
                {(plans || [])
                  .filter((p) => p.is_active)
                  .map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} — {p.featureIds.length} recursos
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setPlanTarget(null)
                  setSelectedPlanId('')
                }}
              >
                Cancelar
              </Button>
              <Button
                disabled={planMutation.isPending || !selectedPlanId}
                onClick={() => {
                  if (planTarget && selectedPlanId) {
                    planMutation.mutate({
                      storeId: planTarget.id,
                      planId: selectedPlanId === 'none' ? null : selectedPlanId,
                    })
                  }
                }}
              >
                {planMutation.isPending ? <Loader2 className="animate-spin" /> : 'Salvar plano'}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Acessar como suporte */}
      <Dialog open={!!supportTarget} onOpenChange={(open) => !open && setSupportTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Acessar como suporte</DialogTitle>
            <DialogDescription>
              Você vai entrar no painel de <b>{supportTarget?.name}</b> usando sua própria conta de
              Super Admin — sem senha do dono, sem credencial nova. O painel vai mostrar um aviso de
              que você está em modo suporte, com botão para voltar. Esse acesso fica registrado no
              log de auditoria.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setSupportTarget(null)}>
              Cancelar
            </Button>
            <Button
              disabled={supportMutation.isPending}
              onClick={() => supportTarget && supportMutation.mutate(supportTarget)}
            >
              {supportMutation.isPending ? <Loader2 className="animate-spin" /> : 'Entrar no painel'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detalhes da loja */}
      <Dialog open={!!detailsTarget} onOpenChange={(open) => !open && setDetailsTarget(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{detailsTarget?.name}</DialogTitle>
            <DialogDescription>Dados gerais da loja</DialogDescription>
          </DialogHeader>
          {detailsTarget && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <DetailRow label="Proprietário" value={detailsTarget.ownerName || 'sem dono'} />
                <DetailRow
                  label="Plano"
                  value={detailsTarget.planName || 'sem plano'}
                />
                <DetailRow
                  label="Endereço no site"
                  value={`/${detailsTarget.slug}`}
                  mono
                />
                <DetailRow label="Status" value={STATUS_LABEL[detailsTarget.status]} />
                <DetailRow
                  label="Criada em"
                  value={
                    detailsTarget.created_at &&
                    !isNaN(new Date(detailsTarget.created_at).getTime())
                      ? format(new Date(detailsTarget.created_at), 'dd/MM/yyyy', { locale: ptBR })
                      : '—'
                  }
                />
                <DetailRow label="Telefone" value={details?.phone || '—'} />
                <DetailRow label="WhatsApp" value={details?.whatsapp || '—'} />
                <DetailRow label="Endereço" value={details?.address || '—'} />
              </div>

              <div className="grid grid-cols-4 gap-3 pt-2 border-t border-slate-800">
                {isDetailsLoading ? (
                  <div className="col-span-4 flex justify-center py-4">
                    <Loader2 className="animate-spin text-pink-500" size={20} />
                  </div>
                ) : (
                  <>
                    <MetricBox label="Usuários" value={details?.userCount ?? 0} />
                    <MetricBox label="Pedidos" value={details?.orderCount ?? 0} />
                    <MetricBox label="Clientes" value={details?.customerCount ?? 0} />
                    <MetricBox label="Produtos" value={details?.productCount ?? 0} />
                  </>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-xs text-slate-500">{label}</div>
      <div className={mono ? 'font-mono text-slate-200' : 'text-slate-200'}>{value}</div>
    </div>
  )
}

function MetricBox({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center">
      <div className="text-2xl font-bold text-white">{value}</div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  )
}
