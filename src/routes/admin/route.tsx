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
      // 1. Direct local storage check for immediate feedback
      const projectId = import.meta.env["VITE_SUPABASE_PROJECT_ID"];
      const authKey = `sb-${projectId}-auth-token`;
      const localSessionStr = projectId ? localStorage.getItem(authKey) : null;

      if (!localSessionStr) {
        console.log("No local session found, redirecting to /auth");
        navigate({ to: "/auth" });
        return;
      }

      try {
        const localSession = JSON.parse(localSessionStr);
        if (localSession?.user?.email) {
          setUserEmail(localSession.user.email);
        }
      } catch (e) {
        console.error("Error parsing local session:", e);
      }

      // 2. Fallback to Supabase API check
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
          console.log(
            "Access denied to Admin panel. Role:",
            role,
            "Status:",
            profileData?.data?.status,
          );
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
      } catch (e) {
        console.error("Erro ao verificar autenticação:", e);
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
            setStoreLogo(newSettings["logo_url"]);
            setStoreTheme({
              primary: newSettings["primary_color"],
              secondary: newSettings["secondary_color"],
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
        className="flex min-h-screen bg-slate-50 flex-col md:flex-row"
        style={storeThemeVars(storeTheme.primary, storeTheme.secondary)}
      >
        {/* Mobile Header */}
        <header className="md:hidden flex items-center justify-between p-4 bg-slate-900 text-white sticky top-0 z-50">
          <div className="flex items-center gap-2">
            {storeLogo ? (
              <img src={storeLogo} alt={storeName} className="h-8 w-8 rounded-full object-cover" />
            ) : (
              <div className="h-8 w-8 rounded-full bg-pink-500 flex items-center justify-center text-xs font-bold">
                {(storeName || "L").slice(0, 2).toUpperCase()}
              </div>
            )}
            <span className="font-bold">{storeName}</span>
          </div>
          <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </header>

        {/* Sidebar */}
        <aside
          className={cn(
            "fixed inset-0 z-40 bg-slate-900 text-white transition-all duration-300 transform md:translate-x-0 md:static md:inset-auto flex flex-col min-h-screen",
            isMobileMenuOpen ? "translate-x-0" : "-translate-x-full",
            isSidebarCollapsed ? "md:w-20" : "md:w-64",
          )}
        >
          <div
            className={cn(
              "hidden md:flex p-6 items-center border-b border-slate-800 relative",
              isSidebarCollapsed ? "justify-center px-2" : "gap-3 justify-between",
            )}
          >
            <div className="flex items-center gap-3 overflow-hidden">
              {storeLogo ? (
                <img
                  src={storeLogo}
                  alt={storeName}
                  className="h-10 w-10 shrink-0 rounded-full object-cover"
                />
              ) : (
                <div className="h-10 w-10 shrink-0 rounded-full bg-pink-500 flex items-center justify-center text-lg font-bold">
                  {(storeName || "L").slice(0, 2).toUpperCase()}
                </div>
              )}
              {!isSidebarCollapsed && (
                <div className="animate-in fade-in duration-300">
                  <div className="font-bold text-lg leading-tight truncate">{storeName}</div>
                  <div className="text-[10px] text-pink-400 uppercase tracking-wider font-semibold">
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
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className="absolute -right-3 top-7 bg-pink-600 rounded-full p-1 text-white shadow-lg hidden md:block hover:bg-pink-700 transition-colors z-50"
            >
              {isSidebarCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-1">
            {navItems.map((item) => (
              <Link
                key={item.label}
                to={item.to}
                onClick={() => setIsMobileMenuOpen(false)}
                activeProps={{ className: "bg-pink-600 text-white" }}
                className={cn(
                  "flex items-center gap-3 p-3 text-slate-300 hover:bg-slate-800 hover:text-white rounded-lg transition-all group",
                  isSidebarCollapsed ? "justify-center" : "",
                )}
                title={isSidebarCollapsed ? item.label : undefined}
              >
                <item.icon
                  size={20}
                  className="group-hover:scale-110 transition-transform shrink-0"
                />
                {!isSidebarCollapsed && (
                  <span className="font-medium animate-in fade-in slide-in-from-left-2 duration-300">
                    {item.label}
                  </span>
                )}
              </Link>
            ))}
          </nav>

          <div className="p-4 border-t border-slate-800 space-y-2">
            <Button
              variant="ghost"
              className={cn(
                "w-full text-slate-400 hover:text-white hover:bg-slate-800 px-3 transition-all",
                isSidebarCollapsed ? "justify-center" : "justify-start gap-3",
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
        <div className="flex-1 flex flex-col min-h-screen">
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
          <header className="hidden md:flex h-16 items-center justify-between px-8 bg-white border-b shadow-sm sticky top-0 z-30">
            <div className="flex items-center gap-4">
              <h1 className="text-xl font-semibold text-slate-800">{storeName}</h1>
              <div className="flex items-center gap-2 text-xs">
                <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-slate-600">
                  Plano: {storePlan?.name || "Carregando..."}
                </span>
                <span
                  className={cn(
                    "rounded-full border px-2.5 py-1 font-medium",
                    storeIsOpen
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border-slate-200 bg-slate-100 text-slate-600",
                  )}
                >
                  {storeIsOpen ? "Loja aberta" : "Loja fechada"}
                </span>
              </div>
              {memberships.length > 1 && (
                <Select value={activeStore.id} onValueChange={handleSwitchStore}>
                  <SelectTrigger className="w-[220px] h-9">
                    <StoreIcon size={14} className="mr-2 text-pink-500 shrink-0" />
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
            <div className="flex items-center gap-4">
              {userRole === "super_admin" && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="gap-2 text-pink-600 hover:text-pink-700"
                  onClick={() => (supportSession ? handleEndSupport() : navigate({ to: "/super" }))}
                >
                  <StoreIcon size={16} />
                  {saasName}
                </Button>
              )}
              <div className="flex items-center gap-2 text-sm text-slate-600 bg-slate-50 px-3 py-1.5 rounded-full border">
                <User size={16} className="text-pink-500" />
                <span className="max-w-[150px] truncate font-medium">
                  {userEmail || "Carregando..."}
                </span>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="gap-2 text-slate-600"
                onClick={() => navigate({ to: "/staff" })}
              >
                <ShoppingBag size={16} />
                Pedidos
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-2 text-slate-600 border-slate-200 hover:bg-red-50 hover:text-red-600 hover:border-red-100"
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
