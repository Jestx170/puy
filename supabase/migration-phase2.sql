-- ============================================================
-- Fieldstone ERP — Migration Phase 2
-- รันใน Supabase Dashboard → SQL Editor (หลังจากรัน schema.sql แล้ว)
-- เพิ่ม: image_url, stock audit trail, CHECK constraint, RPC transactions
-- ============================================================

-- ============================================================
-- 1) products: เพิ่ม image_url + soft delete + CHECK stock >= 0
-- ============================================================
alter table public.products add column if not exists image_url text;
alter table public.products add column if not exists deleted_at timestamptz;

-- กัน stock ติดลบ (negative stock prevention ระดับ DB)
-- ใช้ DO block เพื่อ drop constraint เดิมก่อน (ถ้ามี) แล้วสร้างใหม่
do $$
begin
  if exists (
    select 1 from information_schema.table_constraints
    where table_name = 'products' and constraint_name = 'products_stock_nonneg'
  ) then
    alter table public.products drop constraint products_stock_nonneg;
  end if;
end $$;

alter table public.products add constraint products_stock_nonneg check (stock >= 0);

-- ============================================================
-- 2) stock_movements: เพิ่ม stock_before, stock_after, reference
--    สำหรับ audit trail ที่สมบูรณ์
-- ============================================================
alter table public.stock_movements add column if not exists stock_before integer;
alter table public.stock_movements add column if not exists stock_after integer;
alter table public.stock_movements add column if not exists reference text;

create index if not exists idx_movements_reference on public.stock_movements(reference);

-- ============================================================
-- 3) order_items: เพิ่ม unique constraint กัน duplicate (order_id, product_id)
--    ไม่บังคับ — ออเดอร์หนึ่งอาจมีสินค้าเดียวกันหลายบรรทัดได้
--    แต่เพิ่ม index เพื่อ query performance
-- ============================================================
create index if not exists idx_order_items_order_product on public.order_items(order_id, product_id);

-- ============================================================
-- 4) RPC: record_stock_movement
--    บันทึก stock movement + อัปเดต stock แบบ atomic
--    ป้องกัน negative stock ด้วย CHECK constraint + explicit check
--    คืน row ของ movement ที่สร้าง (พร้อม stock_before/after)
-- ============================================================
create or replace function public.record_stock_movement(
  p_product_id text,
  p_type text,
  p_qty integer,
  p_warehouse text default 'คลังหลัก',
  p_by_user text default 'admin',
  p_note text default null,
  p_reference text default null
)
returns public.stock_movements
language plpgsql
security definer
as $$
declare
  v_product public.products;
  v_movement public.stock_movements;
  v_code text;
  v_new_stock integer;
  v_signed_qty integer;
begin
  -- ล็อค row ของสินค้าเพื่อกัน race condition
  select * into v_product
  from public.products
  where id = p_product_id
  for update;

  if not found then
    raise exception 'สินค้าไม่พบ (id=%)', p_product_id;
  end if;

  -- กำหนดเครื่องหมาย qty: จ่ายออก = ลบ, อื่น ๆ = บวก
  v_signed_qty := case when p_type = 'จ่ายออก' then -abs(p_qty) else abs(p_qty) end;

  v_new_stock := v_product.stock + v_signed_qty;

  -- ป้องกัน stock ติดลบ
  if v_new_stock < 0 then
    raise exception 'สต็อกไม่พอ — สินค้า % คงเหลือ % ไม่สามารถ % จำนวน %',
      v_product.name, v_product.stock, p_type, abs(p_qty);
  end if;

  -- สร้างรหัส movement
  v_code := case p_type
    when 'รับเข้า' then 'IN-' || to_char(now(), 'YYYYMMDDHH24MISS')
    when 'จ่ายออก' then 'OUT-' || to_char(now(), 'YYYYMMDDHH24MISS')
    when 'ปรับปรุง' then 'ADJ-' || to_char(now(), 'YYYYMMDDHH24MISS')
    else 'MV-' || to_char(now(), 'YYYYMMDDHH24MISS')
  end;

  -- อัปเดต stock (trigger จะคำนวณ status อัตโนมัติ)
  update public.products
  set stock = v_new_stock
  where id = p_product_id;

  -- บันทึก movement พร้อม audit trail
  insert into public.stock_movements
    (code, type, product_id, product_name, qty, warehouse, by_user, note, reference,
     stock_before, stock_after, status)
  values
    (v_code, p_type, p_product_id, v_product.name, v_signed_qty, p_warehouse,
     p_by_user, p_note, p_reference, v_product.stock, v_new_stock, 'completed')
  returning * into v_movement;

  return v_movement;
end;
$$;

