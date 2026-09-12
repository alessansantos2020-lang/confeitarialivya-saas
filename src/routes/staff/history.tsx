import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getOrders, updateOrderStatus, type OrderWithItems } from "@/lib/orders-admin.functions";
import { useActiveStore } from "@/lib/active-store";
import { getStoreSettings } from "@/lib/delivery.functions";
import {
  ORDER_STATUS_LABEL,
  ORDER_STATUS_STYLE,
  previousStatus,
  paymentMethodLabel,
  type OrderStatus,
} from "@/lib/order-status";
import { printOrder } from "@/lib/order-print";
import { logAudit } from "@/lib/audit.functions";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  History,
  Search,
  Eye,
  MapPin,
  Calendar,
  RotateCcw,
  Printer,
  AlertTriangle,
  RefreshCw,
  ArrowLeft,
  Phone,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";

export const Route = createFileRoute("/staff/history")({
  component: StaffHistoryPage,
});

function StaffHistoryPage() {
  const { store, storeId } = useActiveStore();
  const [searchTerm, setSearchTerm] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const queryClient = useQueryClient();

  const { data: storeSettings } = useQuery({
    queryKey: ["store-settings", storeId],
    queryFn: () => getStoreSettings(storeId),
  });

  const {
    data: orders,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["staff-history", storeId, startDate, endDate],
    queryFn: () =>
      getOrders({
        statuses: ["delivered", "canceled"],
        storeId,
        dateFrom: startDate || undefined,
        dateTo: endDate || undefined,
        limit: 150,
      }),
  });

  const undoMutation = useMutation({
    mutationFn: async ({
      order,
      prevStatus,
    }: {
      order: OrderWithItems;
      prevStatus: OrderStatus;
    }) => {
      const updated = await updateOrderStatus({
        id: order.id,
        status: prevStatus,
        storeId,
        expectedStatus: order.status,
      });

      if (order.status === "canceled") {
        await logAudit({
          action: "order_reopened",
          module: "pedidos",
          storeId,
          description: `Pedido #${order.id.slice(0, 8).toUpperCase()} reaberto do histórico para ${ORDER_STATUS_LABEL[prevStatus]}.`,
        });
      } else {
        await logAudit({
          action: "order_status_changed",
          module: "pedidos",
          storeId,
          description: `Pedido #${order.id.slice(0, 8).toUpperCase()} desfeito no histórico para ${ORDER_STATUS_LABEL[prevStatus]}.`,
        });
      }

      return updated;
    },
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["staff-history", storeId] });
      queryClient.invalidateQueries({ queryKey: ["staff-orders", storeId] });
      queryClient.invalidateQueries({ queryKey: ["salesReport"] });
      queryClient.invalidateQueries({ queryKey: ["admin-orders", storeId] });

      toast.success(
        `Pedido #${updated.id.slice(0, 8).toUpperCase()} alterado para ${ORDER_STATUS_LABEL[updated.status]}!`,
      );
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : "Erro ao desfazer status.");
    },
  });

  const historyOrders = (orders || []).filter((order) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      order.customer_name?.toLowerCase().includes(term) ||
      order.id.toLowerCase().includes(term) ||
      (order.customer_phone && order.customer_phone.includes(term))
    );
  });

  const clearFilters = () => {
    setSearchTerm("");
    setStartDate("");
    setEndDate("");
  };

  const handlePrint = (order: OrderWithItems) => {
    const storeName = storeSettings?.name || store?.name || "Loja";
    const ok = printOrder(order, storeName);
    if (!ok) {
      toast.error("Não foi possível abrir a impressão. Verifique bloqueador de pop-ups.");
    }
  };

  const handleUndo = (order: OrderWithItems) => {
    const prev = previousStatus(order.status);
    if (!prev) return;
    undoMutation.mutate({ order, prevStatus: prev });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            Histórico de Pedidos
            <History className="w-6 h-6 text-slate-400" />
          </h2>
          <p className="text-slate-500 text-sm">
            Consulte pedidos finalizados e cancelados da loja.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link to="/staff">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs text-slate-700">
              <ArrowLeft className="w-3.5 h-3.5" />
              Voltar aos pedidos
            </Button>
          </Link>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="gap-1.5 text-xs text-slate-700"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Buscar no histórico por cliente, telefone ou pedido..."
            className="pl-10 h-12 bg-white border-slate-200"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex flex-col sm:flex-row sm:items-end gap-3 rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex-1 space-y-1.5">
            <label htmlFor="history-start-date" className="text-xs font-semibold text-slate-600">
              Data inicial
            </label>
            <Input
              id="history-start-date"
              type="date"
              value={startDate}
              max={endDate || undefined}
              onChange={(e) => setStartDate(e.target.value)}
              className="h-10"
            />
          </div>
          <div className="flex-1 space-y-1.5">
            <label htmlFor="history-end-date" className="text-xs font-semibold text-slate-600">
              Data final
            </label>
            <Input
              id="history-end-date"
              type="date"
              value={endDate}
              min={startDate || undefined}
              onChange={(e) => setEndDate(e.target.value)}
              className="h-10"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={clearFilters}
            disabled={!searchTerm && !startDate && !endDate}
            className="h-10 gap-1.5 text-slate-700"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Limpar filtros
          </Button>
        </div>
      </div>

      {isError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center justify-between text-red-800">
          <div className="flex items-center gap-2 text-sm font-medium">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <span>
              Erro ao carregar histórico: {(error as Error)?.message || "Erro desconhecido."}
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            className="border-red-300 text-red-700 hover:bg-red-100"
          >
            Tentar novamente
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading ? (
          Array(6)
            .fill(0)
            .map((_, i) => <div key={i} className="h-48 bg-slate-100 animate-pulse rounded-xl" />)
        ) : historyOrders.length === 0 ? (
          <div className="col-span-full py-20 text-center text-slate-500 bg-white rounded-xl border border-dashed border-slate-200">
            <History className="w-12 h-12 mx-auto mb-4 text-slate-200" />
            <p>Nenhum pedido finalizado encontrado.</p>
          </div>
        ) : (
          historyOrders.map((order) => (
            <HistoryCard
              key={order.id}
              order={order}
              onPrint={handlePrint}
              onUndo={handleUndo}
              isUndoing={undoMutation.isPending && undoMutation.variables?.order.id === order.id}
            />
          ))
        )}
      </div>
    </div>
  );
}

