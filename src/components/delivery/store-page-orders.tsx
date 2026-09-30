import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Loader2, Package, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getCustomerSession,
  onCustomerAuthChange,
  type CustomerSession,
} from "@/lib/customer-auth.functions";
import { getMyOrders, type CustomerOrder } from "@/lib/customer-account.functions";

const ORDER_STATUS_LABEL: Record<string, string> = {
  pending: "Aguardando confirmação",
  confirmed: "Confirmado",
  preparing: "Em preparo",
  ready: "Pronto",
  out_for_delivery: "Saiu para entrega",
  delivered: "Entregue",
  canceled: "Cancelado",
};

type OrdersFilter = "all" | "active" | "delivered" | "canceled";

export function StorePageOrders({
  open,
  storeId,
  formatCurrency,
  onClose,
  onLogin,
}: {
  open: boolean;
  storeId: string;
  formatCurrency: (value: number) => string;
  onClose: () => void;
  onLogin: () => void;
}) {
  const [session, setSession] = useState<CustomerSession | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [orders, setOrders] = useState<CustomerOrder[] | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<OrdersFilter>("all");
  const [selectedOrder, setSelectedOrder] = useState<CustomerOrder | null>(null);
  const [historyMarker, setHistoryMarker] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let mounted = true;
    const unsubscribe = onCustomerAuthChange((value) => {
      if (!mounted) return;
      setSession(value);
      setAuthReady(true);
    });
    void getCustomerSession().then((value) => {
      if (!mounted) return;
      setSession(value);
      setAuthReady(true);
    });
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [open]);

  const userId = session?.userId;

  useEffect(() => {
    if (!open || !userId) {
      setOrders(null);
      return;
    }
    let mounted = true;
    setOrders(null);
    setError("");
    void getMyOrders(storeId)
      .then((result) => {
        if (mounted) setOrders(result);
      })
      .catch((cause: Error) => {
        if (mounted) setError(cause.message);
      });
    return () => {
      mounted = false;
    };
  }, [open, userId, storeId]);

  const filteredOrders = useMemo(
    () =>
      (orders ?? []).filter((order) => {
        if (filter === "active") return !["delivered", "canceled"].includes(order.status);
        if (filter === "delivered") return order.status === "delivered";
        if (filter === "canceled") return order.status === "canceled";
        return true;
      }),
    [filter, orders],
  );

  useEffect(() => {
    if (!open) return;
    const marker = `orders-${Math.random().toString(36).slice(2)}`;
    setHistoryMarker(marker);
    window.history.pushState({ ...(window.history.state ?? {}), storeOrdersView: marker }, "");
    return () => {
      const currentState = window.history.state;
      if (currentState?.storeOrdersView === marker) {
        const {
          storeOrdersView: _ordersView,
          storeOrderDetail: _orderDetail,
          ...rest
        } = currentState;
        window.history.replaceState(rest, "");
      }
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handlePopState = (event: PopStateEvent) => {
      const state = event.state as { storeOrdersView?: string; storeOrderDetail?: boolean } | null;
      if (state?.storeOrdersView === historyMarker) {
        setSelectedOrder(null);
      } else {
        setSelectedOrder(null);
        onClose();
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [historyMarker, onClose, open]);

  const closeOrBack = () => {
    if (selectedOrder) {
      if (window.history.state?.storeOrderDetail) window.history.back();
      else setSelectedOrder(null);
    } else if (window.history.state?.storeOrdersView === historyMarker) {
      window.history.back();
    } else {
      onClose();
    }
  };

  const selectOrder = (order: CustomerOrder) => {
    window.history.pushState(
      { ...(window.history.state ?? {}), storeOrdersView: historyMarker, storeOrderDetail: true },
      "",
    );
    setSelectedOrder(order);
  };

  if (!open) return null;

  return (
    <section
      className="fixed inset-0 z-[60] flex flex-col bg-white pt-[env(safe-area-inset-top)] pb-16 md:pb-0 animate-in slide-in-from-right-2 duration-200"
      role="dialog"
      aria-modal="true"
      aria-label={selectedOrder ? "Detalhes do pedido" : "Pedidos"}
    >
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-slate-100 px-4">
        <button
          type="button"
          onClick={closeOrBack}
          aria-label="Voltar"
          className="flex h-10 w-10 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="flex-1 truncate text-lg font-black text-slate-900">
          {selectedOrder ? `Pedido #${selectedOrder.id.slice(0, 8).toUpperCase()}` : "Meus pedidos"}
        </h1>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[env(safe-area-inset-bottom)]">
        {!selectedOrder && !authReady ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
          </div>
        ) : !selectedOrder && !session ? (
          <div className="mx-auto flex max-w-sm flex-col items-center gap-4 px-6 py-14 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
              <ShoppingBag className="h-7 w-7 text-slate-400" />
            </div>
            <div>
              <p className="font-bold text-slate-900">Entre para ver seus pedidos</p>
              <p className="mt-1 text-sm text-slate-500">
                Os pedidos realizados enquanto você estiver conectado aparecerão aqui.
              </p>
            </div>
            <Button className="h-11 w-full font-bold" onClick={onLogin}>
              Entrar ou criar conta
            </Button>
          </div>
        ) : selectedOrder ? (
          <div className="mx-auto w-full max-w-xl space-y-3 p-4">
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="font-bold text-slate-900">
                {ORDER_STATUS_LABEL[selectedOrder.status] ?? selectedOrder.status}
              </p>
              {selectedOrder.created_at && (
                <p className="mt-1 text-sm text-slate-500">
                  {new Date(selectedOrder.created_at).toLocaleString("pt-BR")}
                </p>
              )}
            </div>
            <div className="divide-y divide-slate-100 rounded-2xl border border-slate-100 px-4">
              {(selectedOrder.order_items ?? []).map((item) => (
                <div key={item.id} className="flex justify-between gap-3 py-3 text-sm">
                  <span>
                    {item.quantity}× {item.product_name}
                  </span>
                </div>
              ))}
            </div>
            <div className="flex justify-between rounded-2xl bg-slate-50 p-4 font-black">
              <span>Total</span>
              <span className="text-[var(--primary-color)]">
                {formatCurrency(selectedOrder.total_amount)}
              </span>
            </div>
          </div>
        ) : error ? (
          <p className="mx-auto max-w-xl px-5 py-10 text-center text-sm text-slate-500">{error}</p>
        ) : orders === null ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
          </div>
        ) : orders.length === 0 ? (
          <div className="mx-auto flex max-w-sm flex-col items-center gap-3 px-6 py-14 text-center">
            <Package className="h-8 w-8 text-slate-300" />
            <p className="text-sm text-slate-500">
              Você ainda não fez pedidos nesta loja com esta conta.
            </p>
          </div>
        ) : (
          <div className="mx-auto w-full max-w-2xl space-y-3 p-4">
            <div className="flex gap-2 overflow-x-auto pb-1">
              {(
                [
                  ["all", "Todos"],
                  ["active", "Em andamento"],
                  ["delivered", "Concluídos"],
                  ["canceled", "Cancelados"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setFilter(value)}
                  className={
                    "min-h-10 shrink-0 rounded-full px-3 text-xs font-bold " +
                    (filter === value
                      ? "bg-[var(--primary-color)] text-white"
                      : "bg-slate-100 text-slate-600")
                  }
                >
                  {label}
                </button>
              ))}
            </div>
            {filteredOrders.length === 0 ? (
              <p className="py-10 text-center text-sm text-slate-500">
                Nenhum pedido nesta categoria.
              </p>
            ) : (
              filteredOrders.map((order) => (
                <button
                  key={order.id}
                  type="button"
                  onClick={() => selectOrder(order)}
                  className="w-full rounded-2xl border border-slate-100 p-4 text-left shadow-sm transition-colors hover:bg-slate-50"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-bold text-slate-500">
                      #{order.id.slice(0, 8).toUpperCase()}
                    </span>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black text-slate-600">
                      {ORDER_STATUS_LABEL[order.status] ?? order.status}
                    </span>
                  </div>
                  {order.created_at && (
                    <p className="mt-1 text-xs text-slate-400">
                      {new Date(order.created_at).toLocaleString("pt-BR")}
                    </p>
                  )}
                  <p className="mt-2 line-clamp-2 text-sm text-slate-600">
                    {order.order_items
                      ?.map((item) => `${item.quantity}× ${item.product_name}`)
                      .join(", ")}
                  </p>
                  <p className="mt-2 text-base font-black text-slate-900">
                    {formatCurrency(order.total_amount)}
                  </p>
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </section>
  );
}
