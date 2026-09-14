-- ============================================================
-- Clear mock/demo data — เก็บเฉพาะ config (คลัง, หมวดหมู่, ระยะพืช, ตั้งค่าร้าน)
-- รันใน Supabase Dashboard → SQL Editor
-- ============================================================

-- ลบข้อมูลธุรกิจ (mock) ตามลำดับ dependency
delete from public.notifications;
delete from public.activities;
delete from public.order_items;
delete from public.orders;
delete from public.cultivation_schedules;
delete from public.cultivations;
delete from public.customers;
delete from public.stock_movements;
delete from public.stage_products;
delete from public.promotions;

-- ลบสินค้า mock (เก็บไว้ถ้าผู้ใช้เพิ่มเองแล้ว — ลบเฉพาะ seed ID)
delete from public.products where id in (
  'p1','p2','p3','p4','p5','p6','p7','p8','p9','p10','p11','p12','p13','p14','p15','p16',
  'lp01','lp02','lp03','lp04','lp05','lp06','lp07','lp08','lp09','lp10',
  'lp11','lp12','lp13','lp14','lp15','lp16','lp17','lp18','lp19','lp20'
);

-- รีเซ็ต warehouse aggregate เป็น 0
update public.warehouses
  set items = 0, value = 0, capacity = 0
  where id = 'wh1';

-- รีเซ็ต auto-increment sequences (ถ้ามี)
alter sequence if exists public.notifications_id_seq restart with 1;
alter sequence if exists public.activities_id_seq restart with 1;
alter sequence if exists public.promotions_id_seq restart with 1;

-- ยืนยันข้อมูลที่เหลือ
select 'products' as table_name, count(*) as remaining from public.products
union all select 'customers', count(*) from public.customers
union all select 'orders', count(*) from public.orders
union all select 'stock_movements', count(*) from public.stock_movements
union all select 'cultivations', count(*) from public.cultivations
union all select 'categories', count(*) from public.categories
union all select 'crop_stages', count(*) from public.crop_stages
union all select 'warehouses', count(*) from public.warehouses
union all select 'store_settings', count(*) from public.store_settings;
