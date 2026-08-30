import { createFileRoute } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { 
  Trash2, 
  Loader2, 
  UserPlus, 
  Shield, 
  UserX,
  UserCheck,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  Users,
  Eye,
  EyeOff,
  Key
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
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
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { approveEmployee, rejectEmployee, createEmployee, deleteEmployee } from '@/lib/employees.functions';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute('/admin/employees')({
  component: EmployeesPage,
});

function EmployeesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  
  // Create Employee Form State
  const [newEmployee, setNewEmployee] = useState({
    fullName: '',
    email: '',
    password: '',
    role: 'employee' as 'admin' | 'employee',
    permissions: [] as string[]
  });
  const [showPassword, setShowPassword] = useState(false);

  // Subscribe to real-time changes
  useEffect(() => {
    const channel = supabase
      .channel('employees-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles' },
        () => {
          console.log("DEBUG: Realtime change detected in profiles");
          queryClient.invalidateQueries({ queryKey: ['employees'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Fetch Employees
  const { data: employees, isLoading, error: queryError } = useQuery({
    queryKey: ['employees'],
    queryFn: async () => {
      console.log("DEBUG: Fetching employees...");
      
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .neq('status', 'deleted')
        .order('created_at', { ascending: false });
      
      if (profilesError) {
        console.error("DEBUG: Profiles fetch error:", profilesError);
        throw profilesError;
      }

      console.log("DEBUG: Profiles found:", profiles?.length, profiles);

      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');

      if (rolesError) console.error("DEBUG: Error fetching roles:", rolesError);

      const merged = (profiles || []).map(profile => ({
        ...profile,
        user_roles: (roles || []).filter(r => r.user_id === profile.id)
      }));

      return merged;
    },
  });

  useEffect(() => {
    if (queryError) {
      console.error("DEBUG: employees query error:", queryError);
      toast.error("Erro ao carregar funcionários: " + (queryError as any).message);
    }
  }, [queryError]);

  const { data: permissions } = useQuery({
    queryKey: ['permissions'],
    queryFn: async () => {
      const { data, error } = await supabase.from('permissions').select('*');
      if (error) return [];
      return data;
    }
  });

  const { data: employeePermissions, refetch: refetchPerms } = useQuery({
    queryKey: ['employeePermissions', selectedEmployee?.id],
    enabled: !!selectedEmployee,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_permissions')
        .select('permission_id')
        .eq('user_id', selectedEmployee.id);
      if (error) throw error;
      return data.map(p => p.permission_id);
    }
  });

  const togglePermissionMutation = useMutation({
    mutationFn: async ({ employeeId, permissionId, hasIt }: any) => {
      if (hasIt) {
        const { error } = await supabase
          .from('user_permissions')
          .delete()
          .eq('user_id', employeeId)
          .eq('permission_id', permissionId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('user_permissions')
          .insert({ user_id: employeeId, permission_id: permissionId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      refetchPerms();
      toast.success('Permissão atualizada');
    }
  });

  const createEmployeeMutation = useMutation({
    mutationFn: (data: any) => createEmployee({ data }),
    onSuccess: (result: any) => {
      if (!result?.success) {
        toast.error(result?.error || 'Erro ao cadastrar funcionário');
        return;
      }
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      setIsCreateDialogOpen(false);
      setNewEmployee({ fullName: '', email: '', password: '', role: 'employee', permissions: [] });
      toast.success('Funcionário cadastrado com sucesso!');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erro ao cadastrar funcionário');
    }
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => approveEmployee({ data: { id } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      toast.success('Funcionário aprovado com sucesso!');
    },
    onError: (error) => {
      console.error(error);
      toast.error('Erro ao aprovar funcionário');
    }
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => rejectEmployee({ data: { id } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      toast.success('Funcionário recusado.');
    },
    onError: (error) => {
      console.error(error);
      toast.error('Erro ao processar solicitação');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteEmployee({ data: { id } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      toast.success('Funcionário removido definitivamente do sistema.');
    },
    onError: (error) => {
      console.error(error);
      toast.error('Erro ao remover funcionário');
    }
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: any) => {
      const { error } = await supabase
        .from('profiles')
        .update({ status })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      toast.success('Status atualizado');
    }
  });

  const filteredEmployees = employees?.filter((e: any) => 
    e.full_name?.toLowerCase().includes(search.toLowerCase())
  );

  const pendingEmployees = filteredEmployees?.filter((e: any) => e.status === 'pending');
  const activeEmployees = filteredEmployees?.filter((e: any) => e.status === 'active' || e.status === 'blocked');

  const EmployeeTable = ({ data }: { data: any[] }) => (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>Cadastro</TableHead>
            <TableHead>Função / Status</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="text-center py-8 text-slate-500">
                Nenhum funcionário encontrado.
              </TableCell>
            </TableRow>
          ) : (
            data.map((employee: any) => (
              <TableRow key={employee.id}>
                <TableCell className="font-medium">{employee.full_name || 'Sem nome'}</TableCell>
                <TableCell className="text-sm text-slate-500">
                  {employee.created_at ? format(new Date(employee.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR }) : '-'}
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1">
                    <Badge variant={employee.user_roles?.[0]?.role === 'admin' ? 'default' : 'secondary'} className="capitalize w-fit">
                      {employee.user_roles?.[0]?.role === 'admin' ? 'Administrador' : 'Funcionário'}
                    </Badge>
                    <Badge 
                      variant={
                        employee.status === 'active' ? 'outline' : 
                        employee.status === 'pending' ? 'secondary' : 'destructive'
                      }
                      className={cn("w-fit", employee.status === 'pending' ? 'bg-amber-100 text-amber-700 hover:bg-amber-100' : '')}
                    >
                      {employee.status === 'active' ? 'Ativo' : 
                       employee.status === 'pending' ? 'Pendente' : 'Bloqueado'}
                    </Badge>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  {employee.user_roles?.[0]?.role !== 'admin' && (
                    <div className="flex justify-end gap-1">
                      {employee.status === 'pending' ? (
                        <>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            className="text-green-600 hover:text-green-700 hover:bg-green-50 gap-1"
                            onClick={() => approveMutation.mutate(employee.id)}
                            disabled={approveMutation.isPending}
                          >
                            <CheckCircle2 size={16} />
                            Aprovar
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                className="text-red-600 hover:text-red-700 hover:bg-red-50 gap-1"
                              >
                                <Trash2 size={16} />
                                Remover
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Remover Funcionário?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Deseja realmente remover <strong>{employee.full_name}</strong> definitivamente? 
                                  Esta ação excluirá o cadastro do banco de dados e o acesso será revogado permanentemente.
                                  Para apenas suspender o acesso, use a opção de "Bloquear".
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction 
                                  onClick={() => deleteMutation.mutate(employee.id)}
                                  className="bg-red-600 hover:bg-red-700"
                                >
                                  Remover Definitivamente
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </>
                      ) : (
                        <>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="gap-2"
                            onClick={() => setSelectedEmployee(employee)}
                          >
                            <Shield size={16} />
                            Permissões
                          </Button>
                          
                          <Button 
                            variant="ghost" 
                            size="icon"
                            title={employee.status === 'active' ? 'Bloquear' : 'Ativar'}
                            onClick={() => updateStatusMutation.mutate({ 
                              id: employee.id, 
                              status: employee.status === 'active' ? 'blocked' : 'active'
                            })}
                          >
                            {employee.status === 'active' ? <UserX size={16} className="text-orange-500" /> : <UserCheck size={16} className="text-green-500" />}
                          </Button>

                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" title="Remover Definitivamente">
                                <Trash2 size={16} className="text-red-500" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Remover Funcionário?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Deseja realmente remover <strong>{employee.full_name}</strong> definitivamente? 
                                  Esta ação excluirá o cadastro do banco de dados e o acesso será revogado permanentemente.
                                  Para apenas suspender o acesso, use a opção de "Bloquear".
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction 
                                  onClick={() => deleteMutation.mutate(employee.id)}
                                  className="bg-red-600 hover:bg-red-700"
                                >
                                  Remover Definitivamente
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </>
                      )}
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Gerenciamento de Equipe</h1>
          <p className="text-slate-500 text-sm">Controle acesso e permissões dos funcionários.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <Input 
              placeholder="Buscar por nome..." 
              className="pl-10 w-full md:w-64 bg-white"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          
          <Button 
            className="bg-pink-600 hover:bg-pink-700 text-white gap-2" 
            onClick={() => setIsCreateDialogOpen(true)}
          >
            <UserPlus size={18} />
            Novo Funcionário
          </Button>
        </div>
      </div>

      <Tabs defaultValue="active" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-[400px]">
          <TabsTrigger value="active" className="gap-2">
            <Users size={16} />
            Equipe Ativa
          </TabsTrigger>
          <TabsTrigger value="pending" className="gap-2 relative">
            <Clock size={16} />
            Pendentes
            {pendingEmployees && pendingEmployees.length > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-pink-600 text-[10px] text-white">
                {pendingEmployees.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <div className="mt-6">
          {isLoading ? (
            <div className="p-12 flex justify-center">
              <Loader2 className="animate-spin text-pink-600" size={32} />
            </div>
          ) : (
            <>
              <TabsContent value="active" className="mt-0">
                <EmployeeTable data={activeEmployees || []} />
              </TabsContent>
              <TabsContent value="pending" className="mt-0">
                <EmployeeTable data={pendingEmployees || []} />
              </TabsContent>
            </>
          )}
        </div>
      </Tabs>

      {/* Create Employee Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Novo Funcionário</DialogTitle>
            <DialogDescription>Cadastre as credenciais de acesso para um novo membro da equipe.</DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] -mx-6 px-6">
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Nome Completo</Label>
                  <Input 
                    id="fullName" 
                    value={newEmployee.fullName} 
                    onChange={e => setNewEmployee({...newEmployee, fullName: e.target.value})}
                    placeholder="Ex: João Silva"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">E-mail (Login)</Label>
                  <Input 
                    id="email" 
                    type="email" 
                    value={newEmployee.email} 
                    onChange={e => setNewEmployee({...newEmployee, email: e.target.value})}
                    placeholder="email@confeitaria.com"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="password">Senha Inicial</Label>
                  <div className="relative">
                    <Input 
                      id="password" 
                      type={showPassword ? 'text' : 'password'}
                      value={newEmployee.password} 
                      onChange={e => setNewEmployee({...newEmployee, password: e.target.value})}
                      placeholder="Mínimo 6 caracteres"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Função</Label>
                  <Select 
                    value={newEmployee.role} 
                    onValueChange={(val: any) => setNewEmployee({...newEmployee, role: val})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a função" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="employee">Funcionário (Operacional)</SelectItem>
                      <SelectItem value="admin">Administrador (Gestão Total)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold">Permissões Iniciais</Label>
                  <Badge variant="outline" className="text-[10px] font-normal">Apenas para Funcionários</Badge>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {permissions?.map((p: any) => (
                    <div key={p.id} className="flex items-center space-x-2 border rounded-md p-2 hover:bg-slate-50 transition-colors">
                      <Checkbox 
                        id={`perm-new-${p.id}`}
                        checked={newEmployee.permissions.includes(p.id)}
                        disabled={newEmployee.role === 'admin'}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setNewEmployee({
                              ...newEmployee, 
                              permissions: [...newEmployee.permissions, p.id]
                            });
                          } else {
                            setNewEmployee({
                              ...newEmployee, 
                              permissions: newEmployee.permissions.filter(id => id !== p.id)
                            });
                          }
                        }}
                      />
                      <Label htmlFor={`perm-new-${p.id}`} className="text-sm cursor-pointer flex-1">
                        {p.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>Cancelar</Button>
            <Button 
              className="bg-pink-600 hover:bg-pink-700 text-white"
              onClick={() => createEmployeeMutation.mutate(newEmployee)}
              disabled={createEmployeeMutation.isPending}
            >
              {createEmployeeMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Cadastrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Permissions Dialog */}
      <Dialog open={!!selectedEmployee} onOpenChange={(open) => !open && setSelectedEmployee(null)}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-6 pb-0">
            <DialogTitle>Gerenciar Funcionário</DialogTitle>
            <DialogDescription>
              Configurações para <strong>{selectedEmployee?.full_name}</strong>.
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1 px-6 py-4">
            <div className="space-y-6">
              {/* Quick Info & Main Actions */}
              <div className="bg-slate-50 rounded-lg p-4 border border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex flex-col">
                  <span className="text-xs text-slate-500 uppercase font-semibold">Status Atual</span>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge 
                      variant={selectedEmployee?.status === 'active' ? 'outline' : 'destructive'}
                      className={cn(selectedEmployee?.status === 'active' ? 'bg-green-50 text-green-700 border-green-200' : '')}
                    >
                      {selectedEmployee?.status === 'active' ? 'Ativo' : 'Bloqueado'}
                    </Badge>
                    <Badge variant="secondary" className="capitalize">
                      {selectedEmployee?.user_roles?.[0]?.role === 'admin' ? 'Administrador' : 'Funcionário'}
                    </Badge>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    className={cn(
                      "gap-2",
                      selectedEmployee?.status === 'active' ? "text-orange-600 border-orange-200 hover:bg-orange-50" : "text-green-600 border-green-200 hover:bg-green-50"
                    )}
                    onClick={() => updateStatusMutation.mutate({ 
                      id: selectedEmployee.id, 
                      status: selectedEmployee.status === 'active' ? 'blocked' : 'active'
                    })}
                  >
                    {selectedEmployee?.status === 'active' ? <UserX size={16} /> : <UserCheck size={16} />}
                    {selectedEmployee?.status === 'active' ? 'Desativar' : 'Reativar'}
                  </Button>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="sm" className="text-red-600 border-red-200 hover:bg-red-50 gap-2">
                        <Trash2 size={16} />
                        Remover
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remover Funcionário?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Deseja realmente remover <strong>{selectedEmployee?.full_name}</strong> definitivamente? 
                          Esta ação excluirá o cadastro do banco de dados e o acesso será revogado permanentemente.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction 
                          onClick={() => {
                            deleteMutation.mutate(selectedEmployee.id);
                            setSelectedEmployee(null);
                          }}
                          className="bg-red-600 hover:bg-red-700"
                        >
                          Remover Definitivamente
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>

              <Separator />

              {/* Permissions Section */}
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    <Shield size={16} className="text-pink-600" />
                    Permissões de Acesso
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">Define quais módulos este funcionário pode visualizar e gerenciar.</p>
                </div>

                {selectedEmployee?.user_roles?.[0]?.role === 'admin' ? (
                  <div className="p-4 bg-amber-50 border border-amber-100 rounded-lg text-amber-800 text-sm flex items-start gap-3">
                    <Shield className="mt-0.5 shrink-0" size={18} />
                    <p>Administradores possuem acesso total a todos os módulos do sistema. Não é necessário configurar permissões individuais.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {permissions?.map((p: any) => {
                      const hasIt = employeePermissions?.includes(p.id);
                      return (
                        <div key={p.id} className="flex items-center justify-between p-3 rounded-lg border border-slate-100 bg-white hover:border-pink-200 transition-colors">
                          <div className="flex flex-col pr-2">
                            <span className="font-medium text-sm">{p.label}</span>
                            <span className="text-[10px] text-slate-500 line-clamp-1">{p.description || `Acesso ao módulo de ${p.name}`}</span>
                          </div>
                          <Checkbox 
                            checked={!!hasIt}
                            disabled={togglePermissionMutation.isPending}
                            onCheckedChange={() => togglePermissionMutation.mutate({
                              employeeId: selectedEmployee.id,
                              permissionId: p.id,
                              hasIt
                            })}
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </ScrollArea>
          
          <DialogFooter className="p-6 pt-2 border-t mt-auto">
            <Button className="w-full sm:w-auto bg-pink-600 hover:bg-pink-700 text-white" onClick={() => setSelectedEmployee(null)}>
              Salvar e Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}