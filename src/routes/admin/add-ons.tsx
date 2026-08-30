import { createFileRoute, redirect } from '@tanstack/react-router'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { 
  Plus, 
  Pencil, 
  Trash2, 
  Loader2, 
  ChevronDown, 
  ChevronUp,
  Settings2,
  Tag,
  AlertCircle
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
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
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

type Addon = {
  id: string
  group_id: string
  name: string
  price: number
  status: 'active' | 'inactive'
}

type AddonGroup = {
  id: string
  name: string
  min_quantity: number
  max_quantity: number
  is_required: boolean
  status: 'active' | 'inactive'
  addons?: Addon[]
}

export const Route = createFileRoute('/admin/add-ons')({
  beforeLoad: () => {
    return;
  },
  component: AddonsPage,
})

function AddonsPage() {
  const queryClient = useQueryClient()
  const [isAddGroupOpen, setIsAddGroupOpen] = useState(false)
  const [isAddAddonOpen, setIsAddAddonOpen] = useState<{ isOpen: boolean, groupId: string | null }>({ isOpen: false, groupId: null })
  const [editingGroup, setEditingGroup] = useState<AddonGroup | null>(null)
  const [editingAddon, setEditingAddon] = useState<Addon | null>(null)
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({})

  const { data: groups, isLoading } = useQuery({
    queryKey: ['addon_groups'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('addon_groups')
        .select('*, addons(*)')
        .order('name')
      
      if (error) throw error
      return data as AddonGroup[]
    },
  })

  const groupMutation = useMutation({
    mutationFn: async (data: any) => {
      const { id, ...payload } = data
      if (id) {
        const { error } = await supabase.from('addon_groups').update(payload).eq('id', id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('addon_groups').insert([payload])
        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['addon_groups'] })
      setIsAddGroupOpen(false)
      setEditingGroup(null)
      toast.success('Grupo salvo com sucesso!')
    },
    onError: (error) => toast.error(`Erro ao salvar grupo: ${error.message}`),
  })

  const addonMutation = useMutation({
    mutationFn: async (data: any) => {
      const { id, ...payload } = data
      if (id) {
        const { error } = await supabase.from('addons').update(payload).eq('id', id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('addons').insert([payload])
        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['addon_groups'] })
      setIsAddAddonOpen({ isOpen: false, groupId: null })
      setEditingAddon(null)
      toast.success('Adicional salvo!')
    },
    onError: (error) => toast.error(`Erro ao salvar adicional: ${error.message}`),
  })

  const deleteGroupMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('addon_groups').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['addon_groups'] })
      toast.success('Grupo excluído!')
    },
  })

  const deleteAddonMutation = useMutation({
    mutationFn: async (id: string) => {
      // Note: Ideally we would check for order_items using this addon,
      // but selected_addons is stored as JSONB in order_items, making it complex to check.
      // We'll proceed with deletion but with a warning in the UI (already added).
      const { error } = await supabase.from('addons').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['addon_groups'] })
      toast.success('Adicional excluído!')
    },
    onError: (error: any) => toast.error(`Erro ao excluir adicional: ${error.message}`),
  })

  const toggleGroupExpansion = (id: string) => {
    setExpandedGroups(prev => ({ ...prev, [id]: !prev[id] }))
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Adicionais</h1>
          <p className="text-slate-500 text-sm">Gerencie grupos de complementos e extras</p>
        </div>
        
        <Dialog open={isAddGroupOpen} onOpenChange={setIsAddGroupOpen}>
          <DialogTrigger asChild>
            <Button className="bg-pink-600 hover:bg-pink-700 text-white gap-2">
              <Plus size={18} />
              Novo Grupo
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingGroup ? 'Editar Grupo' : 'Adicionar Grupo de Adicionais'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => {
              e.preventDefault()
              const formData = new FormData(e.currentTarget)
              const min = parseInt(formData.get('min_quantity') as string)
              const max = parseInt(formData.get('max_quantity') as string)
              
              if (isNaN(min) || min < 0) {
                toast.error("A quantidade mínima deve ser zero ou superior.")
                return
              }

              if (isNaN(max) || max < 1) {
                toast.error("A quantidade máxima deve ser pelo menos 1.")
                return
              }

              if (max < min) {
                toast.error("A quantidade máxima não pode ser menor que a mínima.")
                return
              }

              groupMutation.mutate({
                id: editingGroup?.id,
                name: formData.get('name'),
                min_quantity: min,
                max_quantity: max,
                is_required: formData.get('is_required') === 'on',
                status: editingGroup?.status || 'active'
              })
            }} className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Nome do Grupo</label>
                <Input name="name" defaultValue={editingGroup?.name} placeholder="Ex: Escolha a cobertura" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Qtd Mínima</label>
                  <Input name="min_quantity" type="number" defaultValue={editingGroup?.min_quantity || 0} required />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Qtd Máxima</label>
                  <Input name="max_quantity" type="number" defaultValue={editingGroup?.max_quantity || 1} required />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch name="is_required" defaultChecked={!!editingGroup?.is_required} />
                <label className="text-sm font-medium">Obrigatório?</label>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsAddGroupOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={groupMutation.isPending}>Salvar</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-4">
        {isLoading ? (
          <div className="p-12 flex justify-center bg-white rounded-xl border">
            <Loader2 className="animate-spin text-pink-600" size={32} />
          </div>
        ) : groups?.length === 0 ? (
          <div className="p-12 text-center text-slate-500 bg-white rounded-xl border border-dashed">
            Nenhum grupo de adicionais encontrado.
          </div>
        ) : (
          groups?.map((group) => (
            <div key={group.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-4 flex items-center justify-between bg-slate-50 border-b">
                <div className="flex items-center gap-4">
                  <button onClick={() => toggleGroupExpansion(group.id)} className="text-slate-400 hover:text-slate-600">
                    {expandedGroups[group.id] ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                  </button>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-slate-800">{group.name}</h3>
                      <Badge variant={group.status === 'active' ? 'outline' : 'secondary'} className={cn("text-[10px] uppercase", group.status === 'active' && "text-green-600 border-green-200 bg-green-50")}>
                        {group.status === 'active' ? 'Ativo' : 'Inativo'}
                      </Badge>
                      <Switch 
                        checked={group.status === 'active'}
                        onCheckedChange={(checked) => groupMutation.mutate({ id: group.id, status: checked ? 'active' : 'inactive' })}
                        className="scale-75"
                      />
                      {group.is_required && <Badge className="text-[10px] uppercase bg-pink-100 text-pink-700 hover:bg-pink-100">Obrigatório</Badge>}
                    </div>
                    <div className="text-xs text-slate-500">
                      Mín: {group.min_quantity} | Máx: {group.max_quantity}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="gap-2 text-slate-600"
                    onClick={() => {
                      setEditingGroup(group)
                      setIsAddGroupOpen(true)
                    }}
                  >
                    <Settings2 size={14} />
                    Editar Grupo
                  </Button>
                  
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="text-red-500">
                        <Trash2 size={16} />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Excluir Grupo?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Isso excluirá o grupo "{group.name}" e todos os seus adicionais.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteGroupMutation.mutate(group.id)} className="bg-red-600">Excluir</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>

              {expandedGroups[group.id] && (
                <div className="p-4 bg-white">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-sm font-semibold text-slate-600 uppercase tracking-wider">Itens do Grupo</h4>
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      className="text-pink-600 hover:text-pink-700 hover:bg-pink-50 gap-1 h-8"
                      onClick={() => setIsAddAddonOpen({ isOpen: true, groupId: group.id })}
                    >
                      <Plus size={14} />
                      Novo Adicional
                    </Button>
                  </div>

                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead>Nome</TableHead>
                        <TableHead>Preço</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {group.addons?.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-slate-400 py-8 italic text-sm">
                            Nenhum item neste grupo.
                          </TableCell>
                        </TableRow>
                      ) : (
                        group.addons?.map((addon) => (
                          <TableRow key={addon.id}>
                            <TableCell className="font-medium text-slate-700">{addon.name}</TableCell>
                            <TableCell>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(addon.price)}</TableCell>
                            <TableCell>
                              <Switch 
                                checked={addon.status === 'active'} 
                                onCheckedChange={(checked) => addonMutation.mutate({ id: addon.id, status: checked ? 'active' : 'inactive' })}
                              />
                            </TableCell>
                            <TableCell className="text-right space-x-2">
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={() => {
                                  setEditingAddon(addon)
                                  setIsAddAddonOpen({ isOpen: true, groupId: group.id })
                                }}
                              >
                                <Pencil size={14} className="text-slate-500" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="icon">
                                    <Trash2 size={14} className="text-red-500" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Excluir Adicional?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Deseja realmente excluir o adicional "{addon.name}"? Esta ação não pode ser desfeita.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction 
                                      onClick={() => deleteAddonMutation.mutate(addon.id)}
                                      className="bg-red-600"
                                    >
                                      Excluir
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <Dialog open={isAddAddonOpen.isOpen} onOpenChange={(open) => !open && setIsAddAddonOpen({ isOpen: false, groupId: null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingAddon ? 'Editar Adicional' : 'Novo Adicional'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => {
            e.preventDefault()
            const formData = new FormData(e.currentTarget)
            const priceStr = formData.get('price') as string || '0';
            const price = parseFloat(priceStr);
            
            if (isNaN(price) || price < 0) {
              toast.error("O preço deve ser zero ou superior.")
              return
            }

            addonMutation.mutate({
              id: editingAddon?.id,
              group_id: isAddAddonOpen.groupId,
              name: formData.get('name'),
              price: price,
              status: editingAddon?.status || 'active'
            })
          }} className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Nome</label>
              <Input name="name" defaultValue={editingAddon?.name} placeholder="Ex: Calda de Chocolate" required />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Preço (R$)</label>
              <Input name="price" type="number" step="0.01" defaultValue={editingAddon?.price} placeholder="0.00" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsAddAddonOpen({ isOpen: false, groupId: null })}>Cancelar</Button>
              <Button type="submit" disabled={addonMutation.isPending}>Salvar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