-- ============================================================
-- 5) RPC: create_sale_transaction
--    สร้าง order + order_items + ลด stock + stock_movements + อัปเดตลูกค้า
--    ทุกอย่างใน transaction เดียว — atomic (all or nothing)
--    ป้องกัน: partial order, negative stock, double deduction
-- ============================================================
create or replace function public.create_sale_transaction(
  p_order_id text,
  p_code text,
  p_customer_id text,
  p_customer_name text,
  p_total numeric,
  p_status text default 'paid',
  p_channel text default 'POS',
  p_salesperson text default 'admin',
  p_payment text default 'เงินสด',
  p_items jsonb default null
)
returns public.orders
language plpgsql
security definer
as $$
declare
  v_order public.orders;
  v_item jsonb;
  v_product public.products;
  v_line_total numeric;
  v_items_count integer := 0;
  v_movement public.stock_movements;
begin
  -- ตรวจสอบว่า order นี้ยังไม่มีอยู่ (idempotency protection)
  select * into v_order from public.orders where id = p_order_id;
  if found then
    -- ถ้ามีอยู่แล้ว คืน order เดิม (idempotent — ไม่สร้างซ้ำ)
    return v_order;
  end if;

  -- สร้าง order
  insert into public.orders
    (id, code, customer_id, customer_name, total, items, status, channel, salesperson, payment)
  values
    (p_order_id, p_code, p_customer_id, p_customer_name, p_total,
     jsonb_array_length(p_items), p_status, p_channel, p_salesperson, p_payment)
  returning * into v_order;

  -- วนลูปสร้าง order_items + ลด stock + สร้าง movement
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_items_count := v_items_count + 1;

    -- ล็อค product row
    select * into v_product
    from public.products
    where id = v_item->>'productId'
    for update;

    if not found then
      raise exception 'สินค้าไม่พบ (id=%)', v_item->>'productId';
    end if;

    -- ตรวจสอบสต็อกเพียงพอ
    if v_product.stock < (v_item->>'qty')::integer then
      raise exception 'สต็อก % ไม่พอ (คงเหลือ % ต้องการ %)',
        v_product.name, v_product.stock, (v_item->>'qty')::integer;
    end if;

    v_line_total := (v_item->>'price')::numeric * (v_item->>'qty')::integer;

    -- สร้าง order_item (เก็บ price + cost ณ เวลาขาย)
    insert into public.order_items
      (order_id, product_id, product_name, qty, price, cost, subtotal)
    values
      (p_order_id, v_item->>'productId', v_item->>'productName',
       (v_item->>'qty')::integer, (v_item->>'price')::numeric,
       (v_item->>'cost')::numeric, v_line_total);

    -- ลด stock + สร้าง movement (atomic ภายใน transaction เดียว)
    update public.products
    set stock = stock - (v_item->>'qty')::integer
    where id = v_item->>'productId';

    insert into public.stock_movements
      (code, type, product_id, product_name, qty, warehouse, by_user,
       note, reference, stock_before, stock_after, status)
    values
      ('OUT-' || p_code, 'จ่ายออก', v_item->>'productId', v_item->>'productName',
       -(v_item->>'qty')::integer, 'คลังหลัก', p_salesperson,
       'ขาย POS ' || p_code, p_code,
       v_product.stock, v_product.stock - (v_item->>'qty')::integer, 'completed');
  end loop;

  -- อัปเดตยอดสะสมลูกค้า
  if p_customer_id is not null and p_customer_id <> '' then
    update public.customers
    set
      lifetime = lifetime + p_total,
      orders = orders + 1,
      last_order = current_date
    where id = p_customer_id;
  end if;

  -- บันทึก activity
  insert into public.activities (actor, action, target, kind)
  values (p_salesperson,
          'ขายหน้าร้าน ' || p_code || ' มูลค่า ' || p_total::text,
          p_customer_name, 'order');

  return v_order;
end;
$$;

-- ============================================================
-- 6) RPC: delete_product_safe
--    ลบสินค้าแบบปลอดภัย — ถ้าเคยขาย (มี order_items) ให้ soft delete
--    ถ้าไม่เคยขาย ให้ hard delete ได้
--    คืน 'soft' หรือ 'hard'
-- ============================================================
create or replace function public.delete_product_safe(p_product_id text)
returns text
language plpgsql
security definer
as $$
declare
  v_has_orders integer;
begin
  select count(*) into v_has_orders
  from public.order_items
  where product_id = p_product_id;

  if v_has_orders > 0 then
    -- soft delete: ตั้ง deleted_at + เปลี่ยน status
    update public.products
    set deleted_at = now(), status = 'discontinued'
    where id = p_product_id;
    return 'soft';
  else
    -- hard delete ได้เพราะไม่มี historical reference
    delete from public.products where id = p_product_id;
    return 'hard';
  end if;
end;
$$;

-- ============================================================
-- เสร็จแล้ว — migration เสร็จสมบูรณ์
-- ============================================================
