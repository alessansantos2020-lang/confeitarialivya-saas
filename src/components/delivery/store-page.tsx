/* eslint-disable @typescript-eslint/no-explicit-any */
import { useSuspenseQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Clock,
  ShoppingBag,
  Plus,
  Minus,
  X,
  Trash2,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  AlertCircle,
  Phone,
  MapPin,
  Instagram,
  Heart,
  Star,
  Flame,
} from "lucide-react";

import {
  getPublicStoreSettings,
  getCategoriesWithProducts,
  type StoreSettings,
} from "@/lib/delivery.functions";
import { getCatalogPricing } from "@/lib/promotions";
import { createOrder } from "@/lib/orders.functions";
import { getActiveDeliveryFees } from "@/lib/delivery-fees.functions";
import { getPublicStorePaymentMethods } from "@/lib/store-payments";
import { useCart } from "@/lib/cart.store";
import { queryOptions } from "@tanstack/react-query";
import { useState, useMemo, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useIsHydrated } from "@/hooks/use-hydrated";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { StorePageProductDialog } from "./store-page-product-dialog";
import { StorePageCart } from "./store-page-cart";
import { StorePageFooter } from "./store-page-footer";
import { supabase } from "@/integrations/supabase/client";

export const storeSettingsOptions = (storeId: string) =>
  queryOptions({
    queryKey: ["storeSettings", storeId],
    queryFn: () => getPublicStoreSettings(storeId),
  });

export const categoriesWithProductsOptions = (storeId: string) =>
  queryOptions({
    queryKey: ["categoriesWithProducts", storeId],
    queryFn: () => getCategoriesWithProducts(storeId),
  });

export const activeDeliveryFeesOptions = (storeId: string) =>
  queryOptions({
    queryKey: ["activeDeliveryFees", storeId],
    queryFn: () => getActiveDeliveryFees(storeId),
  });

export const buildStoreHead = (settings: StoreSettings | undefined) => {
  const title = settings?.name
    ? `${settings.name} - Catálogo Online`
    : "Catálogo Online - Delivery";
  const description = settings?.description || "Faça seu pedido online de forma rápida e prática.";
  const logo = settings?.logo_url;

  return {
    title,
    meta: [
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      ...(logo ? [{ property: "og:image", content: logo }] : []),
    ],
  };
};

