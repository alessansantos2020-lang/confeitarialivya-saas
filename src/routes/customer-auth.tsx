import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import { Eye, EyeOff, Loader2, Mail, Lock, UserRound, Phone, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { signInCustomer, signUpCustomer } from "@/lib/customer-auth.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/customer-auth")({
  validateSearch: (search: Record<string, unknown>) => ({
    store: typeof search["store"] === "string" ? search["store"] : "",
    mode: search["mode"] === "signup" ? "signup" : "signin",
  }),
  component: CustomerAuthPage,
});

function CustomerAuthPage() {
  const navigate = useNavigate();
  const { store, mode } = useSearch({ from: "/customer-auth" });
  const [isSignUp, setIsSignUp] = useState(mode === "signup");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const finish = () => {
    if (store) {
      void navigate({ to: "/$slug", params: { slug: store } });
    } else {
      void navigate({ to: "/" });
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsLoading(true);
    try {
      if (isSignUp) {
        if (name.trim().length < 2) {
          toast.error("Informe seu nome.");
          return;
        }
        if (phone.replace(/\D/g, "").length < 10) {
          toast.error("Informe um telefone válido.");
          return;
        }
        await signUpCustomer(email.trim(), password, name.trim(), phone.trim());
        toast.success("Conta criada com sucesso!");
      } else {
        await signInCustomer(email.trim(), password);
        toast.success("Bem-vindo(a) de volta!");
      }
      await finish();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível acessar sua conta.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <Card className="w-full max-w-sm border-slate-200 shadow-lg">
        <CardHeader className="space-y-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="-ml-3 mb-1 w-fit text-slate-500"
            onClick={() => void navigate({ to: "/" })}
          >
            <ArrowLeft size={16} className="mr-1" /> Voltar à loja
          </Button>
          <CardTitle className="text-2xl font-black">
            {isSignUp ? "Criar sua conta" : "Entrar na sua conta"}
          </CardTitle>
          <CardDescription>
            {isSignUp
              ? "Acompanhe seus pedidos e salve seus dados de entrega."
              : "Acesse seu perfil, pedidos e cupons."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            {isSignUp && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="customer-name">Nome</Label>
                  <div className="relative">
                    <UserRound className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                    <Input
                      id="customer-name"
                      autoComplete="name"
                      className="pl-9"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="customer-phone">Telefone</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                    <Input
                      id="customer-phone"
                      type="tel"
                      autoComplete="tel"
                      className="pl-9"
                      value={phone}
                      onChange={(event) => setPhone(event.target.value)}
                      required
                    />
                  </div>
                </div>
              </>
            )}
            <div className="space-y-2">
              <Label htmlFor="customer-email">E-mail</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <Input
                  id="customer-email"
                  type="email"
                  autoComplete="email"
                  className="pl-9"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="customer-password">Senha</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <Input
                  id="customer-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete={isSignUp ? "new-password" : "current-password"}
                  className="pl-9 pr-10"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  minLength={6}
                  required
                />
                <button
                  type="button"
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  className="absolute right-3 top-3 text-slate-400"
                  onClick={() => setShowPassword((value) => !value)}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <Button type="submit" className="w-full font-bold" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isSignUp ? "Criar conta" : "Entrar"}
            </Button>
          </form>
          <p className="mt-5 text-center text-sm text-slate-500">
            {isSignUp ? "Já tem uma conta?" : "Ainda não tem conta?"}{" "}
            <button
              type="button"
              className="font-bold text-[var(--primary-color)] underline-offset-4 hover:underline"
              onClick={() => setIsSignUp((value) => !value)}
            >
              {isSignUp ? "Entrar" : "Cadastre-se"}
            </button>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
