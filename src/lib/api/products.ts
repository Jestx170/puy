import { supabase } from "@/lib/supabase";
import type { Product, ProductStatus } from "@/data/mock";

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
  // status คำนวณอัตโนมัติใน DB trigger ไม่ต้องส่ง
  return row;
}

export const productsApi = {
  async list(): Promise<Product[]> {
    const { data, error } = await supabase.from("products").select("*").order("name");
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

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) throw error;
  },

  async adjustStock(id: string, delta: number): Promise<Product> {
    // ดึง stock ปัจจุบัน + บวก delta + ให้ trigger คำนวณ status
    const { data: cur, error: e1 } = await supabase
      .from("products")
      .select("stock")
      .eq("id", id)
      .single();
    if (e1) throw e1;
    const newStock = (cur as DbProduct).stock + delta;
    return this.update(id, { stock: newStock });
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
  created_at: string;
  updated_at: string;
}
