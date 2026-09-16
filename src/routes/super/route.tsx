import { createFileRoute, Outlet, Link, useNavigate, useLocation } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getUserRole } from "@/lib/auth.functions";
import { getSaasSettings, SAAS_NAME_FALLBACK } from "@/lib/saas-settings.functions";
import { storeThemeVars } from "@/lib/store-theme";
import { Button } from "@/components/ui/button";
import {
  Activity,
  CircleDollarSign,
  LayoutDashboard,
  Loader2,
  LogOut,
  Megaphone,
  Menu,
  Package,
  ScrollText,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Store as StoreIcon,
  User,
  Users,
  WalletCards,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/super")({
  ssr: false,
  component: SuperAdminLayout,
});

const NAV_ITEMS = [
  { to: "/super/dashboard", label: "Dashboard", icon: LayoutDashboard, exact: false },
  { to: "/super", label: "Lojas", icon: StoreIcon, exact: true },
  { to: "/super/usuarios", label: "Usuários", icon: Users, exact: false },
  { to: "/super/monitoramento", label: "Monitoramento", icon: Activity, exact: false },
  { to: "/super/financeiro", label: "Pedidos", icon: CircleDollarSign, exact: false },
  { to: "/super/cobrancas", label: "Cobranças", icon: WalletCards, exact: false },
  { to: "/super/avisos", label: "Avisos", icon: Megaphone, exact: false },
  { to: "/super/logs", label: "Logs", icon: ScrollText, exact: false },
  { to: "/super/planos", label: "Planos", icon: Package, exact: false },
  { to: "/super/configuracoes", label: "Configurações", icon: Settings, exact: false },
] as const;

