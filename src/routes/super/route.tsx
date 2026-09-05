import { createFileRoute, Outlet, Link, useNavigate, useLocation } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { getUserRole } from '@/lib/auth.functions'
import { getSaasSettings, SAAS_NAME_FALLBACK } from '@/lib/saas-settings.functions'
import { storeThemeVars } from '@/lib/store-theme'
import { Button } from '@/components/ui/button'
import {
  LogOut,
  Store as StoreIcon,
  ShieldCheck,
  Loader2,
  Menu,
  X,
  User,
  ShieldAlert,
  Package,
  LayoutDashboard,
  Users,
  Activity,
  Megaphone,
  ScrollText,
  Settings,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/super')({
  ssr: false,
  component: SuperAdminLayout,
})

const NAV_ITEMS = [
  { to: '/super/dashboard', label: 'Dashboard', icon: LayoutDashboard, exact: false },
  { to: '/super', label: 'Lojas', icon: StoreIcon, exact: true },
  { to: '/super/usuarios', label: 'Usuários', icon: Users, exact: false },
  { to: '/super/monitoramento', label: 'Monitoramento', icon: Activity, exact: false },
  { to: '/super/avisos', label: 'Avisos', icon: Megaphone, exact: false },
  { to: '/super/logs', label: 'Logs', icon: ScrollText, exact: false },
  { to: '/super/planos', label: 'Planos', icon: Package, exact: false },
  { to: '/super/configuracoes', label: 'Configurações', icon: Settings, exact: false },
] as const

function SuperAdminLayout() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [userEmail, setUserEmail] = useState('')
  const [isAuthLoading, setIsAuthLoading] = useState(true)
  const [denied, setDenied] = useState(false)

  // Mesma queryKey da tela de Configurações: ao salvar, o invalidate de lá
  // atualiza nome/logo/cor deste menu na hora, sem recarregar a página.
  const { data: saas } = useQuery({
    queryKey: ['saas-settings'],
    queryFn: getSaasSettings,
    enabled: !isAuthLoading && !denied,
  })

  const saasName = saas?.name || SAAS_NAME_FALLBACK
  const saasLogo = saas?.logo_url ?? null

  const currentSection = pathname.startsWith('/super/planos')
    ? 'Planos e Funcionalidades'
    : pathname.startsWith('/super/usuarios')
      ? 'Usuários'
      : pathname.startsWith('/super/monitoramento')
        ? 'Monitoramento'
        : pathname.startsWith('/super/avisos')
          ? 'Avisos'
          : pathname.startsWith('/super/logs')
            ? 'Logs e Auditoria'
            : pathname.startsWith('/super/configuracoes')
              ? 'Configurações do Sistema'
              : pathname.startsWith('/super/dashboard')
                ? 'Dashboard'
                : 'Gerenciamento de Lojas'

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate({ to: '/auth' })
  }

  useEffect(() => {
    let cancelled = false

    const loadAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()

      if (!session?.user) {
        if (!cancelled) navigate({ to: '/auth' })
        return
      }

      setUserEmail(session.user.email || '')

      try {
        const [role, profileRes] = await Promise.all([
          getUserRole(),
          supabase.from('profiles').select('status').eq('id', session.user.id).maybeSingle(),
        ])
        if (cancelled) return

        if (role !== 'super_admin' || profileRes.data?.status === 'blocked') {
          setDenied(true)
          setIsAuthLoading(false)
          return
        }

        setIsAuthLoading(false)
      } catch (e) {
        console.error('Erro ao verificar acesso super admin:', e)
        if (!cancelled) navigate({ to: '/auth' })
      }
    }

    loadAuth()

    const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') navigate({ to: '/auth' })
    })

    return () => {
      cancelled = true
      authListener.subscription.unsubscribe()
    }
  }, [navigate])

  if (isAuthLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="text-center space-y-4">
          <Loader2 className="h-10 w-10 animate-spin text-pink-500 mx-auto" />
          <p className="text-slate-400 font-medium">Verificando acesso...</p>
        </div>
      </div>
    )
  }

  if (denied) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
        <div className="max-w-md w-full bg-slate-900 rounded-2xl p-8 border border-slate-800 text-center space-y-4">
          <div className="w-16 h-16 bg-red-500/10 text-red-400 rounded-full flex items-center justify-center mx-auto">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-white">Acesso restrito</h2>
          <p className="text-slate-400 text-sm">
            Esta área é exclusiva do dono do sistema. Sua conta não tem esse nível de acesso.
          </p>
          <Button variant="outline" className="w-full" onClick={handleLogout}>
            <LogOut size={16} className="mr-2" />
            Sair
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div
      className="flex min-h-screen bg-slate-950 flex-col md:flex-row text-slate-100"
      style={storeThemeVars(saas?.primary_color)}
    >
      {/* Mobile Header */}
      <header className="md:hidden flex items-center justify-between p-4 bg-slate-900 border-b border-slate-800 sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-pink-600 flex items-center justify-center overflow-hidden">
            {saasLogo ? (
              <img src={saasLogo} alt="" className="h-full w-full object-cover" />
            ) : (
              <ShieldCheck size={18} />
            )}
          </div>
          <span className="font-bold">{saasName}</span>
        </div>
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </header>

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-0 z-40 bg-slate-900 border-r border-slate-800 transition-all duration-300 transform md:translate-x-0 md:static md:inset-auto md:w-64 flex flex-col min-h-screen",
        isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="hidden md:flex p-6 items-center gap-3 border-b border-slate-800">
          <div className="h-10 w-10 rounded-lg bg-pink-600 flex items-center justify-center shrink-0 overflow-hidden">
            {saasLogo ? (
              <img src={saasLogo} alt="" className="h-full w-full object-cover" />
            ) : (
              <ShieldCheck size={22} />
            )}
          </div>
          <div className="min-w-0">
            <div className="font-bold text-lg leading-tight truncate">{saasName}</div>
            <div className="text-[10px] text-pink-400 uppercase tracking-wider font-semibold">
              Super Admin
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-1">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setIsMobileMenuOpen(false)}
              activeOptions={{ exact: item.exact }}
              activeProps={{ className: "bg-pink-600 text-white" }}
              className="flex items-center gap-3 p-3 text-slate-300 hover:bg-slate-800 hover:text-white rounded-lg transition-all"
            >
              <item.icon size={20} className="shrink-0" />
              <span className="font-medium">{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-800">
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 text-slate-400 hover:text-white hover:bg-slate-800 px-3"
            onClick={handleLogout}
          >
            <LogOut size={20} className="shrink-0" />
            <span>Sair</span>
          </Button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-h-screen">
        <header className="hidden md:flex h-16 items-center justify-between px-8 bg-slate-900 border-b border-slate-800 sticky top-0 z-30">
          <h1 className="text-xl font-semibold text-white">{currentSection}</h1>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-slate-300 bg-slate-800 px-3 py-1.5 rounded-full border border-slate-700">
              <User size={16} className="text-pink-400" />
              <span className="max-w-[180px] truncate font-medium">{userEmail}</span>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="gap-2 border-slate-700 text-slate-300 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/40"
              onClick={handleLogout}
            >
              <LogOut size={16} />
              Sair
            </Button>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-8">
          <div className="max-w-6xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
