import { supabase } from "@/lib/supabase";
import type { Movement } from "@/types";

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
    stockBefore: r.stock_before,
    stockAfter: r.stock_after,
    reference: r.reference,
    note: r.note,
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

  /**
   * บันทึก stock movement แบบ atomic ผ่าน RPC `record_stock_movement`
   * - ป้องกัน negative stock (DB CHECK constraint + explicit check)
   * - บันทึก audit trail (stock_before/after)
   * - อัปเดต products.stock ใน transaction เดียวกัน
   * - trigger คำนวณ products.status อัตโนมัติ
   *
   * สำหรับ "จ่ายออก" qty จะถูกลบจาก stock
   * สำหรับ "รับเข้า"/"ปรับปรุง" qty จะถูกบวกเข้า stock
   */
  async create(m: {
    type: Movement["type"];
    productId: string;
    productName: string;
    qty: number;
    warehouse?: string;
    by: string;
    note?: string | undefined;
    reference?: string | undefined;
  }): Promise<Movement> {
    const { data, error } = await supabase.rpc("record_stock_movement", {
      p_product_id: m.productId,
      p_type: m.type,
      p_qty: Math.abs(m.qty),
      p_warehouse: m.warehouse ?? "คลังหลัก",
      p_by_user: m.by,
      p_note: m.note ?? null,
      p_reference: m.reference ?? null,
    });
    if (error) throw error;
    // RPC คืน row ของ stock_movements โดยตรง
    return rowToMovement(data as unknown as DbMovement);
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
  reference: string | null;
  stock_before: number | null;
  stock_after: number | null;
  status: string;
  date: string;
  created_at: string;
}
