import { createFileRoute } from '@tanstack/react-router';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useActiveStore } from '@/lib/active-store';
import { getDeliveryFees, createDeliveryFee, updateDeliveryFee, deleteDeliveryFee, type DeliveryFee } from '@/lib/delivery-fees.functions';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
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
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit2, Trash2, Loader2, AlertTriangle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute('/admin/delivery')({
  beforeLoad: () => {
    return;
  },
  component: DeliveryAdminPage,
});

function DeliveryAdminPage() {
  const { storeId } = useActiveStore();
  const { data: fees, isLoading } = useQuery({
    queryKey: ['deliveryFees', storeId],
    queryFn: () => getDeliveryFees(storeId),
  });
  const queryClient = useQueryClient();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingFee, setEditingFee] = useState<DeliveryFee | null>(null);
  const [formData, setFormData] = useState({ neighborhood: '', fee: '', status: 'active' as 'active' | 'inactive' });

  const createMutation = useMutation({
    mutationFn: (data: any) => createDeliveryFee({ ...data, store_id: storeId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deliveryFees', storeId] });
      setIsAddDialogOpen(false);
      setFormData({ neighborhood: '', fee: '', status: 'active' });
      toast.success("Taxa de entrega criada com sucesso!");
    },
    onError: (error) => toast.error("Erro ao criar taxa: " + error.message)
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => updateDeliveryFee({ ...data, store_id: storeId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deliveryFees', storeId] });
      setEditingFee(null);
      toast.success("Taxa de entrega atualizada!");
    },
    onError: (error) => toast.error("Erro ao atualizar taxa: " + error.message)
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteDeliveryFee({ id, store_id: storeId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deliveryFees', storeId] });
      toast.success("Taxa de entrega excluída!");
    },
    onError: (error) => toast.error("Erro ao excluir taxa: " + error.message)
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const fee = parseFloat(formData.fee);
    
    if (isNaN(fee) || fee < 0) {
      toast.error("A taxa de entrega deve ser um valor zero ou superior.");
      return;
    }

    const data = {
      neighborhood: formData.neighborhood,
      fee: fee,
      status: formData.status
    };

    if (editingFee) {
      updateMutation.mutate({ ...data, id: editingFee.id });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (fee: DeliveryFee) => {
    setEditingFee(fee);
    setFormData({ neighborhood: fee.neighborhood, fee: fee.fee.toString(), status: fee.status });
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  if (isLoading || !fees) {
    return (
      <div className="p-12 flex justify-center">
        <Loader2 className="animate-spin text-pink-600" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Taxas de Entrega</h1>
          <p className="text-slate-500">Gerencie os bairros atendidos e seus respectivos valores de frete.</p>
        </div>
        <Dialog open={isAddDialogOpen || !!editingFee} onOpenChange={(open) => {
          if (!open) {
            setIsAddDialogOpen(false);
            setEditingFee(null);
            setFormData({ neighborhood: '', fee: '', status: 'active' });
          }
        }}>
          <DialogTrigger asChild>
            <Button className="bg-pink-600 hover:bg-pink-700" onClick={() => setIsAddDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Novo Bairro
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingFee ? 'Editar Bairro' : 'Cadastrar Novo Bairro'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="neighborhood">Nome do Bairro</Label>
                <Input 
                  id="neighborhood" 
                  value={formData.neighborhood} 
                  onChange={(e) => setFormData({ ...formData, neighborhood: e.target.value })}
                  placeholder="Ex: Centro" 
                  required 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fee">Taxa de Entrega (R$)</Label>
                <Input 
                  id="fee" 
                  type="number" 
                  step="0.01"
                  value={formData.fee} 
                  onChange={(e) => setFormData({ ...formData, fee: e.target.value })}
                  placeholder="0,00" 
                  required 
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="status">Status Ativo</Label>
                <Switch 
                  id="status"
                  checked={formData.status === 'active'}
                  onCheckedChange={(checked) => setFormData({ ...formData, status: checked ? 'active' : 'inactive' })}
                />
              </div>
              <DialogFooter className="pt-4">
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Salvar
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Bairro</TableHead>
              <TableHead>Taxa</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {fees.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8 text-slate-500">
                  Nenhum bairro cadastrado.
                </TableCell>
              </TableRow>
            ) : (
              fees.map((fee) => (
                <TableRow key={fee.id}>
                  <TableCell className="font-medium">{fee.neighborhood}</TableCell>
                  <TableCell>{formatCurrency(fee.fee)}</TableCell>
                  <TableCell>
                    <Badge variant={fee.status === 'active' ? 'default' : 'secondary'}>
                      {fee.status === 'active' ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(fee)}>
                      <Edit2 className="w-4 h-4 text-slate-500" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle className="flex items-center gap-2">
                            <AlertTriangle className="w-5 h-5 text-red-500" />
                            Excluir Taxa?
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            Deseja realmente excluir a taxa de entrega para o bairro <strong>{fee.neighborhood}</strong>? 
                            Esta ação removerá a opção do checkout dos clientes.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction 
                            onClick={() => deleteMutation.mutate(fee.id)}
                            className="bg-red-600 hover:bg-red-700"
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
    </div>
  );
}