export function StorePage({ storeId }: { storeId: string }) {
  const queryClient = useQueryClient();
  const setStoreContext = useCart((state) => state.setStoreContext);
  const cartStoreId = useCart((state) => state.storeId);
  const { data: settings } = useSuspenseQuery(storeSettingsOptions(storeId)) as {
    data: StoreSettings;
  };
  const { data: categories } = useSuspenseQuery(categoriesWithProductsOptions(storeId));
  const { data: deliveryFees } = useSuspenseQuery(activeDeliveryFeesOptions(storeId));
  const { data: paymentMethods } = useQuery({
    queryKey: ["publicPaymentMethods", storeId],
    queryFn: () => getPublicStorePaymentMethods(storeId),
  });

  const isCartReady = cartStoreId === storeId;

  useEffect(() => {
    setStoreContext(storeId);
  }, [setStoreContext, storeId]);

  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [productObservation, setProductObservation] = useState("");
  const [selectedAddons, setSelectedAddons] = useState<Record<string, string[]>>({});
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [checkoutStep, setCheckoutStep] = useState<"cart" | "info" | "success">("cart");
  const [lastCreatedOrder, setLastCreatedOrder] = useState<any>(null);
  const isHydrated = useIsHydrated();

  // Real-time synchronization for store settings
  useEffect(() => {
    const channel = supabase
      .channel(`store_settings_${storeId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "store_settings",
          filter: `store_id=eq.${storeId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["storeSettings", storeId] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, storeId]);

  // CSS Variables for brand colors defined globally on root element
  useEffect(() => {
    if (settings) {
      const root = document.documentElement;
      root.style.setProperty("--primary-color", settings.primary_color || "#1d4ed8");
      root.style.setProperty("--secondary-color", settings.secondary_color || "#eff6ff");
    }
  }, [settings?.primary_color, settings?.secondary_color]);

  const {
    items: persistedItems,
    addItem,
    removeItem,
    updateQuantity,
    getTotal,
    getSubtotal,
    getDeliveryFee,
    getTotalItems,
    clearCart,
    setDeliveryFee,
    selectedNeighborhood,
  } = useCart();
  const items = isCartReady ? persistedItems : [];
  const cartTotalItems = isCartReady ? getTotalItems() : 0;
  const cartTotal = isCartReady ? getTotal() : 0;
  const scopedGetSubtotal = () => (isCartReady ? getSubtotal() : 0);
  const scopedGetDeliveryFee = () => (isCartReady ? getDeliveryFee() : 0);
  const scopedGetTotal = () => (isCartReady ? getTotal() : 0);

  const [orderInfo, setOrderInfo] = useState({
    name: "",
    phone: "",
    neighborhood: selectedNeighborhood || "",
    street: "",
    number: "",
    complement: "",
    reference: "",
    payment_method: "pix",
    change_for: "",
    observation: "",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setOrderInfo((current) => ({
      ...current,
      neighborhood: isCartReady ? selectedNeighborhood || "" : "",
    }));
  }, [isCartReady, selectedNeighborhood]);

  // Update cart delivery fee when neighborhood changes in orderInfo
  useEffect(() => {
    if (orderInfo.neighborhood && deliveryFees) {
      const feeObj = deliveryFees.find((f: any) => f.neighborhood === orderInfo.neighborhood);
      if (feeObj) {
        setDeliveryFee(feeObj.fee, feeObj.neighborhood);
      } else {
        setDeliveryFee(0, null);
      }
    } else {
      setDeliveryFee(0, null);
    }
  }, [orderInfo.neighborhood, deliveryFees, setDeliveryFee]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const handleCreateOrder = async () => {
    if (!settings.is_open) {
      toast.error("A loja está fechada no momento e não está recebendo pedidos.");
      return;
    }

    if (
      !orderInfo.name ||
      !orderInfo.phone ||
      !orderInfo.neighborhood ||
      !orderInfo.street ||
      !orderInfo.number
    ) {
      toast.error("Por favor, preencha todos os campos obrigatórios.");
      return;
    }

    if (items.length === 0) {
      toast.error("Sua sacola está vazia.");
      return;
    }

    // Respeita os métodos que a loja habilitou (defesa extra; o RPC também valida no banco).
    const methodAllowed =
      (orderInfo.payment_method === "pix" &&
        (paymentMethods?.accept_manual_pix !== false ||
          paymentMethods?.online_pix_available === true ||
          paymentMethods?.mp_enabled === true ||
          paymentMethods?.asaas_enabled === true)) ||
      (orderInfo.payment_method === "money" && paymentMethods?.accept_cash !== false) ||
      (orderInfo.payment_method === "card" && paymentMethods?.accept_card_delivery !== false);
    if (paymentMethods && !methodAllowed) {
      toast.error("Esta forma de pagamento não está disponível nesta loja.");
      return;
    }

    const totalOrderAmount = scopedGetTotal();
    let changeForNum: number | null = null;
    if (orderInfo.payment_method === "money" && orderInfo.change_for) {
      const parsed = parseFloat(String(orderInfo.change_for).replace(",", "."));
      if (!Number.isNaN(parsed) && parsed > 0) {
        if (parsed < totalOrderAmount) {
          toast.error(
            `O valor para troco (${formatCurrency(parsed)}) não pode ser menor que o total do pedido (${formatCurrency(totalOrderAmount)}).`,
          );
          return;
        }
        changeForNum = parsed;
      }
    }

    setIsSubmitting(true);
    try {
      const orderData = {
        store_id: storeId,
        customer_name: orderInfo.name,
        customer_phone: orderInfo.phone,
        address: `${orderInfo.street}, ${orderInfo.number}${orderInfo.complement ? ` - ${orderInfo.complement}` : ""} - ${orderInfo.neighborhood}${orderInfo.reference ? ` (Ref: ${orderInfo.reference})` : ""}`,
        neighborhood: orderInfo.neighborhood,
        street: orderInfo.street,
        number: orderInfo.number,
        complement: orderInfo.complement || null,
        reference: orderInfo.reference || null,
        payment_method: orderInfo.payment_method,
        change_for: changeForNum,
        observation: orderInfo.observation || null,
        items: items.map((item) => ({
          product_id: item.product_id,
          quantity: item.quantity,
          observation: item.observation || null,
          selected_addons: (item.addons || []).map((addon) => ({ id: addon.id })),
        })),
      };

      const response = await createOrder(orderData);

      setLastCreatedOrder(response);
      clearCart();
      setCheckoutStep("success");
      toast.success("Pedido realizado com sucesso!");
    } catch {
      toast.error("Não foi possível realizar o pedido. Confira os dados e tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col pb-24 md:pb-0 font-sans">
      {/* Header Section */}
      <header className="relative w-full bg-white overflow-hidden shadow-sm">
        {/* Cover Image */}
        <div className="relative h-56 md:h-80 w-full overflow-hidden">
          {settings.cover_url ? (
            <img
              src={settings.cover_url}
              alt="Capa da loja"
              className="w-full h-full object-cover brightness-90 transition-transform duration-700 hover:scale-105"
              onError={(e) => {
                (e.target as HTMLImageElement).src =
                  "https://placehold.co/1200x400?text=Capa+Indisponível";
              }}
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-pink-400 via-rose-300 to-amber-200" />
          )}

          {/* Logo overlay on cover for mobile, or floating for desktop */}
          <div className="absolute -bottom-10 left-4 md:left-8 z-10">
            <div className="w-24 h-24 md:w-32 md:h-32 rounded-2xl bg-white p-1 shadow-xl overflow-hidden border-2 border-white">
              {settings.logo_url ? (
                <img
                  src={settings.logo_url}
                  alt={settings.name}
                  className="w-full h-full object-cover rounded-xl"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = "https://placehold.co/200x200?text=Logo";
                  }}
                />
              ) : (
                <div className="w-full h-full bg-[var(--primary-color)] flex items-center justify-center text-white text-3xl font-black rounded-xl">
                  {settings.name.charAt(0)}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Store Info Container */}
        <div className="container mx-auto px-4 pt-12 pb-6 md:pt-16">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
                {settings.name}
              </h1>
              <Badge
                className={`px-2 py-0.5 rounded-full text-[10px] font-black border-none ${
                  settings.is_open ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-600"
                }`}
              >
                {settings.is_open ? "ABERTO" : "FECHADO"}
              </Badge>
            </div>
          </div>
        </div>
      </header>

      {/* Categories Navigation (Sticky) */}
      <nav className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-100 shadow-sm">
        <div className="container mx-auto px-4">
          <div className="flex gap-2 py-3 overflow-x-auto no-scrollbar scroll-smooth items-center">
            <a
              href="#main"
              className="px-4 py-2 rounded-full text-slate-900 font-bold text-sm whitespace-nowrap bg-slate-100 transition-colors"
            >
              Todos
            </a>
            {categories.map((category) => (
              <a
                key={category.id}
                href={`#cat-${category.id}`}
                className="px-4 py-2 rounded-full text-slate-500 font-bold text-sm whitespace-nowrap transition-all hover:bg-slate-50 hover:text-slate-900"
              >
                {category.name}
              </a>
            ))}
          </div>
        </div>
      </nav>

      {/* Main Content: Products List */}
      <main id="main" className="container mx-auto px-4 py-8 space-y-12 max-w-7xl">
        {categories.map((category) => (
          <section key={category.id} id={`cat-${category.id}`} className="scroll-mt-24">
            <h2 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight mb-6 flex items-center gap-2">
              {category.name}
              <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">
                {category.products.length}
              </span>
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
              {category.products.map((product) => {
                const pricing = getCatalogPricing(product);
                return (
                  <Card
                    key={product.id}
                    className="group relative overflow-hidden rounded-2xl border-slate-100 bg-white hover:border-[var(--primary-color)]/20 transition-all duration-300 cursor-pointer flex p-3 md:p-4 gap-4"
                    onClick={isCartReady ? () => setSelectedProduct(product) : undefined}
                    aria-disabled={!isCartReady}
                  >
                    <div className="flex-1 flex flex-col justify-between py-1">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h3 className="text-base md:text-lg font-black text-slate-900 tracking-tight line-clamp-1">
                            {product.name}
                          </h3>
                          {product.is_featured && (
                            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400 shrink-0" />
                          )}
                          {pricing.onSale && (
                            <Badge className="bg-rose-500 text-white border-none font-black text-[9px] px-1.5 py-0 gap-0.5 shrink-0">
                              <Flame className="w-2.5 h-2.5" /> OFERTA
                            </Badge>
                          )}
                        </div>
                        <p className="text-slate-400 text-xs md:text-sm font-medium line-clamp-2 md:line-clamp-3">
                          {product.description}
                        </p>
                      </div>

                      <div className="flex items-center justify-between mt-4">
                        <div className="flex items-baseline gap-1.5">
                          {pricing.onSale && (
                            <span className="text-xs text-slate-400 line-through font-medium">
                              {formatCurrency(pricing.fullPrice)}
                            </span>
                          )}
                          <span className="text-base md:text-lg font-black text-[var(--primary-color)] tracking-tight">
                            {formatCurrency(pricing.price)}
                          </span>
                          {pricing.onSale && (
                            <span className="text-[10px] font-black text-rose-500">
                              -{pricing.discountPercent}%
                            </span>
                          )}
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          aria-label={`Adicionar ${product.name} à sacola`}
                          className="h-8 w-8 md:h-10 md:w-10 rounded-xl text-white transition-all active:scale-90 hover:text-white hover:brightness-110"
                          style={{ backgroundColor: "var(--primary-color)" }}
                          onClick={(event) => {
                            event.stopPropagation();
                            addItem({
                              product_id: product.id,
                              name: product.name,
                              price: pricing.price,
                              quantity: 1,
                              image_url: product.image_url || null,
                              observation: "",
                              addons: [],
                            });
                            toast.success(`${product.name} adicionado à sacola`);
                          }}
                        >
                          <Plus className="w-4 h-4 md:w-5 md:h-5 text-white" />
                        </Button>
                      </div>
                    </div>

                    <div className="relative w-28 h-28 md:w-36 md:h-36 rounded-xl overflow-hidden bg-slate-50 shrink-0 shadow-sm">
                      {product.image_url ? (
                        <img
                          src={product.image_url}
                          alt={product.name}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src =
                              "https://placehold.co/400x400?text=Imagem";
                          }}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <ShoppingBag className="w-8 h-8 md:w-10 md:h-10 text-slate-200" />
                        </div>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          </section>
        ))}
      </main>

      <StorePageFooter settings={settings} />

      {/* Mobile Footer (Cart) */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-slate-100 md:hidden z-50">
        <Sheet open={isCartOpen} onOpenChange={setIsCartOpen}>
          <SheetTrigger asChild>
            <Button
              className="w-full h-14 text-lg font-black rounded-2xl flex items-center justify-between px-6 border-none shadow-none text-white hover:text-white hover:brightness-110"
              style={{ backgroundColor: "var(--primary-color)" }}
              disabled={!isHydrated || cartTotalItems === 0}
            >
              <div className="flex items-center gap-3">
                <div className="relative">
                  <ShoppingBag className="w-6 h-6 text-white" />
                  {isHydrated && cartTotalItems > 0 && (
                    <div className="absolute -top-2 -right-2 bg-white text-[var(--primary-color)] border-none min-w-[20px] h-5 flex items-center justify-center p-0 text-[10px] font-black rounded-full">
                      {cartTotalItems}
                    </div>
                  )}
                </div>
                <span className="tracking-tight">VER SACOLA</span>
              </div>
              <span className="font-black tracking-tight">
                {isHydrated ? formatCurrency(cartTotal) : formatCurrency(0)}
              </span>
            </Button>
          </SheetTrigger>

          <SheetContent side="bottom" className="h-[90vh] rounded-t-3xl p-0 flex flex-col">
            <SheetHeader className="p-6 border-b shrink-0">
              <SheetTitle className="text-xl flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-[var(--primary-color)]" />
                Sua Sacola
              </SheetTitle>
            </SheetHeader>
            <StorePageCart
              items={items}
              removeItem={removeItem}
              updateQuantity={updateQuantity}
              getSubtotal={scopedGetSubtotal}
              getDeliveryFee={scopedGetDeliveryFee}
              getTotal={scopedGetTotal}
              formatCurrency={formatCurrency}
              onClose={() => {
                setIsCartOpen(false);
                setCheckoutStep("cart");
              }}
              checkoutStep={checkoutStep}
              setCheckoutStep={setCheckoutStep}
              orderInfo={orderInfo}
              setOrderInfo={setOrderInfo}
              onSubmit={handleCreateOrder}
              isSubmitting={isSubmitting}
              deliveryFees={deliveryFees}
              settings={settings}
              lastCreatedOrder={lastCreatedOrder}
              isHydrated={isHydrated}
              paymentMethods={paymentMethods}
            />
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop Floating Cart Button */}
      <div className="fixed bottom-8 right-8 hidden md:block z-50">
        <Sheet open={isCartOpen} onOpenChange={setIsCartOpen}>
          <SheetTrigger asChild>
            <Button
              size="lg"
              className="bg-[var(--primary-color)] hover:brightness-110 active:scale-90 h-16 w-16 rounded-full relative transition-all duration-300 border-none shadow-none"
            >
              <ShoppingBag className="w-7 h-7 text-white" />
              {isHydrated && cartTotalItems > 0 && (
                <div className="absolute -top-1 -right-1 bg-slate-900 text-white border-2 border-white min-w-[24px] h-6 flex items-center justify-center p-0 font-black text-[10px] rounded-full">
                  {cartTotalItems}
                </div>
              )}
            </Button>
          </SheetTrigger>

          <SheetContent className="w-full sm:max-w-md p-0 flex flex-col">
            <SheetHeader className="p-6 border-b shrink-0">
              <SheetTitle className="text-xl flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-[var(--primary-color)]" />
                Sua Sacola
              </SheetTitle>
            </SheetHeader>
            <StorePageCart
              items={items}
              removeItem={removeItem}
              updateQuantity={updateQuantity}
              getSubtotal={scopedGetSubtotal}
              getDeliveryFee={scopedGetDeliveryFee}
              getTotal={scopedGetTotal}
              formatCurrency={formatCurrency}
              onClose={() => {
                setIsCartOpen(false);
                setCheckoutStep("cart");
              }}
              checkoutStep={checkoutStep}
              setCheckoutStep={setCheckoutStep}
              orderInfo={orderInfo}
              setOrderInfo={setOrderInfo}
              onSubmit={handleCreateOrder}
              isSubmitting={isSubmitting}
              deliveryFees={deliveryFees}
              settings={settings}
              lastCreatedOrder={lastCreatedOrder}
              isHydrated={isHydrated}
              paymentMethods={paymentMethods}
            />
          </SheetContent>
        </Sheet>
      </div>

      <StorePageProductDialog
        product={selectedProduct}
        observation={productObservation}
        setObservation={setProductObservation}
        selectedAddons={selectedAddons}
        setSelectedAddons={setSelectedAddons}
        formatCurrency={formatCurrency}
        addItem={addItem}
        onClose={() => {
          setSelectedProduct(null);
          setProductObservation("");
          setSelectedAddons({});
        }}
      />
    </div>
  );
}
