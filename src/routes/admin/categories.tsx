import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useActiveStore } from '@/lib/active-store'
import { Plus, Pencil, Trash2, GripVertical, Check, X, Loader2, Upload, Image as ImageIcon } from 'lucide-react'
import { ImageUpload } from '@/components/admin/ImageUpload'
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
import { toast } from 'sonner'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

type Category = {
  id: string
  name: string
  status: 'active' | 'inactive'
  sort_order: number
  image_url: string | null
  created_at: string
}

export const Route = createFileRoute('/admin/categories')({
  beforeLoad: () => {
    return;
  },
  component: CategoriesPage,
})

function CategoriesPage() {
  const { storeId } = useActiveStore()
  const queryClient = useQueryClient()
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [newName, setNewName] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const [newCategoryImage, setNewCategoryImage] = useState('')
  const [editCategoryImage, setEditCategoryImage] = useState('')

  const { data: categories, isLoading, error: queryError } = useQuery({
    queryKey: ['categories', storeId],
    queryFn: async () => {
      console.log('Fetching categories...');
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('store_id', storeId)
        .order('sort_order', { ascending: true })

      if (error) {
        console.error('Supabase error fetching categories:', error);
        throw error;
      }
      console.log('Categories fetched:', data);
      return (data || []) as Category[]
    },
  })

  if (queryError) {
    console.error('React Query error:', queryError);
  }

  const createMutation = useMutation({
    mutationFn: async (data: { name: string, image_url: string }) => {
      const { error } = await supabase
        .from('categories')
        .insert([{
          store_id: storeId,
          name: data.name,
          image_url: data.image_url,
          sort_order: (categories?.length || 0) + 1,
          status: 'active'
        } as any])
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories', storeId] })
      setIsAddOpen(false)
      setNewName('')
      setNewCategoryImage('')
      toast.success('Categoria criada com sucesso!')
    },
    onError: (error: any) => toast.error(`Erro ao criar categoria: ${error.message}`),
  })

  const updateMutation = useMutation({
    mutationFn: async (updates: Partial<Category> & { id: string }) => {
      const { error } = await supabase
        .from('categories')
        .update(updates as any)
        .eq('id', updates.id)
        .eq('store_id', storeId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories', storeId] })
      setEditingCategory(null)
      toast.success('Categoria atualizada!')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      // Check for products in this category
      const { count, error: countError } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('store_id', storeId)
        .eq('category_id', id);

      if (countError) throw countError;
      if (count && count > 0) {
        throw new Error(`Esta categoria possui ${count} produto(s) vinculado(s) e não pode ser excluída. Remova ou mova os produtos primeiro.`);
      }

      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', id)
        .eq('store_id', storeId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories', storeId] })
      toast.success('Categoria excluída!')
    },
    onError: (error: any) => toast.error(error.message)
  })

  // handleFileUpload was removed in favor of ImageUpload component

  const toggleStatus = (category: Category) => {
    updateMutation.mutate({
      id: category.id,
      status: category.status === 'active' ? 'inactive' : 'active',
    })
  }

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newName.trim()) return
    createMutation.mutate({ name: newName, image_url: newCategoryImage })
  }

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingCategory || !editingCategory.name.trim()) return
    updateMutation.mutate({ 
      id: editingCategory.id, 
      name: editingCategory.name,
      image_url: editCategoryImage || editingCategory.image_url
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Categorias</h1>
          <p className="text-slate-500 text-sm">Gerencie as categorias do seu catálogo</p>
        </div>
        
        <Dialog 
          open={isAddOpen} 
          onOpenChange={(open) => {
            setIsAddOpen(open);
            if (!open) {
              setNewName('');
              setNewCategoryImage('');
            }
          }}
        >
          <DialogTrigger asChild>
            <Button className="bg-pink-600 hover:bg-pink-700 text-white gap-2">
              <Plus size={18} />
              Nova Categoria
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Adicionar Categoria</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Nome da Categoria</label>
                <Input 
                  value={newName} 
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Ex: Promoções, Mais vendidos, Bebidas..."
                  autoFocus
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Imagem (Opcional)</label>
                <ImageUpload
                  value={newCategoryImage}
                  onChange={(url) => setNewCategoryImage(url || '')}
                  folder="categories"
                  maxSizeMB={2}
                />
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? <Loader2 className="animate-spin" /> : 'Criar'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-12 flex justify-center">
            <Loader2 className="animate-spin text-pink-600" size={32} />
          </div>
        ) : categories?.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            Nenhuma categoria encontrada. Comece criando uma!
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12"></TableHead>
                <TableHead className="w-16">Imagem</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Ordem</TableHead>
                <TableHead>Criação</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories?.map((category) => (
                <TableRow key={category.id}>
                  <TableCell>
                    <GripVertical className="text-slate-300 cursor-move" size={16} />
                  </TableCell>
                  <TableCell>
                    {category.image_url ? (
                      <img 
                        src={category.image_url} 
                        alt={category.name}
                        className="w-10 h-10 rounded-lg object-cover border bg-slate-50"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'https://placehold.co/100x100?text=Erro';
                        }}
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 border">
                        <ImageIcon size={16} />
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="font-medium text-slate-700">
                    {category.name}
                  </TableCell>
                  <TableCell>
                    <button 
                      onClick={() => toggleStatus(category)}
                      className="cursor-pointer"
                    >
                      <Badge variant={category.status === 'active' ? 'default' : 'secondary'} className={category.status === 'active' ? 'bg-green-100 text-green-700 hover:bg-green-200 border-green-200' : ''}>
                        {category.status === 'active' ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </button>
                  </TableCell>
                  <TableCell className="text-slate-500">
                    {category.sort_order}
                  </TableCell>
                  <TableCell className="text-slate-500 text-xs">
                    {category.created_at && !isNaN(new Date(category.created_at).getTime())
                      ? format(new Date(category.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })
                      : "—"}
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    <Dialog 
                      open={editingCategory?.id === category.id} 
                      onOpenChange={(open) => {
                        if (!open) {
                          setEditingCategory(null);
                          setEditCategoryImage('');
                        }
                      }}
                    >
                      <DialogTrigger asChild>
                        <Button variant="ghost" size="icon" onClick={() => {
                          setEditingCategory(category);
                          setEditCategoryImage('');
                        }}>
                          <Pencil size={16} className="text-slate-500" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Editar Categoria</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleUpdate} className="space-y-4 py-4">
                          <div className="space-y-2">
                            <label className="text-sm font-medium">Nome da Categoria</label>
                            <Input 
                              value={editingCategory?.name || ''} 
                              onChange={(e) => setEditingCategory(prev => prev ? {...prev, name: e.target.value} : null)}
                            />
                          </div>

                          <div className="space-y-2">
                            <label className="text-sm font-medium">Imagem</label>
                            <ImageUpload
                              value={editCategoryImage || editingCategory?.image_url}
                              onChange={(url) => setEditCategoryImage(url || '')}
                              folder="categories"
                              maxSizeMB={2}
                            />
                          </div>
                          <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setEditingCategory(null)}>Cancelar</Button>
                            <Button type="submit" disabled={updateMutation.isPending}>Salvar</Button>
                          </DialogFooter>
                        </form>
                      </DialogContent>
                    </Dialog>

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <Trash2 size={16} className="text-red-500" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir Categoria?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Esta ação não pode ser desfeita. Isso excluirá permanentemente a categoria "{category.name}".
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction 
                            onClick={() => deleteMutation.mutate(category.id)}
                            className="bg-red-600 hover:bg-red-700"
                          >
                            Excluir
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  )
}
