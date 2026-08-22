import { supabase } from "@/lib/supabase";
import type { Order, OrderItem, OrderStatus } from "@/types";

function rowToOrder(r: DbOrder): Order {
  return {
    id: r.id,
    code: r.code,
    customer: r.customer_name,
    customerId: r.customer_id ?? "",
    date: r.date,
    total: Number(r.total),
    items: r.items,
    status: r.status as OrderStatus,
    channel: r.channel as Order["channel"],
    salesperson: r.salesperson,
    payment: r.payment as Order["payment"],
  };
}

function rowToOrderItem(r: DbOrderItem): OrderItem {
  return {
    id: r.id,
    orderId: r.order_id,
    productId: r.product_id,
    productName: r.product_name,
    qty: r.qty,
    price: Number(r.price),
    cost: Number(r.cost),
    subtotal: Number(r.subtotal),
  };
}

// รายการสินค้าในออเดอร์ (สำหรับ create แบบมี items)
export interface OrderLineInput {
  productId: string;
  productName: string;
  qty: number;
  price: number;
  cost: number;
}

export const ordersApi = {
  async list(filter?: {
    status?: string | undefined;
    channel?: string | undefined;
    limit?: number;
  }): Promise<Order[]> {
    let q = supabase.from("orders").select("*").order("date", { ascending: false });
    if (filter?.status && filter.status !== "all") q = q.eq("status", filter.status);
    if (filter?.channel && filter.channel !== "all") q = q.eq("channel", filter.channel);
    if (filter?.limit) q = q.limit(filter.limit);
    const { data, error } = await q;
    if (error) throw error;
    return (data as DbOrder[]).map(rowToOrder);
  },

  async get(id: string): Promise<Order> {
    const { data, error } = await supabase.from("orders").select("*").eq("id", id).single();
    if (error) throw error;
    return rowToOrder(data as DbOrder);
  },

  /** ดึงคำสั่งซื้อทั้งหมดของลูกค้าคนหนึ่ง */
  async listByCustomer(customerId: string): Promise<Order[]> {
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .eq("customer_id", customerId)
      .order("date", { ascending: false });
    if (error) throw error;
    return (data as DbOrder[]).map(rowToOrder);
  },

  /** ดึงรายการสินค้าในคำสั่งซื้อ */
  async getItems(orderId: string): Promise<OrderItem[]> {
    const { data, error } = await supabase
      .from("order_items")
      .select("*")
      .eq("order_id", orderId)
      .order("id");
    if (error) throw error;
    return (data as DbOrderItem[]).map(rowToOrderItem);
  },

  async create(o: {
    code: string;
    customerId: string;
    customerName: string;
    total: number;
    items: number;
    status: OrderStatus;
    channel: Order["channel"];
    salesperson: string;
    payment: Order["payment"];
  }): Promise<Order> {
    const { data, error } = await supabase
      .from("orders")
      .insert({
        id: `o-${Date.now()}`,
        code: o.code,
        customer_id: o.customerId,
        customer_name: o.customerName,
        total: o.total,
        items: o.items,
        status: o.status,
        channel: o.channel,
        salesperson: o.salesperson,
        payment: o.payment,
      })
      .select()
      .single();
    if (error) throw error;
    return rowToOrder(data as DbOrder);
  },

  /**
   * สร้างคำสั่งขายแบบ atomic ผ่าน RPC `create_sale_transaction`
   * ทำทุกอย่างใน transaction เดียว:
   * - สร้าง order + order_items
   * - ลด stock + สร้าง stock_movements (พร้อม audit trail)
   * - อัปเดตยอดสะสมลูกค้า
   * - บันทึก activity
   * มี idempotency protection — ถ้าส่ง order_id ซ้ำจะคืน order เดิม (ไม่สร้างซ้ำ)
   */
  async createSaleTransaction(o: {
    id: string;
    code: string;
    customerId: string;
    customerName: string;
    total: number;
    status?: OrderStatus;
    channel?: Order["channel"];
    salesperson?: string;
    payment?: Order["payment"];
    items: OrderLineInput[];
  }): Promise<Order> {
    const itemsJson = o.items.map((l) => ({
      productId: l.productId,
      productName: l.productName,
      qty: l.qty,
      price: l.price,
      cost: l.cost,
    }));
    const { data, error } = await supabase.rpc("create_sale_transaction", {
      p_order_id: o.id,
      p_code: o.code,
      p_customer_id: o.customerId,
      p_customer_name: o.customerName,
      p_total: o.total,
      p_status: o.status ?? "paid",
      p_channel: o.channel ?? "POS",
      p_salesperson: o.salesperson ?? "admin",
      p_payment: o.payment ?? "เงินสด",
      p_items: itemsJson,
    });
    if (error) throw error;
    return rowToOrder(data as DbOrder);
  },

  async updateStatus(id: string, status: OrderStatus): Promise<Order> {
    const { data, error } = await supabase
      .from("orders")
      .update({ status })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return rowToOrder(data as DbOrder);
  },
};

interface DbOrder {
  id: string;
  code: string;
  customer_id: string | null;
  customer_name: string;
  date: string;
  total: number;
  items: number;
  status: string;
  channel: string;
  salesperson: string;
  payment: string;
  created_at: string;
}

interface DbOrderItem {
  id: string;
  order_id: string;
  product_id: string;
  product_name: string;
  qty: number;
  price: number;
  cost: number;
  subtotal: number;
}
