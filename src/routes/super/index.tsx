import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
} from "@/lib/super-admin.functions";
import { startSupportSession } from "@/lib/support-session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Loader2, Search, Store as StoreIcon } from "lucide-react";
import { toast } from "sonner";
import { StoresTable } from "@/components/super/stores-table";
import { StoreDialogs } from "@/components/super/store-dialogs";
import { STATUS_LABEL } from "@/components/super/types";

export const Route = createFileRoute("/super/")({ component: SuperStoresPage });

function SuperStoresPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [ownerTarget, setOwnerTarget] = useState<StoreOverview | null>(null);
  const [selectedOwnerId, setSelectedOwnerId] = useState("");
  const [renameTarget, setRenameTarget] = useState<StoreOverview | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [planTarget, setPlanTarget] = useState<StoreOverview | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [detailsTarget, setDetailsTarget] = useState<StoreOverview | null>(null);
  const [supportTarget, setSupportTarget] = useState<StoreOverview | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StoreStatus | "all">("all");
  const [planFilter, setPlanFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"created_desc" | "created_asc" | "name">("created_desc");
  const { data: stores, isLoading } = useQuery({
    queryKey: ["super-stores"],
    queryFn: getAllStores,
  });
  const { data: plans } = useQuery({ queryKey: ["super-plans"], queryFn: getAllPlans });
  const { data: details, isLoading: isDetailsLoading } = useQuery({
    queryKey: ["super-store-details", detailsTarget?.id],
    queryFn: () => getStoreDetails(detailsTarget!.id),
    enabled: !!detailsTarget,
  });
  const { data: users } = useQuery({
    queryKey: ["super-assignable-users"],
    queryFn: getAssignableUsers,
    enabled: !!ownerTarget,
  });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["super-stores"] });
  const error = (e: unknown) => toast.error(e instanceof Error ? e.message : String(e));
  const createMutation = useMutation({
    mutationFn: createStore,
    onSuccess: (store) => {
      invalidate();
      setIsCreateOpen(false);
      setNewName("");
      setNewSlug("");
      setSlugTouched(false);
      toast.success(`Loja "${store.name}" criada!`);
    },
    onError: error,
  });
  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: StoreStatus }) =>
      updateStoreStatus(id, status),
    onSuccess: () => {
      invalidate();
      toast.success("Status atualizado!");
    },
    onError: error,
  });
  const renameMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => renameStore(id, name),
    onSuccess: () => {
      invalidate();
      setRenameTarget(null);
      toast.success("Nome atualizado!");
    },
    onError: error,
  });
  const ownerMutation = useMutation({
    mutationFn: ({ storeId, userId }: { storeId: string; userId: string }) =>
      assignStoreOwner(storeId, userId),
    onSuccess: () => {
      invalidate();
      setOwnerTarget(null);
      setSelectedOwnerId("");
      toast.success("Dono vinculado à loja!");
    },
    onError: error,
  });
  const planMutation = useMutation({
    mutationFn: ({ storeId, planId }: { storeId: string; planId: string | null }) =>
      setStorePlan(storeId, planId),
    onSuccess: () => {
      invalidate();
      setPlanTarget(null);
      setSelectedPlanId("");
      toast.success("Plano da loja atualizado!");
    },
    onError: error,
  });
  const supportMutation = useMutation({
    mutationFn: (store: StoreOverview) => startSupportSession(store.id, store.name),
    onSuccess: () => {
      setSupportTarget(null);
      navigate({ to: "/admin" });
    },
    onError: error,
  });
  const effectiveSlug = slugify(slugTouched ? newSlug : newName);
  const visibleStores = (stores || [])
    .filter((s) => {
      if (statusFilter !== "all" && s.status !== statusFilter) return false;
      if (planFilter === "none" && s.planId) return false;
      if (planFilter !== "all" && planFilter !== "none" && s.planId !== planFilter) return false;
      const q = search.trim().toLowerCase();
      return (
        !q ||
        s.name.toLowerCase().includes(q) ||
        s.slug.toLowerCase().includes(q) ||
        (s.ownerName || "").toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name, "pt-BR");
      const at = a.created_at ? new Date(a.created_at).getTime() : 0;
      const bt = b.created_at ? new Date(b.created_at).getTime() : 0;
      return sortBy === "created_asc" ? at - bt : bt - at;
    });
  const onCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (newName.trim())
      createMutation.mutate({ name: newName, slug: slugTouched ? newSlug : newName });
  };
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Lojas</h1>
          <p className="text-slate-400 text-sm">Cadastre e gerencie as lojas que usam o sistema</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="bg-pink-600 hover:bg-pink-700 text-white gap-2">
              <Plus size={18} />
              Nova Loja
            </Button>
          </DialogTrigger>
        </Dialog>
      </div>
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
        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as StoreStatus | "all")}
        >
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
          <StoresTable
            stores={visibleStores}
            statusMutation={statusMutation}
            onDetails={setDetailsTarget}
            onRename={(s) => {
              setRenameTarget(s);
              setRenameValue(s.name);
            }}
            onOwner={(s) => {
              setOwnerTarget(s);
              setSelectedOwnerId(s.owner_id || "");
            }}
            onPlan={(s) => {
              setPlanTarget(s);
              setSelectedPlanId(s.planId || "none");
            }}
            onSupport={setSupportTarget}
          />
        )}
      </div>
      <StoreDialogs
        isCreateOpen={isCreateOpen}
        setIsCreateOpen={setIsCreateOpen}
        newName={newName}
        setNewName={setNewName}
        newSlug={newSlug}
        setNewSlug={setNewSlug}
        slugTouched={slugTouched}
        setSlugTouched={setSlugTouched}
        effectiveSlug={effectiveSlug}
        onCreate={onCreate}
        createMutation={createMutation}
        renameTarget={renameTarget}
        setRenameTarget={setRenameTarget}
        renameValue={renameValue}
        setRenameValue={setRenameValue}
        renameMutation={renameMutation}
        onRename={() =>
          renameTarget && renameMutation.mutate({ id: renameTarget.id, name: renameValue })
        }
        ownerTarget={ownerTarget}
        setOwnerTarget={setOwnerTarget}
        selectedOwnerId={selectedOwnerId}
        setSelectedOwnerId={setSelectedOwnerId}
        users={users}
        ownerMutation={ownerMutation}
        onOwner={() =>
          ownerTarget &&
          selectedOwnerId &&
          ownerMutation.mutate({ storeId: ownerTarget.id, userId: selectedOwnerId })
        }
        planTarget={planTarget}
        setPlanTarget={setPlanTarget}
        selectedPlanId={selectedPlanId}
        setSelectedPlanId={setSelectedPlanId}
        plans={plans}
        planMutation={planMutation}
        onPlan={() =>
          planTarget &&
          selectedPlanId &&
          planMutation.mutate({
            storeId: planTarget.id,
            planId: selectedPlanId === "none" ? null : selectedPlanId,
          })
        }
        supportTarget={supportTarget}
        setSupportTarget={setSupportTarget}
        supportMutation={supportMutation}
        onSupport={() => supportTarget && supportMutation.mutate(supportTarget)}
      />
      <Dialog open={!!detailsTarget} onOpenChange={(open) => !open && setDetailsTarget(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{detailsTarget?.name}</DialogTitle>
            <DialogDescription>Dados gerais da loja</DialogDescription>
          </DialogHeader>
          {detailsTarget && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <DetailRow label="Proprietário" value={detailsTarget.ownerName || "sem dono"} />
                <DetailRow label="Plano" value={detailsTarget.planName || "sem plano"} />
                <DetailRow label="Endereço no site" value={`/${detailsTarget.slug}`} mono />
                <DetailRow label="Status" value={STATUS_LABEL[detailsTarget.status]} />
                <DetailRow
                  label="Criada em"
                  value={
                    detailsTarget.created_at && !isNaN(new Date(detailsTarget.created_at).getTime())
                      ? new Date(detailsTarget.created_at).toLocaleDateString("pt-BR")
                      : "—"
                  }
                />
                <DetailRow label="Telefone" value={details?.phone || "—"} />
                <DetailRow label="WhatsApp" value={details?.whatsapp || "—"} />
                <DetailRow label="Endereço" value={details?.address || "—"} />
              </div>
              <div className="grid grid-cols-4 gap-3 pt-2 border-t border-slate-800">
                {isDetailsLoading ? (
                  <div className="col-span-4 flex justify-center py-4">
                    <Loader2 className="animate-spin text-pink-500" size={20} />
                  </div>
                ) : (
                  <>
                    {[
                      ["Usuários", details?.userCount ?? 0],
                      ["Pedidos", details?.orderCount ?? 0],
                      ["Clientes", details?.customerCount ?? 0],
                      ["Produtos", details?.productCount ?? 0],
                    ].map(([label, value]) => (
                      <MetricBox key={label} label={String(label)} value={Number(value)} />
                    ))}
                  </>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-xs text-slate-500">{label}</div>
      <div className={mono ? "font-mono text-slate-200" : "text-slate-200"}>{value}</div>
    </div>
  );
}
function MetricBox({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center">
      <div className="text-2xl font-bold text-white">{value}</div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  );
}
