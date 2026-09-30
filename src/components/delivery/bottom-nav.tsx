"use client";

import { Home, Ticket, ShoppingBag, User } from "lucide-react";

export type BottomNavTab = "cardapio" | "promocoes" | "pedidos" | "perfil";

type BottomNavProps = {
  activeTab: BottomNavTab;
  cartCount: number;
  onCardapio: () => void;
  onPromocoes: () => void;
  onPedidos: () => void;
  onPerfil: () => void;
};

export function BottomNav({
  activeTab,
  cartCount,
  onCardapio,
  onPromocoes,
  onPedidos,
  onPerfil,
}: BottomNavProps) {
  const items = [
    { key: "cardapio" as const, label: "Cardápio", Icon: Home, action: onCardapio },
    { key: "promocoes" as const, label: "Promoções", Icon: Ticket, action: onPromocoes },
    {
      key: "pedidos" as const,
      label: "Pedidos",
      Icon: ShoppingBag,
      action: onPedidos,
      badge: cartCount,
    },
    { key: "perfil" as const, label: "Perfil", Icon: User, action: onPerfil },
  ];

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white/95 backdrop-blur-sm md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Navegação principal"
    >
      <div className="grid h-16 grid-cols-4">
        {items.map(({ key, label, Icon, action, badge }) => {
          const active = activeTab === key;
          return (
            <button
              key={key}
              type="button"
              onClick={action}
              aria-current={active ? "page" : undefined}
              className={
                "relative flex flex-col items-center justify-center gap-0.5 transition-colors duration-200 active:scale-95 " +
                (active ? "text-[var(--primary-color)]" : "text-slate-400 hover:text-slate-600")
              }
            >
              <span className="relative">
                <Icon size={22} strokeWidth={active ? 2.4 : 2} />
                {key === "pedidos" && cartCount > 0 && (
                  <span className="absolute -top-1.5 -right-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--primary-color)] px-1 text-[9px] font-black text-white">
                    {cartCount}
                  </span>
                )}
              </span>
              <span
                className={"text-[10px] leading-none " + (active ? "font-black" : "font-semibold")}
              >
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
