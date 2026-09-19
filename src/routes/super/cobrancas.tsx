import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  CircleDollarSign,
  ExternalLink,
  FileText,
  Loader2,
  Plus,
  RefreshCw,
  ShieldCheck,
  Store,
  WalletCards,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  billingPeriodLabel,
  billingStatusLabel,
  createBillingSubscription,
  createAsaasSubscription,
  getBillingOverview,
  isSafePaymentUrl,
  moneyFromCents,
  upsertBillingCustomer,
  type BillingFilters,
  type BillingInvoiceStatus,
  type BillingSubscriptionPeriod,
  type BillingStore,
} from "@/lib/super-admin.functions";
import { getAllPlans } from "@/lib/super-admin.functions";
import { queryKeys } from "@/lib/query-keys";

export const Route = createFileRoute("/super/cobrancas")({ component: BillingPage });

const invoiceStatusOptions: Array<{ value: BillingInvoiceStatus; label: string }> = [
  { value: "pending", label: "Pendentes" },
  { value: "received", label: "Recebidas" },
  { value: "overdue", label: "Vencidas" },
  { value: "failed", label: "Falhas" },
];

const statusClass = (status: string) => {
  if (status === "active" || status === "received" || status === "confirmed") {
    return "border-emerald-500/25 bg-emerald-500/10 text-emerald-300";
  }
  if (status === "overdue" || status === "past_due" || status === "failed") {
    return "border-amber-500/25 bg-amber-500/10 text-amber-200";
  }
  if (status === "canceled" || status === "suspended") {
    return "border-red-500/25 bg-red-500/10 text-red-300";
  }
  return "border-white/10 bg-white/[0.05] text-slate-300";
};

const dateLabel = (value: string | null) =>
  value ? new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR") : "—";

