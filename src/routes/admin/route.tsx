import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { getUserRole, getMyPermissions } from "@/lib/auth.functions";
import { resolveActiveStore, type StoreMembership } from "@/lib/store-context";
import {
  getStoreFeatures,
  getStorePlan,
  FEATURE_LABEL,
  type FeatureId,
  type StorePlan,
} from "@/lib/features.functions";
import { getSupportSession, endSupportSession, type SupportSession } from "@/lib/support-session";
import { getActiveAnnouncements, type Announcement } from "@/lib/announcements.functions";
import {
  getSaasSettings,
  SAAS_NAME_FALLBACK,
  MAINTENANCE_FALLBACK,
} from "@/lib/saas-settings.functions";
import { ActiveStoreProvider } from "@/lib/active-store";
import { storeThemeVars } from "@/lib/store-theme";
import type { Store } from "@/lib/delivery.functions";

export const Route = createFileRoute("/admin")({
  ssr: false,
  component: AdminLayout,
});

import { Outlet, Link, useNavigate, useLocation } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  LogOut,
  LayoutDashboard,
  ShoppingBag,
  Package,
  Tags,
  PlusCircle,
  Users,
  Truck,
  BarChart3,
  Settings,
  Menu,
  X,
  User,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Lock,
  LifeBuoy,
  Megaphone,
  Wrench,
  Store as StoreIcon,
  WalletCards,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

// Qual funcionalidade cada rota do painel exige. Rota fora dessa lista é livre.
const ROUTE_FEATURE: Record<string, FeatureId> = {
  "/admin/products": "products",
  "/admin/categories": "categories",
  "/admin/add-ons": "addons",
  "/admin/customers": "customers",
  "/admin/delivery": "delivery",
  "/admin/reports": "reports",
  "/admin/settings": "settings",
  "/admin/orders": "orders",
  "/admin/cobrancas": "settings",
};

// Faixa de aviso: cores por gravidade e ordem de prioridade (só uma aparece
// por vez — duas faixas empilhadas empurram o painel para baixo demais).
const SEVERITY_BANNER: Record<string, string> = {
  info: "bg-blue-500 text-blue-950",
  warning: "bg-amber-500 text-amber-950",
  critical: "bg-red-600 text-white",
};

const SEVERITY_RANK: Record<string, number> = { critical: 3, warning: 2, info: 1 };

const DISMISSED_KEY = "avisos-dispensados";

const readDismissed = (): string[] => {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
};

