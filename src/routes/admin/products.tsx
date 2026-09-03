import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useActiveStore } from '@/lib/active-store'
import { ensurePublicBucket } from '@/lib/storage-setup'
import { 
  Plus, 
  Pencil, 
  Trash2, 
  Loader2, 
  Image as ImageIcon,
  Star,
  StarOff,
  Search,
  Upload,
  X
} from 'lucide-react'
import { ImageUpload } from '@/components/admin/ImageUpload'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'

type Category = {
  id: string
  name: string
}

type Product = {
  id: string
  name: string
  description: string | null
  price: number
  image_url: string | null
  category_id: string
  is_available: boolean
  is_featured: boolean
  created_at: string
  category?: Category
}

export const Route = createFileRoute('/admin/products')({
  beforeLoad: () => {
    return;
  },
  component: ProductsPage,
})

function ProductsPage() {
  const { storeId } = useActiveStore()
  const queryClient = useQueryClient()
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Partial<Product> | null>(null)
  const [search, setSearch] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const [newProductImage, setNewProductImage] = useState('')
  const [editProductImage, setEditProductImage] = useState('')

  useEffect(() => {
    ensurePublicBucket()
  }, [])

  // Fetch Products
  const { data: products, isLoading: isLoadingProducts } = useQuery({
    queryKey: ['products', storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('*, category:categories(id, name)')
        .eq('store_id', storeId)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data as Product[]
    },
  })

  // Fetch Categories for the selector
  const { data: categories } = useQuery({
    queryKey: ['categories', storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('id, name')
        .eq('store_id', storeId)
        .eq('status', 'active')
        .order('name')

      if (error) throw error
      return data as Category[]
    },
  })

  const createMutation = useMutation({
    mutationFn: async (newProduct: any) => {
      const { category, ...insertData } = newProduct
      const { data, error } = await supabase
        .from('products')
        .insert([{ ...insertData, store_id: storeId }])
        .select('*, category:categories(id, name)')
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products', storeId] })
      setIsAddOpen(false)
      toast.success('Produto criado com sucesso!')
    },
    onError: (error: any) => toast.error(`Erro ao criar produto: ${error.message}`),
  })

  const updateMutation = useMutation({
    mutationFn: async (updates: any) => {
      const { id, category, ...updateData } = updates
      const { data, error } = await supabase
        .from('products')
        .update(updateData)
        .eq('id', id)
        .eq('store_id', storeId)
        .select('*, category:categories(id, name)')
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products', storeId] })
      setEditingProduct(null)
      toast.success('Produto atualizado!')
    },
    onError: (error) => toast.error(`Erro ao atualizar: ${error.message}`),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      // First check if product is used in order_items
      const { count: orderItemsCount, error: countError } = await supabase
        .from('order_items')
        .select('*', { count: 'exact', head: true })
        .eq('product_id', id);

      if (countError) throw countError;
      if (orderItemsCount && orderItemsCount > 0) {
        throw new Error(`Este produto possui ${orderItemsCount} pedido(s) vinculado(s) e não pode ser excluído. Desative-o em vez disso.`);
      }

      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', id)
        .eq('store_id', storeId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products', storeId] })
      toast.success('Produto excluído!')
    },
    onError: (error: any) => toast.error(error.message)
  })

  // handleFileUpload was removed in favor of ImageUpload component

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    
    if (!newProductImage) {
      toast.error("Por favor, envie uma imagem para o produto.");
      return;
    }

    const formData = new FormData(e.currentTarget)
    const priceStr = formData.get('price') as string;
    const price = parseFloat(priceStr);

    if (isNaN(price) || price < 0) {
      toast.error("O preço deve ser um valor positivo.");
      return;
    }

    const newProduct = {
      name: formData.get('name') as string,
      description: formData.get('description') as string,
      price: price,
      category_id: formData.get('category_id') as string,
      image_url: newProductImage,
      is_available: true,
      is_featured: false
    }

    if (!newProduct.category_id) {
      toast.error('Selecione uma categoria')
      return
    }

    createMutation.mutate(newProduct as any)
  }

  const handleUpdate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!editingProduct?.id) return

    if (!editProductImage && !editingProduct.image_url) {
      toast.error("O produto deve ter uma imagem.");
      return;
    }

    const formData = new FormData(e.currentTarget)
    const priceStr = formData.get('price') as string;
    const price = parseFloat(priceStr);

    if (isNaN(price) || price < 0) {
      toast.error("O preço deve ser um valor positivo.");
      return;
    }

    const updates = {
      id: editingProduct.id,
      name: formData.get('name') as string,
      description: formData.get('description') as string,
      price: price,
      category_id: formData.get('category_id') as string,
      image_url: editProductImage || editingProduct.image_url || '',
    }

    updateMutation.mutate(updates as any)
  }

  const filteredProducts = products?.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.category?.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Produtos</h1>
          <p className="text-slate-500 text-sm">Gerencie o catálogo da loja</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <Input 
              placeholder="Buscar produto..." 
              className="pl-10 w-full md:w-64 bg-white"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          
          <Dialog 
            open={isAddOpen} 
            onOpenChange={(open) => {
              setIsAddOpen(open);
              if (!open) setNewProductImage('');
            }}
          >
            <DialogTrigger asChild>
              <Button className="bg-pink-600 hover:bg-pink-700 text-white gap-2">
                <Plus size={18} />
                Novo Produto
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Adicionar Produto</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2 space-y-2">
                    <label className="text-sm font-medium">Nome do Produto</label>
                    <Input name="name" placeholder="Ex: Nome do produto" required />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Preço (R$)</label>
                    <Input name="price" type="number" step="0.01" placeholder="0.00" required />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Categoria</label>
                    <Select name="category_id" required>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories?.map(c => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Imagem do Produto</label>
                  <ImageUpload
                    value={newProductImage}
                    onChange={(url) => setNewProductImage(url || '')}
                    folder="products"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Descrição</label>
                  <Textarea name="description" placeholder="Detalhes do produto..." rows={3} />
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
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {isLoadingProducts ? (
          <div className="p-12 flex justify-center">
            <Loader2 className="animate-spin text-pink-600" size={32} />
          </div>
        ) : filteredProducts?.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            {search ? 'Nenhum produto encontrado para sua busca.' : 'Nenhum produto cadastrado.'}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[80px]">Foto</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Preço</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Destaque</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProducts?.map((product) => (
                <TableRow key={product.id}>
                  <TableCell>
                    {product.image_url ? (
                      <img 
                        src={product.image_url} 
                        alt={product.name}
                        className="w-12 h-12 rounded-lg object-cover border bg-slate-50"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'https://placehold.co/100x100?text=Erro';
                        }}
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 border">
                        <ImageIcon size={20} />
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="font-medium text-slate-700">{product.name}</div>
                    <div className="text-xs text-slate-500 truncate max-w-[200px]">{product.description || 'Sem descrição'}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-normal">
                      {product.category?.name || 'Sem Categoria'}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(product.price)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Switch 
                        checked={product.is_available}
                        onCheckedChange={(checked) => updateMutation.mutate({ id: product.id, is_available: checked })}
                      />
                      <span className="text-xs text-slate-500">
                        {product.is_available ? 'Ativo' : 'Inativo'}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <button 
                      onClick={() => updateMutation.mutate({ id: product.id, is_featured: !product.is_featured })}
                      className="text-slate-300 hover:text-yellow-400 transition-colors"
                    >
                      {product.is_featured ? (
                        <Star size={20} className="fill-yellow-400 text-yellow-400" />
                      ) : (
                        <StarOff size={20} />
                      )}
                    </button>
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    <Dialog open={editingProduct?.id === product.id} onOpenChange={(open) => !open && setEditingProduct(null)}>
                      <DialogTrigger asChild>
                        <Button variant="ghost" size="icon" onClick={() => {
                          setEditingProduct(product);
                          setEditProductImage('');
                        }}>
                          <Pencil size={16} className="text-slate-500" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-[500px]">
                        <DialogHeader>
                          <DialogTitle>Editar Produto</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleUpdate} className="space-y-4 py-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="col-span-2 space-y-2">
                              <label className="text-sm font-medium">Nome do Produto</label>
                              <Input name="name" defaultValue={product.name} required />
                            </div>
                            
                            <div className="space-y-2">
                              <label className="text-sm font-medium">Preço (R$)</label>
                              <Input name="price" type="number" step="0.01" defaultValue={product.price} required />
                            </div>
                            
                            <div className="space-y-2">
                              <label className="text-sm font-medium">Categoria</label>
                              <Select name="category_id" defaultValue={product.category_id}>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {categories?.map(c => (
                                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <label className="text-sm font-medium">Imagem do Produto</label>
                            <ImageUpload
                              value={editProductImage || product.image_url}
                              onChange={(url) => setEditProductImage(url || '')}
                              folder="products"
                            />
                          </div>

                          <div className="space-y-2">
                            <label className="text-sm font-medium">Descrição</label>
                            <Textarea name="description" defaultValue={product.description || ''} rows={3} />
                          </div>

                          <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setEditingProduct(null)}>Cancelar</Button>
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
                          <AlertDialogTitle>Excluir Produto?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Deseja realmente excluir "{product.name}"? Esta ação não pode ser desfeita.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction 
                            onClick={() => deleteMutation.mutate(product.id)}
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
