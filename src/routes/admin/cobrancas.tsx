import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Check,
  Clipboard,
  ExternalLink,
  FileText,
  Loader2,
  QrCode,
  WalletCards,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  billingStatusLabel,
  getCompanyBilling,
  isSafePaymentUrl,
  moneyFromCents,
  paymentMethodLabel,
} from "@/lib/super-admin.functions";
import { useActiveStore } from "@/lib/active-store";

export const Route = createFileRoute("/admin/cobrancas")({ component: CompanyBillingPage });

const dateLabel = (value: string | null) =>
  value ? new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR") : "—";

const statusClass = (status: string) => {
  if (status === "received" || status === "confirmed") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (status === "overdue" || status === "failed") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }
  return "border-slate-200 bg-slate-50 text-slate-600";
};

function CompanyBillingPage() {
  const { storeId } = useActiveStore();
  const [copied, setCopied] = useState<string | null>(null);
  const { data, isLoading, error } = useQuery({
    queryKey: ["company-billing", storeId],
    queryFn: () => getCompanyBilling(storeId),
  });

  const copy = async (value: string, label: string) => {
    await navigator.clipboard.writeText(value);
    setCopied(label);
    toast.success(`${label} copiado.`);
    window.setTimeout(() => setCopied(null), 1800);
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center text-slate-400">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        {error instanceof Error ? error.message : "Não foi possível carregar suas cobranças."}
      </div>
    );
  }

  const invoices = data?.invoices || [];
  const latest = invoices[0];

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-2 border-b border-slate-200 pb-5">
        <div className="flex items-center gap-2 text-sm font-medium text-pink-600">
          <WalletCards size={17} /> Mensalidade da plataforma
        </div>
        <h1 className="text-2xl font-semibold text-slate-800">Minhas cobranças</h1>
        <p className="max-w-2xl text-sm text-slate-500">
          Escolha Pix ou boleto para pagar sua mensalidade. O status só muda após a confirmação do
          Asaas.
        </p>
      </header>

      {!data?.profile && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          O perfil de cobrança ainda está sendo configurado pelo administrador do sistema.
        </div>
      )}

      {latest && (
        <Card className="border-pink-100 bg-gradient-to-br from-white to-pink-50/50">
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle>Próxima mensalidade</CardTitle>
                <CardDescription className="mt-1">
                  Vencimento em {dateLabel(latest.due_date)}
                </CardDescription>
              </div>
              <Badge className={statusClass(latest.status)}>
                {billingStatusLabel(latest.status)}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs text-slate-500">Valor da cobrança</p>
                <p className="mt-1 text-3xl font-semibold text-slate-900">
                  {moneyFromCents(latest.amount_cents)}
                </p>
              </div>
              <p className="text-sm text-slate-500">
                Forma:{" "}
                <span className="font-medium text-slate-700">
                  {paymentMethodLabel(latest.payment_method)}
                </span>
              </p>
            </div>
            {latest.status !== "received" && latest.status !== "confirmed" && (
              <div className="grid gap-3 sm:grid-cols-2">
                <PaymentAction
                  label="Pagar com Pix"
                  icon={<QrCode size={17} />}
                  value={latest.pix_copy_paste}
                  onCopy={() =>
                    latest.pix_copy_paste && copy(latest.pix_copy_paste, "Pix copia e cola")
                  }
                  href={isSafePaymentUrl(latest.invoice_url) ? latest.invoice_url : null}
                />
                <PaymentAction
                  label="Pagar com boleto"
                  icon={<FileText size={17} />}
                  value={latest.bank_slip_digitable_line}
                  onCopy={() =>
                    latest.bank_slip_digitable_line &&
                    copy(latest.bank_slip_digitable_line, "Linha digitável")
                  }
                  href={
                    isSafePaymentUrl(latest.bank_slip_url)
                      ? latest.bank_slip_url
                      : isSafePaymentUrl(latest.invoice_url)
                        ? latest.invoice_url
                        : null
                  }
                />
              </div>
            )}
            {(latest.status === "received" || latest.status === "confirmed") && (
              <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
                <Check size={17} /> Pagamento confirmado pelo provedor.
              </div>
            )}
            {!latest.pix_copy_paste &&
              !latest.bank_slip_digitable_line &&
              latest.status !== "received" &&
              latest.status !== "confirmed" && (
                <p className="text-sm text-slate-500">
                  Os dados para Pix e boleto aparecerão aqui assim que o administrador gerar a
                  cobrança no Asaas.
                </p>
              )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Histórico de faturas</CardTitle>
          <CardDescription>
            Os valores e períodos ficam registrados mesmo quando o plano mudar.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs text-slate-500">
                  <th className="px-3 py-3">Período</th>
                  <th className="px-3 py-3">Vencimento</th>
                  <th className="px-3 py-3">Valor</th>
                  <th className="px-3 py-3">Forma</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoices.map((invoice) => (
                  <tr key={invoice.id}>
                    <td className="px-3 py-3 text-slate-600">
                      {dateLabel(invoice.period_start)} — {dateLabel(invoice.period_end)}
                    </td>
                    <td className="px-3 py-3 text-slate-600">{dateLabel(invoice.due_date)}</td>
                    <td className="px-3 py-3 font-medium text-slate-800">
                      {moneyFromCents(invoice.amount_cents)}
                    </td>
                    <td className="px-3 py-3 text-slate-600">
                      {paymentMethodLabel(invoice.payment_method)}
                    </td>
                    <td className="px-3 py-3">
                      <Badge className={statusClass(invoice.status)}>
                        {billingStatusLabel(invoice.status)}
                      </Badge>
                    </td>
                    <td className="px-3 py-3 text-right">
                      {isSafePaymentUrl(invoice.invoice_url) && (
                        <Button asChild size="sm" variant="ghost" className="text-pink-600">
                          <a href={invoice.invoice_url} target="_blank" rel="noreferrer">
                            <ExternalLink size={14} /> Abrir
                          </a>
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
                {!invoices.length && (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-500">
                      Nenhuma fatura foi gerada para esta empresa.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function PaymentAction({
  label,
  icon,
  value,
  href,
  onCopy,
}: {
  label: string;
  icon: ReactNode;
  value: string | null;
  href: string | null;
  onCopy: () => void;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center gap-2 font-medium text-slate-800">
        {icon}
        {label}
      </div>
      {value ? (
        <div className="mt-3 flex items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded-md bg-slate-100 px-2 py-2 text-xs text-slate-600">
            {value}
          </code>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onCopy}
            aria-label={`Copiar ${label}`}
          >
            {<Clipboard size={14} />}
          </Button>
        </div>
      ) : (
        <p className="mt-3 text-xs text-slate-500">
          A opção ficará disponível quando o provedor retornar os dados.
        </p>
      )}
      {href && (
        <Button asChild size="sm" variant="link" className="mt-2 h-auto p-0 text-pink-600">
          <a href={href} target="_blank" rel="noreferrer">
            Abrir checkout do Asaas <ExternalLink size={13} />
          </a>
        </Button>
      )}
    </div>
  );
}