function AdminLayout() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  };

  const [userRole, setUserRole] = useState<string | null>(null);
  const [userPermissions, setUserPermissions] = useState<string[]>([]);
  const [userEmail, setUserEmail] = useState<string>("");
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  const [activeStore, setActiveStore] = useState<Store | null>(null);
  const [storeFeatures, setStoreFeatures] = useState<FeatureId[]>([]);
  const [storePlan, setStorePlan] = useState<StorePlan | null>(null);
  const [storeIsOpen, setStoreIsOpen] = useState(true);
  const [supportSession, setSupportSession] = useState<SupportSession | null>(null);
  const [memberships, setMemberships] = useState<StoreMembership[]>([]);
  const [storeName, setStoreName] = useState("");
  const [storeLogo, setStoreLogo] = useState<string | null>(null);
  const [storeTheme, setStoreTheme] = useState<{
    primary: string | null;
    secondary: string | null;
  }>({
    primary: null,
    secondary: null,
  });

  const [dismissedAnnouncements, setDismissedAnnouncements] = useState<string[]>(readDismissed);
  const [maintenance, setMaintenance] = useState<{ on: boolean; message: string | null }>({
    on: false,
    message: null,
  });
  const [saasName, setSaasName] = useState(SAAS_NAME_FALLBACK);

  const { data: announcements } = useQuery({
    queryKey: ["admin-announcements", activeStore?.id],
    queryFn: () => getActiveAnnouncements(activeStore!.id),
    enabled: !!activeStore,
  });

  // O mais grave primeiro; entre iguais, o mais recente.
  const currentAnnouncement: Announcement | null =
    (announcements || [])
      .filter((a) => !dismissedAnnouncements.includes(a.id))
      .sort(
        (a, b) =>
          (SEVERITY_RANK[b.severity] ?? 0) - (SEVERITY_RANK[a.severity] ?? 0) ||
          b.created_at.localeCompare(a.created_at),
      )[0] ?? null;

  const dismissAnnouncement = (id: string) => {
    const next = [...dismissedAnnouncements, id];
    setDismissedAnnouncements(next);
    try {
      localStorage.setItem(DISMISSED_KEY, JSON.stringify(next));
    } catch {
      // Navegador sem localStorage: a faixa volta no próximo carregamento.
    }
  };

  useEffect(() => {
    let cancelled = false;

    const loadAuth = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        if (!cancelled) navigate({ to: "/auth" });
        return;
      }

      setUserEmail(session.user.email || "");

      try {
        const [role, permissions, storeResolution, profileData, saas] = await Promise.all([
          getUserRole(),
          getMyPermissions(),
          resolveActiveStore(),
          supabase.from("profiles").select("status").eq("id", session.user.id).maybeSingle(),
          getSaasSettings().catch(() => null),
        ]);

        if (cancelled) return;

        const isSuperAdmin = role === "super_admin";
        const isActiveAdmin = role === "admin" && profileData?.data?.status === "active";

        if (!isSuperAdmin && !isActiveAdmin) {
          await supabase.auth.signOut();
          navigate({ to: "/auth" });
          return;
        }

        if (saas) {
          setSaasName(saas.name || SAAS_NAME_FALLBACK);
          // Manutenção nunca alcança o dono do sistema: senão ele se trancaria
          // fora e não teria como desligar o modo.
          setMaintenance({
            on: saas.maintenance_mode && !isSuperAdmin,
            message: saas.maintenance_message,
          });
        }

        setUserRole(role);
        setUserPermissions(permissions as string[]);
        setMemberships(storeResolution.memberships);

        // Modo suporte só vale para super_admin; qualquer outro caso o marcador
        // é descartado (o RLS já bloquearia, isso só limpa a tela).
        const support = getSupportSession();
        setSupportSession(isSuperAdmin ? support : null);
        if (support && !isSuperAdmin) await endSupportSession();

        if (storeResolution.store) {
          setActiveStore(storeResolution.store);
          setStoreName(storeResolution.store.name);

          const [settingsRes, features, plan] = await Promise.all([
            supabase
              .from("store_settings")
              .select("name, logo_url, primary_color, secondary_color, is_open")
              .eq("store_id", storeResolution.store.id)
              .maybeSingle(),
            getStoreFeatures(storeResolution.store.id),
            getStorePlan(storeResolution.store.id),
          ]);

          if (!cancelled) {
            setStoreFeatures(features);
            setStorePlan(plan);
            const settings = settingsRes.data;
            setStoreIsOpen(settings?.is_open ?? true);
            if (settings) {
              setStoreName(settings.name || storeResolution.store.name);
              setStoreLogo(settings.logo_url);
              setStoreTheme({
                primary: settings.primary_color,
                secondary: settings.secondary_color,
              });
            }
          }
        }

        setIsAuthLoading(false);
      } catch {
        if (!cancelled) navigate({ to: "/auth" });
      }
    };

    loadAuth();

    const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        navigate({ to: "/auth" });
      }
    });

    return () => {
      cancelled = true;
      authListener.subscription.unsubscribe();
    };
  }, [navigate]);

  // Realtime das configurações da loja ativa (recriado ao trocar de loja)
  useEffect(() => {
    if (!activeStore) return;

    const channel = supabase
      .channel(`admin_store_settings_${activeStore.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "store_settings",
          filter: `store_id=eq.${activeStore.id}`,
        },
        (payload) => {
          const newSettings = payload.new as {
            name?: string | null;
            logo_url?: string | null;
            primary_color?: string | null;
            secondary_color?: string | null;
            is_open?: boolean | null;
          };
          if (newSettings) {
            setStoreName(newSettings["name"] || activeStore.name);
            setStoreLogo(newSettings["logo_url"] ?? null);
            setStoreTheme({
              primary: newSettings["primary_color"] ?? null,
              secondary: newSettings["secondary_color"] ?? null,
            });
            setStoreIsOpen(newSettings["is_open"] ?? true);
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeStore]);

  const handleEndSupport = async () => {
    await endSupportSession();
    setSupportSession(null);
    navigate({ to: "/super" });
  };

  const handleSwitchStore = async (storeId: string) => {
    const next = memberships.find((m) => m.store_id === storeId);
    if (!next) return;

    setActiveStore(next.store);
    setStoreName(next.store.name);
    setStoreLogo(null);
    setStoreTheme({ primary: null, secondary: null });
    setStoreFeatures([]);
    setStorePlan(null);
    setStoreIsOpen(true);

    const [settingsRes, features, plan] = await Promise.all([
      supabase
        .from("store_settings")
        .select("name, logo_url, primary_color, secondary_color, is_open")
        .eq("store_id", storeId)
        .maybeSingle(),
      getStoreFeatures(storeId),
      getStorePlan(storeId),
    ]);

    setStoreFeatures(features);
    setStorePlan(plan);

    const settings = settingsRes.data;
    setStoreIsOpen(settings?.is_open ?? true);
    if (settings) {
      setStoreName(settings.name || next.store.name);
      setStoreLogo(settings.logo_url);
      setStoreTheme({ primary: settings.primary_color, secondary: settings.secondary_color });
    }
  };

  const hasPermission = (permission: string) => {
    if (userRole === "admin" || userRole === "super_admin") return true;
    if (userPermissions.includes("all")) return true;
    return userPermissions.includes(permission);
  };

  const navItems = [
    { label: "Painel Geral", to: "/admin", icon: LayoutDashboard, permission: "view_reports" },
    { label: "Produtos", to: "/admin/products", icon: Package, permission: "view_products" },
    { label: "Categorias", to: "/admin/categories", icon: Tags, permission: "view_categories" },
    { label: "Adicionais", to: "/admin/add-ons", icon: PlusCircle, permission: "view_addons" },
    { label: "Clientes", to: "/admin/customers", icon: Users, permission: "view_customers" },
    {
      label: "Taxas de Entrega",
      to: "/admin/delivery",
      icon: Truck,
      permission: "manage_delivery",
    },
    {
      label: "Relatórios Financeiros",
      to: "/admin/reports",
      icon: BarChart3,
      permission: "view_reports",
    },
    {
      label: "Minha mensalidade",
      to: "/admin/cobrancas",
      icon: WalletCards,
      permission: "manage_settings",
    },
    {
      label: "Configurações",
      to: "/admin/settings",
      icon: Settings,
      permission: "manage_settings",
    },
  ].filter((item) => {
    if (!hasPermission(item.permission)) return false;
    // Fora do plano, fora do menu. storeFeatures vazio = ainda carregando.
    const feature = ROUTE_FEATURE[item.to];
    if (!feature || userRole === "super_admin" || storeFeatures.length === 0) return true;
    return storeFeatures.includes(feature);
  });

  // Bloqueio real por plano: rota atual exige feature que a loja não tem.
  // super_admin passa direto (suporte). storeFeatures vazio = ainda carregando.
  const requiredFeature = ROUTE_FEATURE[pathname];
  const blockedFeature =
    userRole !== "super_admin" &&
    requiredFeature &&
    storeFeatures.length > 0 &&
    !storeFeatures.includes(requiredFeature)
      ? requiredFeature
      : null;

  if (isAuthLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center space-y-4">
          <Loader2 className="h-10 w-10 animate-spin text-pink-600 mx-auto" />
          <p className="text-slate-500 font-medium">Verificando acesso...</p>
        </div>
      </div>
    );
  }

  if (maintenance.on) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="max-w-md w-full bg-white rounded-2xl p-8 border text-center space-y-4">
          <div className="w-16 h-16 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center mx-auto">
            <Wrench className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">Sistema em manutenção</h2>
          <p className="text-slate-500 text-sm">{maintenance.message || MAINTENANCE_FALLBACK}</p>
          <p className="text-slate-400 text-xs">
            Seu catálogo continua no ar e recebendo pedidos normalmente.
          </p>
          <Button variant="outline" className="w-full" onClick={handleLogout}>
            <LogOut size={16} className="mr-2" />
            Sair
          </Button>
        </div>
      </div>
    );
  }

  if (!activeStore) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="max-w-md w-full bg-white rounded-2xl p-8 border text-center space-y-4">
          <div className="w-16 h-16 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center mx-auto">
            <StoreIcon className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">Nenhuma loja vinculada</h2>
          <p className="text-slate-500 text-sm">
            Sua conta não está vinculada a nenhuma loja ativa. Contate o administrador do sistema.
          </p>
          <Button variant="outline" className="w-full" onClick={handleLogout}>
            <LogOut size={16} className="mr-2" />
            Sair
          </Button>
        </div>
      </div>
    );
  }

  return (
    <ActiveStoreProvider
      store={activeStore}
      memberships={memberships}
      features={storeFeatures}
      onSwitch={handleSwitchStore}
    >
      <div
        className="admin-shell flex min-h-screen bg-slate-50 flex-col md:flex-row"
        style={storeThemeVars(storeTheme.primary, storeTheme.secondary)}
      >
        {/* Mobile Header */}
        <header className="admin-mobile-header md:hidden flex items-center justify-between px-4 py-3 sticky top-0 z-50">
          <div className="flex items-center gap-3 min-w-0">
            {storeLogo ? (
              <img
                src={storeLogo}
                alt={storeName}
                className="h-9 w-9 rounded-xl object-cover ring-2 ring-white/20"
              />
            ) : (
              <div className="admin-brand-mark h-9 w-9 rounded-xl flex items-center justify-center text-xs font-bold">
                {(storeName || "L").slice(0, 2).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <span className="block truncate text-sm font-bold">{storeName}</span>
              <span className="block text-[10px] font-semibold uppercase tracking-[0.16em] text-white/60">
                Painel da loja
              </span>
            </div>
          </div>
          <button
            type="button"
            aria-label={isMobileMenuOpen ? "Fechar menu" : "Abrir menu"}
            aria-expanded={isMobileMenuOpen}
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="admin-menu-button rounded-xl p-2.5"
          >
            {isMobileMenuOpen ? <X size={21} /> : <Menu size={21} />}
          </button>
        </header>

        {isMobileMenuOpen && (
          <button
            type="button"
            aria-label="Fechar menu"
            className="admin-mobile-overlay md:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside
          className={cn(
            "admin-sidebar fixed inset-y-0 left-0 z-50 flex w-[min(86vw,20rem)] flex-col text-white transition-transform duration-300 transform md:translate-x-0 md:static md:inset-auto md:min-h-screen",
            isMobileMenuOpen ? "translate-x-0" : "-translate-x-full",
            isSidebarCollapsed ? "md:w-20" : "md:w-64",
          )}
        >
          <div
            className={cn(
              "admin-sidebar-head hidden md:flex p-6 items-center border-b border-white/10 relative",
              isSidebarCollapsed ? "justify-center px-2" : "gap-3 justify-between",
            )}
          >
            <div className="flex items-center gap-3 overflow-hidden">
              {storeLogo ? (
                <img
                  src={storeLogo}
                  alt={storeName}
                  className="h-10 w-10 shrink-0 rounded-xl object-cover ring-2 ring-white/15"
                />
              ) : (
                <div className="admin-brand-mark h-10 w-10 shrink-0 rounded-xl flex items-center justify-center text-lg font-bold">
                  {(storeName || "L").slice(0, 2).toUpperCase()}
                </div>
              )}
              {!isSidebarCollapsed && (
                <div className="animate-in fade-in duration-300 min-w-0">
                  <div className="font-bold text-base leading-tight truncate">{storeName}</div>
                  <div className="admin-role-label text-[10px] uppercase tracking-[0.16em] font-semibold">
                    {userRole === "super_admin"
                      ? "Dono do Sistema"
                      : userRole === "admin"
                        ? "Administrador"
                        : "Funcionário"}
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              aria-label={isSidebarCollapsed ? "Expandir menu" : "Recolher menu"}
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className="admin-collapse-button absolute -right-3 top-7 rounded-full p-1 text-white shadow-lg hidden md:block z-50"
            >
              {isSidebarCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
            </button>
          </div>

          <nav
            className={cn(
              "admin-nav flex-1 overflow-y-auto py-6 px-4 space-y-1",
              isSidebarCollapsed && "md:px-3",
            )}
          >
            {navItems.map((item) => (
              <Link
                key={item.label}
                to={item.to}
                onClick={() => setIsMobileMenuOpen(false)}
                activeProps={{ className: "admin-nav-item-active" }}
                className={cn(
                  "admin-nav-item flex items-center gap-3 p-3 rounded-xl transition-all group",
                  isSidebarCollapsed ? "md:justify-center" : "",
                )}
                title={isSidebarCollapsed ? item.label : undefined}
                aria-label={item.label}
              >
                <item.icon
                  size={20}
                  className="group-hover:scale-110 transition-transform shrink-0"
                />
                {!isSidebarCollapsed && (
                  <span className="font-medium text-sm animate-in fade-in slide-in-from-left-2 duration-300">
                    {item.label}
                  </span>
                )}
              </Link>
            ))}
          </nav>

          <div
            className={cn(
              "p-4 border-t border-white/10 space-y-2",
              isSidebarCollapsed && "md:px-3",
            )}
          >
            <Button
              variant="ghost"
              className={cn(
                "admin-logout-button w-full px-3 transition-all",
                isSidebarCollapsed ? "md:justify-center" : "md:justify-start gap-3",
              )}
              onClick={handleLogout}
              title={isSidebarCollapsed ? "Sair" : undefined}
            >
              <LogOut size={20} className="shrink-0" />
              {!isSidebarCollapsed && <span>Sair</span>}
            </Button>
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-h-screen min-w-0 overflow-x-hidden">
          {supportSession && (
            <div className="flex flex-wrap items-center justify-between gap-3 bg-amber-500 px-4 md:px-8 py-2.5 text-sm text-amber-950">
              <div className="flex items-center gap-2 font-medium">
                <LifeBuoy size={16} className="shrink-0" />
                <span>
                  Modo suporte: você está vendo o painel de <b>{supportSession.storeName}</b> como
                  Dono do Sistema. Tudo que fizer aqui é registrado.
                </span>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="gap-2 border-amber-800/40 bg-amber-100 text-amber-950 hover:bg-white"
                onClick={handleEndSupport}
              >
                <LogOut size={14} />
                Sair do modo suporte
              </Button>
            </div>
          )}

          {currentAnnouncement && (
            <div
              className={cn(
                "flex flex-wrap items-start justify-between gap-3 px-4 md:px-8 py-2.5 text-sm",
                SEVERITY_BANNER[currentAnnouncement.severity] || SEVERITY_BANNER["info"],
              )}
            >
              <div className="flex items-start gap-2 min-w-0">
                <Megaphone size={16} className="shrink-0 mt-0.5" />
                <span>
                  <b>{currentAnnouncement.title}</b>
                  <span className="mx-1.5">—</span>
                  {currentAnnouncement.body}
                </span>
              </div>
              <button
                type="button"
                onClick={() => dismissAnnouncement(currentAnnouncement.id)}
                className="shrink-0 rounded p-1 opacity-70 hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-current"
                aria-label="Fechar aviso"
              >
                <X size={16} />
              </button>
            </div>
          )}

          {/* Desktop Header */}
          <header className="admin-topbar hidden md:flex min-h-20 items-center justify-between gap-6 px-8 sticky top-0 z-30">
            <div className="flex items-center gap-4 min-w-0">
              <div className="min-w-0">
                <p className="admin-eyebrow">Central de gestão</p>
                <h1 className="truncate text-xl font-bold text-slate-900">{storeName}</h1>
              </div>
              <div className="flex items-center gap-2 text-xs shrink-0">
                <span className="admin-plan-badge rounded-full px-3 py-1.5">
                  Plano {storePlan?.name || "Carregando..."}
                </span>
                <span
                  className={cn(
                    "admin-open-badge rounded-full px-3 py-1.5 font-semibold",
                    storeIsOpen ? "is-open" : "is-closed",
                  )}
                >
                  <span className="admin-status-dot" />
                  {storeIsOpen ? "Aberta" : "Fechada"}
                </span>
              </div>
              {memberships.length > 1 && (
                <Select value={activeStore.id} onValueChange={handleSwitchStore}>
                  <SelectTrigger className="admin-store-select w-[220px] h-10">
                    <StoreIcon size={14} className="mr-2 shrink-0" />
                    <SelectValue placeholder="Selecione a loja" />
                  </SelectTrigger>
                  <SelectContent>
                    {memberships.map((m) => (
                      <SelectItem key={m.store_id} value={m.store_id}>
                        {m.store.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {userRole === "super_admin" && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="admin-topbar-link gap-2"
                  onClick={() => (supportSession ? handleEndSupport() : navigate({ to: "/super" }))}
                >
                  <StoreIcon size={16} />
                  {saasName}
                </Button>
              )}
              <div className="admin-user-chip flex items-center gap-2 rounded-xl px-3 py-2 text-sm">
                <User size={16} />
                <span className="max-w-[150px] truncate font-medium">
                  {userEmail || "Carregando..."}
                </span>
              </div>
              <Button
                size="sm"
                className="admin-orders-button gap-2"
                onClick={() => navigate({ to: "/staff" })}
              >
                <ShoppingBag size={16} />
                Pedidos
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="admin-exit-button gap-2"
                onClick={handleLogout}
              >
                <LogOut size={16} />
                Sair
              </Button>
            </div>
          </header>

          {/* Content */}
          <main className="flex-1 p-4 md:p-8">
            <div className="max-w-7xl mx-auto">
              {blockedFeature ? (
                <div className="max-w-md mx-auto bg-white rounded-2xl p-8 border text-center space-y-4 mt-8">
                  <div className="w-16 h-16 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center mx-auto">
                    <Lock className="w-8 h-8" />
                  </div>
                  <h2 className="text-xl font-bold text-slate-900">
                    Esta funcionalidade não está disponível no seu plano.
                  </h2>
                  <p className="text-slate-500 text-sm">
                    {FEATURE_LABEL[blockedFeature]} faz parte de um plano superior. Fale com o
                    administrador do sistema para liberar.
                  </p>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => navigate({ to: "/admin" })}
                  >
                    Voltar ao painel
                  </Button>
                </div>
              ) : (
                <Outlet />
              )}
            </div>
          </main>
        </div>
      </div>
    </ActiveStoreProvider>
  );
}
