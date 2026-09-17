import type { StoreSettings } from "./delivery.functions";
import {
  createWhatsAppAttempt,
  updateOrderNotificationStatus,
  updateWhatsAppAttempt,
  type OrderWithItems,
} from "./orders-admin.functions";
import { paymentMethodLabel } from "./order-status";
import { formatCurrencyBRL } from "./formatters";
import { orderItemsSummary } from "./order-utils";

export type NotifyEvent =
  "received" | "accepted" | "preparing" | "ready" | "shipping" | "delivered" | "canceled";

export type NotifySource = "manual" | "automatic";

export type NotifyResult =
  | { sent: true; message: string }
  | {
      sent: false;
      reason:
        | "disabled"
        | "missing_phone"
        | "invalid_phone"
        | "blocked_popup"
        | "duplicate"
        | "record_failed";
    };

const eventEnabled = (settings: StoreSettings, event: NotifyEvent): boolean => {
  if (event === "accepted") return settings.whatsapp_accept_enabled;
  if (event === "canceled") return settings.whatsapp_cancel_enabled;
  if (event === "shipping") return settings.whatsapp_shipping_enabled;
  return true;
};

const eventIsIdempotent = (event: NotifyEvent): event is "accepted" | "canceled" | "shipping" =>
  event === "accepted" || event === "canceled" || event === "shipping";

const money = formatCurrencyBRL;
const itemSummary = (order: OrderWithItems): string => orderItemsSummary(order.order_items);

const fallbackMessage = (
  order: OrderWithItems,
  settings: StoreSettings,
  event: NotifyEvent,
): string => {
  const name = order.customer_name || "cliente";
  const number = order.id.slice(0, 8).toUpperCase();
  const store = settings.name || "Loja";

  if (event === "received") {
    return `Olá, *${name}*! Seu pedido *#${number}* foi recebido pela *${store}*.\n\n🛍️ *Itens:*\n${itemSummary(order)}\n\n💰 *Total:* ${money(order.total_amount)}\n💳 *Pagamento:* ${paymentMethodLabel(order.payment_method, order.change_for, order.total_amount)}\n📍 *Endereço:* ${order.address}\n\nObrigado pela preferência!`;
  }
  if (event === "accepted") {
    return `🟢 PEDIDO ACEITO\n\nOlá, ${name}!\n\nSeu pedido #${number} foi aceito e já está sendo preparado.\n\n🧾 RESUMO DO PEDIDO:\n${itemSummary(order)}\n\n💰 Total: ${money(order.total_amount)}\n💳 Pagamento:* ${paymentMethodLabel(order.payment_method, order.change_for, order.total_amount)}\n\nObrigado pela preferência!`;
  }
  if (event === "canceled") {
    const reason = order.cancel_reason?.trim();
    return `🔴 PEDIDO CANCELADO\n\nOlá, ${name}.\n\nInfelizmente, seu pedido #${number} foi cancelado pelo estabelecimento.${reason ? `\n\nMotivo: ${reason}` : ""}\n\nPedimos desculpas pelo transtorno.`;
  }
  if (event === "shipping") {
    return `🛵 PEDIDO A CAMINHO\n\nOlá, ${name}!\n\nSeu pedido #${number} já saiu para entrega. 🛵\n\n🧾 Total: ${money(order.total_amount)}\n\nEm breve ele chegará até você.\n\nObrigado pela preferência!`;
  }
  const labels: Record<NotifyEvent, string> = {
    received: "foi recebido",
    accepted: "foi aceito",
    preparing: "está sendo preparado",
    ready: "está pronto",
    shipping: "saiu para entrega",
    delivered: "foi entregue",
    canceled: "foi cancelado",
  };
  return `Olá, *${name}*! Seu pedido *#${number}* ${labels[event]}.`;
};

const templateFor = (settings: StoreSettings, event: NotifyEvent): string | null => {
  if (event === "received") return settings.whatsapp_template_recebido;
  if (event === "accepted")
    return settings.whatsapp_template_aceito || settings.whatsapp_template_recebido;
  if (event === "canceled") return settings.whatsapp_template_cancelado;
  if (event === "shipping") return settings.whatsapp_template_saida_entrega;
  return null;
};

