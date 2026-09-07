import type { StoreSettings } from "./delivery.functions";
import { updateOrderNotificationStatus, type OrderWithItems } from "./orders-admin.functions";
import { paymentMethodLabel } from "./order-status";

export type NotifyEvent =
  | "received"
  | "accepted"
  | "preparing"
  | "ready"
  | "shipping"
  | "delivered";

export type NotifySource = "manual" | "automatic";

export type NotifyResult =
  | { sent: true; message: string }
  | { sent: false; reason: "disabled" | "missing_phone" | "invalid_phone" | "blocked_popup" };

const money = (value: number | null | undefined): string =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value || 0));

const parseAddons = (value: unknown): Array<{ name?: string; price?: number }> => {
  if (!value) return [];
  if (typeof value !== "string") return Array.isArray(value) ? value as Array<{ name?: string; price?: number }> : [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed as Array<{ name?: string; price?: number }> : [];
  } catch {
    return [];
  }
};

const itemSummary = (order: OrderWithItems): string =>
  order.order_items.map((item) => {
    const name = item.product_name || item.product?.name || "Produto";
    const addons = parseAddons(item.selected_addons)
      .map((addon) => addon.name)
      .filter(Boolean)
      .join(", ");
    return `${item.quantity}x ${name}${addons ? ` (${addons})` : ""}`;
  }).join("\n");

const fallbackMessage = (order: OrderWithItems, settings: StoreSettings, event: NotifyEvent): string => {
  const name = order.customer_name || "cliente";
  const number = order.id.slice(0, 8).toUpperCase();
  const store = settings.name || "Loja";

  if (event === "received" || event === "accepted") {
    return `Olá, *${name}*! Seu pedido *#${number}* foi recebido pela *${store}*.\n\n🛍️ *Itens:*\n${itemSummary(order)}\n\n💰 *Total:* ${money(order.total_amount)}\n💳 *Pagamento:* ${paymentMethodLabel(order.payment_method)}\n📍 *Endereço:* ${order.address}\n\nObrigado pela preferência!`;
  }
  if (event === "shipping") {
    return `Olá, *${name}*! Seu pedido *#${number}* da *${store}* saiu para entrega! 🛵💨`;
  }
  const labels: Record<NotifyEvent, string> = {
    received: "foi recebido",
    accepted: "foi aceito",
    preparing: "está sendo preparado",
    ready: "está pronto",
    shipping: "saiu para entrega",
    delivered: "foi entregue",
  };
  return `Olá, *${name}*! Seu pedido *#${number}* ${labels[event]}.`;
};

const templateFor = (settings: StoreSettings, event: NotifyEvent): string | null => {
  if (event === "received" || event === "accepted") return settings.whatsapp_template_recebido;
  if (event === "shipping") return settings.whatsapp_template_saida_entrega;
  return null;
};

const buildMessage = (order: OrderWithItems, settings: StoreSettings, event: NotifyEvent): string => {
  const configured = templateFor(settings, event)?.trim();
  if (!configured) return fallbackMessage(order, settings, event);

  const replacements: Record<string, string> = {
    "{nome}": order.customer_name || "cliente",
    "{numero_pedido}": order.id.slice(0, 8).toUpperCase(),
    "{itens}": itemSummary(order),
    "{total}": money(order.total_amount),
    "{pagamento}": paymentMethodLabel(order.payment_method),
    "{endereco}": order.address || "Não informado",
    "{loja}": settings.name || "Loja",
  };

  return Object.entries(replacements).reduce(
    (message, [placeholder, value]) => message.replaceAll(placeholder, value),
    configured,
  );
};

export const notifyOrderWhatsApp = async (
  order: OrderWithItems,
  settings: StoreSettings,
  event: NotifyEvent,
  source: NotifySource,
  storeId: string,
): Promise<NotifyResult> => {
  if (source === "automatic" && !settings.auto_notify_whatsapp) return { sent: false, reason: "disabled" };

  const phone = (order.customer_phone || "").replace(/\D/g, "");
  if (!order.customer_phone) return { sent: false, reason: "missing_phone" };
  if (phone.length < 10) return { sent: false, reason: "invalid_phone" };

  const message = buildMessage(order, settings, event);
  const popup = window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(message)}`, "_blank");
  if (!popup) return { sent: false, reason: "blocked_popup" };

  try {
    await updateOrderNotificationStatus({ id: order.id, notified: true, storeId });
  } catch (error) {
    console.error("Falha ao marcar pedido como avisado:", error);
  }

  return { sent: true, message };
};

export const notifyResultMessage = (result: NotifyResult): string | null => {
  if (result.sent) return "WhatsApp aberto.";
  if (result.reason === "disabled") return null;
  if (result.reason === "missing_phone") return "Cliente não possui telefone cadastrado para WhatsApp.";
  if (result.reason === "invalid_phone") return "Telefone do cliente é inválido para WhatsApp.";
  return "Permita pop-ups para abrir o WhatsApp.";
};
