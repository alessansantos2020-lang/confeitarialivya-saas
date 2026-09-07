import type { LucideIcon } from "lucide-react";
import {
  CheckCircle,
  CheckCircle2,
  Clock,
  Loader2,
  Truck,
  XCircle,
} from "lucide-react";

export const ORDER_STATUS = [
  "pending",
  "confirmed",
  "preparing",
  "ready",
  "out_for_delivery",
  "delivered",
  "canceled",
] as const;

export type OrderStatus = (typeof ORDER_STATUS)[number];

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  pending: "Novo Pedido",
  confirmed: "Aceito",
  preparing: "Em Preparo",
  ready: "Pronto",
  out_for_delivery: "Saiu para Entrega",
  delivered: "Entregue",
  canceled: "Cancelado",
};

export type OrderStatusMeta = {
  label: string;
  color: string;
  icon: LucideIcon;
  nextLabel: string | null;
};

export const ORDER_STATUS_STYLE: Record<OrderStatus, OrderStatusMeta> = {
  pending: { label: "Novo Pedido", color: "bg-blue-500 text-white", icon: Clock, nextLabel: "Aceitar Pedido" },
  confirmed: { label: "Aceito", color: "bg-indigo-500 text-white", icon: CheckCircle2, nextLabel: "Iniciar Preparo" },
  preparing: { label: "Em Preparo", color: "bg-orange-500 text-white", icon: Loader2, nextLabel: "Pedido Pronto" },
  ready: { label: "Pronto", color: "bg-green-600 text-white", icon: CheckCircle2, nextLabel: "Sair para Entrega" },
  out_for_delivery: { label: "Saiu para Entrega", color: "bg-purple-600 text-white", icon: Truck, nextLabel: "Confirmar Entrega" },
  delivered: { label: "Entregue", color: "bg-green-700 text-white", icon: CheckCircle, nextLabel: null },
  canceled: { label: "Cancelado", color: "bg-red-500 text-white", icon: XCircle, nextLabel: null },
};

export const ORDER_STATUS_STYLE_DARK: Record<OrderStatus, string> = {
  pending: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  confirmed: "bg-indigo-500/15 text-indigo-300 border-indigo-500/30",
  preparing: "bg-orange-500/15 text-orange-300 border-orange-500/30",
  ready: "bg-green-500/15 text-green-300 border-green-500/30",
  out_for_delivery: "bg-purple-500/15 text-purple-300 border-purple-500/30",
  delivered: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  canceled: "bg-red-500/15 text-red-300 border-red-500/30",
};

const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  pending: "confirmed",
  confirmed: "preparing",
  preparing: "ready",
  ready: "out_for_delivery",
  out_for_delivery: "delivered",
};

const PREVIOUS_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  confirmed: "pending",
  preparing: "confirmed",
  ready: "preparing",
  out_for_delivery: "ready",
  delivered: "out_for_delivery",
  canceled: "pending",
};

export const nextStatus = (status: OrderStatus): OrderStatus | null =>
  NEXT_STATUS[status] ?? null;

export const previousStatus = (status: OrderStatus): OrderStatus | null =>
  PREVIOUS_STATUS[status] ?? null;

export const canCancel = (status: OrderStatus): boolean =>
  ["pending", "confirmed", "preparing", "ready", "out_for_delivery"].includes(status);

export const isActiveStatus = (status: OrderStatus): boolean =>
  ["pending", "confirmed", "preparing", "ready", "out_for_delivery"].includes(status);

export const PAYMENT_METHOD_LABEL: Record<string, string> = {
  pix: "PIX",
  card: "Cartão",
  cash: "Dinheiro",
};

export const paymentMethodLabel = (method: string | null | undefined): string =>
  PAYMENT_METHOD_LABEL[method || ""] || method || "Não informado";

export const isOrderStatus = (value: string | null | undefined): value is OrderStatus =>
  typeof value === "string" && (ORDER_STATUS as readonly string[]).includes(value);
