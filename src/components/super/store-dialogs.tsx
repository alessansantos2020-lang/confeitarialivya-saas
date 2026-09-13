import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import type { StoreOverview, AssignableUser, PlanOverview } from "./types";

type Mutation = { isPending: boolean };

type StoreDialogsProps = {
  isCreateOpen: boolean;
  setIsCreateOpen: (v: boolean) => void;
  newName: string;
  setNewName: (v: string) => void;
  newSlug: string;
  setNewSlug: (v: string) => void;
  slugTouched: boolean;
  setSlugTouched: (v: boolean) => void;
  effectiveSlug: string;
  onCreate: (e: React.FormEvent) => void;
  createMutation: Mutation;
  renameTarget: StoreOverview | null;
  setRenameTarget: (v: StoreOverview | null) => void;
  renameValue: string;
  setRenameValue: (v: string) => void;
  renameMutation: Mutation;
  onRename: () => void;
  ownerTarget: StoreOverview | null;
  setOwnerTarget: (v: StoreOverview | null) => void;
  selectedOwnerId: string;
  setSelectedOwnerId: (v: string) => void;
  users: AssignableUser[] | undefined;
  ownerMutation: Mutation;
  onOwner: () => void;
  planTarget: StoreOverview | null;
  setPlanTarget: (v: StoreOverview | null) => void;
  selectedPlanId: string;
  setSelectedPlanId: (v: string) => void;
  plans: PlanOverview[] | undefined;
  planMutation: Mutation;
  onPlan: () => void;
  supportTarget: StoreOverview | null;
  setSupportTarget: (v: StoreOverview | null) => void;
  supportMutation: Mutation;
  onSupport: () => void;
};

export function StoreDialogs(p: StoreDialogsProps) {
  return (
    <>
      <Dialog
        open={p.isCreateOpen}
        onOpenChange={(open) => {
          p.setIsCreateOpen(open);
          if (!open) {
            p.setNewName("");
            p.setNewSlug("");
            p.setSlugTouched(false);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criar nova loja</DialogTitle>
            <DialogDescription>
              A loja já nasce com configurações padrão e pode receber um dono depois.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={p.onCreate} className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Nome da loja</label>
              <Input
                value={p.newName}
                onChange={(e) => p.setNewName(e.target.value)}
                placeholder="Ex: Mercado do Bairro"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Endereço no site</label>
              <Input
                value={p.slugTouched ? p.newSlug : p.effectiveSlug}
                onChange={(e) => {
                  p.setSlugTouched(true);
                  p.setNewSlug(e.target.value);
                }}
                placeholder="mercado-do-bairro"
              />
              <p className="text-xs text-slate-500">
                A loja pública ficará em{" "}
                <span className="font-mono">/{p.effectiveSlug || "..."}</span>
              </p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => p.setIsCreateOpen(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={p.createMutation.isPending || !p.newName.trim() || !p.effectiveSlug}
              >
                {p.createMutation.isPending ? <Loader2 className="animate-spin" /> : "Criar loja"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!p.renameTarget}
        onOpenChange={(open) => {
          if (!open) p.setRenameTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Renomear loja</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (p.renameValue.trim()) p.onRename();
            }}
            className="space-y-4 py-2"
          >
            <Input
              value={p.renameValue}
              onChange={(e) => p.setRenameValue(e.target.value)}
              autoFocus
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => p.setRenameTarget(null)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={p.renameMutation.isPending || !p.renameValue.trim()}>
                {p.renameMutation.isPending ? <Loader2 className="animate-spin" /> : "Salvar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!p.ownerTarget}
        onOpenChange={(open) => {
          if (!open) {
            p.setOwnerTarget(null);
            p.setSelectedOwnerId("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Definir dono da loja</DialogTitle>
            <DialogDescription>
              O usuário escolhido vira administrador de <b>{p.ownerTarget?.name}</b> e passa a ter
              acesso ao painel dessa loja.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <Select value={p.selectedOwnerId} onValueChange={p.setSelectedOwnerId}>
              <SelectTrigger>
                <SelectValue placeholder="Escolha um usuário" />
              </SelectTrigger>
              <SelectContent>
                {(p.users || []).map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.full_name || u.id}
                    {u.status && u.status !== "active" ? ` (${u.status})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  p.setOwnerTarget(null);
                  p.setSelectedOwnerId("");
                }}
              >
                Cancelar
              </Button>
              <Button
                disabled={p.ownerMutation.isPending || !p.selectedOwnerId}
                onClick={p.onOwner}
              >
                {p.ownerMutation.isPending ? <Loader2 className="animate-spin" /> : "Vincular dono"}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!p.planTarget}
        onOpenChange={(open) => {
          if (!open) {
            p.setPlanTarget(null);
            p.setSelectedPlanId("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Definir plano da loja</DialogTitle>
            <DialogDescription>
              Escolha o plano de <b>{p.planTarget?.name}</b>. Trocar o plano nunca apaga dados — só
              muda o que a loja consegue acessar. Sem plano = acesso a tudo.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <Select value={p.selectedPlanId} onValueChange={p.setSelectedPlanId}>
              <SelectTrigger>
                <SelectValue placeholder="Escolha um plano" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem plano (acesso total)</SelectItem>
                {(p.plans || [])
                  .filter((x) => x.is_active)
                  .map((x) => (
                    <SelectItem key={x.id} value={x.id}>
                      {x.name} — {x.featureIds.length} recursos
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  p.setPlanTarget(null);
                  p.setSelectedPlanId("");
                }}
              >
                Cancelar
              </Button>
              <Button disabled={p.planMutation.isPending || !p.selectedPlanId} onClick={p.onPlan}>
                {p.planMutation.isPending ? <Loader2 className="animate-spin" /> : "Salvar plano"}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={!!p.supportTarget} onOpenChange={(open) => !open && p.setSupportTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Acessar como suporte</DialogTitle>
            <DialogDescription>
              Você vai entrar no painel de <b>{p.supportTarget?.name}</b> usando sua própria conta
              de Super Admin — sem senha do dono, sem credencial nova. O painel vai mostrar um aviso
              de que você está em modo suporte, com botão para voltar. Esse acesso fica registrado
              no log de auditoria.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => p.setSupportTarget(null)}>
              Cancelar
            </Button>
            <Button disabled={p.supportMutation.isPending} onClick={p.onSupport}>
              {p.supportMutation.isPending ? (
                <Loader2 className="animate-spin" />
              ) : (
                "Entrar no painel"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
