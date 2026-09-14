import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";
import { DEFAULT_STORE_ID } from "./delivery.functions";
import type { Tables } from "@/integrations/supabase/types";

type ReportItem = Pick<Tables<"order_items">, "quantity" | "product_id" | "price_at_time"> & {
  products: { name: string } | null;
};

export type ReportOrder = Pick<
  Tables<"orders">,
  | "id"
  | "status"
  | "total_amount"
  | "delivery_fee"
  | "payment_method"
  | "created_at"
  | "customer_phone"
  | "customer_name"
> & {
  order_items: ReportItem[];
};

export type FinancialPayment = {
  method: string;
  count: number;
  amount: number;
};

export type FinancialTransaction = {
  id: string;
  created_at: string | null;
  customer_name: string;
  customer_phone: string;
  payment_method: string;
  delivery_fee: number;
  total_amount: number;
  status: string;
};

export type FinancialSummary = {
  revenue: number;
  orderCount: number;
  averageTicket: number;
  canceledCount: number;
  paymentBreakdown: FinancialPayment[];
  transactions: FinancialTransaction[];
};

type ReportCustomer = {
  name: string;
  phone: string;
  total_orders: number;
  total_spent: number;
};

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
    .from("orders")
    .select(
      `
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
    `,
    )
    .eq("store_id", storeId);

  if (startDate) {
    query = query.gte("created_at", startDate);
  }
  if (endDate) {
    query = query.lte("created_at", endDate);
  }

  const { data: orders, error } = await query;
  if (error) throw error;

  const stats = {
    totalRevenue: 0,
    totalOrders: 0,
    completedOrders: 0,
    canceledOrders: 0,
    productsSold: {} as Record<string, { name: string; quantity: number; revenue: number }>,
    dailySales: {} as Record<string, number>,
  };
  const paymentMap = new Map<string, FinancialPayment>();
  const financialTransactions: FinancialTransaction[] = [];
  const reportOrders = (orders || []) as ReportOrder[];

  reportOrders.forEach((order) => {
    stats.totalOrders++;

    const isCancelled = order.status === "canceled";
    const isRevenueOrder = !isCancelled;

    if (isRevenueOrder) {
      const amount = Number(order.total_amount || 0);
      const method = order.payment_method?.trim() || "Não informado";
      const currentPayment = paymentMap.get(method) || { method, count: 0, amount: 0 };
      currentPayment.count++;
      currentPayment.amount += amount;
      paymentMap.set(method, currentPayment);
      stats.totalRevenue += amount;
      stats.completedOrders++;
      financialTransactions.push({
        id: order.id,
        created_at: order.created_at,
        customer_name: order.customer_name,
        customer_phone: order.customer_phone,
        payment_method: method,
        delivery_fee: Number(order.delivery_fee || 0),
        total_amount: amount,
        status: order.status,
      });
    } else {
      stats.canceledOrders++;
    }

    const day = new Date(order.created_at || new Date()).toLocaleDateString("pt-BR");
    if (isRevenueOrder) {
      stats.dailySales[day] = (stats.dailySales[day] || 0) + Number(order.total_amount);
    } else if (!stats.dailySales[day]) {
      stats.dailySales[day] = 0;
    }

    order.order_items.forEach((item) => {
      if (isRevenueOrder) {
        const productId = item.product_id;
        if (!productId) return;
        const productName = item.products?.name || "Produto Removido";
        if (!stats.productsSold[productId]) {
          stats.productsSold[productId] = { name: productName, quantity: 0, revenue: 0 };
        }
        stats.productsSold[productId].quantity += item.quantity;

        const itemPrice = Number(item.price_at_time || 0);
        stats.productsSold[productId].revenue += item.quantity * itemPrice;
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
  const ordersWithDetails = reportOrders.map((order) => ({
    ...order,
    items_summary: order.order_items
      .map((item) => `${item.quantity}x ${item.products?.name || "Produto Removido"}`)
      .join(", "),
  }));

  // Customers from orders in this period
  const customersMap = new Map<string, ReportCustomer>();
  reportOrders
    .filter((order) => order.status !== "canceled")
    .forEach((order) => {
      const phone = order.customer_phone;
      const existing = customersMap.get(phone);
      if (existing) {
        existing.total_orders++;
        existing.total_spent += Number(order.total_amount);
        return;
      }

      customersMap.set(phone, {
        name: order.customer_name,
        phone,
        total_orders: 1,
        total_spent: Number(order.total_amount),
      });
    });

  return {
    summary: {
      totalRevenue: stats.totalRevenue,
      totalOrders: stats.totalOrders,
      completedOrders: stats.completedOrders,
      canceledOrders: stats.canceledOrders,
    },
    topProducts,
    salesChart,
    orders: ordersWithDetails,
    customers: Array.from(customersMap.values()),
    financial: {
      revenue: stats.totalRevenue,
      orderCount: financialTransactions.length,
      averageTicket: financialTransactions.length
        ? stats.totalRevenue / financialTransactions.length
        : 0,
      canceledCount: stats.canceledOrders,
      paymentBreakdown: Array.from(paymentMap.values()).sort((a, b) => b.amount - a.amount),
      transactions: financialTransactions,
    } satisfies FinancialSummary,
  };
};
