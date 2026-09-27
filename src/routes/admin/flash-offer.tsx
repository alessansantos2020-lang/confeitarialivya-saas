import { createFileRoute } from "@tanstack/react-router";
import { useActiveStore } from "@/lib/active-store";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Zap, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useMemo, useState } from "react";
import { getPromotionStatus, getDiscountPercent, type PromotionStatus } from "@/lib/promotions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/flash-offer")({
  component: FlashOfferPage,
});

type Product = {
  id: string;
  name: string;
  price: number;
  image_url: string | null;
  is_available: boolean | null;
  is_on_sale: boolean | null;
  sale_price: number | null;
  sale_start_at: string | null;
  sale_end_at: string | null;
  flash_headline: string | null;
  flash_message: string | null;
};

const toLocalInput = (iso: string | null | undefined) => {
  if (!iso) return "";
  const date = new Date(iso);
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};

const fromLocalInput = (value: string) => (value ? new Date(value).toISOString() : null);

const STATUS_BADGE: Record<PromotionStatus, { label: string; className: string }> = {
  none: { label: "Sem promoção", className: "bg-slate-100 text-slate-600 border-slate-200" },
  active: { label: "Ativa agora", className: "bg-green-100 text-green-700 border-green-200" },
  scheduled: { label: "Agendada", className: "bg-amber-100 text-amber-700 border-amber-200" },
  expired: { label: "Encerrada", className: "bg-red-100 text-red-700 border-red-200" },
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

function FlashOfferPage() {
  const { storeId, hasFeature } = useActiveStore();
  const queryClient = useQueryClient();
  const canUsePromotions = hasFeature("promotions");

  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [salePrice, setSalePrice] = useState("");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [headline, setHeadline] = useState("");
  const [message, setMessage] = useState("");
  const [isActive, setIsActive] = useState(true);

  const { data: products, isLoading } = useQuery({
    queryKey: ["flash-offer-products", storeId],
    enabled: !!storeId && canUsePromotions,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select(
          "id, name, price, image_url, is_available, is_on_sale, sale_price, sale_start_at, sale_end_at, flash_headline, flash_message",
        )
        .eq("store_id", storeId)
        .eq("is_available", true)
        .order("name");
      if (error) throw error;
      return data as unknown as Product[];
    },
  });

  // Preenche o formulário ao escolher um produto (dados atuais da promoção).
  const selectedProduct = useMemo(
    () => products?.find((product) => product.id === selectedProductId) ?? null,
    [products, selectedProductId],
  );

  const applyProduct = (productId: string) => {
    setSelectedProductId(productId);
    const product = products?.find((item) => item.id === productId);
    setSalePrice(product?.sale_price != null ? String(product.sale_price) : "");
    setStartAt(toLocalInput(product?.sale_start_at));
    setEndAt(toLocalInput(product?.sale_end_at));
    setHeadline(product?.flash_headline ?? "");
    setMessage(product?.flash_message ?? "");
    setIsActive(product?.is_on_sale ?? false);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!selectedProduct) throw new Error("Escolha um produto.");
      const price = Number(selectedProduct.price);
      const salePriceStr = salePrice.trim();
      const salePriceValue = salePriceStr === "" ? null : Number(salePriceStr.replace(",", "."));

      if (isActive && salePriceValue == null) {
        throw new Error("Informe o preço promocional para ativar a oferta.");
      }
      if (salePriceValue != null && (Number.isNaN(salePriceValue) || salePriceValue <= 0)) {
        throw new Error("O preço promocional deve ser maior que zero.");
      }
      if (salePriceValue != null && salePriceValue >= price) {
        throw new Error("O preço promocional precisa ser menor que o preço normal.");
      }
      const startIso = fromLocalInput(startAt);
      const endIso = fromLocalInput(endAt);
      if (startIso && endIso && new Date(endIso) <= new Date(startIso)) {
        throw new Error("A data/hora final precisa ser depois da inicial.");
      }

      const { error } = await supabase
        .from("products")
        .update({
          is_on_sale: isActive,
          sale_price: salePriceValue ?? selectedProduct.sale_price ?? null,
          sale_start_at: startIso,
          sale_end_at: endIso,
          flash_headline: headline.trim() || null,
          flash_message: message.trim() || null,
        } as never)
        .eq("id", selectedProduct.id)
        .eq("store_id", storeId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Oferta Relâmpago salva!");
      queryClient.invalidateQueries({ queryKey: ["flash-offer-products", storeId] });
      queryClient.invalidateQueries({ queryKey: ["products", storeId] });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Não foi possível salvar a oferta.");
    },
  });

  if (!canUsePromotions) {
    return (
      <div className="max-w-md mx-auto bg-white rounded-2xl p-8 border text-center space-y-4 mt-8">
        <div className="w-16 h-16 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center mx-auto">
          <Zap className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">
          Funcionalidade não disponível no seu plano.
        </h2>
        <p className="text-slate-500 text-sm">
          A Oferta Relâmpago faz parte do módulo de promoções. Fale com o administrador do sistema
          para liberar.
        </p>
      </div>
    );
  }

  const previewStatus: PromotionStatus = selectedProduct
    ? getPromotionStatus({
        price: selectedProduct.price,
        is_on_sale: isActive,
        sale_price: salePrice.trim() === "" ? null : Number(salePrice.replace(",", ".")),
        sale_start_at: startAt ? new Date(startAt).toISOString() : null,
        sale_end_at: endAt ? new Date(endAt).toISOString() : null,
      })
    : "none";
  const statusBadge = STATUS_BADGE[previewStatus];

  return (
    <div className="space-y-7">
      <div>
        <p className="admin-eyebrow">Promoção relâmpago</p>
        <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-900">
          <Zap className="h-6 w-6 text-amber-500" fill="currentColor" />
          Oferta Relâmpago
        </h1>
        <p className="admin-page-subtitle">
          Aparece automaticamente na frente do app do cliente durante o período escolhido, com
          contador regressivo.
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : !products?.length ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-slate-500">
          Nenhum produto disponível. Cadastre produtos primeiro.
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-5">
          <form
            className="admin-kpi-card lg:col-span-3 space-y-5"
            onSubmit={(event) => {
              event.preventDefault();
              saveMutation.mutate();
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="flash-product">Produto</Label>
              <Select value={selectedProductId} onValueChange={applyProduct}>
                <SelectTrigger id="flash-product" className="w-full">
                  <SelectValue placeholder="Escolha o produto da oferta" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((product) => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.name} — {formatCurrency(product.price)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedProduct && (
              <>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Preço normal</Label>
                    <Input value={formatCurrency(selectedProduct.price)} readOnly disabled />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="flash-sale-price">Preço promocional *</Label>
                    <Input
                      id="flash-sale-price"
                      inputMode="decimal"
                      placeholder="Ex.: 19,90"
                      value={salePrice}
                      onChange={(event) => setSalePrice(event.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="flash-start">Início</Label>
                    <Input
                      id="flash-start"
                      type="datetime-local"
                      value={startAt}
                      onChange={(event) => setStartAt(event.target.value)}
                    />
                    <p className="text-xs text-slate-400">Vazio = começa agora.</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="flash-end">Fim</Label>
                    <Input
                      id="flash-end"
                      type="datetime-local"
                      value={endAt}
                      onChange={(event) => setEndAt(event.target.value)}
                    />
                    <p className="text-xs text-slate-400">Passou da hora, a oferta sai sozinha.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="flash-headline">Título no modal (opcional)</Label>
                    <Input
                      id="flash-headline"
                      maxLength={80}
                      placeholder={`Padrão: ${selectedProduct.name}`}
                      value={headline}
                      onChange={(event) => setHeadline(event.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="flash-message">Texto promocional (opcional)</Label>
                    <Input
                      id="flash-message"
                      maxLength={140}
                      placeholder="Ex.: Só hoje das 18h às 23h!"
                      value={message}
                      onChange={(event) => setMessage(event.target.value)}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div>
                    <Label htmlFor="flash-active" className="text-slate-900">
                      Oferta ativa
                    </Label>
                    <p className="text-xs text-slate-500">
                      Ligada = aparece no app do cliente no período.
                    </p>
                  </div>
                  <Switch id="flash-active" checked={isActive} onCheckedChange={setIsActive} />
                </div>

                <Button
                  type="submit"
                  className="admin-orders-button w-full h-12 rounded-xl text-base font-black"
                  disabled={saveMutation.isPending}
                >
                  {saveMutation.isPending ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    "Salvar Oferta Relâmpago"
                  )}
                </Button>
              </>
            )}
          </form>

          <div className="lg:col-span-2 space-y-4">
            <div className="admin-kpi-card space-y-1">
              <p className="admin-kpi-label">Status da configuração atual</p>
              <Badge variant="outline" className={cn("mt-1", statusBadge.className)}>
                {statusBadge.label}
              </Badge>
              {selectedProduct && (
                <div className="mt-3 space-y-1 text-sm text-slate-500">
                  <p>
                    {formatCurrency(selectedProduct.price)} →{" "}
                    <span className="font-bold text-slate-900">
                      {salePrice.trim() ? formatCurrency(Number(salePrice.replace(",", "."))) : "—"}
                    </span>
                    {salePrice.trim() &&
                      Number(salePrice.replace(",", ".")) < selectedProduct.price && (
                        <span className="ml-2 rounded-full bg-red-600 px-2 py-0.5 text-[11px] font-black text-white">
                          -
                          {getDiscountPercent(
                            selectedProduct.price,
                            Number(salePrice.replace(",", ".")),
                          )}
                          %
                        </span>
                      )}
                  </p>
                  <p className="text-xs">
                    {startAt
                      ? `Início: ${new Date(startAt).toLocaleString("pt-BR")}`
                      : "Início: imediato"}
                    {" · "}
                    {endAt ? `Fim: ${new Date(endAt).toLocaleString("pt-BR")}` : "Fim: sem prazo"}
                  </p>
                </div>
              )}
            </div>

            <div className="admin-kpi-card space-y-2">
              <p className="admin-kpi-label">Como o cliente vê</p>
              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <div
                  className="flex items-center justify-center gap-1.5 py-2 text-[11px] font-black uppercase tracking-[0.14em] text-white"
                  style={{ background: "var(--primary-color, #1d4ed8)" }}
                >
                  <Zap size={13} fill="currentColor" /> Oferta Relâmpago
                </div>
                <div className="bg-slate-100">
                  {selectedProduct?.image_url ? (
                    <img
                      src={selectedProduct.image_url}
                      alt={selectedProduct.name}
                      className="h-28 w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-24 items-center justify-center text-3xl">⚡</div>
                  )}
                </div>
                <div className="space-y-1.5 p-3 text-center">
                  <p className="text-sm font-black text-slate-900">
                    {headline.trim() || selectedProduct?.name || "Produto"}
                  </p>
                  {message.trim() ? <p className="text-xs text-slate-500">{message}</p> : null}
                  <p className="text-xs text-slate-400 line-through">
                    {formatCurrency(selectedProduct?.price ?? 0)}
                  </p>
                  <p
                    className="text-xl font-black"
                    style={{ color: "var(--primary-color, #1d4ed8)" }}
                  >
                    {salePrice.trim()
                      ? formatCurrency(Number(salePrice.replace(",", ".")))
                      : "R$ —"}
                  </p>
                  <div className="rounded-lg bg-slate-50 py-1.5">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Termina em
                    </p>
                    <p className="font-mono text-lg font-black tabular-nums text-slate-900">
                      01:42:35
                    </p>
                  </div>
                  <div
                    className="rounded-lg py-2 text-xs font-black text-white"
                    style={{ background: "var(--primary-color, #1d4ed8)" }}
                  >
                    PEDIR AGORA
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
