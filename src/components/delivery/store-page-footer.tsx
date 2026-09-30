import { Clock, Phone, MapPin, Instagram, Heart } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import type { StoreSettings } from "@/lib/delivery.functions";

export function StorePageFooter({ settings }: { settings: StoreSettings }) {
  const hasContact = Boolean(settings.phone || settings.whatsapp);
  const hasStoreInfo = Boolean(settings.address || settings.opening_hours);
  return (
    <footer className="mt-8 border-t bg-slate-50 pb-6 pt-8 md:pb-8">
      <div className="container mx-auto px-4">
        <div className="mx-auto grid max-w-5xl grid-cols-1 gap-6 sm:grid-cols-2 md:gap-8 lg:grid-cols-3">
          <section className="space-y-3">
            <h2 className="font-bold text-lg text-[var(--primary-color)]">{settings.name}</h2>
            {settings.description && (
              <p className="text-slate-600 text-sm leading-relaxed">{settings.description}</p>
            )}
            {settings.instagram && (
              <a
                href={`https://instagram.com/${settings.instagram.replace("@", "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-h-11 items-center gap-2 font-medium text-[var(--primary-color)] hover:brightness-110"
              >
                <Instagram className="h-5 w-5" />
                <span>{settings.instagram}</span>
              </a>
            )}
          </section>

          {hasContact && (
            <section className="space-y-2">
              <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider">Contato</h3>
              <div className="space-y-1.5">
                {settings.phone && (
                  <a
                    href={`tel:${settings.phone.replace(/[^\d+]/g, "")}`}
                    className="flex min-h-10 items-center gap-3 text-slate-600 text-sm hover:text-[var(--primary-color)]"
                  >
                    <Phone className="h-4 w-4 shrink-0" />
                    <span>{settings.phone}</span>
                  </a>
                )}
                {settings.whatsapp && (
                  <a
                    href={`https://wa.me/55${settings.whatsapp.replace(/\D/g, "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex min-h-10 items-center gap-3 text-slate-600 text-sm hover:text-green-700"
                  >
                    <Phone className="h-4 w-4 shrink-0" />
                    <span>WhatsApp</span>
                  </a>
                )}
              </div>
            </section>
          )}

          {hasStoreInfo && (
            <section className="space-y-2">
              <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
                Informações da loja
              </h3>
              <div className="space-y-1.5">
                {settings.address && (
                  <div className="flex items-start gap-3 py-1 text-slate-600 text-sm">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                    <p>{settings.address}</p>
                  </div>
                )}
                {settings.opening_hours && (
                  <div className="flex items-start gap-3 py-1 text-slate-600 text-sm">
                    <Clock className="mt-0.5 h-4 w-4 shrink-0" />
                    <p>{settings.opening_hours}</p>
                  </div>
                )}
              </div>
            </section>
          )}
        </div>

        <Separator className="my-5" />
        <div className="flex items-center justify-center gap-1.5 text-center text-slate-400 text-[10px] font-bold uppercase tracking-wider">
          <span>
            © {new Date().getFullYear()} {settings.name}
          </span>
          <span aria-hidden="true">·</span>
          <span className="inline-flex items-center gap-1">
            Feito com <Heart className="h-3 w-3 fill-rose-400 text-rose-400" />
          </span>
        </div>
      </div>
    </footer>
  );
}
