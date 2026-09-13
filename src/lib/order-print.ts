import type { OrderWithItems } from "./orders-admin.functions";
import { paymentMethodLabel } from "./order-status";
import { formatCurrencyBRL } from "./formatters";
import { parseSelectedAddons } from "./order-utils";

const escapeHtml = (value: unknown): string =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const money = formatCurrencyBRL;

export const printOrder = (order: OrderWithItems, storeName: string): boolean => {
  const printWindow = window.open("", "_blank", "noopener,noreferrer");
  if (!printWindow) return false;

  const items = order.order_items
    .map((item) => {
      const name = item.product_name || item.product?.name || "Produto";
      const addons = parseSelectedAddons(item.selected_addons)
        .map((addon) => addon.name)
        .filter(Boolean)
        .map((name) => `<div class="addon">+ ${escapeHtml(name)}</div>`)
        .join("");
      const observation = item.observation
        ? `<div class="obs">Obs: ${escapeHtml(item.observation)}</div>`
        : "";

      return `<div class="item-block">
      <div class="item"><span class="item-qty">${item.quantity}x</span><span class="item-name">${escapeHtml(name)}</span><span>${money(Number(item.price_at_time) * item.quantity)}</span></div>
      ${addons}${observation}
    </div>`;
    })
    .join("");

  const address = [
    order.street,
    order.number,
    order.complement,
    order.neighborhood,
    order.reference ? `Ref.: ${order.reference}` : null,
  ]
    .filter(Boolean)
    .map(escapeHtml)
    .join(", ");

  const html = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><title>Pedido #${escapeHtml(order.id.slice(0, 8).toUpperCase())}</title>
<style>
* { box-sizing: border-box; }
body { font-family: Arial, sans-serif; padding: 20px; line-height: 1.4; color: #333; max-width: 680px; margin: 0 auto; }
.header { text-align: center; border-bottom: 2px dashed #ccc; padding-bottom: 10px; margin-bottom: 20px; }
.header h1 { margin: 0 0 6px; font-size: 22px; }
.order-info { margin-bottom: 20px; font-size: 14px; }
.section-title { font-weight: bold; text-transform: uppercase; font-size: 12px; margin-top: 15px; border-bottom: 1px solid #eee; padding-bottom: 5px; }
.item-block { margin-bottom: 12px; }
.item { display: flex; gap: 8px; justify-content: space-between; margin-bottom: 4px; border-bottom: 1px dotted #eee; padding-bottom: 5px; }
.item-qty { font-weight: bold; }
.item-name { flex: 1; font-weight: bold; }
.addon { font-size: 11px; margin-left: 25px; color: #666; font-style: italic; }
.obs { background: #f9f9f9; padding: 8px; font-size: 12px; margin-top: 5px; border-left: 3px solid #1d4ed8; }
.total-section { margin-top: 20px; border-top: 2px solid #333; padding-top: 10px; }
.total-row { display: flex; justify-content: space-between; margin-bottom: 5px; }
.final-total { font-size: 20px; font-weight: 900; margin-top: 10px; text-align: right; }
@media print { .no-print { display: none; } }
</style></head><body>
<div class="header"><h1>${escapeHtml(storeName)}</h1><p>Pedido #${escapeHtml(order.id.slice(0, 8).toUpperCase())}</p><p>${escapeHtml(new Date(order.created_at || Date.now()).toLocaleString("pt-BR"))}</p></div>
<div class="order-info"><strong>Cliente:</strong> ${escapeHtml(order.customer_name)}<br><strong>Telefone:</strong> ${escapeHtml(order.customer_phone)}<br><strong>Endereço:</strong> ${address || escapeHtml(order.address)}${order.observation ? `<br><strong>Observação:</strong> ${escapeHtml(order.observation)}` : ""}</div>
<div class="section-title">Itens do pedido</div>${items || "<p>Nenhum item informado.</p>"}
<div class="total-section"><div class="total-row"><span>Subtotal dos produtos:</span><span>${money(order.total_amount - Number(order.delivery_fee || 0))}</span></div><div class="total-row"><span>Frete:</span><span>${money(order.delivery_fee)}</span></div><div class="total-row"><span>Pagamento:</span><span>${escapeHtml(paymentMethodLabel(order.payment_method))}</span></div><div class="final-total">TOTAL: ${money(order.total_amount)}</div></div>
<script>window.onload = function () { window.print(); window.close(); };</script></body></html>`;

  printWindow.document.write(html);
  printWindow.document.close();
  return true;
};