function SuperAdminLayout() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [denied, setDenied] = useState(false);

  const { data: saas } = useQuery({
    queryKey: ["saas-settings"],
    queryFn: getSaasSettings,
    enabled: !isAuthLoading && !denied,
  });

  const saasName = saas?.name || SAAS_NAME_FALLBACK;
  const saasLogo = saas?.logo_url ?? null;

  const currentSection = pathname.startsWith("/super/planos")
    ? "Planos e Funcionalidades"
    : pathname.startsWith("/super/usuarios")
      ? "Usuários"
      : pathname.startsWith("/super/monitoramento")
        ? "Monitoramento"
        : pathname.startsWith("/super/cobrancas")
          ? "Cobranças"
          : pathname.startsWith("/super/financeiro")
            ? "Pedidos"
            : pathname.startsWith("/super/avisos")
              ? "Avisos"
              : pathname.startsWith("/super/logs")
                ? "Logs"
                : pathname.startsWith("/super/configuracoes")
                  ? "Configurações"
                  : pathname.startsWith("/super/dashboard")
                    ? "Dashboard"
                    : "Lojas";

  useEffect(() => {
    let active = true;
    const checkAccess = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!active) return;
        if (!data.session?.user) {
          await navigate({ to: "/auth" });
          return;
        }
        setUserEmail(data.session.user.email || "");
        const [role, profile] = await Promise.all([
          getUserRole(),
          supabase.from("profiles").select("status").eq("id", data.session.user.id).maybeSingle(),
        ]);
        if (role !== "super_admin" || profile.data?.status === "blocked") {
          setDenied(true);
          return;
        }
      } catch (error) {
        console.error("Erro ao verificar acesso super admin:", error);
        setDenied(true);
      } finally {
        if (active) setIsAuthLoading(false);
      }
    };
    void checkAccess();
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") void navigate({ to: "/auth" });
    });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [navigate]);

  useEffect(() => {
    if (!isMobileMenuOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsMobileMenuOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [isMobileMenuOpen]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    await navigate({ to: "/auth" });
  };

  if (isAuthLoading) {
    return (
      <div className="super-admin-shell flex min-h-screen items-center justify-center bg-[#08090c] text-slate-400">
        <Loader2 className="animate-spin text-red-500" size={22} />
      </div>
    );
  }

  if (denied) {
    return (
      <div className="super-admin-shell flex min-h-screen items-center justify-center bg-[#08090c] p-6 text-center text-slate-300">
        <div className="max-w-sm space-y-3">
          <ShieldAlert className="mx-auto text-red-400" size={30} />
          <h1 className="text-xl font-semibold text-white">Acesso restrito</h1>
          <p className="text-sm text-slate-500">
            Esta área está disponível apenas para administradores do sistema.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "super-admin-shell min-h-screen bg-[#08090c] text-slate-100",
        isCollapsed && "super-admin-shell-collapsed",
      )}
      style={storeThemeVars()}
    >
      {isMobileMenuOpen && (
        <button
          type="button"
          aria-label="Fechar menu"
          className="fixed inset-0 z-30 bg-black/70 backdrop-blur-[2px] md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-[268px] flex-col border-r border-white/[0.08] bg-[#0d1016] transition-transform duration-200 md:translate-x-0",
          isCollapsed && "md:w-[84px]",
          isMobileMenuOpen ? "translate-x-0" : "-translate-x-full",
        )}
        aria-label="Navegação principal"
      >
        <div
          className={cn(
            "flex h-[88px] items-center border-b border-white/[0.07] px-5",
            isCollapsed && "md:justify-center md:px-3",
          )}
        >
          <div className="flex min-w-0 items-center gap-3">
            {saasLogo ? (
              <img
                src={saasLogo}
                alt=""
                className="size-10 rounded-xl object-cover ring-1 ring-white/10"
              />
            ) : (
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-red-600 text-white shadow-[0_0_24px_rgba(220,38,38,0.22)]">
                <ShieldCheck size={21} />
              </div>
            )}
            <div className={cn("min-w-0", isCollapsed && "md:hidden")}>
              <p className="truncate text-sm font-semibold tracking-tight text-white">{saasName}</p>
              <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-red-400">
                Super admin
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Fechar menu"
            className="ml-auto rounded-md p-2 text-slate-500 hover:bg-white/[0.06] hover:text-white md:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-6">
          <p
            className={cn(
              "px-3 pb-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-600",
              isCollapsed && "md:hidden",
            )}
          >
            Workspace
          </p>
          {NAV_ITEMS.map(({ to, label, icon: Icon, exact }) => {
            const active = exact ? pathname === to : pathname.startsWith(to);
            return (
              <Link
                key={to}
                to={to}
                aria-current={active ? "page" : undefined}
                title={isCollapsed ? label : undefined}
                onClick={() => setIsMobileMenuOpen(false)}
                className={cn(
                  "group relative flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium text-slate-500 transition-colors hover:bg-white/[0.05] hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500",
                  isCollapsed && "md:justify-center md:px-0",
                  active && "bg-red-500/[0.09] text-white shadow-[inset_3px_0_0_#ef4444]",
                )}
              >
                <Icon
                  size={18}
                  className={cn(
                    "shrink-0 transition-colors",
                    active ? "text-red-400" : "text-slate-600 group-hover:text-slate-300",
                  )}
                />
                <span className={cn(isCollapsed && "md:hidden")}>{label}</span>
                {active && (
                  <span className="absolute right-3 size-1.5 rounded-full bg-red-400 shadow-[0_0_9px_#ef4444]" />
                )}
              </Link>
            );
          })}
        </nav>

        <div className={cn("border-t border-white/[0.07] p-3", isCollapsed && "md:px-3")}>
          <button
            type="button"
            title={isCollapsed ? "Sair" : undefined}
            className={cn(
              "flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium text-slate-500 transition-colors hover:bg-red-500/[0.08] hover:text-red-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500",
              isCollapsed && "md:justify-center md:px-0",
            )}
            onClick={handleLogout}
          >
            <LogOut size={18} />
            <span className={cn(isCollapsed && "md:hidden")}>Sair</span>
          </button>
        </div>
      </aside>

      <div
        className={cn(
          "min-h-screen transition-[padding] duration-200 md:pl-[268px]",
          isCollapsed && "md:pl-[84px]",
        )}
      >
        <header className="sticky top-0 z-20 flex min-h-[72px] items-center justify-between gap-4 border-b border-white/[0.08] bg-[#08090c]/90 px-4 backdrop-blur-xl md:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              aria-label="Abrir menu"
              aria-expanded={isMobileMenuOpen}
              className="rounded-lg p-2 text-slate-400 hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 md:hidden"
              onClick={() => setIsMobileMenuOpen(true)}
            >
              <Menu size={20} />
            </button>
            <button
              type="button"
              aria-label={isCollapsed ? "Expandir barra lateral" : "Recolher barra lateral"}
              aria-expanded={!isCollapsed}
              className="hidden rounded-lg p-2 text-slate-500 hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 md:block"
              onClick={() => setIsCollapsed((collapsed) => !collapsed)}
            >
              <Menu size={19} />
            </button>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-300">{currentSection}</p>
              <p className="hidden text-xs text-slate-600 sm:block">
                Console de gestão da plataforma
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 rounded-full border border-emerald-500/15 bg-emerald-500/[0.06] px-3 py-1.5 text-xs text-emerald-400 sm:flex">
              <span className="size-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
              Sistema protegido
            </div>
            <div className="flex max-w-[180px] items-center gap-2 rounded-full border border-white/[0.08] bg-[#11151c] px-3 py-1.5 text-xs text-slate-300">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-red-500/10 text-red-400">
                <User size={13} />
              </span>
              <span className="truncate">{userEmail}</span>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="hidden gap-2 border-white/[0.1] bg-transparent text-slate-400 hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-300 sm:inline-flex"
              onClick={handleLogout}
            >
              <LogOut size={15} />
              Sair
            </Button>
          </div>
        </header>

        <main className="min-h-[calc(100vh-72px)] bg-[radial-gradient(circle_at_80%_0%,rgba(127,29,29,0.1),transparent_28rem)] p-4 md:p-8">
          <div className="mx-auto max-w-7xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
