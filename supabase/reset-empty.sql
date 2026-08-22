-- ============================================================
-- Fieldstone ERP — ล้างข้อมูลทั้งหมด เพื่อเตรียมส่งให้ลูกค้าใช้งานจริง
-- รันใน Supabase Dashboard → SQL Editor
--
-- ผลลัพธ์: ฐานข้อมูลว่างเปล่าทุกตาราง พร้อมใช้งานจริง
-- โครงสร้างตาราง, views, functions, triggers, RLS policies ยังอยู่ครบ
-- ============================================================

-- ลบข้อมูลตามลำดับ dependency (ลูกก่อน แม่ทีหลัง)
-- ใช้ TRUNCATE ... CASCADE เพื่อล้างพร้อม reset serial/identity

begin;

-- 1. ตารางลูก (มี foreign key อ้างถึงตารางอื่น)
truncate table public.order_items restart identity cascade;
truncate table public.stock_movements restart identity cascade;
truncate table public.cultivations restart identity cascade;
truncate table public.activities restart identity cascade;
truncate table public.notifications restart identity cascade;

-- 2. ตารางแม่
truncate table public.orders restart identity cascade;
truncate table public.customers restart identity cascade;
truncate table public.products restart identity cascade;
truncate table public.warehouses restart identity cascade;

-- 3. ล้างไฟล์ใน storage bucket 'product-images' (ถ้ามี)
--    ไม่สามารถลบผ่าน SQL ได้ (Supabase ป้องกัน direct delete จาก storage.objects)
--    ให้ลบผ่าน Dashboard: Storage → product-images → เลือกไฟล์ทั้งหมด → Delete
--    หรือถ้ายังไม่มีไฟล์ ข้ามขั้นตอนนี้ได้เลย

commit;

-- ============================================================
-- ตรวจสอบผลลัพธ์ — ทุกตารางควรมี 0 แถว
-- ============================================================
select 'warehouses' as "table", count(*) as rows from public.warehouses
union all
select 'products', count(*) from public.products
union all
select 'stock_movements', count(*) from public.stock_movements
union all
select 'customers', count(*) from public.customers
union all
select 'cultivations', count(*) from public.cultivations
union all
select 'orders', count(*) from public.orders
union all
select 'order_items', count(*) from public.order_items
union all
select 'activities', count(*) from public.activities
union all
select 'notifications', count(*) from public.notifications
order by "table";

-- ผลลัพธ์ที่คาดหวัง: ทุกตาราง = 0 rows
