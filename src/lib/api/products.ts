import { supabase } from "@/lib/supabase";
import type { Product, ProductStatus } from "@/types";

// แปลง row จาก Supabase (snake_case) เป็น Product (camelCase)
function rowToProduct(r: DbProduct): Product {
  return {
    id: r.id,
    name: r.name,
    sku: r.sku,
    barcode: r.barcode ?? "",
    category: r.category,
    brand: r.brand,
    price: Number(r.price),
    cost: Number(r.cost),
    stock: r.stock,
    minStock: r.min_stock,
    unit: r.unit,
    status: r.status as ProductStatus,
    emoji: r.emoji,
    imageUrl: r.image_url ?? undefined,
    expiryDate: r.expiry_date ?? undefined,
    deletedAt: r.deleted_at ?? undefined,
  };
}

// แปลง Product เป็น row สำหรับ insert/update
function productToRow(p: Partial<Product>): Partial<DbProduct> {
  const row: Partial<DbProduct> = {};
  if (p.id !== undefined) row.id = p.id;
  if (p.name !== undefined) row.name = p.name;
  if (p.sku !== undefined) row.sku = p.sku;
  if (p.barcode !== undefined) row.barcode = p.barcode;
  if (p.category !== undefined) row.category = p.category;
  if (p.brand !== undefined) row.brand = p.brand;
  if (p.price !== undefined) row.price = p.price;
  if (p.cost !== undefined) row.cost = p.cost;
  if (p.stock !== undefined) row.stock = p.stock;
  if (p.minStock !== undefined) row.min_stock = p.minStock;
  if (p.unit !== undefined) row.unit = p.unit;
  if (p.emoji !== undefined) row.emoji = p.emoji;
  if (p.imageUrl !== undefined) row.image_url = p.imageUrl;
  if (p.expiryDate !== undefined) row.expiry_date = p.expiryDate || null;
  // status คำนวณอัตโนมัติใน DB trigger ไม่ต้องส่ง
  return row;
}

export const productsApi = {
  async list(): Promise<Product[]> {
    // กรองสินค้าที่ถูก soft delete ออก
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .is("deleted_at", null)
      .order("name");
    if (error) throw error;
    return (data as DbProduct[]).map(rowToProduct);
  },

  async get(id: string): Promise<Product> {
    const { data, error } = await supabase.from("products").select("*").eq("id", id).single();
    if (error) throw error;
    return rowToProduct(data as DbProduct);
  },

  async create(p: Product): Promise<Product> {
    const { data, error } = await supabase
      .from("products")
      .insert(productToRow(p))
      .select()
      .single();
    if (error) throw error;
    return rowToProduct(data as DbProduct);
  },

  async update(id: string, patch: Partial<Product>): Promise<Product> {
    const { data, error } = await supabase
      .from("products")
      .update(productToRow(patch))
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return rowToProduct(data as DbProduct);
  },

  /**
   * ลบสินค้าแบบปลอดภัยผ่าน RPC `delete_product_safe`
   * - ถ้าเคยขาย (มี order_items) → soft delete (ตั้ง deleted_at)
   * - ถ้าไม่เคยขาย → hard delete
   * คืนค่า 'soft' หรือ 'hard'
   */
  async remove(id: string): Promise<"soft" | "hard"> {
    const { data, error } = await supabase.rpc("delete_product_safe", { p_product_id: id });
    if (error) throw error;
    return data as "soft" | "hard";
  },

  /**
   * ปรับสต็อกแบบ atomic ผ่าน RPC `record_stock_movement`
   * - ป้องกัน negative stock (DB CHECK constraint)
   * - บันทึก audit trail (stock_before/after)
   * - สร้าง stock_movement ใน transaction เดียวกัน
   * คืนค่า Product ที่อัปเดตแล้ว
   */
  async adjustStock(
    id: string,
    delta: number,
    opts?: {
      type?: "รับเข้า" | "จ่ายออก" | "ปรับปรุง";
      by?: string;
      note?: string;
      reference?: string;
    },
  ): Promise<Product> {
    const type = opts?.type ?? (delta >= 0 ? "รับเข้า" : "จ่ายออก");
    const { error } = await supabase.rpc("record_stock_movement", {
      p_product_id: id,
      p_type: type,
      p_qty: Math.abs(delta),
      p_by_user: opts?.by ?? "admin",
      p_note: opts?.note ?? null,
      p_reference: opts?.reference ?? null,
    });
    if (error) throw error;
    return this.get(id);
  },

  /**
   * ดึงสินค้าที่ใกล้หมดอายุ (ภายใน 30 วัน) หรือหมดอายุแล้ว
   * คืนค่าเรียงตามวันหมดอายุใกล้สุดก่อน
   */
  async expiring(): Promise<ExpiringProduct[]> {
    const { data, error } = await supabase
      .from("v_expiring_products")
      .select("*")
      .order("expiry_date", { ascending: true });
    if (error) throw error;
    return (data as DbExpiringProduct[]).map((r) => ({
      id: r.id,
      name: r.name,
      sku: r.sku,
      barcode: r.barcode ?? "",
      category: r.category,
      brand: r.brand,
      stock: r.stock,
      unit: r.unit,
      emoji: r.emoji,
      expiryDate: r.expiry_date,
      expiryStatus: r.expiry_status as "expired" | "critical" | "warning",
      daysUntilExpiry: Number(r.days_until_expiry),
    }));
  },
};

// Type ตรงกับ schema ใน DB (snake_case)
interface DbProduct {
  id: string;
  name: string;
  sku: string;
  barcode: string | null;
  category: string;
  brand: string;
  price: number;
  cost: number;
  stock: number;
  min_stock: number;
  unit: string;
  status: string;
  emoji: string;
  image_url: string | null;
  expiry_date: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

/** สินค้าที่ใกล้หมดอายุ */
export interface ExpiringProduct {
  id: string;
  name: string;
  sku: string;
  barcode: string;
  category: string;
  brand: string;
  stock: number;
  unit: string;
  emoji: string;
  expiryDate: string;
  expiryStatus: "expired" | "critical" | "warning";
  daysUntilExpiry: number;
}

interface DbExpiringProduct {
  id: string;
  name: string;
  sku: string;
  barcode: string | null;
  category: string;
  brand: string;
  stock: number;
  unit: string;
  emoji: string;
  expiry_date: string;
  expiry_status: string;
  days_until_expiry: number;
}
