import { supabase } from "@/lib/supabase";
import type { Order, OrderStatus } from "@/data/mock";

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

  // สร้างออเดอร์พร้อม line items แล้ว insert ลง order_items ด้วย
  // ใช้สำหรับ POS checkout ที่ต้องบันทึกยอดขาย + รายการสินค้า (มี cost เพื่อคำนวณกำไร)
  async createWithItems(
    o: {
      id?: string;
      code: string;
      customerId: string;
      customerName: string;
      total: number;
      status: OrderStatus;
      channel: Order["channel"];
      salesperson: string;
      payment: Order["payment"];
    },
    lines: OrderLineInput[],
  ): Promise<Order> {
    const orderId = o.id ?? `o-${Date.now()}`;
    const { data, error } = await supabase
      .from("orders")
      .insert({
        id: orderId,
        code: o.code,
        customer_id: o.customerId,
        customer_name: o.customerName,
        total: o.total,
        items: lines.length,
        status: o.status,
        channel: o.channel,
        salesperson: o.salesperson,
        payment: o.payment,
      })
      .select()
      .single();
    if (error) throw error;

    // insert order_items
    const rows = lines.map((l) => ({
      order_id: orderId,
      product_id: l.productId,
      product_name: l.productName,
      qty: l.qty,
      price: l.price,
      cost: l.cost,
      subtotal: l.price * l.qty,
    }));
    const { error: e2 } = await supabase.from("order_items").insert(rows);
    if (e2) throw e2;

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
