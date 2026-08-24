-- ============================================================
-- Fieldstone ERP — Storage bucket setup: product-images
-- แก้ปัญหา "อัปโหลดรูปภาพสินค้าไม่ได้" (400 จาก supabase.storage upload)
-- สาเหตุที่พบบ่อยที่สุด: bucket "product-images" ยังไม่ถูกสร้าง หรือสร้างแล้ว
-- แต่ไม่มี RLS policy อนุญาต anon insert/update/delete บน storage.objects
-- รันครั้งเดียวใน Supabase Dashboard → SQL Editor (รันซ้ำได้ ใช้ on conflict)
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images',
  'product-images',
  true,
  5242880, -- 5MB ตรงกับ handleFileChange ใน products.index.tsx
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- อนุญาตทุกอย่างสำหรับ anon บน bucket นี้เท่านั้น (single-user app, ไม่มี role — ตาม pattern เดียวกับตารางอื่น)
drop policy if exists "anon all product-images" on storage.objects;

create policy "anon all product-images" on storage.objects for all
  using (bucket_id = 'product-images')
  with check (bucket_id = 'product-images');
