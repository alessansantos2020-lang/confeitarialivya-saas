/* eslint-disable @typescript-eslint/no-explicit-any */
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShoppingBag, Flame, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { getCatalogPricing } from "@/lib/promotions";

type ProductDialogProps = {
  product: any;
  observation: string;
  setObservation: (value: string) => void;
  selectedAddons: Record<string, string[]>;
  setSelectedAddons: (value: Record<string, string[]>) => void;
  formatCurrency: (value: number) => string;
  addItem: (item: any) => void;
  onClose: () => void;
};

export function StorePageProductDialog({
  product,
  observation,
  setObservation,
  selectedAddons,
  setSelectedAddons,
  formatCurrency,
  addItem,
  onClose,
}: ProductDialogProps) {
  return (
    <Dialog
      open={!!product}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
          setObservation("");
          setSelectedAddons({});
        }
      }}
    >
      <DialogContent className="w-[95vw] sm:max-w-2xl p-0 overflow-y-auto rounded-2xl gap-0 border-none flex flex-col max-h-[90vh] md:max-h-[85vh]">
        {product && (
          <>
            <div className="flex-1 overflow-visible">
              <div className="relative w-full overflow-hidden bg-slate-100 shrink-0">
                {product.image_url ? (
                  <img
                    src={product.image_url}
                    alt={product.name}
                    className="w-full h-44 sm:h-52 md:h-60 object-cover"
                  />
                ) : (
                  <div className="w-full h-44 sm:h-52 md:h-60 bg-[var(--secondary-color)] flex items-center justify-center">
                    <ShoppingBag className="w-16 h-16 text-[var(--primary-color)]/30" />
                  </div>
                )}
              </div>

              <div className="p-4 sm:p-6">
                <DialogHeader className="space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="flex-1 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <DialogTitle className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
                          {product.name}
                        </DialogTitle>
                        {product.is_featured && (
                          <Badge className="bg-amber-400 text-amber-950 font-black border-none text-[10px] px-2 py-0.5">
                            DESTAQUE
                          </Badge>
                        )}
                        {getCatalogPricing(product).onSale && (
                          <Badge className="bg-rose-500 text-white border-none font-black text-[10px] px-2 py-0.5 gap-1">
                            <Flame className="w-3 h-3" /> OFERTA
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-slate-500 font-medium leading-relaxed">
                        {product.description}
                      </p>
                    </div>
                    <div className="shrink-0">
                      {getCatalogPricing(product).onSale ? (
                        <div className="flex items-baseline gap-2">
                          <span className="text-sm text-slate-400 line-through font-medium">
                            {formatCurrency(getCatalogPricing(product).fullPrice)}
                          </span>
                          <span className="text-2xl font-black text-rose-500 tracking-tight">
                            {formatCurrency(getCatalogPricing(product).price)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-2xl font-black text-slate-900 tracking-tight">
                          {formatCurrency(product.price)}
                        </span>
                      )}
                    </div>
                  </div>
                </DialogHeader>

                {/* Add-ons groups */}
                <div className="mt-5 space-y-6">
                  {product.addons?.map((addonGroupRelation: any) => {
                    const group = addonGroupRelation.group;
                    if (!group || group.status !== "active") return null;

                    const selectedInGroup = selectedAddons[group.id] || [];
                    const canSelectMore = selectedInGroup.length < (group.max_quantity || 1);

                    return (
                      <div
                        key={group.id}
                        className="space-y-4 bg-slate-50/50 p-4 rounded-2xl border border-slate-100"
                      >
                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <h4 className="font-black text-slate-900 tracking-tight">
                              {group.name}
                            </h4>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                              {group.is_required
                                ? `Obrigatório • Mín ${group.min_quantity}`
                                : `Opcional • Máx ${group.max_quantity}`}
                            </p>
                          </div>
                          {group.is_required && (
                            <Badge className="bg-rose-100 text-rose-600 border-none font-black text-[10px] tracking-widest">
                              OBRIGATÓRIO
                            </Badge>
                          )}
                        </div>

                        <div className="grid gap-2">
                          {group.items
                            ?.filter((item: any) => item.status === "active")
                            .map((item: any) => (
                              <div
                                key={item.id}
                                className={`flex items-center justify-between p-3 rounded-xl border-2 transition-all cursor-pointer ${
                                  (selectedAddons[group.id] || []).includes(item.id)
                                    ? "border-[var(--primary-color)] bg-[var(--secondary-color)]"
                                    : "border-white bg-white hover:border-slate-100"
                                }`}
                                onClick={() => {
                                  const current = selectedAddons[group.id] || [];
                                  if (current.includes(item.id)) {
                                    setSelectedAddons({
                                      ...selectedAddons,
                                      [group.id]: current.filter((id) => id !== item.id),
                                    });
                                  } else {
                                    if (!canSelectMore) {
                                      if (group.max_quantity === 1) {
                                        setSelectedAddons({
                                          ...selectedAddons,
                                          [group.id]: [item.id],
                                        });
                                      }
                                      return;
                                    }
                                    setSelectedAddons({
                                      ...selectedAddons,
                                      [group.id]: [...current, item.id],
                                    });
                                  }
                                }}
                              >
                                <div className="flex items-center gap-3">
                                  <div
                                    className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                                      (selectedAddons[group.id] || []).includes(item.id)
                                        ? "bg-[var(--primary-color)] border-[var(--primary-color)]"
                                        : "border-slate-200"
                                    }`}
                                  >
                                    {(selectedAddons[group.id] || []).includes(item.id) && (
                                      <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                                    )}
                                  </div>
                                  <span className="font-bold text-slate-700">{item.name}</span>
                                </div>
                                <span className="text-sm font-black text-[var(--primary-color)]">
                                  {item.price > 0 ? `+ ${formatCurrency(item.price)}` : "Grátis"}
                                </span>
                              </div>
                            ))}
                        </div>
                      </div>
                    );
                  })}

                  <div className="space-y-3 pb-4">
                    <Label
                      htmlFor="observation"
                      className="font-black text-slate-900 tracking-tight uppercase text-xs"
                    >
                      Alguma observação?
                    </Label>
                    <Textarea
                      id="observation"
                      placeholder="Ex: Sem açúcar, embalagem para presente..."
                      className="rounded-2xl border-slate-200 focus:ring-[var(--primary-color)] min-h-[100px] font-medium"
                      value={observation}
                      onChange={(e) => setObservation(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter className="p-6 border-t bg-white shrink-0">
              <Button
                className="w-full h-14 text-lg font-black rounded-2xl border-none shadow-none text-white hover:text-white hover:brightness-110"
                style={{ backgroundColor: "var(--primary-color)" }}
                onClick={() => {
                  // Validation
                  const missingRequired = product.addons?.some((rel: any) => {
                    const group = rel.group;
                    if (!group || group.status !== "active" || !group.is_required) return false;
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
                    const groupRel = product.addons.find((rel: any) => rel.group.id === groupId);
                    addonIds.forEach((id) => {
                      const addon = groupRel.group.items.find((i: any) => i.id === id);
                      if (addon) flatAddons.push(addon);
                    });
                  });

                  addItem({
                    product_id: product.id,
                    name: product.name,
                    price: getCatalogPricing(product).price,
                    quantity: 1,
                    image_url: product.image_url,
                    observation: observation,
                    addons: flatAddons.map((a) => ({ id: a.id, name: a.name, price: a.price })),
                  });

                  toast.success("Produto adicionado à sacola!");
                  onClose();
                  setObservation("");
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
  );
}
