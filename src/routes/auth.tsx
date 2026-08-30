import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Eye, EyeOff, Lock, Mail, Loader2, User } from 'lucide-react'
import { toast } from 'sonner'

export const Route = createFileRoute('/auth')({
  component: AuthPage,
})

function AuthPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isSignUp, setIsSignUp] = useState(false)
  const navigate = useNavigate()
  const search = Route.useSearch() as any

  useEffect(() => {
    if (search.signup) {
      setIsSignUp(true)
    }
  }, [search.signup])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isLoading) return

    setIsLoading(true)

    try {
      console.log("DEBUG: Login attempt for:", email);
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        console.error("DEBUG: Login error:", error);

        if (error.message === 'Invalid login credentials' || error.message.includes('Email not confirmed')) {
          toast.error('E-mail ou senha incorretos.')
        } else if (error.status === 429) {
          toast.error('Muitas tentativas. Tente novamente mais tarde.')
        } else {
          toast.error(error.message)
        }
        setIsLoading(false)
        return
      }

      if (!data.user) {
        toast.error('Erro ao recuperar dados do usuário.')
        setIsLoading(false)
        return
      }

      await handleLoginSuccess(data.user);
    } catch (error) {
      console.error("DEBUG: Login catch error:", error)
      toast.error('Erro ao realizar login.')
      setIsLoading(false)
    }
  }

  const handleLoginSuccess = async (user: any) => {
    try {
      console.log("DEBUG: Login success for:", user.email);

      // Verificar role imediatamente
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle()

      if (roleError) {
        console.error('Erro ao verificar permissões:', roleError)
      }

      if (roleData) {
        toast.success('Login realizado com sucesso!')
        
        // Forçar atualização total
        await supabase.auth.refreshSession()
        
        // Pequeno delay para garantir que o cookie/storage assente
        await new Promise(resolve => setTimeout(resolve, 800))
        
        console.log("DEBUG: Redirecting based on role:", roleData.role);
        if (roleData.role === 'admin') {
          window.location.href = '/admin';
        } else if (roleData.role === 'employee') {
          window.location.href = '/staff';
        } else {
          toast.error('Tipo de usuário não reconhecido.')
          await supabase.auth.signOut()
          setIsLoading(false)
        }

      } else {
        // Verificar se o perfil está pendente
        const { data: profileData } = await supabase
          .from('profiles')
          .select('status')
          .eq('id', user.id)
          .maybeSingle();

        if (profileData?.status === 'pending') {
          toast.info('Seu cadastro está em análise. Por favor, aguarde a aprovação do administrador.');
        } else if (profileData?.status === 'blocked') {
          toast.error('Seu acesso foi bloqueado pelo administrador.');
        } else {
          toast.error('Você não possui permissão para acessar esta área.');
        }
        await supabase.auth.signOut()
        setIsLoading(false)
      }
    } catch (e) {
      console.error("DEBUG: handleLoginSuccess error:", e);
      setIsLoading(false);
    }
  }

  const handleForgotPassword = async () => {
    if (!email) {
      toast.error('Digite seu e-mail para recuperar a senha.')
      return
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    })

    if (error) {
      toast.error(error.message)
    } else {
      toast.success('E-mail de recuperação enviado!')
    }
  }

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isLoading) return
    setIsLoading(true)

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          }
        }
      })

      if (error) {
        toast.error(error.message)
        setIsLoading(false)
        return
      }

      toast.success('Cadastro realizado! Por favor, aguarde o Administrador liberar seu acesso.')
      setIsSignUp(false)
    } catch (error) {
      console.error(error)
      toast.error('Erro ao realizar cadastro.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <div className="h-12 w-12 rounded-full bg-pink-500 flex items-center justify-center text-white text-xl font-bold">
              DE
            </div>
          </div>
          <CardTitle className="text-2xl">{isSignUp ? 'Criar Conta' : 'Acesso Restrito'}</CardTitle>
          <CardDescription>
            {isSignUp 
              ? 'Preencha os dados para solicitar acesso ao painel' 
              : 'Entre com suas credenciais para acessar o painel'}
          </CardDescription>
        </CardHeader>
        <form onSubmit={isSignUp ? handleSignUp : handleLogin}>
          <CardContent className="space-y-4">
            {isSignUp && (
              <div className="space-y-2">
                <Label htmlFor="fullName">Nome Completo</Label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <Input
                    id="fullName"
                    placeholder="Seu nome"
                    className="pl-10"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                  />
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="seu@email.com"
                  className="pl-10"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Senha</Label>
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  className="text-xs text-pink-600 hover:underline"
                >
                  Esqueci minha senha
                </button>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <Input
                  id="password"
                  name="password"
                  autoComplete={isSignUp ? "new-password" : "current-password"}
                  type={showPassword ? 'text' : 'password'}
                  className="pl-10 pr-10"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 focus:outline-none"
                  aria-label={showPassword ? "Esconder senha" : "Mostrar senha"}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button className="w-full bg-pink-600 hover:bg-pink-700" type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isSignUp ? 'Criando conta...' : 'Entrando...'}
                </>
              ) : (
                isSignUp ? 'Criar Conta' : 'Entrar'
              )}
            </Button>
            
            <button
              type="button"
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-sm text-slate-500 hover:text-pink-600 transition-colors"
            >
              {isSignUp ? 'Já tem uma conta? Entre aqui' : 'Solicitar acesso de Funcionário'}
            </button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
