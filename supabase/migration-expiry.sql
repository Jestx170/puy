-- ============================================================
-- Migration Phase 2.2: เพิ่มฟิลด์วันหมดอายุสินค้า (expiry_date)
--
-- - เพิ่มคอลัมน์ expiry_date ในตาราง products
-- - สร้าง view v_expiring_products สำหรับดึงสินค้าใกล้หมดอายุ
-- - เพิ่ม notification อัตโนมัติเมื่อสินค้าใกล้หมดอายุ (ผ่าน function)
--
-- รันใน Supabase Dashboard → SQL Editor (ครั้งเดียว)
-- ============================================================

-- 1) เพิ่มคอลัมน์ expiry_date
alter table public.products
  add column if not exists expiry_date date;

-- 2) View: สินค้าใกล้หมดอายุ (ภายใน 30 วัน) หรือหมดอายุแล้ว
create or replace view public.v_expiring_products as
select
  id,
  name,
  sku,
  barcode,
  category,
  brand,
  stock,
  unit,
  image_url,
  expiry_date,
  case
    when expiry_date < current_date then 'expired'
    when expiry_date <= current_date + interval '7 days' then 'critical'
    when expiry_date <= current_date + interval '30 days' then 'warning'
    else 'ok'
  end as expiry_status,
  expiry_date - current_date as days_until_expiry
from public.products
where
  deleted_at is null
  and expiry_date is not null
  and expiry_date <= current_date + interval '30 days'
order by expiry_date asc;

-- 3) Function: สร้าง notification เตือนสินค้าใกล้หมดอายุ
--    เรียกได้จาก cron หรือรันเองเป็นครั้งคราว
create or replace function public.notify_expiring_products()
returns void
language plpgsql
as $$
declare
  exp_count integer;
  expired_count integer;
begin
  select count(*) into exp_count
  from public.products
  where deleted_at is null
    and expiry_date is not null
    and expiry_date > current_date
    and expiry_date <= current_date + interval '30 days';

  select count(*) into expired_count
  from public.products
  where deleted_at is null
    and expiry_date is not null
    and expiry_date < current_date;

  if exp_count > 0 then
    insert into public.notifications (title, description, unread, link, created_at)
    values (
      'สินค้าใกล้หมดอายุ ' || exp_count || ' รายการ',
      'ตรวจสอบสินค้าที่จะหมดอายุภายใน 30 วัน',
      true,
      '/inventory',
      now()
    )
    on conflict do nothing;
  end if;

  if expired_count > 0 then
    insert into public.notifications (title, description, unread, link, created_at)
    values (
      'สินค้าหมดอายุแล้ว ' || expired_count || ' รายการ',
      'สินค้าหมดอายุแล้ว ควรเอาออกจากการขาย',
      true,
      '/inventory',
      now()
    )
    on conflict do nothing;
  end if;
end;
$$;

-- 4) รันครั้งแรกเพื่อสร้าง notification ถ้ามีสินค้าใกล้หมดอายุ
--    (ตอนนี้ยังไม่มีข้อมูล จะไม่ทำอะไร แต่พร้อมใช้งานเมื่อเพิ่มสินค้า)
-- select public.notify_expiring_products();

-- ============================================================
-- ผลลัพธ์:
-- - สินค้าสามารถกำหนดวันหมดอายุได้ (expiry_date)
-- - View v_expiring_products ดึงสินค้าใกล้หมดอายุ 30 วัน
-- - Function notify_expiring_products() สร้าง notification อัตโนมัติ
--   สามารถตั้ง cron รันทุกวัน เช่น:
--   select cron.schedule('notify-expiry', '0 8 * * *', 'select public.notify_expiring_products()');
-- ============================================================