function HistoryCard({
  order,
  onPrint,
  onUndo,
  isUndoing,
}: {
  order: OrderWithItems;
  onPrint: (order: OrderWithItems) => void;
  onUndo: (order: OrderWithItems) => void;
  isUndoing: boolean;
}) {
  const statusMeta = ORDER_STATUS_STYLE[order.status];
  const prev = previousStatus(order.status);

  return (
    <Card className="overflow-hidden border border-slate-200 hover:shadow-md transition-all">
      <div className="bg-slate-50 p-2 px-3 flex justify-between items-center border-b border-slate-200">
        <span className="font-mono font-bold text-xs">#{order.id.slice(0, 8).toUpperCase()}</span>
        <span className="text-[10px] text-slate-500 font-medium">
          {order.created_at
            ? format(new Date(order.created_at), "dd/MM/yy HH:mm", { locale: ptBR })
            : ""}
        </span>
      </div>
      <CardContent className="p-4 space-y-3">
        <div className="flex justify-between items-start">
          <div>
            <h3
              className="font-bold text-slate-900 truncate max-w-[170px]"
              title={order.customer_name}
            >
              {order.customer_name}
            </h3>
            <div className="text-[11px] font-bold text-pink-600 mt-0.5">
              {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
                order.total_amount || 0,
              )}
            </div>
          </div>
          <Badge className={`${statusMeta.color} text-[9px] uppercase font-bold shrink-0`}>
            {statusMeta.label}
          </Badge>
        </div>

        <div className="flex items-center gap-1.5 pt-1">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="flex-1 h-8 text-[11px] gap-1.5">
                <Eye className="w-3.5 h-3.5" /> Detalhes
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <div className="flex items-center justify-between">
                  <DialogTitle>Pedido #{order.id.slice(0, 8).toUpperCase()}</DialogTitle>
                  <Badge className={`${statusMeta.color} text-[9px] uppercase font-bold`}>
                    {statusMeta.label}
                  </Badge>
                </div>
              </DialogHeader>
              <div className="space-y-4 py-3 text-sm">
                <div className="bg-slate-50 p-3 rounded-lg space-y-1.5 text-xs">
                  <p>
                    <strong>Status:</strong>{" "}
                    <span className="uppercase font-bold">{statusMeta.label}</span>
                  </p>
                  <p>
                    <strong>Data:</strong>{" "}
                    {order.created_at
                      ? format(new Date(order.created_at), "dd/MM/yyyy 'às' HH:mm", {
                          locale: ptBR,
                        })
                      : ""}
                  </p>
                  <p>
                    <strong>Cliente:</strong> {order.customer_name}
                  </p>
                  <p>
                    <strong>Telefone:</strong> {order.customer_phone || "Não informado"}
                  </p>
                  <p>
                    <strong>Endereço:</strong> {order.address || "Não informado"}
                  </p>
                  <p>
                    <strong>Pagamento:</strong> {paymentMethodLabel(order.payment_method)}
                  </p>
                </div>

                <div className="space-y-2">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-slate-500 border-b pb-1">
                    Itens do Pedido
                  </h4>
                  {order.order_items?.map((item) => (
                    <div key={item.id} className="flex justify-between text-xs">
                      <span>
                        {item.quantity}x {item.product_name || item.product?.name || "Produto"}
                      </span>
                      <span className="font-medium">
                        {new Intl.NumberFormat("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                        }).format(Number(item.price_at_time) * item.quantity)}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="flex justify-between font-bold border-t pt-2 text-sm">
                  <span>Total</span>
                  <span className="text-pink-600">
                    {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
                      order.total_amount || 0,
                    )}
                  </span>
                </div>

                <div className="pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full gap-1.5 text-xs"
                    onClick={() => onPrint(order)}
                  >
                    <Printer className="w-3.5 h-3.5" /> Imprimir Comanda
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Button
            variant="outline"
            size="sm"
            className="h-8 px-2 text-slate-600 hover:text-slate-900"
            title="Imprimir comanda"
            onClick={() => onPrint(order)}
          >
            <Printer className="w-3.5 h-3.5" />
          </Button>

          {prev && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 px-2 text-amber-600 hover:text-amber-700 hover:bg-amber-50 gap-1 text-[11px]"
              title={
                order.status === "canceled"
                  ? "Reabrir pedido para Novo"
                  : `Desfazer para ${ORDER_STATUS_LABEL[prev]}`
              }
              onClick={() => onUndo(order)}
              disabled={isUndoing}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Desfazer</span>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
