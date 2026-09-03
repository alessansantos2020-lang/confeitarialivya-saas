import { createFileRoute } from '@tanstack/react-router'
import { supabase } from '@/integrations/supabase/client'
import { getUserRole, getMyPermissions } from '@/lib/auth.functions'
import { resolveActiveStore, type StoreMembership } from '@/lib/store-context'
import { ActiveStoreProvider } from '@/lib/active-store'
import { storeThemeVars } from '@/lib/store-theme'
import type { Store } from '@/lib/delivery.functions'

export const Route = createFileRoute('/admin')({
  ssr: false,
  component: AdminLayout,
})

import { Outlet, Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  Store as StoreIcon
} from "lucide-react";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

function AdminLayout() {
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate({ to: '/auth' });
  };

  const [userRole, setUserRole] = useState<string | null>(null);
  const [userPermissions, setUserPermissions] = useState<string[]>([]);
  const [userEmail, setUserEmail] = useState<string>("");
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  const [activeStore, setActiveStore] = useState<Store | null>(null);
  const [memberships, setMemberships] = useState<StoreMembership[]>([]);
  const [storeName, setStoreName] = useState("");
  const [storeLogo, setStoreLogo] = useState<string | null>(null);
  const [storeTheme, setStoreTheme] = useState<{ primary: string | null; secondary: string | null }>({
    primary: null,
    secondary: null,
  });


  useEffect(() => {
    let cancelled = false;

    const loadAuth = async () => {
      // 1. Direct local storage check for immediate feedback
      const projectId = import.meta.env['VITE_SUPABASE_PROJECT_ID'];
      const authKey = `sb-${projectId}-auth-token`;
      const localSessionStr = projectId ? localStorage.getItem(authKey) : null;
      
      if (!localSessionStr) {
        console.log("No local session found, redirecting to /auth");
        navigate({ to: '/auth' });
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
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.user) {
        if (!cancelled) navigate({ to: '/auth' });
        return;
      }

      setUserEmail(session.user.email || "");

      try {
        const [role, permissions, storeResolution, profileData] = await Promise.all([
          getUserRole(),
          getMyPermissions(),
          resolveActiveStore(),
          supabase.from('profiles').select('status').eq('id', session.user.id).maybeSingle()
        ]);

        if (cancelled) return;

        const isSuperAdmin = role === 'super_admin';
        const isActiveAdmin = role === 'admin' && profileData?.data?.status === 'active';

        if (!isSuperAdmin && !isActiveAdmin) {
          console.log("Access denied to Admin panel. Role:", role, "Status:", profileData?.data?.status);
          await supabase.auth.signOut();
          navigate({ to: '/auth' });
          return;
        }

        setUserRole(role);
        setUserPermissions(permissions as string[]);
        setMemberships(storeResolution.memberships);

        if (storeResolution.store) {
          setActiveStore(storeResolution.store);
          setStoreName(storeResolution.store.name);

          const { data: settings } = await supabase
            .from('store_settings')
            .select('name, logo_url, primary_color, secondary_color')
            .eq('store_id', storeResolution.store.id)
            .maybeSingle();

          if (!cancelled && settings) {
            setStoreName(settings.name || storeResolution.store.name);
            setStoreLogo(settings.logo_url);
            setStoreTheme({ primary: settings.primary_color, secondary: settings.secondary_color });
          }
        }

        setIsAuthLoading(false);
      } catch (e) {
        console.error("Erro ao verificar autenticação:", e);
        if (!cancelled) navigate({ to: '/auth' });
      }
    };

    loadAuth();

    const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        navigate({ to: '/auth' });
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
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'store_settings',
          filter: `store_id=eq.${activeStore.id}`,
        },
        (payload) => {
          const newSettings = payload.new as any;
          if (newSettings) {
            setStoreName(newSettings['name'] || activeStore.name);
            setStoreLogo(newSettings['logo_url']);
            setStoreTheme({
              primary: newSettings['primary_color'],
              secondary: newSettings['secondary_color'],
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeStore]);

  const handleSwitchStore = async (storeId: string) => {
    const next = memberships.find((m) => m.store_id === storeId);
    if (!next) return;

    setActiveStore(next.store);
    setStoreName(next.store.name);
    setStoreLogo(null);
    setStoreTheme({ primary: null, secondary: null });

    const { data: settings } = await supabase
      .from('store_settings')
      .select('name, logo_url, primary_color, secondary_color')
      .eq('store_id', storeId)
      .maybeSingle();

    if (settings) {
      setStoreName(settings.name || next.store.name);
      setStoreLogo(settings.logo_url);
      setStoreTheme({ primary: settings.primary_color, secondary: settings.secondary_color });
    }
  };

  const hasPermission = (permission: string) => {
    if (userRole === 'admin' || userRole === 'super_admin') return true;
    if (userPermissions.includes('all')) return true;
    return userPermissions.includes(permission);
  };

  const navItems = [
    { label: "Painel Geral", to: "/admin", icon: LayoutDashboard, permission: "view_reports" },
    { label: "Produtos", to: "/admin/products", icon: Package, permission: "view_products" },
    { label: "Categorias", to: "/admin/categories", icon: Tags, permission: "view_categories" },
    { label: "Adicionais", to: "/admin/add-ons", icon: PlusCircle, permission: "view_addons" },
    { label: "Clientes", to: "/admin/customers", icon: Users, permission: "view_customers" },
    { label: "Taxas de Entrega", to: "/admin/delivery", icon: Truck, permission: "manage_delivery" },
    { label: "Relatórios Financeiros", to: "/admin/reports", icon: BarChart3, permission: "view_reports" },
    { label: "Configurações", to: "/admin/settings", icon: Settings, permission: "manage_settings" },
  ].filter(item => hasPermission(item.permission));

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
    <ActiveStoreProvider store={activeStore} memberships={memberships} onSwitch={handleSwitchStore}>
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
              {(storeName || 'L').slice(0, 2).toUpperCase()}
            </div>
          )}
          <span className="font-bold">{storeName}</span>
        </div>
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </header>

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-0 z-40 bg-slate-900 text-white transition-all duration-300 transform md:translate-x-0 md:static md:inset-auto flex flex-col min-h-screen",
        isMobileMenuOpen ? "translate-x-0" : "-translate-x-full",
        isSidebarCollapsed ? "md:w-20" : "md:w-64"
      )}>
        <div className={cn(
          "hidden md:flex p-6 items-center border-b border-slate-800 relative",
          isSidebarCollapsed ? "justify-center px-2" : "gap-3 justify-between"
        )}>
          <div className="flex items-center gap-3 overflow-hidden">
            {storeLogo ? (
              <img src={storeLogo} alt={storeName} className="h-10 w-10 shrink-0 rounded-full object-cover" />
            ) : (
              <div className="h-10 w-10 shrink-0 rounded-full bg-pink-500 flex items-center justify-center text-lg font-bold">
                {(storeName || 'L').slice(0, 2).toUpperCase()}
              </div>
            )}
            {!isSidebarCollapsed && (
              <div className="animate-in fade-in duration-300">
                <div className="font-bold text-lg leading-tight truncate">{storeName}</div>
                <div className="text-[10px] text-pink-400 uppercase tracking-wider font-semibold">
                  {userRole === 'super_admin' ? 'Dono do Sistema' : userRole === 'admin' ? 'Administrador' : 'Funcionário'}
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
                isSidebarCollapsed ? "justify-center" : ""
              )}
              title={isSidebarCollapsed ? item.label : undefined}
            >
              <item.icon size={20} className="group-hover:scale-110 transition-transform shrink-0" />
              {!isSidebarCollapsed && <span className="font-medium animate-in fade-in slide-in-from-left-2 duration-300">{item.label}</span>}
            </Link>
          ))}

        </nav>

        <div className="p-4 border-t border-slate-800 space-y-2">
          <Button 
            variant="ghost" 
            className={cn(
              "w-full text-slate-400 hover:text-white hover:bg-slate-800 px-3 transition-all",
              isSidebarCollapsed ? "justify-center" : "justify-start gap-3"
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
        {/* Desktop Header */}
        <header className="hidden md:flex h-16 items-center justify-between px-8 bg-white border-b shadow-sm sticky top-0 z-30">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-semibold text-slate-800">{storeName}</h1>
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
            {userRole === 'super_admin' && (
              <Button
                size="sm"
                variant="ghost"
                className="gap-2 text-pink-600 hover:text-pink-700"
                onClick={() => navigate({ to: '/super' as any })}
              >
                <StoreIcon size={16} />
                Painel do Dono
              </Button>
            )}
            <div className="flex items-center gap-2 text-sm text-slate-600 bg-slate-50 px-3 py-1.5 rounded-full border">
              <User size={16} className="text-pink-500" />
              <span className="max-w-[150px] truncate font-medium">{userEmail || "Carregando..."}</span>
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="gap-2 text-slate-600"
              onClick={() => navigate({ to: '/staff' as any })}
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
            <Outlet />
          </div>
        </main>
      </div>
    </div>
    </ActiveStoreProvider>
  );
}
