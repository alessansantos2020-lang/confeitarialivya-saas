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
        className="w-[85vw] max-w-[360px] max-h-[55dvh] overflow-y-auto gap-0 rounded-[22px] border-none bg-white p-0 animate-in fade-in zoom-in-[0.94] duration-300 shadow-[0_25px_60px_-12px_rgba(0,0,0,0.55)]"
        hideClose
      >
        <DialogTitle className="sr-only">Oferta Relâmpago — {headline}</DialogTitle>

        {/* Cabeçalho gradiente compacto */}
        <div
          className="relative bg-gradient-to-r from-red-600 via-red-500 to-orange-500 px-4 py-2 text-white"
          style={{ borderRadius: "22px 22px 0 0" }}
        >
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar oferta"
            className="absolute right-2.5 top-2.5 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur-sm transition-colors hover:bg-black/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <X size={16} />
          </button>
          <div className="flex items-center gap-1.5">
            <Zap size={16} fill="currentColor" className="shrink-0" />
            <span className="text-xs font-black uppercase tracking-wider drop-shadow-sm">
              Oferta Relâmpago
            </span>
          </div>
          <p className="mt-0 pl-[22px] text-[10px] font-semibold uppercase tracking-wide text-white/85">
            Aproveite, é por tempo limitado!
          </p>
        </div>

        {/* Imagem do produto — compacta */}
        <div className="px-3 pt-2.5">
          {offer.image_url ? (
            <img
              src={offer.image_url}
              alt={headline}
              className="h-[110px] w-full rounded-[14px] object-cover sm:h-[130px]"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          ) : (
            <div className="flex h-[110px] items-center justify-center rounded-[14px] bg-orange-50 text-3xl sm:h-[130px]">
              ⚡
            </div>
          )}
        </div>

        {/* Produto, preço e contador — agrupados */}
        <div className="flex flex-col items-center gap-1.5 px-4 pb-3.5 pt-2.5 text-center">
          <h2 className="text-lg font-extrabold leading-tight text-slate-900 sm:text-xl">
            {headline}
          </h2>
          {message ? (
            <p className="line-clamp-1 text-xs text-slate-500">{message}</p>
          ) : null}

          <div className="flex flex-wrap items-center justify-center gap-x-2.5 gap-y-0.5">
            <span className="text-sm font-semibold text-slate-400 line-through">
              {formatCurrency(offer.price)}
            </span>
            <span
              className="text-3xl font-extrabold tracking-tight"
              style={{ color: "var(--primary-color, #1d4ed8)" }}
            >
              {formatCurrency(salePrice)}
            </span>
            {discount > 0 && (
              <span className="rounded-full bg-red-600 px-2 py-0.5 text-[11px] font-black text-white shadow-sm">
                -{discount}%
              </span>
            )}
          </div>

          <div
            className="flex w-full flex-row items-center justify-center gap-2 rounded-[12px] bg-gradient-to-r from-red-50 to-orange-50 px-3 py-1.5"
            data-testid="flash-countdown"
          >
            <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-red-500">
              <Timer size={11} />
              Termina em
            </span>
            <span className="font-mono text-lg font-black tabular-nums text-red-600">
              {countdown}
            </span>
          </div>

          <button
            type="button"
            onClick={() => onAskNow(offer)}
            className="mt-0.5 flex h-12 w-full items-center justify-center gap-2 rounded-[14px] bg-gradient-to-r from-red-600 to-orange-500 text-sm font-extrabold uppercase tracking-wide text-white shadow-md shadow-red-500/30 transition-transform active:scale-[0.97]"
          >
            <ShoppingCart size={16} />
            Pedir agora
            <ArrowRight size={16} />
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
