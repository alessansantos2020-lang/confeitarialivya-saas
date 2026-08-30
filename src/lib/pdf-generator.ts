import { jsPDF } from "jspdf";
import "jspdf-autotable";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export const generatePDFReport = (title: string, dateRange: { start: string; end: string }, data: any, type: 'sales' | 'orders' | 'products' | 'customers' | 'financial' | 'canceled') => {
  const doc = new jsPDF();
  const now = new Date();

  // Helper for currency
  const formatCurrency = (value: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  // Header
  doc.setFontSize(18);
  doc.text("Doce Encanto Confeitaria", 105, 20, { align: "center" });
  doc.setFontSize(14);
  doc.text(title, 105, 30, { align: "center" });
  
  doc.setFontSize(10);
  doc.text(`Período: ${format(new Date(dateRange.start), 'dd/MM/yyyy')} a ${format(new Date(dateRange.end), 'dd/MM/yyyy')}`, 105, 40, { align: "center" });
  doc.text(`Gerado em: ${format(now, "dd/MM/yyyy HH:mm", { locale: ptBR })}`, 105, 45, { align: "center" });

  doc.line(10, 50, 200, 50);

  let startY = 60;

  if (type === 'sales' || type === 'financial') {
    doc.setFontSize(12);
    doc.text(`Resumo Geral:`, 10, startY);
    doc.setFontSize(10);
    doc.text(`Total de Pedidos: ${data.summary.totalOrders}`, 10, startY + 10);
    doc.text(`Faturamento Bruto: ${formatCurrency(data.summary.totalRevenue)}`, 10, startY + 15);
    doc.text(`Pedidos Concluídos: ${data.summary.completedOrders}`, 10, startY + 20);
    doc.text(`Pedidos Cancelados: ${data.summary.canceledOrders}`, 10, startY + 25);
    
    // Estimating delivery fees from summary (if available in future audits, for now using revenue)
    // In a real scenario we'd query this specifically
    
    if (type === 'sales') {
      (doc as any).autoTable({
        startY: startY + 35,
        head: [['Produto', 'Qtd. Vendida', 'Receita Estimada']],
        body: data.topProducts.map((p: any) => [
          p.name, 
          `${p.quantity} un.`,
          formatCurrency(p.revenue || 0)
        ]),
        headStyles: { fillStyle: 'fill', fillColor: [219, 39, 119] }
      });
    }
  } else if (type === 'orders' || type === 'canceled') {
    const orders = type === 'canceled' 
      ? (data.orders || []).filter((o: any) => o.status === 'canceled')
      : (data.orders || []);

    (doc as any).autoTable({
      startY: startY,
      head: [['Data/Hora', 'Cliente', 'Produtos', 'Pagamento', 'Total']],
      body: orders.map((o: any) => [
        format(new Date(o.created_at), 'dd/MM HH:mm'),
        o.customer_name,
        o.items_summary || 'N/A',
        o.payment_method || 'N/A',
        formatCurrency(o.total_amount)
      ]),
      headStyles: { fillStyle: 'fill', fillColor: [219, 39, 119] },
      columnStyles: { 2: { cellWidth: 60 } }
    });
  } else if (type === 'products') {
    (doc as any).autoTable({
      startY: startY,
      head: [['Produto', 'Qtd. Vendida', 'Total Vendido (Est.)']],
      body: data.topProducts.map((p: any) => [
        p.name, 
        `${p.quantity} un.`,
        formatCurrency(p.revenue || 0)
      ]),
      headStyles: { fillStyle: 'fill', fillColor: [219, 39, 119] }
    });
  } else if (type === 'customers') {
    (doc as any).autoTable({
      startY: startY,
      head: [['Nome', 'Telefone', 'Qtd. Pedidos', 'Total Gasto']],
      body: (data.customers || []).map((c: any) => [
        c.name, 
        c.phone, 
        c.total_orders,
        formatCurrency(c.total_spent)
      ]),
      headStyles: { fillStyle: 'fill', fillColor: [219, 39, 119] }
    });
  }


  // Save
  doc.save(`${title.replace(/\s+/g, '_')}_${format(now, 'yyyyMMdd')}.pdf`);
};

