import { Clock, Phone, MapPin, Instagram } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import type { StoreSettings } from "@/lib/delivery.functions";

export function StorePageFooter({ settings }: { settings: StoreSettings }) {
  return (
    <footer className="bg-white border-t py-12 pb-32 md:pb-12 mt-12">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="space-y-4">
            <h3 className="font-bold text-lg text-[var(--primary-color)]">{settings.name}</h3>
            <p className="text-slate-500 text-sm max-w-xs">{settings.description}</p>
            {settings.instagram && (
              <a
                href={`https://instagram.com/${settings.instagram.replace("@", "")}`}
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
                  href={`https://wa.me/55${settings.whatsapp.replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 text-slate-500 hover:text-green-600 transition-colors text-sm"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
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
              <p className="text-sm">{settings.address || "Endereço não informado"}</p>
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
