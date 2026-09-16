import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CircleDollarSign, Loader2, Store, WalletCards } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getAllStores } from "@/lib/super-admin.functions";
import type { StoreOverview } from "@/lib/super-admin.functions";
import {
  getPlatformFinance,
  type FinanceFilters,
  type FinancePeriod,
} from "@/lib/super-admin-finance";

export const Route = createFileRoute("/super/financeiro")({
  component: PlatformFinancePage,
});

const money = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0);
const periods: Array<{ value: FinancePeriod; label: string }> = [
  { value: "today", label: "Hoje" },
  { value: 7, label: "7 dias" },
  { value: 30, label: "30 dias" },
];
const colors = ["#ef4444", "#1d4ed8", "#64748b", "#d97706"] as const;

function PlatformFinancePage() {
  const [filters, setFilters] = useState<FinanceFilters>({ period: 30 });
  const { data: stores } = useQuery<StoreOverview[]>({
    queryKey: ["super-stores"],
    queryFn: getAllStores,
  });
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["super-platform-finance", filters],
    queryFn: () => getPlatformFinance(filters),
  });

  return (
    <div className="space-y-7">
      <header className="flex flex-col gap-4 border-b border-white/[0.07] pb-7 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-3 flex items-center gap-2 text-xs font-medium text-red-400">
            <CircleDollarSign size={14} /> Financeiro da plataforma
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-white">Visão financeira</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-400">
            Receita bruta operacional dos pedidos não cancelados, consolidada por loja.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {periods.map((period) => (
            <Button
              key={String(period.value)}
              size="sm"
              variant="ghost"
              aria-pressed={filters.period === period.value}
              onClick={() => setFilters({ period: period.value })}
              className={
                filters.period === period.value
                  ? "bg-red-600 text-white hover:bg-red-500"
                  : "text-slate-400 hover:bg-white/[0.06] hover:text-white"
              }
            >
              {period.label}
            </Button>
          ))}
          <Button
            size="sm"
            variant="ghost"
            aria-pressed={filters.period === "custom"}
            onClick={() =>
              setFilters({
                period: "custom",
                dateFrom: filters.dateFrom || new Date().toISOString().slice(0, 10),
                dateTo: filters.dateTo || new Date().toISOString().slice(0, 10),
              })
            }
            className={
              filters.period === "custom"
                ? "bg-red-600 text-white hover:bg-red-500"
                : "text-slate-400 hover:bg-white/[0.06] hover:text-white"
            }
          >
            Personalizado
          </Button>
        </div>
      </header>

      <section className="flex flex-col gap-3 rounded-2xl border border-white/[0.08] bg-[#11151c] p-4 sm:flex-row sm:items-end">
        <label className="flex-1 text-xs text-slate-500">
          Loja
          <select
            value={filters.storeId || "all"}
            onChange={(event) =>
              setFilters((current) => {
                const next = { ...current };
                if (event.target.value === "all") delete next.storeId;
                else next.storeId = event.target.value;
                return next;
              })
            }
            className="mt-2 h-10 w-full rounded-lg border border-white/[0.1] bg-[#0b0d12] px-3 text-sm text-slate-200 outline-none focus:border-red-500"
          >
            <option value="all">Todas as lojas</option>
            {(stores || []).map((store) => (
              <option key={store.id} value={store.id}>
                {store.name}
              </option>
            ))}
          </select>
        </label>
        {filters.period === "custom" && (
          <>
            <label className="text-xs text-slate-500">
              De
              <Input
                type="date"
                value={filters.dateFrom || ""}
                onChange={(event) =>
                  setFilters((current) => ({ ...current, dateFrom: event.target.value }))
                }
                className="mt-2 border-white/[0.1] bg-[#0b0d12] text-slate-200"
              />
            </label>
            <label className="text-xs text-slate-500">
              Até
              <Input
                type="date"
                value={filters.dateTo || ""}
                onChange={(event) =>
                  setFilters((current) => ({ ...current, dateTo: event.target.value }))
                }
                className="mt-2 border-white/[0.1] bg-[#0b0d12] text-slate-200"
              />
            </label>
          </>
        )}
      </section>

      {isLoading ? (
        <div className="flex h-72 items-center justify-center text-slate-500">
          <Loader2 className="animate-spin" />
        </div>
      ) : isError ? (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/[0.06] p-8 text-center text-red-200">
          {error instanceof Error ? error.message : "Não foi possível carregar o financeiro."}
        </div>
      ) : data ? (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Metric
              label="Receita bruta"
              value={money(data.revenue)}
              detail="Pedidos não cancelados"
              icon={CircleDollarSign}
            />
            <Metric
              label="Pedidos válidos"
              value={String(data.nonCanceledOrders)}
              detail="No período"
              icon={WalletCards}
            />
            <Metric
              label="Ticket médio"
              value={money(data.averageTicket)}
              detail="Por pedido não cancelado"
              icon={CircleDollarSign}
            />
            <Metric
              label="Cancelados"
              value={String(data.canceledOrders)}
              detail="Fora da receita"
              icon={Store}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <Chart
              title="Evolução da receita"
              description="Somente pedidos não cancelados"
              summary="Evolução diária da receita bruta."
              data={data.daily}
            >
              <LineChart data={data.daily}>
                <CartesianGrid
                  strokeDasharray="2 5"
                  vertical={false}
                  stroke="rgba(148,163,184,.1)"
                />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#8993a5" }} />
                <YAxis tick={{ fontSize: 11, fill: "#8993a5" }} />
                <Tooltip formatter={(value) => money(Number(value ?? 0))} />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#ef4444"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </Chart>
            <Card className="border-white/[0.08] bg-[#11151c] text-slate-100">
              <CardHeader>
                <CardTitle>Formas informadas</CardTitle>
                <CardDescription className="text-slate-500">
                  Não representa confirmação de pagamento.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {data.payments.length ? (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.payments}>
                        <CartesianGrid
                          strokeDasharray="2 5"
                          vertical={false}
                          stroke="rgba(148,163,184,.1)"
                        />
                        <XAxis dataKey="method" tick={{ fontSize: 11, fill: "#8993a5" }} />
                        <YAxis tick={{ fontSize: 11, fill: "#8993a5" }} />
                        <Tooltip formatter={(value) => money(Number(value ?? 0))} />
                        <Bar dataKey="amount" name="Receita" radius={[4, 4, 0, 0]}>
                          {data.payments.map((payment, index) => (
                            <Cell
                              key={payment.method}
                              fill={colors[index % colors.length] ?? "#64748b"}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <p className="py-20 text-center text-sm text-slate-500">
                    Nenhum pedido no período.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
          <Card className="border-white/[0.08] bg-[#11151c] text-slate-100">
            <CardHeader>
              <CardTitle>Desempenho por loja</CardTitle>
              <CardDescription className="text-slate-500">
                Receita bruta e pedidos não cancelados.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {data.stores.map((store) => (
                  <div key={store.storeId} className="flex items-center gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-slate-200">{store.storeName}</p>
                      <div className="mt-2 h-1.5 rounded-full bg-white/[0.06]">
                        <div
                          className="h-full rounded-full bg-red-500"
                          style={{
                            width: `${data.revenue ? Math.max(3, (store.revenue / data.revenue) * 100) : 0}%`,
                          }}
                        />
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-white">{money(store.revenue)}</span>
                    <span className="w-16 text-right text-xs text-slate-500">
                      {store.orders} pedidos
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          <Card className="border-white/[0.08] bg-[#11151c] text-slate-100">
            <CardHeader>
              <CardTitle>Transações recentes</CardTitle>
              <CardDescription className="text-slate-500">
                Sem dados pessoais de clientes.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="max-h-96 overflow-auto">
                <table className="w-full min-w-[680px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-white/[0.08] text-xs text-slate-500">
                      <th className="px-3 py-3">Data</th>
                      <th className="px-3 py-3">Loja</th>
                      <th className="px-3 py-3">Status</th>
                      <th className="px-3 py-3">Método</th>
                      <th className="px-3 py-3 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.06]">
                    {data.transactions.map((transaction) => (
                      <tr key={transaction.id}>
                        <td className="px-3 py-3 text-slate-400">
                          {transaction.date
                            ? new Date(transaction.date).toLocaleDateString("pt-BR")
                            : "-"}
                        </td>
                        <td className="px-3 py-3 text-slate-200">{transaction.storeName}</td>
                        <td className="px-3 py-3 text-slate-400">{transaction.status}</td>
                        <td className="px-3 py-3 text-slate-400">{transaction.paymentMethod}</td>
                        <td className="px-3 py-3 text-right font-medium text-white">
                          {money(transaction.total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!data.transactions.length && (
                <p className="py-8 text-center text-sm text-slate-500">
                  Nenhuma transação no período.
                </p>
              )}
            </CardContent>
          </Card>
          {data.truncated && (
            <p className="rounded-lg border border-amber-500/20 bg-amber-500/[0.08] p-3 text-sm text-amber-200">
              O resultado foi limitado. Reduza o período ou filtre uma loja para uma visão completa.
            </p>
          )}
        </>
      ) : null}
    </div>
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
        <div className="flex justify-between">
          <div>
            <p className="text-xs text-slate-500">{label}</p>
            <p className="mt-3 text-2xl font-semibold text-white">{value}</p>
            <p className="mt-1 text-xs text-slate-600">{detail}</p>
          </div>
          <Icon className="text-red-400" size={18} />
        </div>
      </CardContent>
    </Card>
  );
}

function Chart({
  title,
  description,
  summary,
  data,
  children,
}: {
  title: string;
  description: string;
  summary: string;
  data: unknown[];
  children: React.ReactElement;
}) {
  return (
    <Card className="border-white/[0.08] bg-[#11151c] text-slate-100">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription className="text-slate-500">{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="sr-only">{summary}</p>
        <div className="h-64">
          {data.length ? (
            <ResponsiveContainer width="100%" height="100%">
              {children}
            </ResponsiveContainer>
          ) : (
            <p className="py-20 text-center text-sm text-slate-500">Nenhum dado no período.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
