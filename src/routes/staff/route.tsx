import { createFileRoute } from '@tanstack/react-router'
import { supabase } from '@/integrations/supabase/client'
import { getUserRole } from '@/lib/auth.functions'

export const Route = createFileRoute('/staff')({
  ssr: false,
  component: StaffLayout,
})

import { Outlet, Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { 
  LogOut, 
  ShoppingBag, 
  History,
  Menu,
  X,
  User,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Printer
} from "lucide-react";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

function StaffLayout() {
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string>("");
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  const [storeName, setStoreName] = useState("Doce Encanto");
  const [storeLogo, setStoreLogo] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.user) {
        if (!cancelled) navigate({ to: '/auth' });
        return;
      }

      setUserEmail(session.user.email || "");

      try {
        const [role, settingsResult, profileData] = await Promise.all([
          getUserRole(),
          supabase.from('store_settings').select('name, logo_url').maybeSingle(),
          supabase.from('profiles').select('status').eq('id', session.user.id).maybeSingle()
        ]);

        if (cancelled) return;

        if (settingsResult?.data) {
          setStoreName(settingsResult.data.name || "Doce Encanto");
          setStoreLogo(settingsResult.data.logo_url);
        }

        // Bloqueio se não estiver ativo ou não for funcionário/admin
        if (profileData?.data?.status !== 'active' || !role || (role !== 'admin' && role !== 'employee')) {
          console.log("Access denied to Staff panel. Status:", profileData?.data?.status, "Role:", role);
          await supabase.auth.signOut();
          navigate({ to: '/auth' });
          return;
        } else {
          setUserRole(role);
        }
        
        setIsAuthLoading(false);
      } catch (e) {
        console.error("Erro ao verificar autenticação:", e);
        if (!cancelled) navigate({ to: '/auth' });
      }
    };

    loadAuth();

    return () => {
      cancelled = true;
    };
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate({ to: '/auth' });
  };

  const navItems = [
    { label: "Pedidos Ativos", to: "/staff", icon: ShoppingBag },
    { label: "Histórico", to: "/staff/history" as any, icon: History },
  ];

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

  return (
    <div className="flex min-h-screen bg-slate-50 flex-col md:flex-row">
      {/* Mobile Header */}
      <header className="md:hidden flex items-center justify-between p-4 bg-slate-900 text-white sticky top-0 z-50">
        <div className="flex items-center gap-2">
          {storeLogo ? (
            <img src={storeLogo} alt={storeName} className="h-8 w-8 rounded-full object-cover" />
          ) : (
            <div className="h-8 w-8 rounded-full bg-pink-500 flex items-center justify-center text-xs font-bold">DE</div>
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
              <div className="h-10 w-10 shrink-0 rounded-full bg-pink-500 flex items-center justify-center text-lg font-bold">DE</div>
            )}
            {!isSidebarCollapsed && (
              <div className="animate-in fade-in duration-300">
                <div className="font-bold text-lg leading-tight truncate">{storeName}</div>
                <div className="text-[10px] text-pink-400 uppercase tracking-wider font-semibold">
                  Painel do Funcionário
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
          <h1 className="text-xl font-semibold text-slate-800">Operação - {storeName}</h1>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-slate-600 bg-slate-50 px-3 py-1.5 rounded-full border">
              <User size={16} className="text-pink-500" />
              <span className="max-w-[150px] truncate font-medium">{userEmail}</span>
            </div>
            <Button 
              size="sm"
              variant="outline" 
              className="gap-2 text-slate-600"
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
  );
}
