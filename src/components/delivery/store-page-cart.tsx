/* eslint-disable @typescript-eslint/no-explicit-any */
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  Loader2,
  AlertCircle,
  ArrowLeft,
  Minus,
  Plus,
  Trash2,
  X,
  ShoppingBag,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import type { StoreSettings } from "@/lib/delivery.functions";

export function StorePageCart({
  items,
  removeItem,
  updateQuantity,
  getSubtotal,
  getDeliveryFee,
  getTotal,
  formatCurrency,
  onClose,
  checkoutStep,
  setCheckoutStep,
  orderInfo,
  setOrderInfo,
  onSubmit,
  isSubmitting,
  deliveryFees = [],
  settings,
  lastCreatedOrder,
  isHydrated,
}: any) {
  const handleSendWhatsApp = () => {
    if (!lastCreatedOrder || !settings.whatsapp) return;

    const itemsText = (lastCreatedOrder.order_items || [])
      .map((item: any) => {
        const addons = item.selected_addons || item.addons || [];
        const addonsText =
          addons.length > 0
            ? `\n   + Adicionais: ${addons.map((a: any) => a.name).join(", ")}`
            : "";
        const obsText = item.observation ? `\n   + Obs: ${item.observation}` : "";
        const prodName = item.product_name || item.products?.name || "Produto";
        const formattedPrice = new Intl.NumberFormat("pt-BR", {
          style: "currency",
          currency: "BRL",
        }).format(item.price_at_time * item.quantity);
        return `* ${item.quantity}x ${prodName} - ${formattedPrice}${addonsText}${obsText}`;
      })
      .join("\n");

    const orderId = lastCreatedOrder.id.split("-")[0].toUpperCase();
    const deliveryFeeFormatted = new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(lastCreatedOrder.delivery_fee);
    const totalAmountFormatted = new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(lastCreatedOrder.total_amount);
    let paymentMethod = lastCreatedOrder.payment_method.toUpperCase();
    if (lastCreatedOrder.payment_method === "money") {
      paymentMethod = "DINHEIRO";
      if (
        lastCreatedOrder.change_for &&
        lastCreatedOrder.change_for > lastCreatedOrder.total_amount
      ) {
        const diff = lastCreatedOrder.change_for - lastCreatedOrder.total_amount;
        const changeForFormatted = new Intl.NumberFormat("pt-BR", {
          style: "currency",
          currency: "BRL",
        }).format(lastCreatedOrder.change_for);
        const diffFormatted = new Intl.NumberFormat("pt-BR", {
          style: "currency",
          currency: "BRL",
        }).format(diff);
        paymentMethod += ` (Troco para ${changeForFormatted} - Levar ${diffFormatted})`;
      } else if (lastCreatedOrder.change_for) {
        const changeForFormatted = new Intl.NumberFormat("pt-BR", {
          style: "currency",
          currency: "BRL",
        }).format(lastCreatedOrder.change_for);
        paymentMethod += ` (Troco para ${changeForFormatted})`;
      } else {
        paymentMethod += " (Não precisa de troco)";
      }
    }
    const observations = lastCreatedOrder.observation
      ? `\n*Observações:* ${lastCreatedOrder.observation}`
      : "";

    const message = `*PEDIDO #${orderId}*
    
*Cliente:* ${lastCreatedOrder.customer_name}
*Telefone:* ${lastCreatedOrder.customer_phone}

*Produtos:*
${itemsText}

*Taxa de Entrega:* ${deliveryFeeFormatted}
*TOTAL DO PEDIDO:* ${totalAmountFormatted}

*Endereço:* ${lastCreatedOrder.address}
*Pagamento:* ${paymentMethod}${observations}

_Pedido realizado via Delivery Online._`;

    const encodedMessage = encodeURIComponent(message);
    const cleanWhatsapp = settings.whatsapp.replace(/\D/g, "");
    const whatsappUrl = `https://wa.me/55${cleanWhatsapp}?text=${encodedMessage}`;
    window.open(whatsappUrl, "_blank");
  };

  if (checkoutStep === "success") {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
        <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mb-6">
          <CheckCircle2 className="w-10 h-10 text-green-500" />
        </div>
        <h3 className="text-2xl font-bold text-slate-900">Pedido Confirmado!</h3>
        <p className="text-slate-500 mt-2 mb-8">
          Recebemos seu pedido com sucesso. Em breve iniciaremos o preparo!
        </p>

        {lastCreatedOrder && (
          <div className="w-full rounded-2xl bg-slate-50 border border-slate-200/80 p-4 text-left text-xs space-y-2 mb-6">
            <div className="flex justify-between items-center text-slate-600">
              <span>Forma de Pagamento</span>
              <span className="font-black text-slate-800 uppercase">
                {lastCreatedOrder.payment_method === "money"
                  ? "Dinheiro"
                  : lastCreatedOrder.payment_method === "pix"
                    ? "Pix"
                    : "Cartão"}
              </span>
            </div>
            {lastCreatedOrder.payment_method === "money" && (
              <div className="flex justify-between items-center pt-2 border-t border-slate-200/60 text-slate-700">
                <span className="font-semibold">Troco:</span>
                <span className="font-black text-emerald-700">
                  {lastCreatedOrder.change_for &&
                  lastCreatedOrder.change_for > lastCreatedOrder.total_amount
                    ? `Troco para ${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(lastCreatedOrder.change_for)} (Levar ${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(lastCreatedOrder.change_for - lastCreatedOrder.total_amount)})`
                    : "Não precisa de troco"}
                </span>
              </div>
            )}
          </div>
        )}

        <div className="w-full space-y-3">
          {settings.whatsapp && (
            <Button
              onClick={handleSendWhatsApp}
              className="w-full bg-green-600 hover:bg-green-700 h-14 text-lg rounded-xl gap-2 shadow-lg"
            >
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
              Enviar pedido pelo WhatsApp
            </Button>
          )}

          <Button
            variant="outline"
            onClick={() => {
              onClose();
              setCheckoutStep("cart");
            }}
            className="w-full h-12 rounded-xl"
          >
            Continuar Comprando
          </Button>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
        <div className="w-20 h-20 bg-[var(--secondary-color)] rounded-full flex items-center justify-center mb-4">
          <ShoppingBag className="w-10 h-10 text-[var(--primary-color)]/30" />
        </div>
        <h3 className="text-xl font-bold text-slate-900">Sua sacola está vazia</h3>
        <p className="text-slate-500 mt-2 mb-8">Que tal adicionar alguns itens ao seu pedido?</p>
        <Button onClick={onClose} variant="outline" className="rounded-xl px-8">
          Ver catálogo
        </Button>
      </div>
    );
  }

  return (
    <>
      <ScrollArea className="flex-1">
        {checkoutStep === "cart" ? (
          <div className="p-6 space-y-6">
            {items.map((item: any) => (
              <div key={item.id} className="flex gap-4 group">
                {item.image_url ? (
                  <div className="w-20 h-20 rounded-xl overflow-hidden shrink-0 border border-slate-100">
                    <img
                      src={item.image_url}
                      alt={item.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="w-20 h-20 rounded-xl bg-[var(--secondary-color)] shrink-0 border border-slate-100" />
                )}
                <div className="flex-1 flex flex-col justify-between py-0.5">
                  <div>
                    <div className="flex justify-between items-start">
                      <h4 className="font-bold text-slate-900">{item.name}</h4>
                      <button
                        onClick={() => removeItem(item.id)}
                        className="text-slate-400 hover:text-[var(--primary-color)] transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    {item.addons?.length > 0 && (
                      <p className="text-xs text-slate-500 mt-0.5">
                        + {item.addons.map((a: any) => a.name).join(", ")}
                      </p>
                    )}
                    {item.observation && (
                      <p className="text-xs text-[var(--primary-color)] font-medium italic mt-1">
                        Obs: {item.observation}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center border rounded-lg bg-slate-50 h-8">
                      <button
                        className="w-8 flex items-center justify-center hover:text-[var(--primary-color)]"
                        onClick={() => updateQuantity(item.id, Math.max(0, item.quantity - 1))}
                      >
                        <Minus className="w-3.5 h-3.5 text-slate-600" />
                      </button>
                      <span className="w-8 text-center text-sm font-bold text-slate-700">
                        {item.quantity}
                      </span>
                      <button
                        className="w-8 flex items-center justify-center hover:text-[var(--primary-color)]"
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                      >
                        <Plus className="w-3.5 h-3.5 text-slate-600" />
                      </button>
                    </div>
                    <span className="font-bold text-slate-900">
                      {formatCurrency(
                        (item.price + item.addons.reduce((s: any, a: any) => s + a.price, 0)) *
                          item.quantity,
                      )}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-6 space-y-6">
            <Button
              variant="ghost"
              className="pl-0 gap-2 text-slate-500 hover:text-[var(--primary-color)]"
              onClick={() => setCheckoutStep("cart")}
            >
              <ArrowLeft size={16} />
              Voltar para a sacola
            </Button>

            <div className="space-y-4">
              <h3 className="font-bold text-slate-900 text-lg">Informações de Entrega</h3>

              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-2">
                  <Label className="text-slate-900 font-bold">Nome Completo *</Label>
                  <Input
                    value={orderInfo.name}
                    onChange={(e) => setOrderInfo({ ...orderInfo, name: e.target.value })}
                    placeholder="Como devemos te chamar?"
                    className="text-slate-900 border-slate-200 focus:border-[var(--primary-color)]"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-slate-900 font-bold">Telefone / WhatsApp *</Label>
                  <Input
                    value={orderInfo.phone}
                    onChange={(e) => setOrderInfo({ ...orderInfo, phone: e.target.value })}
                    placeholder="(00) 00000-0000"
                    className="text-slate-900 border-slate-200 focus:border-[var(--primary-color)]"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-slate-900 font-bold">Bairro *</Label>
                    <Select
                      value={orderInfo.neighborhood}
                      onValueChange={(v) => setOrderInfo({ ...orderInfo, neighborhood: v })}
                    >
                      <SelectTrigger className="w-full text-slate-900 border-slate-200">
                        <SelectValue placeholder="Selecione seu bairro" />
                      </SelectTrigger>
                      <SelectContent>
                        {deliveryFees && deliveryFees.length > 0 ? (
                          deliveryFees.map((fee: any) => (
                            <SelectItem key={fee.id} value={fee.neighborhood}>
                              {fee.neighborhood} ({formatCurrency(fee.fee)})
                            </SelectItem>
                          ))
                        ) : (
                          <SelectItem value="none" disabled>
                            Nenhum bairro disponível
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                    {(!deliveryFees || deliveryFees.length === 0) && (
                      <Alert variant="destructive" className="py-2 px-3 mt-2">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription className="text-xs">
                          Nenhum bairro disponível para entrega no momento. Por favor, contate a
                          loja.
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-900 font-bold">Rua *</Label>
                    <Input
                      value={orderInfo.street}
                      onChange={(e) => setOrderInfo({ ...orderInfo, street: e.target.value })}
                      className="text-slate-900 border-slate-200 focus:border-[var(--primary-color)]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-slate-900 font-bold">Número *</Label>
                    <Input
                      value={orderInfo.number}
                      onChange={(e) => setOrderInfo({ ...orderInfo, number: e.target.value })}
                      className="text-slate-900 border-slate-200 focus:border-[var(--primary-color)]"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-900 font-bold">Complemento</Label>
                    <Input
                      value={orderInfo.complement}
                      onChange={(e) => setOrderInfo({ ...orderInfo, complement: e.target.value })}
                      placeholder="Apto, Bloco, etc."
                      className="text-slate-900 border-slate-200 focus:border-[var(--primary-color)]"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-slate-900 font-bold">Ponto de Referência</Label>
                  <Input
                    value={orderInfo.reference}
                    onChange={(e) => setOrderInfo({ ...orderInfo, reference: e.target.value })}
                    placeholder="Próximo a..."
                    className="text-slate-900 border-slate-200 focus:border-[var(--primary-color)]"
                  />
                </div>
              </div>
            </div>

            <Separator />

            <div className="space-y-4">
              <h3 className="font-bold text-slate-900 text-lg">Forma de Pagamento</h3>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setOrderInfo({ ...orderInfo, payment_method: "pix" })}
                  className={cn(
                    "flex flex-col items-center justify-center p-4 border-2 rounded-xl cursor-pointer transition-all",
                    orderInfo.payment_method === "pix"
                      ? "border-[var(--primary-color)] bg-[var(--secondary-color)]"
                      : "border-slate-100 hover:border-slate-200",
                  )}
                >
                  <span className="font-bold text-slate-700">Pix</span>
                </button>
                <button
                  type="button"
                  onClick={() => setOrderInfo({ ...orderInfo, payment_method: "money" })}
                  className={cn(
                    "flex flex-col items-center justify-center p-4 border-2 rounded-xl cursor-pointer transition-all",
                    orderInfo.payment_method === "money"
                      ? "border-[var(--primary-color)] bg-[var(--secondary-color)]"
                      : "border-slate-100 hover:border-slate-200",
                  )}
                >
                  <span className="font-bold text-slate-700">Dinheiro</span>
                </button>
                <button
                  type="button"
                  onClick={() => setOrderInfo({ ...orderInfo, payment_method: "card" })}
                  className={cn(
                    "flex flex-col items-center justify-center p-4 border-2 rounded-xl cursor-pointer transition-all",
                    orderInfo.payment_method === "card"
                      ? "border-[var(--primary-color)] bg-[var(--secondary-color)]"
                      : "border-slate-100 hover:border-slate-200",
                  )}
                >
                  <span className="font-bold text-slate-700">Cartão</span>
                </button>
              </div>

              {/* Pergunta de Troco para Dinheiro */}
              {orderInfo.payment_method === "money" && (
                <div className="p-4 bg-amber-50/80 border border-amber-200 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-bold text-amber-900">
                      Vai precisar de troco?
                    </Label>
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => setOrderInfo({ ...orderInfo, change_for: "" })}
                        className={cn(
                          "px-3 py-1.5 text-xs rounded-lg font-bold transition-all cursor-pointer",
                          !orderInfo.change_for
                            ? "bg-amber-600 text-white shadow-sm"
                            : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50",
                        )}
                      >
                        Não preciso
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (!orderInfo.change_for) {
                            const totalVal = getTotal ? getTotal() : 0;
                            const rounded = Math.ceil(totalVal / 10) * 10;
                            setOrderInfo({
                              ...orderInfo,
                              change_for: String(rounded > totalVal ? rounded : rounded + 10),
                            });
                          }
                        }}
                        className={cn(
                          "px-3 py-1.5 text-xs rounded-lg font-bold transition-all cursor-pointer",
                          orderInfo.change_for
                            ? "bg-amber-600 text-white shadow-sm"
                            : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50",
                        )}
                      >
                        Sim, preciso
                      </button>
                    </div>
                  </div>

                  {orderInfo.change_for !== "" && (
                    <div className="space-y-1.5 pt-1 border-t border-amber-200/60">
                      <Label className="text-xs text-amber-950 font-bold">
                        Troco para quanto em dinheiro?
                      </Label>
                      <div className="relative">
                        <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">
                          R$
                        </span>
                        <Input
                          type="number"
                          step="0.50"
                          min={getTotal ? getTotal() : 0}
                          value={orderInfo.change_for || ""}
                          onChange={(e) =>
                            setOrderInfo({ ...orderInfo, change_for: e.target.value })
                          }
                          placeholder="Ex: 50,00"
                          className="pl-9 bg-white text-slate-900 border-amber-300 font-bold focus:border-amber-600"
                        />
                      </div>
                      {(() => {
                        const totalVal = getTotal ? getTotal() : 0;
                        const parsed = parseFloat(orderInfo.change_for);
                        if (!parsed || Number.isNaN(parsed)) return null;
                        if (parsed < totalVal) {
                          return (
                            <p className="text-[11px] font-bold text-red-600">
                              O valor informado é menor que o total ({formatCurrency(totalVal)}).
                            </p>
                          );
                        }
                        const changeAmount = parsed - totalVal;
                        return (
                          <div className="text-xs font-semibold text-amber-950 flex items-center justify-between pt-0.5">
                            <span>Troco a devolver:</span>
                            <span className="text-sm font-black text-emerald-700">
                              {formatCurrency(changeAmount)}
                            </span>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-2 pb-6">
              <Label className="text-slate-900 font-bold">Observações do Pedido</Label>
              <Textarea
                value={orderInfo.observation}
                onChange={(e) => setOrderInfo({ ...orderInfo, observation: e.target.value })}
                placeholder="Alguma informação adicional sobre a entrega?"
                rows={3}
                className="text-slate-900 border-slate-200 focus:border-[var(--primary-color)]"
              />
            </div>
          </div>
        )}
      </ScrollArea>

      <div className="p-6 border-t bg-slate-50 space-y-4 shrink-0">
        <div className="space-y-2">
          <div className="flex justify-between text-sm text-slate-500">
            <span>Subtotal</span>
            <span>{isHydrated ? formatCurrency(getSubtotal()) : formatCurrency(0)}</span>
          </div>
          <div className="flex justify-between text-sm text-slate-500">
            <span>Taxa de entrega</span>
            {orderInfo.neighborhood ? (
              <span>{isHydrated ? formatCurrency(getDeliveryFee()) : formatCurrency(0)}</span>
            ) : (
              <span className="text-xs italic">Selecione o bairro</span>
            )}
          </div>
          <Separator />
          <div className="flex justify-between text-lg font-bold text-slate-900">
            <span>Total</span>
            <span className="text-[var(--primary-color)]">
              {isHydrated ? formatCurrency(getTotal()) : formatCurrency(0)}
            </span>
          </div>
        </div>

        {checkoutStep === "cart" ? (
          <Button
            className="w-full h-14 text-lg rounded-xl border-none shadow-none text-white font-black hover:text-white hover:brightness-110"
            style={{ backgroundColor: "var(--primary-color)" }}
            onClick={() => setCheckoutStep("info")}
            disabled={!settings.is_open}
          >
            {settings.is_open ? "Finalizar Pedido" : "Loja fechada"}
          </Button>
        ) : (
          <Button
            className="w-full bg-green-600 hover:bg-green-700 h-14 text-lg rounded-xl shadow-lg gap-2 text-white font-black"
            onClick={onSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? <Loader2 className="animate-spin" /> : <CheckCircle2 size={20} />}
            Confirmar Pedido
          </Button>
        )}
      </div>
    </>
  );
}
