import { localApi } from "@/lib/local-api";
import type { Product } from "@/types";
import { productsApi } from "./products";

export interface DashboardStats {
  todaySales: number;
  todayOrders: number;
  totalCustomers: number;
  lowStockCount: number;
  monthSales: number;
  pendingOrders: number;
  todayProfit: number;
  monthProfit: number;
  monthCogs: number;
}

export interface SalesByDay {
  day: string;
  sales: number;
  orders: number;
}

export interface RevenueTrend {
  month: string;
  revenue: number;
  target: number;
}

export interface ProfitByDay {
  day: string;
  revenue: number;
  cogs: number;
  profit: number;
}

export interface ProfitByMonth {
  month: string;
  revenue: number;
  cogs: number;
  profit: number;
}

export interface TopProduct extends Product {
  sold: number;
  revenue: number;
}

export interface BestCustomer {
  id: string;
  name: string;
  code: string;
  type: string;
  tier: string;
  lifetime: number;
  orders: number;
  lastOrder: string;
}

export const dashboardApi = {
  async stats(): Promise<DashboardStats> {
    const { data, error } = await localApi.from("v_dashboard_stats").select("*").limit(1).single();
    if (error) throw error;
    const r = data as DbDashboardStats;
    return {
      todaySales: Number(r.today_sales),
      todayOrders: r.today_orders,
      totalCustomers: r.total_customers,
      lowStockCount: r.low_stock_count,
      monthSales: Number(r.month_sales),
      pendingOrders: r.pending_orders,
      todayProfit: Number(r.today_profit ?? 0),
      monthProfit: Number(r.month_profit ?? 0),
      monthCogs: Number(r.month_cogs ?? 0),
    };
  },

  async profitByDay(): Promise<ProfitByDay[]> {
    const { data, error } = await localApi.from("v_profit_by_day").select("*");
    if (error) throw error;
    const dayMap: Record<string, string> = {
      Mon: "จ.",
      Tue: "อ.",
      Wed: "พ.",
      Thu: "พฤ.",
      Fri: "ศ.",
      Sat: "ส.",
      Sun: "อา.",
    };
    return (data as DbProfitByDay[]).map((r) => ({
      day: dayMap[r.day_short] ?? r.day_short,
      revenue: Number(r.revenue),
      cogs: Number(r.cogs),
      profit: Number(r.profit),
    }));
  },

  async profitByMonth(): Promise<ProfitByMonth[]> {
    const { data, error } = await localApi.from("v_profit_by_month").select("*");
    if (error) throw error;
    return (data as DbProfitByMonth[]).map((r) => ({
      month: r.month,
      revenue: Number(r.revenue),
      cogs: Number(r.cogs),
      profit: Number(r.profit),
    }));
  },

  async salesByDay(): Promise<SalesByDay[]> {
    const { data, error } = await localApi.from("v_sales_by_day").select("*");
    if (error) throw error;
    // แปลง day_short (Dy) เป็นชื่อวันภาษาไทย
    const dayMap: Record<string, string> = {
      Mon: "จ.",
      Tue: "อ.",
      Wed: "พ.",
      Thu: "พฤ.",
      Fri: "ศ.",
      Sat: "ส.",
      Sun: "อา.",
    };
    return (data as DbSalesByDay[]).map((r) => ({
      day: dayMap[r.day_short] ?? r.day_short,
      sales: Number(r.sales),
      orders: r.orders,
    }));
  },

  async revenueTrend(): Promise<RevenueTrend[]> {
    const { data, error } = await localApi.from("v_revenue_trend").select("*");
    if (error) throw error;
    return (data as DbRevenueTrend[]).map((r) => ({
      month: r.month,
      revenue: Number(r.revenue),
      target: Number(r.target),
    }));
  },

  async topProducts(): Promise<TopProduct[]> {
    const { data, error } = await localApi.from("v_top_products").select("*");
    if (error) throw error;
    return (data as DbTopProduct[]).map((r) => ({
      id: r.id,
      name: r.name,
      sku: r.sku,
      barcode: "",
      category: r.category,
      brand: r.brand,
      price: Number(r.price),
      cost: Number(r.cost),
      stock: r.stock,
      minStock: r.min_stock,
      unit: r.unit,
      status: r.status as Product["status"],
      imageUrl: r.image_url ?? undefined,
      sold: r.sold,
      revenue: Number(r.revenue),
    }));
  },

  async bestCustomers(): Promise<BestCustomer[]> {
    const { data, error } = await localApi.from("v_best_customers").select("*");
    if (error) throw error;
    return (data as DbBestCustomer[]).map((r) => ({
      id: r.id,
      name: r.name,
      code: r.code,
      type: r.type,
      tier: r.tier,
      lifetime: Number(r.lifetime),
      orders: r.orders,
      lastOrder: r.last_order ?? "",
    }));
  },

  async lowStockProducts(): Promise<Product[]> {
    const all = await productsApi.list();
    return all.filter((p) => p.status === "low" || p.status === "out");
  },
};

interface DbDashboardStats {
  today_sales: number;
  today_orders: number;
  total_customers: number;
  low_stock_count: number;
  month_sales: number;
  pending_orders: number;
  today_profit: number | null;
  month_profit: number | null;
  month_cogs: number | null;
}

interface DbProfitByDay {
  date: string;
  day_short: string;
  day_idx: number;
  revenue: number;
  cogs: number;
  profit: number;
}

interface DbProfitByMonth {
  month_key: string;
  month: string;
  revenue: number;
  cogs: number;
  profit: number;
}

interface DbSalesByDay {
  day_short: string;
  day_idx: string;
  sales: number;
  orders: number;
}

interface DbRevenueTrend {
  month_key: string;
  month: string;
  revenue: number;
  target: number;
}

interface DbTopProduct {
  id: string;
  name: string;
  sku: string;
  category: string;
  brand: string;
  price: number;
  cost: number;
  stock: number;
  min_stock: number;
  unit: string;
  status: string;
  image_url: string | null;
  sold: number;
  revenue: number;
}

interface DbBestCustomer {
  id: string;
  name: string;
  code: string;
  type: string;
  tier: string;
  lifetime: number;
  orders: number;
  last_order: string | null;
}
