// ============================================================
// Fieldstone ERP — Supabase Storage helpers
// อัปโหลด/ลบ/ดึง URL รูปสินค้าใน bucket "product-images"
// ============================================================

import { supabase } from "@/lib/supabase";

const BUCKET = "product-images";

/**
 * อัปโหลดรูปสินค้าไปยัง Supabase Storage
 * - ชื่อไฟล์ใช้ productId + timestamp เพื่อกันชน
 * - ถ้ามีรูปเดิมจะลบก่อน (ถ้าส่ง oldPath มา)
 * คืนค่า public URL ของรูปใหม่
 */
export async function uploadProductImage(
  productId: string,
  file: File,
  oldPath?: string,
): Promise<string> {
  // ลบรูปเดิมถ้ามี
  if (oldPath) {
    await supabase.storage
      .from(BUCKET)
      .remove([oldPath])
      .catch(() => {});
  }

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const path = `${productId}-${Date.now()}.${ext}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (error) throw error;

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

/**
 * ลบรูปสินค้าออกจาก Storage
 */
export async function deleteProductImage(path: string): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) throw error;
}

/**
 * แยก path ออกจาก public URL
 * เช่น "https://xxx.supabase.co/storage/v1/object/public/product-images/p1-123.jpg"
 * → "p1-123.jpg"
 */
export function urlToPath(url: string): string {
  const parts = url.split(`/public/${BUCKET}/`);
  return parts[1] ?? url;
}