function BillingPage() {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<BillingFilters>({
    invoiceStatus: "all",
    subscriptionStatus: "all",
  });
  const [createTarget, setCreateTarget] = useState<BillingStore | null>(null);
  const [form, setForm] = useState({
    legalName: "",
    taxId: "",
    email: "",
    phone: "",
    planId: "",
    period: "monthly" as BillingSubscriptionPeriod,
    dueDate: "",
  });
  const plansQuery = useQuery({ queryKey: queryKeys.superPlans(), queryFn: getAllPlans });
  const billingQuery = useQuery({
    queryKey: queryKeys.superBilling({
      storeId: filters.storeId,
      planId: filters.planId,
      subscriptionStatus: filters.subscriptionStatus,
      invoiceStatus: filters.invoiceStatus,
    }),
    queryFn: () => getBillingOverview(filters),
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!createTarget || !form.planId || !form.legalName.trim() || !form.dueDate) {
        throw new Error("Informe empresa, plano e vencimento.");
      }
      const plan = (plansQuery.data || []).find((item) => item.id === form.planId);
      if (!plan) throw new Error("Plano não encontrado.");
      await upsertBillingCustomer({
        storeId: createTarget.id,
        legalName: form.legalName,
        taxId: form.taxId,
        email: form.email,
        phone: form.phone,
      });
      const subscriptionId = await createBillingSubscription({
        storeId: createTarget.id,
        planId: plan.id,
        billingPeriod: form.period,
        amountCents: plan.price_cents,
        startsOn: new Date().toISOString().slice(0, 10),
        nextDueDate: form.dueDate,
      });
      return await createAsaasSubscription(subscriptionId);
    },
    onSuccess: (result) => {
      toast.success(
        result.status === "pending"
          ? "Assinatura registrada. Configure o Asaas para gerar Pix ou boleto."
          : "Assinatura criada. A empresa poderá escolher Pix ou boleto no checkout do Asaas.",
      );
      setCreateTarget(null);
      queryClient.invalidateQueries({ queryKey: ["super-billing"] });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Não foi possível criar a assinatura."),
  });

  const stores = billingQuery.data?.stores || [];
  const plans = plansQuery.data || [];
  const activeCount = billingQuery.data?.summary.activeCompanies || 0;
  const configuredMessage = billingQuery.data?.providerConfigured === false;
  const selectableStores = useMemo(
    () => stores.filter((store) => !store.subscription || store.subscription.status === "canceled"),
    [stores],
  );

  const openCreate = (store: BillingStore) => {
    const plan =
      plans.find((item) => item.id === store.planId) || plans.find((item) => item.is_active);
    setCreateTarget(store);
    setForm({
      legalName: store.profile?.legal_name || store.name,
      taxId: store.profile?.tax_id || "",
      email: store.profile?.email || "",
      phone: store.profile?.phone || "",
      planId: plan?.id || "",
      period: (plan?.billing_period || "monthly") as BillingSubscriptionPeriod,
      dueDate: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
    });
  };

  return (
    <div className="space-y-7">
      <header className="flex flex-col gap-4 border-b border-white/[0.07] pb-7 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-3 flex items-center gap-2 text-xs font-medium text-red-400">
            <CircleDollarSign size={14} /> Financeiro SaaS
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-white">
            Cobranças das empresas
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-400">
            Assinaturas e mensalidades da plataforma. Este painel não mistura pedidos das lojas.
          </p>
        </div>
        <Button
          onClick={() => billingQuery.refetch()}
          variant="outline"
          className="gap-2 border-white/10 bg-transparent text-slate-300 hover:bg-white/[0.06]"
        >
          <RefreshCw size={15} /> Atualizar
        </Button>
      </header>

      {configuredMessage && (
        <div className="flex gap-3 rounded-2xl border border-amber-500/25 bg-amber-500/[0.07] p-4 text-sm text-amber-100">
          <ShieldCheck className="mt-0.5 shrink-0 text-amber-300" size={19} />
          <div>
            <p className="font-medium">Asaas ainda não configurado</p>
            <p className="mt-1 text-amber-200/70">
              As assinaturas são registradas como pendentes. Nenhuma cobrança foi enviada e nenhum
              valor é considerado recebido até a confirmação do provedor.
            </p>
          </div>
        </div>
      )}

      {billingQuery.isLoading ? (
        <Loading />
      ) : billingQuery.error ? (
        <ErrorState message={(billingQuery.error as Error).message} />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <Metric
              label="Contratado ativo"
              value={moneyFromCents(billingQuery.data?.summary.contractedCents || 0)}
              detail="Previsão dos contratos ativos"
              icon={CircleDollarSign}
            />
            <Metric
              label="Recebido confirmado"
              value={moneyFromCents(billingQuery.data?.summary.receivedCents || 0)}
              detail="Confirmado pelo provedor"
              icon={CheckCircle2}
            />
            <Metric
              label="Pendente"
              value={moneyFromCents(billingQuery.data?.summary.pendingCents || 0)}
              detail="Aguardando pagamento"
              icon={CalendarClock}
            />
            <Metric
              label="Vencido"
              value={moneyFromCents(billingQuery.data?.summary.overdueCents || 0)}
              detail="Exige acompanhamento"
              icon={AlertTriangle}
            />
            <Metric
              label="Empresas ativas"
              value={String(activeCount)}
              detail={`${billingQuery.data?.summary.subscriptions || 0} assinatura(s) registrada(s)`}
              icon={Store}
            />
          </div>

          <Card className="border-white/[0.08] bg-[#11151c] text-slate-100">
            <CardHeader>
              <CardTitle>Filtros de cobrança</CardTitle>
              <CardDescription className="text-slate-500">
                Consulte contratos e faturas sem acessar dados de clientes finais.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <Select
                value={filters.storeId || "all"}
                onValueChange={(value) =>
                  setFilters((current) => {
                    const next = { ...current };
                    if (value === "all") delete next.storeId;
                    else next.storeId = value;
                    return next;
                  })
                }
              >
                <SelectTrigger className="border-white/10 bg-[#0b0d12] text-slate-200">
                  <SelectValue placeholder="Empresa" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as empresas</SelectItem>
                  {stores.map((store) => (
                    <SelectItem key={store.id} value={store.id}>
                      {store.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={filters.planId || "all"}
                onValueChange={(value) =>
                  setFilters((current) => {
                    const next = { ...current };
                    if (value === "all") delete next.planId;
                    else next.planId = value;
                    return next;
                  })
                }
              >
                <SelectTrigger className="border-white/10 bg-[#0b0d12] text-slate-200">
                  <SelectValue placeholder="Plano" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os planos</SelectItem>
                  {plans.map((plan) => (
                    <SelectItem key={plan.id} value={plan.id}>
                      {plan.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={filters.invoiceStatus || "all"}
                onValueChange={(value) =>
                  setFilters((current) => ({
                    ...current,
                    invoiceStatus: value === "all" ? "all" : (value as BillingInvoiceStatus),
                  }))
                }
              >
                <SelectTrigger className="border-white/10 bg-[#0b0d12] text-slate-200">
                  <SelectValue placeholder="Status da fatura" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  {invoiceStatusOptions.map((status) => (
                    <SelectItem key={status.value} value={status.value}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          <Card className="border-white/[0.08] bg-[#11151c] text-slate-100">
            <CardHeader>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <CardTitle>Empresas e assinaturas</CardTitle>
                  <CardDescription className="text-slate-500">
                    O valor é congelado no contrato; mudanças de plano não alteram faturas
                    históricas.
                  </CardDescription>
                </div>
                <Button
                  size="sm"
                  onClick={() => selectableStores[0] && openCreate(selectableStores[0])}
                  disabled={!selectableStores.length}
                  className="gap-2 bg-red-600 text-white hover:bg-red-500"
                >
                  <Plus size={15} /> Criar assinatura
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="border-white/[0.08] hover:bg-transparent">
                    <TableHead className="text-slate-500">Empresa</TableHead>
                    <TableHead className="text-slate-500">Plano</TableHead>
                    <TableHead className="text-slate-500">Valor</TableHead>
                    <TableHead className="text-slate-500">Status</TableHead>
                    <TableHead className="text-slate-500">Próximo vencimento</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stores.map((store) => (
                    <TableRow key={store.id} className="border-white/[0.06] hover:bg-white/[0.03]">
                      <TableCell className="font-medium text-slate-200">
                        {store.name}
                        <span className="block text-xs text-slate-600">
                          {store.profile?.legal_name || "Perfil de cobrança incompleto"}
                        </span>
                      </TableCell>
                      <TableCell className="text-slate-400">
                        {store.planName || "Sem plano"}
                      </TableCell>
                      <TableCell className="text-slate-200">
                        {store.subscription
                          ? moneyFromCents(store.subscription.amount_cents)
                          : store.planPriceCents !== null
                            ? moneyFromCents(store.planPriceCents)
                            : "—"}
                        <span className="block text-xs text-slate-600">
                          {store.subscription
                            ? billingPeriodLabel(store.subscription.billing_period)
                            : "Sem assinatura"}
                        </span>
                      </TableCell>
                      <TableCell>
                        {store.subscription ? (
                          <Badge className={statusClass(store.subscription.status)}>
                            {billingStatusLabel(store.subscription.status)}
                          </Badge>
                        ) : (
                          <Badge className={statusClass("pending")}>Sem assinatura</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-slate-400">
                        {dateLabel(store.subscription?.next_due_date || null)}
                      </TableCell>
                      <TableCell className="text-right">
                        {(!store.subscription || store.subscription.status === "canceled") && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openCreate(store)}
                            className="gap-1 text-red-300 hover:bg-red-500/10 hover:text-red-200"
                          >
                            <Plus size={14} /> Cobrar
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {!stores.length && (
                    <TableRow>
                      <TableCell colSpan={6} className="py-12 text-center text-slate-500">
                        Nenhuma empresa encontrada.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card className="border-white/[0.08] bg-[#11151c] text-slate-100">
            <CardHeader>
              <CardTitle>Faturas recentes</CardTitle>
              <CardDescription className="text-slate-500">
                Uma fatura só aparece como recebida quando houver confirmação válida.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="border-white/[0.08] hover:bg-transparent">
                    <TableHead className="text-slate-500">Período</TableHead>
                    <TableHead className="text-slate-500">Vencimento</TableHead>
                    <TableHead className="text-slate-500">Valor</TableHead>
                    <TableHead className="text-slate-500">Status</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(billingQuery.data?.invoices || []).map((invoice) => (
                    <TableRow
                      key={invoice.id}
                      className="border-white/[0.06] hover:bg-white/[0.03]"
                    >
                      <TableCell className="text-slate-400">
                        {dateLabel(invoice.period_start)} — {dateLabel(invoice.period_end)}
                      </TableCell>
                      <TableCell className="text-slate-400">
                        {dateLabel(invoice.due_date)}
                      </TableCell>
                      <TableCell className="font-medium text-slate-200">
                        {moneyFromCents(invoice.amount_cents)}
                      </TableCell>
                      <TableCell>
                        <Badge className={statusClass(invoice.status)}>
                          {billingStatusLabel(invoice.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {isSafePaymentUrl(invoice.invoice_url) && (
                          <Button asChild size="sm" variant="ghost" className="text-slate-400">
                            <a href={invoice.invoice_url} target="_blank" rel="noreferrer">
                              <ExternalLink size={14} /> Abrir
                            </a>
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {!billingQuery.data?.invoices.length && (
                    <TableRow>
                      <TableCell colSpan={5} className="py-12 text-center text-slate-500">
                        Nenhuma fatura registrada.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}

      <Dialog open={!!createTarget} onOpenChange={(open) => !open && setCreateTarget(null)}>
        <DialogContent className="border-white/10 bg-[#11151c] text-slate-100 sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Criar assinatura</DialogTitle>
            <DialogDescription className="text-slate-400">
              Registre o contrato de {createTarget?.name || "empresa"}. O Asaas ainda não está
              conectado.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label="Nome legal"
              value={form.legalName}
              onChange={(value) => setForm((current) => ({ ...current, legalName: value }))}
            />
            <Field
              label="CPF/CNPJ"
              value={form.taxId}
              onChange={(value) => setForm((current) => ({ ...current, taxId: value }))}
            />
            <Field
              label="E-mail de cobrança"
              value={form.email}
              onChange={(value) => setForm((current) => ({ ...current, email: value }))}
            />
            <Field
              label="Telefone"
              value={form.phone}
              onChange={(value) => setForm((current) => ({ ...current, phone: value }))}
            />
            <label className="text-xs text-slate-500">
              Plano
              <Select
                value={form.planId}
                onValueChange={(value) => setForm((current) => ({ ...current, planId: value }))}
              >
                <SelectTrigger className="mt-1 border-white/10 bg-[#0b0d12] text-slate-200">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {plans
                    .filter((plan) => plan.is_active)
                    .map((plan) => (
                      <SelectItem key={plan.id} value={plan.id}>
                        {plan.name} — {moneyFromCents(plan.price_cents)}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </label>
            <label className="text-xs text-slate-500">
              Vencimento inicial
              <Input
                type="date"
                value={form.dueDate}
                onChange={(event) =>
                  setForm((current) => ({ ...current, dueDate: event.target.value }))
                }
                className="mt-1 border-white/10 bg-[#0b0d12] text-slate-200"
              />
            </label>
          </div>
          <div className="rounded-lg border border-blue-500/20 bg-blue-500/[0.06] p-3 text-xs text-blue-100">
            A criação grava a assinatura e a primeira fatura como pendentes. Nenhum pagamento será
            marcado como recebido sem confirmação do Asaas ou ação manual auditada.
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setCreateTarget(null)}
              className="text-slate-400"
            >
              Cancelar
            </Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending}
              className="bg-red-600 text-white hover:bg-red-500"
            >
              {createMutation.isPending ? (
                <Loader2 className="animate-spin" size={15} />
              ) : (
                <FileText size={15} />
              )}{" "}
              Registrar assinatura
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="text-xs text-slate-500">
      {label}
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 border-white/10 bg-[#0b0d12] text-slate-200"
      />
    </label>
  );
}

function Metric({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string;
  value: string;
  detail: string;
  icon: typeof CircleDollarSign;
}) {
  return (
    <Card className="border-white/[0.08] bg-[#11151c] text-slate-100">
      <CardContent className="p-5">
        <div className="flex justify-between gap-2">
          <div>
            <p className="text-xs text-slate-500">{label}</p>
            <p className="mt-3 text-xl font-semibold text-white">{value}</p>
            <p className="mt-1 text-xs text-slate-600">{detail}</p>
          </div>
          <Icon className="text-red-400" size={18} />
        </div>
      </CardContent>
    </Card>
  );
}

function Loading() {
  return (
    <div className="flex h-72 items-center justify-center text-slate-500">
      <Loader2 className="animate-spin" />
    </div>
  );
}
function ErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-red-500/20 bg-red-500/[0.06] p-8 text-center text-red-200">
      {message}
    </div>
  );
}
