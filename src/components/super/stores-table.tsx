import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ExternalLink,
  Eye,
  LifeBuoy,
  MoreHorizontal,
  Package,
  Pencil,
  UserPlus,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { StoreOverview, StoreStatus } from "./types";
import { STATUS_CLASS, STATUS_LABEL } from "./types";

type StoresTableProps = {
  stores: StoreOverview[];
  statusMutation: { mutate: (value: { id: string; status: StoreStatus }) => void };
  onDetails: (store: StoreOverview) => void;
  onRename: (store: StoreOverview) => void;
  onOwner: (store: StoreOverview) => void;
  onPlan: (store: StoreOverview) => void;
  onSupport: (store: StoreOverview) => void;
};

export function StoresTable({
  stores,
  statusMutation,
  onDetails,
  onRename,
  onOwner,
  onPlan,
  onSupport,
}: StoresTableProps) {
  return (
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
        {stores.map((store) => (
          <TableRow key={store.id} className="border-slate-800">
            <TableCell className="font-medium text-white">
              {store.name}
              {store.settingsName && store.settingsName !== store.name && (
                <span className="block text-xs text-slate-500">catálogo: {store.settingsName}</span>
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
                ? format(new Date(store.created_at), "dd/MM/yyyy", { locale: ptBR })
                : "—"}
            </TableCell>
            <TableCell className="text-right">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="hover:bg-slate-800">
                    <MoreHorizontal size={16} className="text-slate-400" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onDetails(store)}>
                    <Eye size={14} className="mr-2" />
                    Visualizar
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onRename(store)}>
                    <Pencil size={14} className="mr-2" />
                    Renomear
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onOwner(store)}>
                    <UserPlus size={14} className="mr-2" />
                    Definir dono
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onPlan(store)}>
                    <Package size={14} className="mr-2" />
                    Definir plano
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onSupport(store)}>
                    <LifeBuoy size={14} className="mr-2" />
                    Acessar como suporte
                  </DropdownMenuItem>
                  {store.status !== "active" && (
                    <DropdownMenuItem
                      onClick={() => statusMutation.mutate({ id: store.id, status: "active" })}
                    >
                      Ativar loja
                    </DropdownMenuItem>
                  )}
                  {store.status !== "suspended" && (
                    <DropdownMenuItem
                      className="text-red-500"
                      onClick={() => statusMutation.mutate({ id: store.id, status: "suspended" })}
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
  );
}
