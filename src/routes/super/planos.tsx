import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getAllPlans,
  getAllFeatures,
  createPlan,
  updatePlan,
  setPlanActive,
  deletePlan,
  type PlanOverview,
  type Feature,
  type BillingPeriod,
  type PlanInput,
} from "@/lib/super-admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, Loader2, MoreHorizontal, Pencil, Trash2, Package, Lock } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/super/planos")({
  component: SuperPlansPage,
});

const BILLING_LABEL: Record<BillingPeriod, string> = {
  monthly: "Mensal",
  quarterly: "Trimestral",
  yearly: "Anual",
};

function money(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

type FormState = {
  name: string;
  description: string;
  priceReais: string;
  billingPeriod: BillingPeriod;
  featureIds: Set<string>;
};

const emptyForm = (features: Feature[]): FormState => ({
  name: "",
  description: "",
  priceReais: "",
  billingPeriod: "monthly",
  // Funcionalidades essenciais já vêm marcadas (não dá pra desligar).
  featureIds: new Set(features.filter((f) => f.is_core).map((f) => f.id)),
});

function SuperPlansPage() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<PlanOverview | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PlanOverview | null>(null);
  const [form, setForm] = useState<FormState | null>(null);

  const { data: plans, isLoading } = useQuery({
    queryKey: ["super-plans"],
    queryFn: getAllPlans,
  });

  const { data: features } = useQuery({
    queryKey: ["super-features"],
    queryFn: getAllFeatures,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["super-plans"] });

  const saveMutation = useMutation({
    mutationFn: async (payload: { id: string | null; input: PlanInput }) => {
      if (payload.id) {
        await updatePlan(payload.id, payload.input);
        return;
      }

      await createPlan(payload.input);
    },
    onSuccess: () => {
      invalidate();
      setIsFormOpen(false);
      setEditing(null);
      setForm(null);
      toast.success("Plano salvo!");
    },
    onError: (error: unknown) =>
      toast.error(error instanceof Error ? error.message : "Falha ao salvar plano."),
  });

  const activeMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      setPlanActive(id, isActive),
    onSuccess: () => {
      invalidate();
      toast.success("Status do plano atualizado!");
    },
    onError: (error: unknown) =>
      toast.error(error instanceof Error ? error.message : "Falha ao salvar plano."),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deletePlan(id),
    onSuccess: () => {
      invalidate();
      setDeleteTarget(null);
      toast.success("Plano excluído!");
    },
    onError: (error: unknown) =>
      toast.error(error instanceof Error ? error.message : "Falha ao salvar plano."),
  });

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm(features || []));
    setIsFormOpen(true);
  };

  const openEdit = (plan: PlanOverview) => {
    setEditing(plan);
    setForm({
      name: plan.name,
      description: plan.description || "",
      priceReais: (plan.price_cents / 100).toFixed(2).replace(".", ","),
      billingPeriod: plan.billing_period,
      featureIds: new Set(plan.featureIds),
    });
    setIsFormOpen(true);
  };

  const toggleFeature = (id: string) => {
    setForm((prev) => {
      if (!prev) return prev;
      const next = new Set(prev.featureIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { ...prev, featureIds: next };
    });
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form || !form.name.trim()) return;

    const priceCents = Math.round(parseFloat(form.priceReais.replace(",", ".") || "0") * 100);
    if (isNaN(priceCents) || priceCents < 0) {
      toast.error("Preço inválido.");
      return;
    }

    // Garante que os essenciais entrem mesmo se algo escapou da UI.
    const coreIds = (features || []).filter((f) => f.is_core).map((f) => f.id);
    const featureIds = Array.from(new Set([...form.featureIds, ...coreIds]));

    saveMutation.mutate({
      id: editing?.id ?? null,
      input: {
        name: form.name,
        description: form.description || null,
        priceCents,
        billingPeriod: form.billingPeriod,
        featureIds,
      },
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Planos e Funcionalidades</h1>
          <p className="text-slate-400 text-sm">
            Defina os planos e o que cada um libera para as lojas
          </p>
        </div>
        <Button className="bg-pink-600 hover:bg-pink-700 text-white gap-2" onClick={openCreate}>
          <Plus size={18} />
          Novo Plano
        </Button>
      </div>

      <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
        {isLoading ? (
          <div className="p-12 flex justify-center">
            <Loader2 className="animate-spin text-pink-500" size={32} />
          </div>
        ) : !plans || plans.length === 0 ? (
          <div className="p-12 text-center text-slate-400 space-y-3">
            <Package className="w-10 h-10 mx-auto text-slate-600" />
            <p>Nenhum plano cadastrado ainda.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-slate-800 hover:bg-transparent">
                <TableHead className="text-slate-400">Plano</TableHead>
                <TableHead className="text-slate-400">Preço</TableHead>
                <TableHead className="text-slate-400">Lojas</TableHead>
                <TableHead className="text-slate-400">Recursos</TableHead>
                <TableHead className="text-slate-400">Status</TableHead>
                <TableHead className="text-right text-slate-400">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plans.map((plan) => (
                <TableRow key={plan.id} className="border-slate-800">
                  <TableCell className="font-medium text-white">
                    {plan.name}
                    {plan.description && (
                      <span className="block text-xs text-slate-500 max-w-xs truncate">
                        {plan.description}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-slate-300 text-sm">
                    {money(plan.price_cents)}
                    <span className="block text-xs text-slate-500">
                      {BILLING_LABEL[plan.billing_period]}
                    </span>
                  </TableCell>
                  <TableCell className="text-slate-300 text-sm">{plan.storeCount}</TableCell>
                  <TableCell className="text-slate-300 text-sm">{plan.featureIds.length}</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        plan.is_active
                          ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                          : "bg-slate-500/15 text-slate-400 border-slate-500/30"
                      }
                    >
                      {plan.is_active ? "Ativo" : "Inativo"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="hover:bg-slate-800">
                          <MoreHorizontal size={16} className="text-slate-400" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(plan)}>
                          <Pencil size={14} className="mr-2" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() =>
                            activeMutation.mutate({ id: plan.id, isActive: !plan.is_active })
                          }
                        >
                          {plan.is_active ? "Desativar" : "Ativar"}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-red-500"
                          disabled={plan.storeCount > 0}
                          onClick={() => setDeleteTarget(plan)}
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

      {/* Criar / editar plano */}
      <Dialog
        open={isFormOpen}
        onOpenChange={(open) => {
          setIsFormOpen(open);
          if (!open) {
            setEditing(null);
            setForm(null);
          }
        }}
      >
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar plano" : "Novo plano"}</DialogTitle>
            <DialogDescription>
              Marque as funcionalidades que este plano libera. As essenciais são obrigatórias.
            </DialogDescription>
          </DialogHeader>
          {form && (
            <form onSubmit={handleSave} className="space-y-4 py-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Nome</label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Ex: Profissional"
                  autoFocus
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Descrição</label>
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Resumo do que o plano oferece"
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Preço (R$)</label>
                  <Input
                    value={form.priceReais}
                    onChange={(e) => setForm({ ...form, priceReais: e.target.value })}
                    placeholder="99,90"
                    inputMode="decimal"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Periodicidade</label>
                  <Select
                    value={form.billingPeriod}
                    onValueChange={(v) => setForm({ ...form, billingPeriod: v as BillingPeriod })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Mensal</SelectItem>
                      <SelectItem value="quarterly">Trimestral</SelectItem>
                      <SelectItem value="yearly">Anual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Funcionalidades</label>
                <div className="space-y-1 rounded-lg border border-slate-800 p-2">
                  {(features || []).map((f) => (
                    <label
                      key={f.id}
                      className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-slate-800/50 cursor-pointer"
                    >
                      <Checkbox
                        checked={f.is_core || form.featureIds.has(f.id)}
                        disabled={f.is_core}
                        onCheckedChange={() => !f.is_core && toggleFeature(f.id)}
                      />
                      <div className="flex-1">
                        <div className="text-sm text-slate-200 flex items-center gap-2">
                          {f.name}
                          {f.is_core && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-amber-400">
                              <Lock size={10} /> essencial
                            </span>
                          )}
                        </div>
                        {f.description && (
                          <div className="text-xs text-slate-500">{f.description}</div>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={saveMutation.isPending || !form.name.trim()}>
                  {saveMutation.isPending ? <Loader2 className="animate-spin" /> : "Salvar plano"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Excluir plano */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir plano "{deleteTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Só é possível excluir planos sem lojas vinculadas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            >
              {deleteMutation.isPending ? <Loader2 className="animate-spin" /> : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