const buildMessage = (
  order: OrderWithItems,
  settings: StoreSettings,
  event: NotifyEvent,
): string => {
  const configured = templateFor(settings, event)?.trim();
  if (!configured) return fallbackMessage(order, settings, event);

  const replacements: Record<string, string> = {
    "{nome}": order.customer_name || "cliente",
    "{nome_cliente}": order.customer_name || "cliente",
    "{numero_pedido}": order.id.slice(0, 8).toUpperCase(),
    "{itens}": itemSummary(order),
    "{total}": money(order.total_amount),
    "{pagamento}": paymentMethodLabel(order.payment_method, order.change_for, order.total_amount),
    "{forma_pagamento}": paymentMethodLabel(
      order.payment_method,
      order.change_for,
      order.total_amount,
    ),
    "{endereco}": order.address || "Não informado",
    "{loja}": settings.name || "Loja",
    "{nome_estabelecimento}": settings.name || "Loja",
    "{motivo_cancelamento}": order.cancel_reason?.trim() || "",
  };

  return Object.entries(replacements).reduce(
    (message, [placeholder, value]) => message.replaceAll(placeholder, value),
    configured,
  );
};

const errorReason = (error: unknown): string =>
  error instanceof Error ? error.message : "Falha desconhecida ao registrar WhatsApp.";

export const notifyOrderWhatsApp = async (
  order: OrderWithItems,
  settings: StoreSettings,
  event: NotifyEvent,
  source: NotifySource,
  storeId: string,
): Promise<NotifyResult> => {
  if (source === "automatic" && !settings.auto_notify_whatsapp)
    return { sent: false, reason: "disabled" };
  if (!eventEnabled(settings, event)) return { sent: false, reason: "disabled" };

  const phone = (order.customer_phone || "").replace(/\D/g, "");
  if (!order.customer_phone) return { sent: false, reason: "missing_phone" };
  if (phone.length < 10) return { sent: false, reason: "invalid_phone" };

  const message = buildMessage(order, settings, event);
  let attemptId: string | null = null;
  const popup = window.open("about:blank", "_blank");

  if (eventIsIdempotent(event)) {
    try {
      const attempt = await createWhatsAppAttempt({
        orderId: order.id,
        event,
        phone,
        message,
        storeId,
      });
      if (!attempt) {
        popup?.close();
        return { sent: false, reason: "duplicate" };
      }
      attemptId = attempt.id;
    } catch (error) {
      popup?.close();
      console.error("Falha ao registrar tentativa de WhatsApp:", error);
      return { sent: false, reason: "record_failed" };
    }
  }

  if (!popup) {
    if (attemptId) {
      await updateWhatsAppAttempt({
        id: attemptId,
        status: "failed",
        error: "Popup bloqueado pelo navegador.",
        storeId,
      }).catch((error) => console.error("Falha ao registrar falha de WhatsApp:", error));
    }
    return { sent: false, reason: "blocked_popup" };
  }

  popup.location.href = `https://wa.me/55${phone}?text=${encodeURIComponent(message)}`;

  if (attemptId) {
    await updateWhatsAppAttempt({ id: attemptId, status: "opened", storeId }).catch((error) =>
      console.error("Falha ao atualizar tentativa de WhatsApp:", error),
    );
  }

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
  if (result.reason === "duplicate") return "Esta mensagem já foi aberta para este pedido.";
  if (result.reason === "record_failed") return "Não foi possível registrar tentativa de WhatsApp.";
  if (result.reason === "missing_phone")
    return "Cliente não possui telefone cadastrado para WhatsApp.";
  if (result.reason === "invalid_phone") return "Telefone do cliente é inválido para WhatsApp.";
  return "Permita pop-ups para abrir o WhatsApp.";
};

export const buildOrderWhatsAppMessage = (
  order: OrderWithItems,
  settings: StoreSettings,
  event: NotifyEvent,
): string => buildMessage(order, settings, event);

export const validateWhatsAppTemplate = (template: string): string[] => {
  const allowed = new Set([
    "nome",
    "nome_cliente",
    "numero_pedido",
    "itens",
    "total",
    "pagamento",
    "forma_pagamento",
    "endereco",
    "loja",
    "nome_estabelecimento",
    "motivo_cancelamento",
  ]);
  const found = template.match(/\\{([a-z_]+)\\}/gi) || [];
  return [...new Set(found.map((value) => value.slice(1, -1).toLowerCase()))].filter(
    (name) => !allowed.has(name),
  );
};
