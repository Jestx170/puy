import { useQuery, useQueryClient } from "@tanstack/react-query";
import { categoriesApi } from "@/lib/api/categories";
import { productCategories } from "@/lib/constants";

/**
 * ดึงหมวดหมู่สินค้าจาก DB
 * - ถ้า DB พร้อม → ใช้รายการจาก DB (ผู้ใช้สร้างเองได้)
 * - ถ้า DB ยังไม่พร้อม (error/empty) → fallback ไป constants
 */
export function useCategories() {
  const qc = useQueryClient();
  const { data: categories = [...productCategories] } = useQuery({
    queryKey: ["categories"],
    queryFn: () => categoriesApi.list(),
    // ไม่ throw ถ้า DB ไม่พร้อม — ใช้ fallback
    retry: false,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["categories"] });

  return { categories, invalidate };
}
