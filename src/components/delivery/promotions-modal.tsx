/* eslint-disable @typescript-eslint/no-explicit-any */
import { ArrowLeft, Ticket } from "lucide-react";
import { getDiscountPercent } from "@/lib/promotions";

type PromotionsModalProps = {
  open: boolean;
  promotions: any[];
  formatCurrency: (value: number) => string;
  onSelect: (product: any) => void;
  onClose: () => void;
  title?: string;
  emptyText?: string;
};

export function PromotionsModal({
  open,
  promotions,
  formatCurrency,
  onSelect,
  onClose,
  title = "Promoções",
  emptyText = "Não há promoções disponíveis no momento.",
}: PromotionsModalProps) {
  if (!open) return null;

  return (
    <section
      className="fixed inset-0 z-[60] flex flex-col bg-white pt-[env(safe-area-inset-top)] animate-in slide-in-from-right-2 duration-200"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-slate-100 px-4">
        <button
          type="button"
          onClick={onClose}
          aria-label="Voltar ao cardápio"
          className="flex h-10 w-10 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100"
        >
          <ArrowLeft size={20} />
        </button>
        <h2 className="flex-1 text-lg font-black text-slate-900">{title}</h2>
      </header>

      {promotions.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-3xl">
            <Ticket className="h-7 w-7 text-slate-400" />
          </div>
          <p className="text-sm font-semibold text-slate-500">{emptyText}</p>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[env(safe-area-inset-bottom)]">
          <div className="mx-auto grid w-full max-w-3xl grid-cols-1 gap-3 p-4 sm:grid-cols-2">
            {promotions.map((product: any) => {
              const salePrice = product.sale_price ?? product.effective_price;
              const discount = getDiscountPercent(product.price, salePrice);
              return (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => onSelect(product)}
                  className="flex min-h-28 w-full items-center gap-3 rounded-2xl border border-slate-100 bg-white p-3 text-left shadow-sm transition-colors hover:border-[var(--primary-color)]/30 active:bg-slate-50"
                >
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <h3 className="line-clamp-2 text-sm font-bold leading-snug text-slate-900">
                      {product.name}
                    </h3>
                    {product.description && (
                      <p className="line-clamp-2 text-xs text-slate-500">{product.description}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="text-base font-black text-[var(--primary-color)]">
                        {formatCurrency(salePrice)}
                      </span>
                      <span className="text-xs text-slate-400 line-through">
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
                      onError={(event) => {
                        event.currentTarget.style.visibility = "hidden";
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
        </div>
      )}
    </section>
  );
}
