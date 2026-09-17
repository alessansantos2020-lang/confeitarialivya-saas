import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CreditCard,
  QrCode,
  Banknote,
  ShieldCheck,
  Loader2,
  Save,
  MessageCircle,
  Eye,
  EyeOff,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getStorePaymentGateways,
  saveStorePaymentGateways,
  DEFAULT_STORE_PAYMENT_GATEWAYS,
  type StorePaymentGateways,
  type PixKeyType,
} from "@/lib/store-payments";

export function StorePaymentSettings({ storeId }: { storeId: string }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<StorePaymentGateways>(DEFAULT_STORE_PAYMENT_GATEWAYS);
  const [showMpToken, setShowMpToken] = useState(false);
  const [showAsaasKey, setShowAsaasKey] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["storePaymentGateways", storeId],
    queryFn: () => getStorePaymentGateways(storeId),
  });

  useEffect(() => {
    if (data) {
      setForm(data);
    }
  }, [data]);

  const mutation = useMutation({
    mutationFn: (updated: StorePaymentGateways) => saveStorePaymentGateways(storeId, updated),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["storePaymentGateways", storeId] });
      toast.success("Configurações de pagamento salvas com sucesso!");
    },
    onError: (err: unknown) => {
      toast.error(
        err instanceof Error ? err.message : "Erro ao salvar configurações de pagamento.",
      );
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate(form);
  };

  const hasAnyGateway = form.mp_enabled || form.asaas_enabled;

  if (isLoading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <Loader2 className="animate-spin text-pink-600" size={28} />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* 1. Modo de Operação Atual */}
      <div
        className={`rounded-2xl border p-5 ${
          hasAnyGateway
            ? "border-emerald-200 bg-emerald-50/60 text-emerald-950"
            : "border-pink-200 bg-pink-50/60 text-pink-950"
        }`}
      >
        <div className="flex items-start gap-3.5">
          {hasAnyGateway ? (
            <ShieldCheck className="shrink-0 text-emerald-600 mt-0.5" size={22} />
          ) : (
            <MessageCircle className="shrink-0 text-pink-600 mt-0.5" size={22} />
          )}
          <div className="space-y-1">
            <h3 className="font-bold text-sm">
              {hasAnyGateway
                ? "Cobrança Online Ativada (Mercado Pago / Asaas)"
                : "Modo Negociação Direta via WhatsApp (Padrão)"}
            </h3>
            <p className="text-xs leading-relaxed opacity-90">
              {hasAnyGateway
                ? "Sua loja está configurada para gerar cobranças automáticas. Você pode escolher qual gateway processa cada método abaixo."
                : "Quando você não ativa Mercado Pago ou Asaas, seu delivery funciona no modo tradicional: o pedido chega na sua tela de pedidos, o cliente envia a mensagem no WhatsApp e você combina o pagamento diretamente com ele."}
            </p>
          </div>
        </div>
      </div>

      {/* 2. Pagamentos no Recebimento (Presencial) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Banknote className="w-5 h-5 text-emerald-600" />
            Pagamentos na Entrega e Chave Pix Manual
          </CardTitle>
          <CardDescription>
            Opções em que o cliente paga no ato da entrega ou faz transferência direta para sua
            chave Pix.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div>
                <Label
                  htmlFor="accept_cash"
                  className="font-semibold text-slate-800 cursor-pointer"
                >
                  Aceitar Dinheiro
                </Label>
                <p className="text-xs text-slate-500 mt-0.5">
                  Pergunta ao cliente se precisa de troco e calcula quanto levar.
                </p>
              </div>
              <Switch
                id="accept_cash"
                checked={form.accept_cash}
                onCheckedChange={(checked) => setForm({ ...form, accept_cash: checked })}
              />
            </div>

            <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div>
                <Label
                  htmlFor="accept_card_delivery"
                  className="font-semibold text-slate-800 cursor-pointer"
                >
                  Cartão na Maquininha
                </Label>
                <p className="text-xs text-slate-500 mt-0.5">
                  O entregador leva a maquininha para o cliente passar débito/crédito.
                </p>
              </div>
              <Switch
                id="accept_card_delivery"
                checked={form.accept_card_delivery}
                onCheckedChange={(checked) => setForm({ ...form, accept_card_delivery: checked })}
              />
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Label
                  htmlFor="accept_manual_pix"
                  className="font-semibold text-slate-800 cursor-pointer"
                >
                  Chave Pix Direta da Loja (Sem Gateway)
                </Label>
                <p className="text-xs text-slate-500 mt-0.5">
                  Exibe a sua chave Pix para o cliente pagar e enviar o comprovante no WhatsApp.
                </p>
              </div>
              <Switch
                id="accept_manual_pix"
                checked={form.accept_manual_pix}
                onCheckedChange={(checked) => setForm({ ...form, accept_manual_pix: checked })}
              />
            </div>

            {form.accept_manual_pix && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-slate-100">
                <div>
                  <Label className="text-xs text-slate-600">Tipo de Chave</Label>
                  <Select
                    value={form.manual_pix_key_type || "random"}
                    onValueChange={(val: PixKeyType) =>
                      setForm({ ...form, manual_pix_key_type: val })
                    }
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cpf">CPF</SelectItem>
                      <SelectItem value="cnpj">CNPJ</SelectItem>
                      <SelectItem value="phone">Telefone</SelectItem>
                      <SelectItem value="email">E-mail</SelectItem>
                      <SelectItem value="random">Chave Aleatória</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-2">
                  <Label className="text-xs text-slate-600">Sua Chave Pix</Label>
                  <Input
                    className="mt-1"
                    placeholder="Cole aqui sua chave Pix"
                    value={form.manual_pix_key || ""}
                    onChange={(e) => setForm({ ...form, manual_pix_key: e.target.value })}
                  />
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 3. Mercado Pago */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex size-7 items-center justify-center rounded-lg bg-sky-50 text-sky-600 font-black text-xs">
                MP
              </div>
              <div>
                <CardTitle>Mercado Pago</CardTitle>
                <CardDescription>
                  Receba pagamentos com Pix transparente e Cartão de Crédito direto na sua conta
                  Mercado Pago.
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 font-medium">Habilitar Mercado Pago</span>
              <Switch
                checked={form.mp_enabled}
                onCheckedChange={(checked) => setForm({ ...form, mp_enabled: checked })}
              />
            </div>
          </div>
        </CardHeader>
        {form.mp_enabled && (
          <CardContent className="space-y-4 border-t pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="mp_public_key">Public Key (Chave Pública)</Label>
                <Input
                  id="mp_public_key"
                  placeholder="APP_USR-xxxxxxxx..."
                  value={form.mp_public_key || ""}
                  onChange={(e) => setForm({ ...form, mp_public_key: e.target.value })}
                />
                <p className="text-[11px] text-slate-500">
                  Usada no checkout para segurança do cartão de crédito.
                </p>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label htmlFor="mp_access_token">Access Token (Token de Acesso)</Label>
                  <button
                    type="button"
                    onClick={() => setShowMpToken(!showMpToken)}
                    className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1"
                  >
                    {showMpToken ? <EyeOff size={13} /> : <Eye size={13} />}
                    {showMpToken ? "Ocultar" : "Mostrar"}
                  </button>
                </div>
                <Input
                  id="mp_access_token"
                  type={showMpToken ? "text" : "password"}
                  placeholder="APP_USR-xxxxxxxx..."
                  value={form.mp_access_token || ""}
                  onChange={(e) => setForm({ ...form, mp_access_token: e.target.value })}
                />
                <p className="text-[11px] text-slate-500">
                  Token privado da sua aplicação no Mercado Pago.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg bg-slate-50 border p-3">
              <div>
                <Label
                  htmlFor="mp_sandbox"
                  className="font-medium text-xs text-slate-800 cursor-pointer"
                >
                  Modo Teste (Sandbox)
                </Label>
                <p className="text-[11px] text-slate-500">
                  Desative para aceitar pagamentos reais de clientes.
                </p>
              </div>
              <Switch
                id="mp_sandbox"
                checked={form.mp_sandbox}
                onCheckedChange={(checked) => setForm({ ...form, mp_sandbox: checked })}
              />
            </div>
          </CardContent>
        )}
      </Card>

      {/* 4. Asaas */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex size-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600 font-black text-xs">
                AS
              </div>
              <div>
                <CardTitle>Asaas</CardTitle>
                <CardDescription>
                  Receba pagamentos com Pix transparente e Cartão de Crédito na sua conta Asaas.
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 font-medium">Habilitar Asaas</span>
              <Switch
                checked={form.asaas_enabled}
                onCheckedChange={(checked) => setForm({ ...form, asaas_enabled: checked })}
              />
            </div>
          </div>
        </CardHeader>
        {form.asaas_enabled && (
          <CardContent className="space-y-4 border-t pt-4">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label htmlFor="asaas_api_key">Chave de API do Asaas</Label>
                <button
                  type="button"
                  onClick={() => setShowAsaasKey(!showAsaasKey)}
                  className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1"
                >
                  {showAsaasKey ? <EyeOff size={13} /> : <Eye size={13} />}
                  {showAsaasKey ? "Ocultar" : "Mostrar"}
                </button>
              </div>
              <Input
                id="asaas_api_key"
                type={showAsaasKey ? "text" : "password"}
                placeholder="$aact_xxxxxxxx..."
                value={form.asaas_api_key || ""}
                onChange={(e) => setForm({ ...form, asaas_api_key: e.target.value })}
              />
              <p className="text-[11px] text-slate-500">
                Chave gerada em Integrações &gt; Chaves de API no seu painel Asaas.
              </p>
            </div>

            <div className="flex items-center justify-between rounded-lg bg-slate-50 border p-3">
              <div>
                <Label
                  htmlFor="asaas_sandbox"
                  className="font-medium text-xs text-slate-800 cursor-pointer"
                >
                  Modo Sandbox (Ambiente de Testes)
                </Label>
                <p className="text-[11px] text-slate-500">
                  Desative quando utilizar as credenciais de produção do Asaas.
                </p>
              </div>
              <Switch
                id="asaas_sandbox"
                checked={form.asaas_sandbox}
                onCheckedChange={(checked) => setForm({ ...form, asaas_sandbox: checked })}
              />
            </div>
          </CardContent>
        )}
      </Card>

      {/* 5. Roteamento de Meios Online */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <QrCode className="w-5 h-5 text-pink-600" />
            Preferências de Processamento Online
          </CardTitle>
          <CardDescription>
            Defina qual gateway processará os pagamentos dos clientes quando online.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Processador do Pix Online</Label>
            <Select
              value={form.pix_provider}
              onValueChange={(val: "manual" | "mercadopago" | "asaas") =>
                setForm({ ...form, pix_provider: val })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">Chave Pix Manual (Sem gateway)</SelectItem>
                <SelectItem value="mercadopago" disabled={!form.mp_enabled}>
                  Mercado Pago (Pix Transparente) {!form.mp_enabled && "(Desativado)"}
                </SelectItem>
                <SelectItem value="asaas" disabled={!form.asaas_enabled}>
                  Asaas (Pix Transparente) {!form.asaas_enabled && "(Desativado)"}
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[11px] text-slate-500">
              Gera QR Code e Copia e Cola automaticamente na tela de finalização.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Processador do Cartão de Crédito</Label>
            <Select
              value={form.card_provider}
              onValueChange={(val: "delivery" | "mercadopago" | "asaas") =>
                setForm({ ...form, card_provider: val })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="delivery">Maquininha na Entrega (Presencial)</SelectItem>
                <SelectItem value="mercadopago" disabled={!form.mp_enabled}>
                  Mercado Pago (Cartão Online) {!form.mp_enabled && "(Desativado)"}
                </SelectItem>
                <SelectItem value="asaas" disabled={!form.asaas_enabled}>
                  Asaas (Cartão Online) {!form.asaas_enabled && "(Desativado)"}
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[11px] text-slate-500">
              Permite pagamento direto por cartão no catálogo com confirmação rápida.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Nota de conformidade */}
      <div className="rounded-xl border border-sky-100 bg-sky-50/60 p-4 flex gap-3 text-xs text-sky-800">
        <ShieldCheck className="shrink-0 text-sky-600 mt-0.5" size={17} />
        <div>
          <span className="font-semibold block text-sky-900">Agilidade no Delivery:</span>O checkout
          de pedidos foi projetado exclusivamente para <strong>Dinheiro</strong> (com troco),{" "}
          <strong>Pix</strong> e <strong>Cartão</strong>. Boleto bancário não é disponibilizado para
          pedidos de delivery devido ao prazo de compensação.
        </div>
      </div>

      <div className="flex justify-end">
        <Button
          type="submit"
          className="bg-pink-600 hover:bg-pink-700 text-white gap-2 px-6 h-11"
          disabled={mutation.isPending}
        >
          {mutation.isPending ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
          Salvar Configurações de Pagamento
        </Button>
      </div>
    </form>
  );
}
