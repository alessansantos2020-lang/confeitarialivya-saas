/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X, Zap, Timer } from "lucide-react";
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
        className="w-[88vw] max-w-sm max-h-[78dvh] overflow-y-auto gap-0 rounded-2xl border-none bg-white p-0 animate-in fade-in zoom-in-90 duration-500"
        hideClose
      >
        <DialogTitle className="sr-only">Oferta Relâmpago — {headline}</DialogTitle>

        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar oferta"
          className="absolute right-3 top-3 z-10 rounded-full bg-black/45 p-1.5 text-white backdrop-blur-sm transition-colors hover:bg-black/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          <X size={18} />
        </button>

        <div
          className="flex origin-center animate-pulse items-center justify-center gap-2 py-2 text-xs font-black tracking-wide text-white"
          style={{ background: "var(--primary-color, #1d4ed8)" }}
        >
          <Zap size={15} fill="currentColor" />
          Oferta Relâmpago
        </div>

        <div className="bg-slate-100">
          {offer.image_url ? (
            <img
              src={offer.image_url}
              alt={headline}
              className="h-36 w-full object-cover sm:h-40"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          ) : (
            <div className="flex h-40 items-center justify-center bg-[var(--secondary-color)] text-4xl">
              ⚡
            </div>
          )}
        </div>

        <div className="space-y-3 p-5 text-center">
          <h2 className="text-xl font-black leading-tight text-slate-900">{headline}</h2>
          {message ? <p className="text-sm text-slate-500 line-clamp-2">{message}</p> : null}

          <div className="flex items-center justify-center gap-2.5">
            <span className="text-base font-semibold text-slate-400 line-through">
              {formatCurrency(offer.price)}
            </span>
            <span
              className="text-3xl font-black"
              style={{ color: "var(--primary-color, #1d4ed8)" }}
            >
              {formatCurrency(salePrice)}
            </span>
            {discount > 0 && (
              <span className="rounded-full bg-red-600 px-2 py-0.5 text-[11px] font-black text-white">
                -{discount}%
              </span>
            )}
          </div>

          <div className="flex flex-col items-center gap-1 rounded-xl bg-slate-50 px-4 py-2.5">
            <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              <Timer size={13} />
              Termina em
            </span>
            <span
              data-testid="flash-countdown"
              className="font-mono text-2xl font-black tabular-nums text-slate-900"
            >
              {countdown}
            </span>
          </div>

          <Button
            className="h-12 w-full animate-pulse rounded-xl text-base font-black shadow-lg transition-transform active:scale-[0.98] motion-reduce:animate-none"
            style={{ background: "var(--primary-color, #1d4ed8)" }}
            onClick={() => onAskNow(offer)}
          >
            PEDIR AGORA
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
