import { X } from "lucide-react";
import { getDiscountPercent } from "@/lib/promotions";

type PromotionsModalProps = {
  open: boolean;
  promotions: any[];
  formatCurrency: (value: number) => string;
  onSelect: (product: any) => void;
  onClose: () => void;
};

export function PromotionsModal({
  open,
  promotions,
  formatCurrency,
  onSelect,
  onClose,
}: PromotionsModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-[calc(100%-32px)] max-w-md max-h-[75vh] rounded-[20px] bg-white shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <h2 className="text-2xl font-black tracking-tight text-slate-900">Promoções</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar promoções"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition-colors hover:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
          >
            <X size={20} />
          </button>
        </div>

        {promotions.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-3xl">
              🎟️
            </div>
            <p className="text-sm font-semibold text-slate-500">
              Não há promoções disponíveis no momento.
            </p>
          </div>
        ) : (
          <div className="overflow-y-auto p-4 space-y-3">
            {promotions.map((product: any) => {
              const salePrice = product.sale_price ?? product.effective_price;
              const discount = getDiscountPercent(product.price, salePrice);
              return (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => onSelect(product)}
                  className="flex w-full items-center gap-4 rounded-2xl border border-slate-100 bg-white p-3 text-left shadow-sm transition-all hover:border-[var(--primary-color)]/30 hover:shadow-md active:scale-[0.99]"
                >
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <h3 className="text-sm font-bold text-slate-900 leading-snug line-clamp-2">
                      {product.name}
                    </h3>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span
                        className="text-lg font-black"
                        style={{ color: "var(--primary-color, #1d4ed8)" }}
                      >
                        {formatCurrency(salePrice)}
                      </span>
                      <span className="text-sm text-slate-400 line-through">
                        {formatCurrency(product.price)}
                      </span>
                      {discount > 0 && (
                        <span className="rounded-md bg-rose-500 px-1.5 py-0.5 text-[10px] font-black text-white">
                          -{discount}%
                        </span>
                      )}
                    </div>
                  </div>
                  {product.image_url ? (
                    <img
                      src={product.image_url}
                      alt={product.name}
                      className="h-20 w-20 shrink-0 rounded-xl object-cover"
                      onError={(e) => {
                        e.currentTarget.style.visibility = "hidden";
                      }}
                    />
                  ) : (
                    <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-2xl">
                      🍽️
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
