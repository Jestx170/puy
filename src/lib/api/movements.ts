import { supabase } from "@/lib/supabase";
import type { Movement } from "@/data/mock";

function rowToMovement(r: DbMovement): Movement {
  return {
    id: r.id,
    code: r.code,
    type: r.type as Movement["type"],
    product: r.product_name,
    qty: r.qty,
    warehouse: r.warehouse,
    by: r.by_user,
    date: r.date,
    status: r.status as Movement["status"],
  };
}

export const movementsApi = {
  async list(filter?: {
    type?: string | undefined;
    status?: string | undefined;
  }): Promise<Movement[]> {
    let q = supabase.from("stock_movements").select("*").order("created_at", { ascending: false });
    if (filter?.type && filter.type !== "all") q = q.eq("type", filter.type);
    if (filter?.status && filter.status !== "all") q = q.eq("status", filter.status);
    const { data, error } = await q;
    if (error) throw error;
    return (data as DbMovement[]).map(rowToMovement);
  },

  async create(m: {
    code: string;
    type: Movement["type"];
    productId: string;
    productName: string;
    qty: number;
    warehouse: string;
    by: string;
    note?: string | undefined;
  }): Promise<Movement> {
    const { data, error } = await supabase
      .from("stock_movements")
      .insert({
        code: m.code,
        type: m.type,
        product_id: m.productId,
        product_name: m.productName,
        qty: m.qty,
        warehouse: m.warehouse,
        by_user: m.by,
        note: m.note,
        status: "completed",
      })
      .select()
      .single();
    if (error) throw error;
    return rowToMovement(data as DbMovement);
  },
};

interface DbMovement {
  id: string;
  code: string;
  type: string;
  product_id: string | null;
  product_name: string;
  qty: number;
  warehouse: string;
  by_user: string;
  note: string | null;
  status: string;
  date: string;
  created_at: string;
}
