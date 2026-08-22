-- ============================================================
-- Migration Phase 2.1: Auto-sync warehouses aggregate from products
--
-- ทุกครั้งที่มีการ insert/update/delete ในตาราง products
-- trigger จะคำนวณ items (จำนวนสินค้ารวม) และ value (มูลค่าสต็อกรวม)
-- อัปเดตลงในแถว "คลังหลัก" ของตาราง warehouses อัตโนมัติ
--
-- รันใน Supabase Dashboard → SQL Editor (ครั้งเดียว)
-- ============================================================

-- 1) สร้าง function สำหรับคำนวณและอัปเดต warehouse "คลังหลัก"
create or replace function public.recalc_warehouse_main()
returns void
language plpgsql
as $$
begin
  insert into public.warehouses (id, name, items, value, capacity)
  values (
    'wh1',
    'คลังหลัก',
    coalesce((select sum(stock) from public.products where deleted_at is null), 0),
    coalesce((select sum(stock * cost) from public.products where deleted_at is null), 0),
    -- capacity = จำนวนสินค้าที่มี stock > 0 / จำนวนสินค้าทั้งหมด * 100 (เปอร์เซ็นต์การใช้งาน)
    case
      when (select count(*) from public.products where deleted_at is null) = 0 then 0
      else round(
        (select count(*) from public.products where deleted_at is null and stock > 0)::numeric
        / (select count(*) from public.products where deleted_at is null)::numeric
        * 100
      )
    end
  )
  on conflict (name) do update
  set
    items = excluded.items,
    value = excluded.value,
    capacity = excluded.capacity;
end;
$$;

-- 2) สร้าง trigger หลัง insert/update/delete บน products
drop trigger if exists trg_products_sync_warehouse on public.products;

create trigger trg_products_sync_warehouse
  after insert or update or delete on public.products
  for each statement execute function public.recalc_warehouse_main();

-- 3) รันครั้งแรกเพื่ออัปเดตข้อมูลปัจจุบัน
select public.recalc_warehouse_main();

-- ============================================================
-- ผลลัพธ์: ตาราง warehouses จะอัปเดตอัตโนมัติทุกครั้งที่:
-- - เพิ่มสินค้าใหม่ → items และ value เพิ่มขึ้น
-- - แก้ไข stock/cost → items และ value อัปเดต
-- - ลบสินค้า → items และ value ลดลง
-- - soft delete (deleted_at) → ไม่นับสินค้าที่ถูก soft delete
-- ============================================================
