/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { X, Zap, Timer, ShoppingCart, ArrowRight } from "lucide-react";
import { getDiscountPercent } from "@/lib/promotions";
import { getFlashCountdown } from "@/lib/flash-offer";

type FlashOfferModalProps = {
  offer: any;
  formatCurrency: (value: number) => string;
  onAskNow: (offer: any) => void;
  onClose: () => void;
};

export function FlashOfferModal({
  offer,
  formatCurrency,
  onAskNow,
  onClose,
}: FlashOfferModalProps) {
  const [countdown, setCountdown] = useState(() => getFlashCountdown(offer?.sale_end_at));

  useEffect(() => {
    if (!offer?.sale_end_at) return;
    const tick = () => setCountdown(getFlashCountdown(offer.sale_end_at));
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [offer?.sale_end_at]);

  // Zerou o contador: o banco já reverteu o preço; o modal sai sozinho.
  useEffect(() => {
    if (countdown === "00:00:00") onClose();
  }, [countdown, onClose]);

  if (!offer) return null;

  const headline = offer.flash_headline?.trim() || offer.name;
  const message = offer.flash_message?.trim() || offer.description || "";
  const discount = getDiscountPercent(offer.price, offer.sale_price ?? offer.effective_price);
  const salePrice = offer.sale_price ?? offer.effective_price ?? offer.price;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="w-[92vw] max-w-[400px] max-h-[75dvh] overflow-y-auto gap-0 rounded-[24px] border-none bg-white p-0 animate-in fade-in zoom-in-[0.94] duration-300 shadow-[0_25px_60px_-12px_rgba(0,0,0,0.55)]"
        hideClose
      >
        <DialogTitle className="sr-only">Oferta Relâmpago — {headline}</DialogTitle>

        {/* Cabeçalho gradiente */}
        <div
          className="relative bg-gradient-to-r from-red-600 via-red-500 to-orange-500 px-5 py-3 text-white"
          style={{ borderRadius: "24px 24px 0 0" }}
        >
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar oferta"
            className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur-sm transition-colors hover:bg-black/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <X size={18} />
          </button>
          <div className="flex items-center gap-2">
            <Zap size={18} fill="currentColor" className="shrink-0" />
            <span className="text-sm font-black uppercase tracking-wider drop-shadow-sm">
              Oferta Relâmpago
            </span>
          </div>
          <p className="mt-0.5 pl-[26px] text-[11px] font-semibold uppercase tracking-wide text-white/85">
            Aproveite, é por tempo limitado!
          </p>
        </div>

        {/* Imagem do produto */}
        <div className="px-4 pt-4">
          {offer.image_url ? (
            <img
              src={offer.image_url}
              alt={headline}
              className="h-44 w-full rounded-[18px] object-cover sm:h-52"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          ) : (
            <div className="flex h-44 items-center justify-center rounded-[18px] bg-orange-50 text-5xl sm:h-52">
              ⚡
            </div>
          )}
        </div>

        {/* Produto, preço e contador */}
        <div className="flex flex-col items-center gap-3 px-5 pb-5 pt-4 text-center">
          <h2 className="text-2xl font-extrabold leading-tight text-slate-900">{headline}</h2>
          {message ? <p className="text-sm text-slate-500 line-clamp-2">{message}</p> : null}

          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
            <span className="text-base font-semibold text-slate-400 line-through">
              {formatCurrency(offer.price)}
            </span>
            <span
              className="text-4xl font-extrabold tracking-tight"
              style={{ color: "var(--primary-color, #1d4ed8)" }}
            >
              {formatCurrency(salePrice)}
            </span>
            {discount > 0 && (
              <span className="rounded-full bg-red-600 px-2.5 py-1 text-xs font-black text-white shadow-sm">
                -{discount}%
              </span>
            )}
          </div>

          <div
            className="flex w-full flex-col items-center gap-0.5 rounded-[18px] bg-gradient-to-r from-red-50 to-orange-50 px-4 py-2.5"
            data-testid="flash-countdown"
          >
            <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-red-500">
              <Timer size={13} />
              Termina em
            </span>
            <span className="font-mono text-2xl font-black tabular-nums text-red-600">
              {countdown}
            </span>
          </div>

          <button
            type="button"
            onClick={() => onAskNow(offer)}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-[18px] bg-gradient-to-r from-red-600 to-orange-500 text-base font-extrabold uppercase tracking-wide text-white shadow-lg shadow-red-500/30 transition-transform active:scale-[0.97]"
          >
            <ShoppingCart size={18} />
            Pedir agora
            <ArrowRight size={18} />
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
