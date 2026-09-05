import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getAllAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  setAnnouncementActive,
  deleteAnnouncement,
  type AnnouncementWithStore,
  type AnnouncementSeverity,
  type AnnouncementInput,
} from '@/lib/announcements.functions'
import { getAllStores } from '@/lib/super-admin.functions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
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
  Plus,
  Loader2,
  MoreHorizontal,
  Pencil,
  Trash2,
  Megaphone,
  Search,
  Globe,
} from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { toast } from 'sonner'

export const Route = createFileRoute('/super/avisos')({
  component: SuperAnnouncementsPage,
})

const SEVERITY_LABEL: Record<AnnouncementSeverity, string> = {
  info: 'Informação',
  warning: 'Atenção',
  critical: 'Crítico',
}

const SEVERITY_CLASS: Record<AnnouncementSeverity, string> = {
  info: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  warning: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  critical: 'bg-red-500/15 text-red-300 border-red-500/30',
}

const ALL_STORES = 'all-stores'

type FormState = {
  title: string
  body: string
  severity: AnnouncementSeverity
  storeId: string // ALL_STORES ou o id da loja
  isActive: boolean
  startsAt: string // yyyy-MM-ddTHH:mm (formato do input datetime-local)
  endsAt: string
}

// O input datetime-local não aceita fuso; corta o ISO no minuto, em hora local.
const toLocalInput = (iso: string | null): string => {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const emptyForm = (): FormState => ({
  title: '',
  body: '',
  severity: 'info',
  storeId: ALL_STORES,
  isActive: true,
  startsAt: toLocalInput(new Date().toISOString()),
  endsAt: '',
})

const formFromAnnouncement = (a: AnnouncementWithStore): FormState => ({
  title: a.title,
  body: a.body,
  severity: a.severity,
  storeId: a.store_id ?? ALL_STORES,
  isActive: a.is_active,
  startsAt: toLocalInput(a.starts_at),
  endsAt: toLocalInput(a.ends_at),
})

function SuperAnnouncementsPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [targetFilter, setTargetFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [editing, setEditing] = useState<AnnouncementWithStore | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [form, setForm] = useState<FormState>(emptyForm())
  const [deleteTarget, setDeleteTarget] = useState<AnnouncementWithStore | null>(null)

  const { data: list, isLoading, error } = useQuery({
    queryKey: ['super-announcements'],
    queryFn: getAllAnnouncements,
  })

  const { data: stores } = useQuery({
    queryKey: ['super-stores'],
    queryFn: getAllStores,
  })

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['super-announcements'] })

  const buildInput = (state: FormState): AnnouncementInput => ({
    title: state.title,
    body: state.body,
    severity: state.severity,
    storeId: state.storeId === ALL_STORES ? null : state.storeId,
    isActive: state.isActive,
    startsAt: new Date(state.startsAt || Date.now()).toISOString(),
    endsAt: state.endsAt ? new Date(state.endsAt).toISOString() : null,
  })

  const saveMutation = useMutation({
    mutationFn: (payload: { id: string | null; input: AnnouncementInput }) =>
      payload.id
        ? updateAnnouncement(payload.id, payload.input)
        : createAnnouncement(payload.input),
    onSuccess: () => {
      invalidate()
      setIsFormOpen(false)
      setEditing(null)
      toast.success('Aviso salvo!')
    },
    onError: (e: any) => toast.error(e.message),
  })

  const activeMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      setAnnouncementActive(id, isActive),
    onSuccess: () => invalidate(),
    onError: (e: any) => toast.error(e.message),
  })

  const deleteMutation = useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) => deleteAnnouncement(id, title),
    onSuccess: () => {
      invalidate()
      setDeleteTarget(null)
      toast.success('Aviso excluído.')
    },
    onError: (e: any) => toast.error(e.message),
  })

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm())
    setIsFormOpen(true)
  }

  const openEdit = (a: AnnouncementWithStore) => {
    setEditing(a)
    setForm(formFromAnnouncement(a))
    setIsFormOpen(true)
  }

  const filtered = (list || []).filter((a) => {
    const term = search.trim().toLowerCase()
    if (term && !a.title.toLowerCase().includes(term) && !a.body.toLowerCase().includes(term)) {
      return false
    }
    if (targetFilter === 'global' && a.store_id !== null) return false
    if (targetFilter !== 'all' && targetFilter !== 'global' && a.store_id !== targetFilter) {
      return false
    }
    if (statusFilter === 'active' && !a.is_active) return false
    if (statusFilter === 'inactive' && a.is_active) return false
    return true
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Avisos</h1>
          <p className="text-slate-400 text-sm">
            Comunicados que aparecem no painel das lojas.
          </p>
        </div>
        <Button className="bg-pink-600 hover:bg-pink-700 gap-2" onClick={openCreate}>
          <Plus size={16} />
          Novo aviso
        </Button>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-red-300 text-sm">
          Não foi possível carregar os avisos: {(error as Error).message}
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por título ou mensagem"
            className="pl-9 bg-slate-900 border-slate-800 text-slate-100"
          />
        </div>

        <Select value={targetFilter} onValueChange={setTargetFilter}>
          <SelectTrigger className="w-[200px] bg-slate-900 border-slate-800 text-slate-100">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os destinos</SelectItem>
            <SelectItem value="global">Todas as lojas</SelectItem>
            {(stores || []).map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px] bg-slate-900 border-slate-800 text-slate-100">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="active">Ativos</SelectItem>
            <SelectItem value="inactive">Inativos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
        {isLoading ? (
          <div className="p-12 flex justify-center">
            <Loader2 className="animate-spin text-pink-500" size={32} />
          </div>
        ) : !list || list.length === 0 ? (
          <div className="p-12 text-center text-slate-400 space-y-3">
            <Megaphone className="w-10 h-10 mx-auto text-slate-600" />
            <p>Nenhum aviso criado ainda.</p>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Um aviso aparece como faixa no alto do painel das lojas escolhidas. Serve para
              comunicar atualizações, manutenção ou mudanças no sistema.
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-slate-400 space-y-3">
            <Search className="w-10 h-10 mx-auto text-slate-600" />
            <p>Nenhum aviso encontrado com esses filtros.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-slate-800 hover:bg-transparent">
                <TableHead className="text-slate-400">Aviso</TableHead>
                <TableHead className="text-slate-400">Destino</TableHead>
                <TableHead className="text-slate-400">Gravidade</TableHead>
                <TableHead className="text-slate-400">Período</TableHead>
                <TableHead className="text-slate-400">Ativo</TableHead>
                <TableHead className="text-slate-400 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((a) => (
                <TableRow key={a.id} className="border-slate-800 hover:bg-slate-800/40">
                  <TableCell>
                    <div className="font-medium text-slate-100">{a.title}</div>
                    <div className="text-xs text-slate-500 max-w-[280px] truncate">{a.body}</div>
                  </TableCell>
                  <TableCell>
                    {a.storeName === null ? (
                      <span className="inline-flex items-center gap-1.5 text-slate-300">
                        <Globe size={14} className="text-slate-500" />
                        Todas as lojas
                      </span>
                    ) : (
                      <span className="text-slate-300">{a.storeName}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={SEVERITY_CLASS[a.severity]}>
                      {SEVERITY_LABEL[a.severity]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-slate-400">
                    <div>{format(new Date(a.starts_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}</div>
                    <div className="text-slate-500">
                      {a.ends_at
                        ? `até ${format(new Date(a.ends_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}`
                        : 'sem prazo'}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={a.is_active}
                      onCheckedChange={(checked) =>
                        activeMutation.mutate({ id: a.id, isActive: checked })
                      }
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-slate-400">
                          <MoreHorizontal size={16} />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(a)}>
                          <Pencil size={14} className="mr-2" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-red-600"
                          onClick={() => setDeleteTarget(a)}
                        >
                          <Trash2 size={14} className="mr-2" />
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Formulário */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-[520px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar aviso' : 'Novo aviso'}</DialogTitle>
            <DialogDescription>
              O aviso aparece como faixa no alto do painel das lojas escolhidas.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="aviso-titulo">Título</Label>
              <Input
                id="aviso-titulo"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Nova atualização disponível"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="aviso-mensagem">Mensagem</Label>
              <Textarea
                id="aviso-mensagem"
                value={form.body}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
                placeholder="Escreva o comunicado que o dono da loja vai ler."
                rows={4}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Destino</Label>
                <Select
                  value={form.storeId}
                  onValueChange={(v) => setForm({ ...form, storeId: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_STORES}>Todas as lojas</SelectItem>
                    {(stores || []).map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Gravidade</Label>
                <Select
                  value={form.severity}
                  onValueChange={(v) => setForm({ ...form, severity: v as AnnouncementSeverity })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="info">Informação</SelectItem>
                    <SelectItem value="warning">Atenção</SelectItem>
                    <SelectItem value="critical">Crítico</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="aviso-inicio">Começa em</Label>
                <Input
                  id="aviso-inicio"
                  type="datetime-local"
                  value={form.startsAt}
                  onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="aviso-fim">Termina em</Label>
                <Input
                  id="aviso-fim"
                  type="datetime-local"
                  value={form.endsAt}
                  onChange={(e) => setForm({ ...form, endsAt: e.target.value })}
                />
                <p className="text-[11px] text-slate-500">Deixe vazio para não expirar.</p>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <div className="text-sm font-medium">Aviso ativo</div>
                <p className="text-xs text-slate-500">Desligado, ninguém vê a faixa.</p>
              </div>
              <Switch
                checked={form.isActive}
                onCheckedChange={(checked) => setForm({ ...form, isActive: checked })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsFormOpen(false)}>
              Cancelar
            </Button>
            <Button
              className="bg-pink-600 hover:bg-pink-700"
              disabled={saveMutation.isPending}
              onClick={() =>
                saveMutation.mutate({ id: editing?.id ?? null, input: buildInput(form) })
              }
            >
              {saveMutation.isPending && <Loader2 size={16} className="mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Exclusão */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir este aviso?</AlertDialogTitle>
            <AlertDialogDescription>
              O aviso "{deleteTarget?.title}" será apagado e sai do painel das lojas. Se quiser
              apenas parar de mostrá-lo, desligue o interruptor "Ativo" em vez de excluir.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() =>
                deleteTarget &&
                deleteMutation.mutate({ id: deleteTarget.id, title: deleteTarget.title })
              }
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
