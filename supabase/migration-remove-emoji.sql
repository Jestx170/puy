-- ============================================================
-- Migration Phase 2.3: ลบคอลัมน์ emoji ออกจากตาราง products
--
-- - อัปเดต view v_top_products ให้ใช้ image_url แทน emoji
-- - ลบคอลัมน์ emoji ออกจากตาราง products
--
-- รันใน Supabase Dashboard → SQL Editor (ครั้งเดียว)
-- ============================================================

-- 1) อัปเดต view v_top_products ให้เลือก image_url แทน emoji
create or replace view public.v_top_products as
select
  p.id, p.name, p.sku, p.category, p.brand, p.price, p.cost,
  p.stock, p.min_stock, p.unit, p.status, p.image_url,
  coalesce(sum(oi.qty), 0) as sold,
  coalesce(sum(oi.subtotal), 0) as revenue
from public.products p
left join public.order_items oi on oi.product_id = p.id
left join public.orders o on oi.order_id = o.id and o.status not in ('cancelled','refunded')
group by p.id, p.name, p.sku, p.category, p.brand, p.price, p.cost,
         p.stock, p.min_stock, p.unit, p.status, p.image_url
order by sold desc
limit 5;

-- 2) อัปเดต view v_expiring_products ให้ไม่มี emoji (ถ้ายังมี)
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

-- 3) ลบคอลัมน์ emoji ออกจากตาราง products
alter table public.products drop column if exists emoji;

-- ============================================================
-- ผลลัพธ์: ไม่มี emoji ในระบบแล้ว ใช้รูปภาพ (image_url) เป็นหลัก
-- ถ้าไม่มีรูป แอปจะแสดง icon Package แทน
-- ============================================================
