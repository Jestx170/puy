import { supabase } from "@/lib/supabase";
import { productCategories } from "@/lib/constants";

export interface Category {
  id: string;
  name: string;
  sortOrder: number;
}

export const categoriesApi = {
  async list(): Promise<string[]> {
    const { data, error } = await supabase
      .from("categories")
      .select("*")
      .order("sort_order", { ascending: true });
    // ถ้าตารางไม่มีหรือ DB ไม่พร้อม → fallback ไป constants (ไม่ throw)
    if (error) return [...productCategories];
    const names = (data as { name: string }[]).map((r) => r.name);
    return names.length > 0 ? names : [...productCategories];
  },

  async create(name: string): Promise<string> {
    const { data, error } = await supabase
      .from("categories")
      .insert({ name: name.trim() })
      .select("name")
      .single();
    if (error) throw error;
    return (data as { name: string }).name;
  },

  async remove(name: string): Promise<void> {
    const { error } = await supabase.from("categories").delete().eq("name", name);
    if (error) throw error;
  },
};
