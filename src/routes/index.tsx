import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Clock, ShoppingBag, Plus, Minus, X, Trash2, ArrowLeft, CheckCircle2, Loader2, AlertCircle, Phone, MapPin, Instagram, Heart, Star } from "lucide-react";

import { getStoreSettings, getCategoriesWithProducts, type StoreSettings } from "@/lib/delivery.functions";
import { createOrder } from "@/lib/orders.functions";
import { getActiveDeliveryFees } from "@/lib/delivery-fees.functions";
import { useCart } from "@/lib/cart.store";
import { queryOptions } from "@tanstack/react-query";
import { useState, useMemo, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetFooter } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useIsHydrated } from '@/hooks/use-hydrated';
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from '@/lib/utils';
import { supabase } from "@/integrations/supabase/client";


const storeSettingsOptions = queryOptions({
  queryKey: ["storeSettings"],
  queryFn: () => getStoreSettings(),
});

const categoriesWithProductsOptions = queryOptions({
  queryKey: ["categoriesWithProducts"],
  queryFn: () => getCategoriesWithProducts(),
});

const activeDeliveryFeesOptions = queryOptions({
  queryKey: ["activeDeliveryFees"],
  queryFn: () => getActiveDeliveryFees(),
});

export const Route = createFileRoute("/")({
  component: DeliveryPage,
  loader: async ({ context }) => {
    const [settings] = await Promise.all([
      context.queryClient.ensureQueryData(storeSettingsOptions),
      context.queryClient.ensureQueryData(categoriesWithProductsOptions),
      context.queryClient.ensureQueryData(activeDeliveryFeesOptions),
    ]);
    return settings;
  },
  head: ({ loaderData }) => {
    const settings = loaderData as unknown as StoreSettings;
    const title = settings?.name ? `${settings.name} - Cardápio Digital` : "Cardápio Digital - Delivery";
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
  },
});

