import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";
import { DEFAULT_STORE_ID } from "./delivery.functions";

const reportInput = z.object({
  storeId: z.string().uuid().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

// Convertido para SPA. O RLS do banco garante que só admins/funcionários
// autorizados leiam pedidos; a checagem view_reports foi removida.

export const getSalesReport = async (input: z.input<typeof reportInput>) => {
  const { startDate, endDate, storeId: rawStoreId } = reportInput.parse(input);
  const storeId = rawStoreId || DEFAULT_STORE_ID;

  let query = supabase
    .from('orders')
    .select(`
      *,
      order_items (
        quantity,
        product_id,
        price_at_time,
        products (
          name,
          categories (name)
        )
      )
    `)
    .eq('store_id', storeId);


  if (startDate) {
    query = query.gte('created_at', startDate);
  }
  if (endDate) {
    query = query.lte('created_at', endDate);
  }

  const { data: orders, error } = await query;
  if (error) throw error;

  const stats = {
    totalRevenue: 0,
    totalOrders: 0,
    completedOrders: 0,
    canceledOrders: 0,
    productsSold: {} as Record<string, { name: string, quantity: number, revenue: number }>,
    dailySales: {} as Record<string, number>
  };

  orders?.forEach(order => {
    stats.totalOrders++;

    const isDelivered = order.status === 'delivered';
    const isCancelled = order.status === 'canceled';

    if (isDelivered) {
      stats.totalRevenue += Number(order.total_amount);
      stats.completedOrders++;
    } else if (isCancelled) {
      stats.canceledOrders++;
    }

    // Daily breakdown - only for delivered orders
    const day = new Date(order.created_at || new Date()).toLocaleDateString('pt-BR');
    if (isDelivered) {
      stats.dailySales[day] = (stats.dailySales[day] || 0) + Number(order.total_amount);
    } else if (!stats.dailySales[day]) {
      stats.dailySales[day] = 0;
    }

    // Product stats - only for delivered orders
    (order.order_items as any[])?.forEach((item: any) => {
      if (isDelivered) {
        const productId = item.product_id;
        const productName = item.products?.name || 'Produto Removido';
        if (!stats.productsSold[productId]) {
          stats.productsSold[productId] = { name: productName, quantity: 0, revenue: 0 };
        }
        stats.productsSold[productId].quantity += item.quantity;

        const itemPrice = Number(item.price_at_time || 0);
        stats.productsSold[productId].revenue += (item.quantity * itemPrice);
      }
    });
  });

  const topProducts = Object.values(stats.productsSold)
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 5);

  const salesChart = Object.entries(stats.dailySales)
    .map(([date, value]) => ({ date, value }))
    .slice(-30); // Last 30 points

  // Group orders for reports
  const ordersWithDetails = orders?.map(order => ({
    ...order,
    items_summary: (order.order_items as any[])?.map(i => `${i.quantity}x ${i.products?.name}`).join(', ')
  })) || [];

  // Customers from orders in this period
  const customersMap = new Map();
  orders?.forEach(order => {
    const phone = order.customer_phone;
    if (!customersMap.has(phone)) {
      customersMap.set(phone, {
        name: order.customer_name,
        phone: order.customer_phone,
        total_orders: 1,
        total_spent: Number(order.total_amount)
      });
    } else {
      const c = customersMap.get(phone);
      c.total_orders++;
      c.total_spent += Number(order.total_amount);
    }
  });

  return {
    summary: {
      totalRevenue: stats.totalRevenue,
      totalOrders: stats.totalOrders,
      completedOrders: stats.completedOrders,
      canceledOrders: stats.canceledOrders
    },
    topProducts,
    salesChart,
    orders: ordersWithDetails,
    customers: Array.from(customersMap.values())
  };
};
