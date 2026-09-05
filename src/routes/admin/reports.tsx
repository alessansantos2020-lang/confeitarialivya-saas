import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { getSalesReport } from '@/lib/reports.functions';
import { useActiveStore } from '@/lib/active-store';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  LineChart, 
  Line,
  Cell,
  PieChart,
  Pie
} from 'recharts';
import { 
  TrendingUp, 
  ShoppingBag, 
  DollarSign, 
  XCircle, 
  Calendar,
  Filter,
  Download,
  Loader2
} from 'lucide-react';
import { useState } from 'react';
import { format, subDays, startOfMonth, endOfMonth, startOfWeek, endOfWeek, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { generatePDFReport } from '@/lib/pdf-generator';


export const Route = createFileRoute('/admin/reports')({
  beforeLoad: () => {
    return;
  },
  component: ReportsPage,
});

function ReportsPage() {
  const { store, storeId } = useActiveStore();
  const [dateRange, setDateRange] = useState({
    start: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
    end: format(new Date(), 'yyyy-MM-dd')
  });

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['salesReport', storeId, dateRange],
    queryFn: () => getSalesReport({
      storeId,
      startDate: new Date(dateRange.start).toISOString(),
      endDate: new Date(dateRange.end + 'T23:59:59').toISOString()
    }),
  });

  const setPeriod = (period: 'today' | 'yesterday' | 'week' | 'last30' | 'thisMonth' | 'lastMonth') => {
    const now = new Date();
    let start = new Date(now);
    let end = new Date(now);

    switch (period) {
      case 'today':
        break;
      case 'yesterday':
        start = subDays(now, 1);
        end = subDays(now, 1);
        break;
      case 'week':
        start = subDays(now, 7);
        break;
      case 'thisMonth':
        start = startOfMonth(now);
        end = endOfMonth(now);
        break;
      case 'lastMonth':
        const lastMonth = subMonths(now, 1);
        start = startOfMonth(lastMonth);
        end = endOfMonth(lastMonth);
        break;
      case 'last30':
        start = subDays(now, 30);
        break;
    }

    setDateRange({
      start: format(start, 'yyyy-MM-dd'),
      end: format(end, 'yyyy-MM-dd')
    });
  };

  const handleGeneratePDF = (type: 'sales' | 'orders' | 'products' | 'customers' | 'financial' | 'canceled') => {
    if (!data) return;
    
    let title = "Relatório de Vendas";
    switch(type) {
      case 'orders': title = "Relatório de Pedidos"; break;
      case 'products': title = "Relatório de Produtos"; break;
      case 'customers': title = "Relatório de Clientes"; break;
      case 'financial': title = "Relatório Financeiro"; break;
      case 'canceled': title = "Relatório de Pedidos Cancelados"; break;
    }

    generatePDFReport(title, dateRange, data, type, store.name);
  };



  const COLORS = ['#1d4ed8', '#2563eb', '#60a5fa', '#bfdbfe', '#eff6ff'];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-pink-600" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Relatórios de Vendas</h1>
          <p className="text-slate-500">Análise completa de desempenho da sua loja.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setPeriod('today')}>Hoje</Button>
          <Button variant="outline" size="sm" onClick={() => setPeriod('yesterday')}>Ontem</Button>
          <Button variant="outline" size="sm" onClick={() => setPeriod('week')}>Últimos 7 dias</Button>
          <Button variant="outline" size="sm" onClick={() => setPeriod('last30')}>Últimos 30 dias</Button>
          <Button variant="outline" size="sm" onClick={() => setPeriod('thisMonth')}>Este mês</Button>
          <Button variant="outline" size="sm" onClick={() => setPeriod('lastMonth')}>Mês anterior</Button>

        </div>
      </div>

      <Card className="bg-white shadow-sm border-slate-200">
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
            <div className="space-y-2">
              <Label htmlFor="start">Data Inicial</Label>
              <Input 
                id="start" 
                type="date" 
                value={dateRange.start} 
                onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end">Data Final</Label>
              <Input 
                id="end" 
                type="date" 
                value={dateRange.end} 
                onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
              />
            </div>
            <Button className="bg-pink-600 hover:bg-pink-700 gap-2" onClick={() => refetch()}>
              <Filter className="w-4 h-4" />
              Filtrar Dados
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Report Types Buttons */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
        <Button variant="outline" className="text-xs py-1 h-auto" onClick={() => handleGeneratePDF('sales')}>Vendas</Button>
        <Button variant="outline" className="text-xs py-1 h-auto" onClick={() => handleGeneratePDF('orders')}>Pedidos</Button>
        <Button variant="outline" className="text-xs py-1 h-auto" onClick={() => handleGeneratePDF('products')}>Produtos</Button>
        <Button variant="outline" className="text-xs py-1 h-auto" onClick={() => handleGeneratePDF('customers')}>Clientes</Button>
        <Button variant="outline" className="text-xs py-1 h-auto" onClick={() => handleGeneratePDF('financial')}>Financeiro</Button>
        <Button variant="outline" className="text-xs py-1 h-auto" onClick={() => handleGeneratePDF('canceled')}>Cancelados</Button>
      </div>

      {/* Summary Cards */}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-none shadow-sm bg-gradient-to-br from-pink-500 to-pink-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <p className="text-pink-100 text-sm font-medium">Faturamento Total</p>
              <DollarSign className="w-5 h-5 text-pink-100 opacity-80" />
            </div>
            <h3 className="text-2xl font-bold mt-1">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(data?.summary.totalRevenue || 0)}
            </h3>
            <p className="text-xs text-pink-100 mt-2 opacity-80">Pedidos concluídos no período</p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <p className="text-slate-500 text-sm font-medium">Total de Pedidos</p>
              <ShoppingBag className="w-5 h-5 text-slate-400" />
            </div>
            <h3 className="text-2xl font-bold mt-1 text-slate-800">{data?.summary.totalOrders}</h3>
            <p className="text-xs text-slate-400 mt-2">Volume total de requisições</p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <p className="text-slate-500 text-sm font-medium">Ticket Médio</p>
              <TrendingUp className="w-5 h-5 text-green-500" />
            </div>
            <h3 className="text-2xl font-bold mt-1 text-slate-800">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                data?.summary.completedOrders ? data.summary.totalRevenue / data.summary.completedOrders : 0
              )}
            </h3>
            <p className="text-xs text-slate-400 mt-2">{data?.summary.completedOrders} pedidos finalizados</p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <p className="text-slate-500 text-sm font-medium">Cancelados</p>
              <XCircle className="w-5 h-5 text-red-500" />
            </div>
            <h3 className="text-2xl font-bold mt-1 text-slate-800">{data?.summary.canceledOrders}</h3>
            <p className="text-xs text-slate-400 mt-2">Pedidos não concretizados</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Sales Chart */}
        <Card className="bg-white shadow-sm border-slate-200">
          <CardHeader>
            <CardTitle className="text-lg">Evolução das Vendas</CardTitle>
            <CardDescription>Faturamento diário no período selecionado</CardDescription>
          </CardHeader>
          <CardContent className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data?.salesChart || []}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="date" 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: '#64748b' }}
                />
                <YAxis 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: '#64748b' }}
                  tickFormatter={(value) => `R$ ${value}`}
                />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  formatter={(value) => [new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0)), 'Faturamento']}
                />
                <Line 
                  type="monotone" 
                  dataKey="value" 
                  stroke="#1d4ed8" 
                  strokeWidth={3} 
                  dot={{ r: 4, fill: '#1d4ed8', strokeWidth: 2, stroke: '#fff' }}
                  activeDot={{ r: 6, strokeWidth: 0 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Top Products */}
        <Card className="bg-white shadow-sm border-slate-200">
          <CardHeader>
            <CardTitle className="text-lg">Produtos Mais Vendidos</CardTitle>
            <CardDescription>Ranking por quantidade vendida</CardDescription>
          </CardHeader>
          <CardContent className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.topProducts || []} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" hide />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  width={150}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: '#64748b' }}
                />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="quantity" fill="#1d4ed8" radius={[0, 4, 4, 0]} barSize={30}>
                  {data?.topProducts.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length] || '#1d4ed8'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Detailed List */}
      <Card className="bg-white shadow-sm border-slate-200">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg">Detalhamento de Produtos</CardTitle>
            <CardDescription>Lista de todos os itens vendidos no período</CardDescription>
          </div>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => handleGeneratePDF('sales')}>
            <Download className="w-4 h-4" />
            Gerar PDF
          </Button>


        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="py-3 px-4 text-sm font-semibold text-slate-600">Produto</th>
                  <th className="py-3 px-4 text-sm font-semibold text-slate-600 text-right">Qtd. Vendida</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {data?.topProducts.map((product, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 px-4 text-sm text-slate-700 font-medium">{product.name}</td>
                    <td className="py-3 px-4 text-sm text-slate-600 text-right">{product.quantity} un.</td>
                  </tr>
                ))}
                {(!data?.topProducts || data.topProducts.length === 0) && (
                  <tr>
                    <td colSpan={2} className="py-8 text-center text-slate-400 italic">
                      Nenhuma venda registrada no período selecionado.
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