function DeliveryPage() {
  const queryClient = useQueryClient();
  const { data: settings } = useSuspenseQuery(storeSettingsOptions) as { data: StoreSettings };
  const { data: categories } = useSuspenseQuery(categoriesWithProductsOptions);
  const { data: deliveryFees } = useSuspenseQuery(activeDeliveryFeesOptions);
  
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [productObservation, setProductObservation] = useState("");
  const [selectedAddons, setSelectedAddons] = useState<Record<string, string[]>>({});
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [checkoutStep, setCheckoutStep] = useState<'cart' | 'info' | 'success'>('cart');
  const [lastCreatedOrder, setLastCreatedOrder] = useState<any>(null);
  const isHydrated = useIsHydrated();
  
  // Real-time synchronization for store settings
  useEffect(() => {
    const channel = supabase
      .channel('store_settings_changes')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'store_settings' },
        (payload) => {
          console.log('Store settings updated, invalidating query...');
          queryClient.invalidateQueries({ queryKey: ["storeSettings"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // CSS Variables for brand colors defined globally on root element
  useEffect(() => {
    if (settings) {
      const root = document.documentElement;
      root.style.setProperty('--primary-color', settings.primary_color || '#db2777');
      root.style.setProperty('--secondary-color', settings.secondary_color || '#fdf2f8');
    }
  }, [settings?.primary_color, settings?.secondary_color]);
  
  
  const { 
    items, 
    addItem, 
    removeItem, 
    updateQuantity, 
    getTotal, 
    getSubtotal, 
    getDeliveryFee, 
    getTotalItems, 
    clearCart,
    setDeliveryFee,
    selectedNeighborhood
  } = useCart();

  const [orderInfo, setOrderInfo] = useState({
    name: '',
    phone: '',
    neighborhood: selectedNeighborhood || '',
    street: '',
    number: '',
    complement: '',
    reference: '',
    payment_method: 'pix',
    observation: ''
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const handleCreateOrder = async () => {
    console.log("handleCreateOrder called");
    if (!orderInfo.name || !orderInfo.phone || !orderInfo.neighborhood || !orderInfo.street || !orderInfo.number) {
      console.log("Validation failed", orderInfo);
      toast.error("Por favor, preencha todos os campos obrigatórios.");
      return;
    }

    if (items.length === 0) {
      toast.error("Sua sacola está vazia.");
      return;
    }

    setIsSubmitting(true);
    try {
      const orderData = {
        customer_name: orderInfo.name,
        customer_phone: orderInfo.phone,
        address: `${orderInfo.street}, ${orderInfo.number}${orderInfo.complement ? ` - ${orderInfo.complement}` : ''} - ${orderInfo.neighborhood}${orderInfo.reference ? ` (Ref: ${orderInfo.reference})` : ''}`,
        neighborhood: orderInfo.neighborhood,
        street: orderInfo.street,
        number: orderInfo.number,
        complement: orderInfo.complement || null,
        reference: orderInfo.reference || null,
        payment_method: orderInfo.payment_method,
        observation: orderInfo.observation || null,
        total_amount: getTotal(),
        delivery_fee: getDeliveryFee(),
        items: items.map(item => ({
          product_id: item.product_id,
          product_name: item.name,
          quantity: item.quantity,
          price_at_time: item.price + (item.addons || []).reduce((s, a) => s + a.price, 0),
          observation: item.observation || null,
          selected_addons: item.addons || []
        }))
      };

      console.log("Submitting order data:", orderData);

      const response = await createOrder(orderData);
      console.log("Order response success:", response);
      
      setLastCreatedOrder(response);
      clearCart();
      setCheckoutStep('success');
      toast.success("Pedido realizado com sucesso!");
    } catch (error: any) {
      console.error("Error creating order:", error);
      toast.error("Erro ao realizar pedido: " + (error.message || "Erro desconhecido"));
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
              alt="Capa da Confeitaria" 
              className="w-full h-full object-cover brightness-90 transition-transform duration-700 hover:scale-105" 
              onError={(e) => {
                (e.target as HTMLImageElement).src = 'https://placehold.co/1200x400?text=Capa+Indisponível';
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
                    (e.target as HTMLImageElement).src = 'https://placehold.co/200x200?text=Logo';
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
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
                  {settings.name}
                </h1>
                <Badge 
                  className={`px-2 py-0.5 rounded-full text-[10px] font-black border-none ${
                    settings.is_open 
                      ? "bg-green-100 text-green-700" 
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {settings.is_open ? "ABERTO" : "FECHADO"}
                </Badge>
              </div>
              <p className="text-slate-500 text-sm md:text-base font-medium line-clamp-2 max-w-2xl">
                {settings.description}
              </p>
            </div>

            <div className="flex flex-col gap-2 shrink-0 md:text-right">
              <div className="flex items-center md:justify-end gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
                <Clock className="w-3.5 h-3.5 text-[var(--primary-color)]" />
                <span>{settings.opening_hours}</span>
              </div>
              {settings.address && (
                <div className="flex items-center md:justify-end gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
                  <MapPin className="w-3.5 h-3.5 text-[var(--primary-color)]" />
                  <span className="line-clamp-1">{settings.address}</span>
                </div>
              )}
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
              {category.products.map((product) => (
                <Card 
                  key={product.id} 
                  className="group relative overflow-hidden rounded-2xl border-slate-100 bg-white hover:border-[var(--primary-color)]/20 transition-all duration-300 cursor-pointer flex p-3 md:p-4 gap-4"
                  onClick={() => setSelectedProduct(product)}
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
                      </div>
                      <p className="text-slate-400 text-xs md:text-sm font-medium line-clamp-2 md:line-clamp-3">
                        {product.description}
                      </p>
                    </div>

                    <div className="flex items-center justify-between mt-4">
                      <span className="text-base md:text-lg font-black text-[var(--primary-color)] tracking-tight">
                        {formatCurrency(product.price)}
                      </span>
                      <Button 
                        size="sm"
                        className="h-8 w-8 md:h-10 md:w-10 rounded-xl text-white transition-all active:scale-90 hover:text-white hover:brightness-110"
                        style={{ backgroundColor: 'var(--primary-color)' }}
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
                          (e.target as HTMLImageElement).src = 'https://placehold.co/400x400?text=Imagem';
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ShoppingBag className="w-8 h-8 md:w-10 md:h-10 text-slate-200" />
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          </section>
        ))}
      </main>

      <Footer settings={settings} />


      {/* Mobile Footer (Cart) */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-slate-100 md:hidden z-50">
        <Sheet open={isCartOpen} onOpenChange={setIsCartOpen}>
          <SheetTrigger asChild>
            <Button 
              className="w-full h-14 text-lg font-black rounded-2xl flex items-center justify-between px-6 border-none shadow-none text-white hover:text-white hover:brightness-110"
              style={{ backgroundColor: 'var(--primary-color)' }}
              disabled={!isHydrated || getTotalItems() === 0}
            >
              <div className="flex items-center gap-3">
                <div className="relative">
                  <ShoppingBag className="w-6 h-6 text-white" />
                  {isHydrated && getTotalItems() > 0 && (
                    <div className="absolute -top-2 -right-2 bg-white text-[var(--primary-color)] border-none min-w-[20px] h-5 flex items-center justify-center p-0 text-[10px] font-black rounded-full">
                      {getTotalItems()}
                    </div>
                  )}
                </div>
                <span className="tracking-tight">VER SACOLA</span>
              </div>
              <span className="font-black tracking-tight">{isHydrated ? formatCurrency(getTotal()) : formatCurrency(0)}</span>
            </Button>
          </SheetTrigger>


          <SheetContent side="bottom" className="h-[90vh] rounded-t-3xl p-0 flex flex-col">
            <SheetHeader className="p-6 border-b shrink-0">
              <SheetTitle className="text-xl flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-[var(--primary-color)]" />
                Sua Sacola
              </SheetTitle>
            </SheetHeader>
            <CartContent 
              items={items} 
              removeItem={removeItem} 
              updateQuantity={updateQuantity} 
              getSubtotal={getSubtotal}
              getDeliveryFee={getDeliveryFee}
              getTotal={getTotal}
              formatCurrency={formatCurrency}
              onClose={() => {
                setIsCartOpen(false);
                setCheckoutStep('cart');
              }}
              checkoutStep={checkoutStep}
              setCheckoutStep={setCheckoutStep}
              orderInfo={orderInfo}
              setOrderInfo={setOrderInfo}
              onSubmit={handleCreateOrder}
              handleCreateOrder={handleCreateOrder}
              isSubmitting={isSubmitting}
              deliveryFees={deliveryFees}
              settings={settings}
              lastCreatedOrder={lastCreatedOrder}
              isHydrated={isHydrated}
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
              {isHydrated && getTotalItems() > 0 && (
                <div className="absolute -top-1 -right-1 bg-slate-900 text-white border-2 border-white min-w-[24px] h-6 flex items-center justify-center p-0 font-black text-[10px] rounded-full">
                  {getTotalItems()}
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
            <CartContent 
              items={items} 
              removeItem={removeItem} 
              updateQuantity={updateQuantity} 
              getSubtotal={getSubtotal}
              getDeliveryFee={getDeliveryFee}
              getTotal={getTotal}
              formatCurrency={formatCurrency}
              onClose={() => {
                setIsCartOpen(false);
                setCheckoutStep('cart');
              }}
              checkoutStep={checkoutStep}
              setCheckoutStep={setCheckoutStep}
              orderInfo={orderInfo}
              setOrderInfo={setOrderInfo}
              onSubmit={handleCreateOrder}
              handleCreateOrder={handleCreateOrder}
              isSubmitting={isSubmitting}
              deliveryFees={deliveryFees}
              settings={settings}
              lastCreatedOrder={lastCreatedOrder}
              isHydrated={isHydrated}
            />
          </SheetContent>
        </Sheet>
      </div>



      {/* Product Details Dialog */}
      <Dialog open={!!selectedProduct} onOpenChange={(open) => {
        if (!open) {
          setSelectedProduct(null);
          setProductObservation("");
          setSelectedAddons({});
        }
      }}>
        <DialogContent className="w-[95vw] sm:max-w-2xl p-0 overflow-y-auto rounded-2xl gap-0 border-none flex flex-col max-h-[90vh] md:max-h-[85vh]">
          {selectedProduct && (
            <>
              <div className="flex-1 overflow-visible">
                <div className="relative w-full overflow-hidden bg-slate-100 shrink-0">
                  {selectedProduct.image_url ? (
                    <img 
                      src={selectedProduct.image_url} 
                      alt={selectedProduct.name} 
                      className="w-full h-auto max-h-[70vh] object-contain mx-auto" 
                    />
                  ) : (
                    <div className="w-full h-full bg-[var(--secondary-color)] flex items-center justify-center">
                      <ShoppingBag className="w-20 h-20 text-[var(--primary-color)]/30" />
                    </div>
                  )}
                  {/* Close button handled by Dialog primitive but we can add a visual one if needed */}
                </div>

                <div className="p-6 md:p-8">
                  <DialogHeader className="space-y-4">
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-3">
                          <DialogTitle className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
                            {selectedProduct.name}
                          </DialogTitle>
                          {selectedProduct.is_featured && (
                            <Badge className="bg-amber-400 text-amber-950 font-black border-none text-[10px] px-2 py-0.5">
                              DESTAQUE
                            </Badge>
                          )}
                        </div>
                        <p className="text-slate-500 font-medium leading-relaxed">
                          {selectedProduct.description}
                        </p>
                      </div>
                      <div className="bg-slate-100 px-4 py-2 rounded-2xl border border-slate-200 shrink-0">
                        <span className="text-xs font-black text-slate-400 uppercase tracking-widest block">Preço Base</span>
                        <span className="text-2xl font-black text-slate-900 tracking-tight">
                          {formatCurrency(selectedProduct.price)}
                        </span>
                      </div>
                    </div>
                  </DialogHeader>
                  
                  {/* Add-ons groups */}
                  <div className="mt-8 space-y-8">

                    {selectedProduct.addons?.map((addonGroupRelation: any) => {
                      const group = addonGroupRelation.group;
                      if (!group || group.status !== 'active') return null;
                      
                      const selectedInGroup = selectedAddons[group.id] || [];
                      const canSelectMore = selectedInGroup.length < (group.max_quantity || 1);
                      
                      return (
                        <div key={group.id} className="space-y-4 bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
                          <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                              <h4 className="font-black text-slate-900 tracking-tight">{group.name}</h4>
                              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                                {group.is_required ? `Obrigatório • Mín ${group.min_quantity}` : `Opcional • Máx ${group.max_quantity}`}
                              </p>
                            </div>
                            {group.is_required && (
                              <Badge className="bg-rose-100 text-rose-600 border-none font-black text-[10px] tracking-widest">
                                OBRIGATÓRIO
                              </Badge>
                            )}
                          </div>
                          
                          <div className="grid gap-2">
                            {group.items?.filter((item: any) => item.status === 'active').map((item: any) => (
                              <div 
                                key={item.id}
                                className={`flex items-center justify-between p-3 rounded-xl border-2 transition-all cursor-pointer ${
                                  (selectedAddons[group.id] || []).includes(item.id)
                                    ? 'border-[var(--primary-color)] bg-[var(--secondary-color)]'
                                    : 'border-white bg-white hover:border-slate-100'
                                }`}
                                onClick={() => {
                                  const current = selectedAddons[group.id] || [];
                                  if (current.includes(item.id)) {
                                    setSelectedAddons({
                                      ...selectedAddons,
                                      [group.id]: current.filter(id => id !== item.id)
                                    });
                                  } else {
                                    if (!canSelectMore) {
                                       if (group.max_quantity === 1) {
                                          setSelectedAddons({
                                            ...selectedAddons,
                                            [group.id]: [item.id]
                                          });
                                       }
                                       return;
                                    }
                                    setSelectedAddons({
                                      ...selectedAddons,
                                      [group.id]: [...current, item.id]
                                    });
                                  }
                                }}
                              >
                                <div className="flex items-center gap-3">
                                  <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                                    (selectedAddons[group.id] || []).includes(item.id)
                                      ? 'bg-[var(--primary-color)] border-[var(--primary-color)]'
                                      : 'border-slate-200'
                                  }`}>
                                    {(selectedAddons[group.id] || []).includes(item.id) && (
                                      <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                                    )}
                                  </div>
                                  <span className="font-bold text-slate-700">{item.name}</span>
                                </div>
                                <span className="text-sm font-black text-[var(--primary-color)]">
                                  {item.price > 0 ? `+ ${formatCurrency(item.price)}` : 'Grátis'}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}

                    <div className="space-y-3 pb-4">
                      <Label htmlFor="observation" className="font-black text-slate-900 tracking-tight uppercase text-xs">Alguma observação?</Label>
                      <Textarea 
                        id="observation"
                        placeholder="Ex: Sem açúcar, embalagem para presente..."
                        className="rounded-2xl border-slate-200 focus:ring-[var(--primary-color)] min-h-[100px] font-medium"
                        value={productObservation}
                        onChange={(e) => setProductObservation(e.target.value)}
                      />
                    </div>

                  </div>
                </div>
              </div>
              
              <DialogFooter className="p-6 border-t bg-white shrink-0">
                <Button 
                  className="w-full h-14 text-lg font-black rounded-2xl border-none shadow-none text-white hover:text-white hover:brightness-110"
                  style={{ backgroundColor: 'var(--primary-color)' }}
                  onClick={() => {

                    // Validation
                    const missingRequired = selectedProduct.addons?.some((rel: any) => {
                      const group = rel.group;
                      if (!group || !group.is_required) return false;
                      const selectedCount = (selectedAddons[group.id] || []).length;
                      return selectedCount < group.min_quantity;
                    });

                    if (missingRequired) {
                      toast.error("Por favor, selecione os itens obrigatórios.");
                      return;
                    }

                    // Build item with full addon data
                    const flatAddons: any[] = [];
                    Object.entries(selectedAddons).forEach(([groupId, addonIds]) => {
                      const groupRel = selectedProduct.addons.find((rel: any) => rel.group.id === groupId);
                      addonIds.forEach(id => {
                        const addon = groupRel.group.items.find((i: any) => i.id === id);
                        if (addon) flatAddons.push(addon);
                      });
                    });

                    addItem({
                      product_id: selectedProduct.id,
                      name: selectedProduct.name,
                      price: selectedProduct.price,
                      quantity: 1,
                      image_url: selectedProduct.image_url,
                      observation: productObservation,
                      addons: flatAddons.map(a => ({ id: a.id, name: a.name, price: a.price }))
                    });
                    
                    toast.success("Produto adicionado à sacola!");
                    setSelectedProduct(null);
                    setProductObservation("");
                    setSelectedAddons({});
                  }}
                >
                  Adicionar à sacola
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CartContent({ 
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
  isHydrated
}: any) {
  const handleSendWhatsApp = () => {
    if (!lastCreatedOrder || !settings.whatsapp) return;

    const itemsText = lastCreatedOrder.order_items.map((item: any) => {
      const addonsText = item.addons && item.addons.length > 0 
        ? `\n   + Adicionais: ${item.addons.map((a: any) => a.name).join(', ')}` 
        : '';
      const obsText = item.observation ? `\n   + Obs: ${item.observation}` : '';
      const prodName = item.products?.name || 'Produto';
      const formattedPrice = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.price_at_time * item.quantity);
      return `* ${item.quantity}x ${prodName} - ${formattedPrice}${addonsText}${obsText}`;
    }).join('\n');

    const orderId = lastCreatedOrder.id.split('-')[0].toUpperCase();
    const deliveryFeeFormatted = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(lastCreatedOrder.delivery_fee);
    const totalAmountFormatted = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(lastCreatedOrder.total_amount);
    const paymentMethod = lastCreatedOrder.payment_method.toUpperCase();
    const observations = lastCreatedOrder.observation ? `\n*Observações:* ${lastCreatedOrder.observation}` : '';

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
    const cleanWhatsapp = settings.whatsapp.replace(/\D/g, '');
    const whatsappUrl = `https://wa.me/55${cleanWhatsapp}?text=${encodedMessage}`;
    window.open(whatsappUrl, '_blank');
  };

  if (checkoutStep === 'success') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
        <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mb-6">
          <CheckCircle2 className="w-10 h-10 text-green-500" />
        </div>
        <h3 className="text-2xl font-bold text-slate-900">Pedido Confirmado!</h3>
        <p className="text-slate-500 mt-2 mb-8">
          Recebemos seu pedido com sucesso. Em breve iniciaremos o preparo!
        </p>
        
        <div className="w-full space-y-3">
          {settings.whatsapp && (
            <Button 
              onClick={handleSendWhatsApp}
              className="w-full bg-green-600 hover:bg-green-700 h-14 text-lg rounded-xl gap-2 shadow-lg"
            >
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              Enviar pedido pelo WhatsApp
            </Button>
          )}

          <Button 
            variant="outline"
            onClick={() => {
              onClose();
              setCheckoutStep('cart');
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
        <p className="text-slate-500 mt-2 mb-8">Que tal adicionar alguns doces para alegrar o dia?</p>
        <Button onClick={onClose} variant="outline" className="rounded-xl px-8">Ver cardápio</Button>
      </div>
    );
  }

  return (
    <>
      <ScrollArea className="flex-1">
        {checkoutStep === 'cart' ? (
          <div className="p-6 space-y-6">
            {items.map((item: any) => (
              <div key={item.id} className="flex gap-4 group">
                {item.image_url ? (
                  <div className="w-20 h-20 rounded-xl overflow-hidden shrink-0 border border-slate-100">
                    <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
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
                        + {item.addons.map((a: any) => a.name).join(', ')}
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
                      <span className="w-8 text-center text-sm font-bold text-slate-700">{item.quantity}</span>
                      <button 
                        className="w-8 flex items-center justify-center hover:text-[var(--primary-color)]"
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                      >
                        <Plus className="w-3.5 h-3.5 text-slate-600" />
                      </button>
                    </div>
                    <span className="font-bold text-slate-900">
                      {formatCurrency((item.price + item.addons.reduce((s: any, a: any) => s + a.price, 0)) * item.quantity)}
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
              onClick={() => setCheckoutStep('cart')}
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
                    onChange={e => setOrderInfo({...orderInfo, name: e.target.value})}
                    placeholder="Como devemos te chamar?"
                    className="text-slate-900 border-slate-200 focus:border-[var(--primary-color)]"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label className="text-slate-900 font-bold">Telefone / WhatsApp *</Label>
                  <Input 
                    value={orderInfo.phone}
                    onChange={e => setOrderInfo({...orderInfo, phone: e.target.value})}
                    placeholder="(00) 00000-0000"
                    className="text-slate-900 border-slate-200 focus:border-[var(--primary-color)]"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-slate-900 font-bold">Bairro *</Label>
                    <Select 
                      value={orderInfo.neighborhood} 
                      onValueChange={v => setOrderInfo({...orderInfo, neighborhood: v})}
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
                          <SelectItem value="none" disabled>Nenhum bairro disponível</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                    {(!deliveryFees || deliveryFees.length === 0) && (
                      <Alert variant="destructive" className="py-2 px-3 mt-2">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription className="text-xs">
                          Nenhum bairro disponível para entrega no momento. Por favor, contate a loja.
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-900 font-bold">Rua *</Label>
                    <Input 
                      value={orderInfo.street}
                      onChange={e => setOrderInfo({...orderInfo, street: e.target.value})}
                      className="text-slate-900 border-slate-200 focus:border-[var(--primary-color)]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-slate-900 font-bold">Número *</Label>
                    <Input 
                      value={orderInfo.number}
                      onChange={e => setOrderInfo({...orderInfo, number: e.target.value})}
                      className="text-slate-900 border-slate-200 focus:border-[var(--primary-color)]"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-900 font-bold">Complemento</Label>
                    <Input 
                      value={orderInfo.complement}
                      onChange={e => setOrderInfo({...orderInfo, complement: e.target.value})}
                      placeholder="Apto, Bloco, etc."
                      className="text-slate-900 border-slate-200 focus:border-[var(--primary-color)]"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-slate-900 font-bold">Ponto de Referência</Label>
                  <Input 
                    value={orderInfo.reference}
                    onChange={e => setOrderInfo({...orderInfo, reference: e.target.value})}
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
                  onClick={() => setOrderInfo({...orderInfo, payment_method: 'pix'})}
                  className={cn(
                    "flex flex-col items-center justify-center p-4 border-2 rounded-xl cursor-pointer transition-all",
                    orderInfo.payment_method === 'pix' ? "border-[var(--primary-color)] bg-[var(--secondary-color)]" : "border-slate-100 hover:border-slate-200"
                  )}
                >
                  <span className="font-bold text-slate-700">Pix</span>
                </button>
                <button
                  type="button"
                  onClick={() => setOrderInfo({...orderInfo, payment_method: 'money'})}
                  className={cn(
                    "flex flex-col items-center justify-center p-4 border-2 rounded-xl cursor-pointer transition-all",
                    orderInfo.payment_method === 'money' ? "border-[var(--primary-color)] bg-[var(--secondary-color)]" : "border-slate-100 hover:border-slate-200"
                  )}
                >
                  <span className="font-bold text-slate-700">Dinheiro</span>
                </button>
                <button
                  type="button"
                  onClick={() => setOrderInfo({...orderInfo, payment_method: 'card'})}
                  className={cn(
                    "flex flex-col items-center justify-center p-4 border-2 rounded-xl cursor-pointer transition-all",
                    orderInfo.payment_method === 'card' ? "border-[var(--primary-color)] bg-[var(--secondary-color)]" : "border-slate-100 hover:border-slate-200"
                  )}
                >
                  <span className="font-bold text-slate-700">Cartão</span>
                </button>
              </div>
            </div>

            <div className="space-y-2 pb-6">
              <Label className="text-slate-900 font-bold">Observações do Pedido</Label>
              <Textarea 
                value={orderInfo.observation}
                onChange={e => setOrderInfo({...orderInfo, observation: e.target.value})}
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
            <span className="text-[var(--primary-color)]">{isHydrated ? formatCurrency(getTotal()) : formatCurrency(0)}</span>
          </div>
        </div>
        
        {checkoutStep === 'cart' ? (
          <Button 
            className="w-full h-14 text-lg rounded-xl border-none shadow-none text-white font-black hover:text-white hover:brightness-110"
            style={{ backgroundColor: 'var(--primary-color)' }}
            onClick={() => setCheckoutStep('info')}
          >
            Finalizar Pedido
          </Button>
        ) : (
          <Button 
            className="w-full bg-green-600 hover:bg-green-700 h-14 text-lg rounded-xl shadow-lg gap-2 text-white font-black"
            onClick={() => {
              console.log("Confirm button clicked - calling onSubmit");
              onSubmit();
            }}
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
function Footer({ settings }: { settings: StoreSettings }) {
  return (
    <footer className="bg-white border-t py-12 pb-32 md:pb-12 mt-12">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="space-y-4">
            <h3 className="font-bold text-lg text-[var(--primary-color)]">{settings.name}</h3>
            <p className="text-slate-500 text-sm max-w-xs">{settings.description}</p>
            {settings.instagram && (
              <a 
                href={`https://instagram.com/${settings.instagram.replace('@', '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-[var(--primary-color)] hover:brightness-110 font-medium transition-colors"
              >
                <Instagram className="w-5 h-5" />
                <span>{settings.instagram}</span>
              </a>
            )}
          </div>

          <div className="space-y-4">
            <h4 className="font-bold text-slate-900 text-sm uppercase tracking-wider">Contato</h4>
            <div className="space-y-3">
              {settings.phone && (
                <div className="flex items-center gap-3 text-slate-500 text-sm">
                  <Phone className="w-4 h-4" />
                  <span>{settings.phone}</span>
                </div>
              )}
              {settings.whatsapp && (
                <a 
                  href={`https://wa.me/55${settings.whatsapp.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 text-slate-500 hover:text-green-600 transition-colors text-sm"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                  <span>WhatsApp</span>
                </a>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="font-bold text-slate-900 text-sm uppercase tracking-wider">Endereço</h4>
            <div className="flex gap-3 text-slate-500">
              <MapPin className="w-5 h-5 shrink-0" />
              <p className="text-sm">{settings.address || 'Endereço não informado'}</p>
            </div>
            <div className="flex gap-3 text-slate-500">
              <Clock className="w-5 h-5 shrink-0" />
              <p className="text-sm">{settings.opening_hours}</p>
            </div>
          </div>
        </div>
        
        <Separator className="my-8" />
        
        <div className="text-center text-slate-400 text-[10px] uppercase tracking-wider font-bold">
          © 2026 {settings.name} • Feito com Amor
        </div>
      </div>
    </footer>
  );
}
