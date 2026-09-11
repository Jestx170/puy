import { supabase } from "@/lib/supabase";
import type { Promotion, PromotionKind, PromotionStatus, PromotionScopeType } from "@/types";

interface DbPromotion {
  id: string;
  name: string;
  kind: PromotionKind;
  value: string;
  scope_type: PromotionScopeType;
  scope: string;
  start_date: string;
  end_date: string;
  used_count: number;
  budget: number;
  priority: number;
  status: PromotionStatus;
  note: string | null;
  created_at: string;
  updated_at: string;
}

function rowToPromotion(r: DbPromotion): Promotion {
  return {
    id: r.id,
    name: r.name,
    kind: r.kind,
    value: r.value,
    scope: r.scope,
    scopeType: r.scope_type,
    start: r.start_date,
    end: r.end_date,
    used: r.used_count,
    budget: r.budget,
    priority: r.priority,
    status: r.status,
    note: r.note ?? undefined,
  };
}

function promotionToRow(p: Partial<Promotion>): Partial<DbPromotion> {
  const row: Partial<DbPromotion> = {};
  if (p.name !== undefined) row.name = p.name;
  if (p.kind !== undefined) row.kind = p.kind;
  if (p.value !== undefined) row.value = p.value;
  if (p.scopeType !== undefined) row.scope_type = p.scopeType;
  if (p.scope !== undefined) row.scope = p.scope;
  if (p.start !== undefined) row.start_date = p.start;
  if (p.end !== undefined) row.end_date = p.end;
  if (p.budget !== undefined) row.budget = p.budget;
  if (p.priority !== undefined) row.priority = p.priority;
  if (p.status !== undefined) row.status = p.status;
  if (p.note !== undefined) row.note = p.note ?? null;
  return row;
}

export const promotionsApi = {
  async list(): Promise<Promotion[]> {
    const { data, error } = await supabase
      .from("promotions")
      .select("*")
      .order("priority", { ascending: true });
    if (error) throw new Error(error.message);
    return (data as DbPromotion[]).map(rowToPromotion);
  },

  /** ดึงเฉพาะโปรโมชันที่ active และอยู่ในช่วงเวลา — สำหรับ POS/ใบเสนอราคา */
  async listActive(): Promise<Promotion[]> {
    const today = new Date().toISOString().slice(0, 10);
    const { data, error } = await supabase
      .from("promotions")
      .select("*")
      .eq("status", "active")
      .lte("start_date", today)
      .gte("end_date", today)
      .order("priority", { ascending: true });
    if (error) throw new Error(error.message);
    return (data as DbPromotion[]).map(rowToPromotion);
  },

  async create(p: Omit<Promotion, "id" | "used">): Promise<Promotion> {
    const row = promotionToRow(p);
    const { data, error } = await supabase
      .from("promotions")
      .insert({ ...row, used_count: 0 })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return rowToPromotion(data as DbPromotion);
  },

  async update(id: string, p: Partial<Promotion>): Promise<Promotion> {
    const row = promotionToRow(p);
    const { data, error } = await supabase
      .from("promotions")
      .update(row)
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return rowToPromotion(data as DbPromotion);
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from("promotions").delete().eq("id", id);
    if (error) throw new Error(error.message);
  },

  /** เพิ่มจำนวนการใช้งาน +1 */
  async incrementUsed(id: string): Promise<void> {
    const { error } = await supabase.rpc("increment_promotion_used", { p_id: id });
    if (error) throw new Error(error.message);
  },
};

/**
 * คำนวณส่วนลดจากโปรโมชัน
 * - ส่วนลด: parse % จาก value (เช่น "-15%" → 15% ของ subtotal)
 * - คูปอง: parse ฿ จาก value (เช่น "฿200" → 200 บาท)
 * - แคมเปญ/ชุดสินค้า: คืน 0 (พนักงานกรอกเอง)
 */
export function calcDiscountAmount(promo: Promotion, subtotal: number): number {
  if (promo.kind === "ส่วนลด") {
    const m = promo.value.match(/-?(\d+(?:\.\d+)?)\s*%/);
    if (!m) return 0;
    const pct = Number(m[1]);
    return Math.round((subtotal * pct) / 100);
  }
  if (promo.kind === "คูปอง") {
    const m = promo.value.match(/฿?\s*([\d,]+)/);
    if (!m) return 0;
    return Number(m[1]!.replace(/,/g, ""));
  }
  return 0;
}
