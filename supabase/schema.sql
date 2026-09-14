-- ============================================================
-- Fieldstone ERP — ปุ๋ยไทย CRM
-- Supabase schema (รวมทุกตาราง + views + RPCs + triggers + RLS + seed)
-- รันใน Supabase Dashboard → SQL Editor (รันครั้งเดียว, รันซ้ำได้)
-- ============================================================

-- Extensions
create extension if not exists "pgcrypto";

-- ============================================================
-- 1) products — สินค้าเกษตร
-- ============================================================
create table if not exists public.products (
  id           text primary key,
  name         text not null,
  sku          text not null unique,
  barcode      text,
  category     text not null,
  brand        text not null default 'ไม่ระบุ',
  price        numeric(12,2) not null default 0,
  cost         numeric(12,2) not null default 0,
  stock        integer not null default 0,
  min_stock    integer not null default 0,
  unit         text not null default 'ชิ้น',
  status       text not null default 'active'
               check (status in ('active','low','out','discontinued')),
  image_url    text,
  deleted_at   timestamptz,
  expiry_date  date,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint products_stock_nonneg check (stock >= 0)
);

-- รันซ้ำได้: เพิ่มคอลัมน์ใหม่ถ้าตารางเดิมยังไม่มี
alter table public.products add column if not exists image_url text;
alter table public.products add column if not exists deleted_at timestamptz;
alter table public.products add column if not exists expiry_date date;

create index if not exists idx_products_category on public.products(category);
create index if not exists idx_products_status on public.products(status);
create index if not exists idx_products_deleted on public.products(deleted_at);

-- ============================================================
-- 2) warehouses — คลังสินค้า
-- ============================================================
create table if not exists public.warehouses (
  id        text primary key,
  name      text not null unique,
  items     integer not null default 0,
  value     numeric(14,2) not null default 0,
  capacity  integer not null default 0
);

-- ============================================================
-- 2b) categories — หมวดหมู่สินค้า (ผู้ใช้สร้างเองได้)
-- ============================================================
create table if not exists public.categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists idx_categories_sort on public.categories(sort_order);

-- ============================================================
-- 3) stock_movements — ประวัติการเคลื่อนไหวสต็อก
-- ============================================================
create table if not exists public.stock_movements (
  id            uuid primary key default gen_random_uuid(),
  code          text not null,
  type          text not null check (type in ('รับเข้า','จ่ายออก','ปรับปรุง','โอนย้าย')),
  product_id    text references public.products(id) on delete set null,
  product_name  text not null,
  qty           integer not null,
  unit_cost     numeric(12,2),
  expiry_date   date,
  warehouse     text not null,
  by_user       text not null default 'admin',
  note          text,
  status        text not null default 'completed'
                check (status in ('completed','pending','draft')),
  stock_before  integer,
  stock_after   integer,
  reference     text,
  created_at    timestamptz not null default now(),
  date          date not null default current_date
);

-- รันซ้ำได้: เพิ่มคอลัมน์ใหม่ถ้าตารางเดิมยังไม่มี (create table if not exists ไม่เพิ่มคอลัมน์)
alter table public.stock_movements add column if not exists unit_cost numeric(12,2);
alter table public.stock_movements add column if not exists expiry_date date;

create index if not exists idx_movements_type on public.stock_movements(type);
create index if not exists idx_movements_product on public.stock_movements(product_id);
create index if not exists idx_movements_date on public.stock_movements(date desc);
create index if not exists idx_movements_reference on public.stock_movements(reference);

-- ============================================================
-- 4) customers — ลูกค้า
-- ============================================================
create table if not exists public.customers (
  id          text primary key,
  name        text not null,
  code        text not null unique,
  phone       text not null default '',
  email       text not null default '',
  address     text not null default '',
  type        text not null default 'เกษตรกร'
              check (type in ('เกษตรกร','ร้านค้าปลีก','สหกรณ์','องค์กร')),
  tier        text not null default 'Bronze'
              check (tier in ('Bronze','Silver','Gold','Platinum')),
  lifetime    numeric(14,2) not null default 0,
  orders      integer not null default 0,
  last_order  date,
  since       date,
  notes       text not null default '',
  tags        text[] not null default '{}',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ============================================================
-- 5) cultivations — แปลงเพาะปลูก (ลำไย 12 ระยะ)
-- ============================================================
create table if not exists public.cultivations (
  id               text primary key,
  customer_id      text not null references public.customers(id) on delete cascade,
  crop             text not null default 'ลำไย',
  stage            text not null default 'เตรียมต้นหลังเก็บเกี่ยว'
                   check (stage in (
                     'เตรียมต้นหลังเก็บเกี่ยว',
                     'แตกใบอ่อน ใบแรก',
                     'แตกใบอ่อน ใบสอง',
                     'ราดสาร',
                     'เปิดตาดอก',
                     'ยืดช่อดอก',
                     'บำรุงช่อดอก',
                     'ดอกบาน',
                     'ลูกเล็ก',
                     'ลูกมะเขือพวง',
                     'ลูกแก้ว',
                     'ก่อนเก็บ'
                   )),
  area             numeric(8,2) not null default 0,
  planted_date     date,
  expected_harvest date,
  location         text not null default '',
  note             text,
  stage_id         text references public.crop_stages(id),
  current_sequence integer default 0,
  created_at       timestamptz not null default now()
);

create index if not exists idx_cultivations_customer on public.cultivations(customer_id);

-- ============================================================
-- 6) orders — คำสั่งขาย
-- ============================================================
create table if not exists public.orders (
  id            text primary key,
  code          text not null unique,
  customer_id   text references public.customers(id) on delete set null,
  customer_name text not null,
  order_date    timestamptz not null default now(),
  date          date not null default current_date,
  total         numeric(14,2) not null default 0,
  items         integer not null default 0,
  status        text not null default 'pending'
                check (status in ('paid','pending','processing','cancelled','refunded')),
  channel       text not null default 'POS'
                check (channel in ('POS','Online','Sales Rep')),
  salesperson   text not null default 'admin',
  payment       text not null default 'เงินสด'
                check (payment in ('เงินสด','โอนเงิน','บัตรเครดิต','QR PromptPay','เครดิต 30 วัน')),
  created_at    timestamptz not null default now()
);

create index if not exists idx_orders_customer on public.orders(customer_id);
create index if not exists idx_orders_date on public.orders(date desc);
create index if not exists idx_orders_status on public.orders(status);

-- ============================================================
-- 7) order_items — รายการสินค้าในคำสั่งขาย
-- ============================================================
create table if not exists public.order_items (
  id           uuid primary key default gen_random_uuid(),
  order_id     text not null references public.orders(id) on delete cascade,
  product_id   text references public.products(id) on delete set null,
  product_name text not null,
  qty          integer not null default 1,
  price        numeric(12,2) not null default 0,
  cost         numeric(12,2) not null default 0,
  subtotal     numeric(14,2) not null default 0
);

create index if not exists idx_order_items_order on public.order_items(order_id);
create index if not exists idx_order_items_product on public.order_items(product_id);
create index if not exists idx_order_items_order_product on public.order_items(order_id, product_id);

-- ============================================================
-- 8) activities — ไทม์ไลน์กิจกรรม
-- ============================================================
create table if not exists public.activities (
  id          uuid primary key default gen_random_uuid(),
  actor       text not null,
  action      text not null,
  target      text not null default '',
  kind        text not null default 'system'
              check (kind in ('order','customer','stock','payment','system')),
  created_at  timestamptz not null default now()
);

create index if not exists idx_activities_created on public.activities(created_at desc);

-- ============================================================
-- 9) notifications — การแจ้งเตือน
-- ============================================================
create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  description text not null default '',
  unread      boolean not null default true,
  link        text,
  created_at  timestamptz not null default now()
);

create index if not exists idx_notifications_created on public.notifications(created_at desc);

-- ============================================================
-- 10) crop_stages — ระยะการเจริญเติบโต 12 ระยะ (ลำไย)
-- ============================================================
create table if not exists public.crop_stages (
  id             text primary key,
  name           text not null,
  emoji          text not null default '🌱',
  description    text,
  days_min       integer,
  days_max       integer,
  frequency_days integer,
  sort_order     integer not null,
  crop_type      text not null default 'ลำไย',
  created_at     timestamptz not null default now()
);

create index if not exists idx_crop_stages_type on public.crop_stages(crop_type, sort_order);

-- ============================================================
-- 11) stage_products — สินค้าที่ใช้ในแต่ละระยะ
-- ============================================================
create table if not exists public.stage_products (
  id          uuid primary key default gen_random_uuid(),
  stage_id    text not null references public.crop_stages(id) on delete cascade,
  product_id  text references public.products(id) on delete cascade,
  formula     text,
  sequence    integer not null default 1,
  is_optional boolean not null default false,
  created_at   timestamptz not null default now()
);

create index if not exists idx_stage_products_stage on public.stage_products(stage_id, sequence);

-- ============================================================
-- 12) cultivation_schedules — ประวัติการดูแลจริง
-- ============================================================
create table if not exists public.cultivation_schedules (
  id             uuid primary key default gen_random_uuid(),
  cultivation_id text not null references public.cultivations(id) on delete cascade,
  stage_id       text not null references public.crop_stages(id),
  product_id     text references public.products(id) on delete set null,
  action_date    date,
  sequence       integer not null default 1,
  notes          text,
  created_at     timestamptz not null default now()
);

create index if not exists idx_schedules_cultivation
  on public.cultivation_schedules(cultivation_id, action_date desc nulls last);
create index if not exists idx_schedules_stage
  on public.cultivation_schedules(stage_id);
create unique index if not exists uq_schedules_cultivation_stage_sequence
  on public.cultivation_schedules(cultivation_id, stage_id, sequence);

-- ============================================================
-- 13) care_program_rounds — ครั้งดูแลของแต่ละระยะ
-- ============================================================
create table if not exists public.care_program_rounds (
  id            uuid primary key default gen_random_uuid(),
  stage_id      text not null references public.crop_stages(id) on delete cascade,
  sequence      integer not null,
  method        text,
  spacing_note  text,
  created_at    timestamptz not null default now(),
  unique (stage_id, sequence)
);

create index if not exists idx_care_rounds_stage
  on public.care_program_rounds(stage_id, sequence);

-- ============================================================
-- 14) care_program_groups — กลุ่มสูตรของแต่ละครั้ง
-- ============================================================
create table if not exists public.care_program_groups (
  id           uuid primary key default gen_random_uuid(),
  round_id     uuid not null references public.care_program_rounds(id) on delete cascade,
  group_key    text not null,
  label        text not null,
  alternatives boolean not null default false,
  created_at   timestamptz not null default now(),
  unique (round_id, group_key)
);

create index if not exists idx_care_groups_round
  on public.care_program_groups(round_id);

-- ============================================================
-- 15) care_program_options — ตัวเลือกสูตรในแต่ละกลุ่ม
-- ============================================================
create table if not exists public.care_program_options (
  id          uuid primary key default gen_random_uuid(),
  group_id    uuid not null references public.care_program_groups(id) on delete cascade,
  sku         text not null,
  label       text not null,
  product_id  text references public.products(id) on delete set null,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  unique (group_id, sku)
);

create index if not exists idx_care_options_group
  on public.care_program_options(group_id, sort_order);

-- ============================================================
-- 16) store_settings — ข้อมูลร้าน (single row, id = 1)
-- ============================================================
create table if not exists public.store_settings (
  id            integer primary key default 1,
  store_name    text not null default 'ปุ๋ยไทย CRM',
  store_address text,
  store_phone   text,
  tax_id        text,
  footer_text   text,
  updated_at    timestamptz not null default now(),
  constraint store_settings_single_row check (id = 1)
);

-- ============================================================
-- 17) promotions — โปรโมชัน/ส่วนลด/คูปอง/แคมเปญ/ชุดสินค้า
-- ============================================================
create table if not exists public.promotions (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  kind        text not null check (kind in ('ส่วนลด','คูปอง','แคมเปญ','ชุดสินค้า')),
  value       text not null,
  scope_type  text not null default 'all' check (scope_type in ('category','product','customer','all')),
  scope       text not null default 'ทั้งหมด',
  start_date  date not null,
  end_date    date not null,
  used_count  integer not null default 0,
  budget      integer not null default 100,
  priority    integer not null default 5,
  status      text not null default 'active' check (status in ('active','scheduled','ended','paused')),
  note        text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_promotions_status on public.promotions(status, priority);
create index if not exists idx_promotions_dates on public.promotions(start_date, end_date);

-- ============================================================
-- Functions: triggers
-- ============================================================

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.calc_product_status()
returns trigger language plpgsql as $$
begin
  new.status := case
    when new.stock = 0 then 'out'
    when new.stock < new.min_stock then 'low'
    else 'active'
  end;
  return new;
end;
$$;

-- drop ฟังก์ชันเดิมก่อน เพื่อเปลี่ยน return type (void → trigger)
-- ใช้ cascade เพราะ trigger trg_products_sync_warehouse อ้างอิงฟังก์ชันนี้อยู่
drop function if exists public.recalc_warehouse_main() cascade;
create or replace function public.recalc_warehouse_main()
returns trigger language plpgsql as $$
begin
  insert into public.warehouses (id, name, items, value, capacity)
  values (
    'wh1',
    'คลังหลัก',
    coalesce((select sum(stock) from public.products where deleted_at is null), 0),
    coalesce((select sum(stock * cost) from public.products where deleted_at is null), 0),
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
  return null;
end;
$$;

-- ============================================================
-- Triggers
-- ============================================================

drop trigger if exists trg_products_updated on public.products;
create trigger trg_products_updated
  before update on public.products
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_products_status on public.products;
create trigger trg_products_status
  before insert or update of stock, min_stock on public.products
  for each row execute function public.calc_product_status();

drop trigger if exists trg_products_sync_warehouse on public.products;
create trigger trg_products_sync_warehouse
  after insert or update or delete on public.products
  for each statement execute function public.recalc_warehouse_main();

drop trigger if exists trg_customers_updated on public.customers;
create trigger trg_customers_updated
  before update on public.customers
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_promotions_updated_at on public.promotions;
create trigger trg_promotions_updated_at
  before update on public.promotions
  for each row execute function public.touch_updated_at();

-- ============================================================
-- RPCs
-- ============================================================

-- record_stock_movement: บันทึก stock movement + อัปเดต stock แบบ atomic
-- p_unit_cost: ต้นทุนต่อหน่วยของสินค้าที่รับเข้า (ใช้คำนวณ weighted average cost)
--   - รับเข้า: คำนวณ cost เฉลี่ยใหม่ = (stock_old * cost_old + qty * p_unit_cost) / (stock_old + qty)
--   - จ่ายออก/ปรับปรุง: ไม่เปลี่ยน cost (ใช้ cost ปัจจุบัน)
-- p_expiry_date: วันหมดอายุของล็อตที่รับเข้า (FEFO — First Expired First Out)
--   - รับเข้า: อัปเดต products.expiry_date เป็นวันที่ใกล้สุดจาก stock คงเหลือทั้งหมด
-- drop ฟังก์ชันเดิมก่อน เพื่อเปลี่ยน signature (create or replace ไม่สามารถเปลี่ยน params ได้)
drop function if exists public.record_stock_movement(text, text, integer, text, text, text, text);
create or replace function public.record_stock_movement(
  p_product_id text,
  p_type text,
  p_qty integer,
  p_warehouse text default 'คลังหลัก',
  p_by_user text default 'admin',
  p_note text default null,
  p_reference text default null,
  p_unit_cost numeric default null,
  p_expiry_date date default null
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
  v_new_cost numeric;
  v_min_expiry date;
begin
  select * into v_product
  from public.products
  where id = p_product_id
  for update;

  if not found then
    raise exception 'สินค้าไม่พบ (id=%)', p_product_id;
  end if;

  v_signed_qty := case when p_type = 'จ่ายออก' then -abs(p_qty) else abs(p_qty) end;
  v_new_stock := v_product.stock + v_signed_qty;

  if v_new_stock < 0 then
    raise exception 'สต็อกไม่พอ — สินค้า % คงเหลือ % ไม่สามารถ % จำนวน %',
      v_product.name, v_product.stock, p_type, abs(p_qty);
  end if;

  v_code := case p_type
    when 'รับเข้า' then 'IN-' || to_char(now(), 'YYYYMMDDHH24MISS')
    when 'จ่ายออก' then 'OUT-' || to_char(now(), 'YYYYMMDDHH24MISS')
    when 'ปรับปรุง' then 'ADJ-' || to_char(now(), 'YYYYMMDDHH24MISS')
    else 'MV-' || to_char(now(), 'YYYYMMDDHH24MISS')
  end;

  -- คำนวณ weighted average cost เฉพาะตอนรับเข้าและมี p_unit_cost
  if p_type = 'รับเข้า' and p_unit_cost is not null and p_unit_cost >= 0 then
    if v_product.stock > 0 then
      v_new_cost := round(
        (v_product.stock * v_product.cost + abs(v_signed_qty) * p_unit_cost)
        / (v_product.stock + abs(v_signed_qty)),
        2
      );
    else
      v_new_cost := p_unit_cost;
    end if;

    -- หาวันหมดอายุใกล้สุดจาก stock คงเหลือ (FEFO)
    -- ถ้ารับเข้าใหม่และมี expiry_date ใหม่ ให้เทียบกับ expiry_date เดิมของ product
    if p_expiry_date is not null then
      select min(expiry_date) into v_min_expiry
      from public.stock_movements
      where product_id = p_product_id
        and type = 'รับเข้า'
        and expiry_date is not null
        and stock_after > 0
        and id <> (select max(id) from public.stock_movements where product_id = p_product_id and type = 'รับเข้า');

      -- เทียบระหว่าง v_min_expiry (ล็อตเดิม) กับ p_expiry_date (ล็อตใหม่)
      v_min_expiry := least(
        coalesce(v_min_expiry, p_expiry_date),
        p_expiry_date
      );
    end if;

    update public.products
    set stock = v_new_stock,
        cost = v_new_cost,
        expiry_date = coalesce(v_min_expiry, v_product.expiry_date)
    where id = p_product_id;
  else
    update public.products
    set stock = v_new_stock
    where id = p_product_id;
  end if;

  insert into public.stock_movements
    (code, type, product_id, product_name, qty, unit_cost, expiry_date, warehouse, by_user, note, reference,
     stock_before, stock_after, status)
  values
    (v_code, p_type, p_product_id, v_product.name, v_signed_qty, p_unit_cost, p_expiry_date, p_warehouse,
     p_by_user, p_note, p_reference, v_product.stock, v_new_stock, 'completed')
  returning * into v_movement;

  return v_movement;
end;
$$;

-- create_sale_transaction: POS checkout แบบ atomic (order + items + stock + customer + activity)
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
begin
  select * into v_order from public.orders where id = p_order_id;
  if found then
    return v_order;
  end if;

  insert into public.orders
    (id, code, customer_id, customer_name, total, items, status, channel, salesperson, payment)
  values
    (p_order_id, p_code, p_customer_id, p_customer_name, p_total,
     jsonb_array_length(p_items), p_status, p_channel, p_salesperson, p_payment)
  returning * into v_order;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_items_count := v_items_count + 1;

    select * into v_product
    from public.products
    where id = v_item->>'productId'
    for update;

    if not found then
      raise exception 'สินค้าไม่พบ (id=%)', v_item->>'productId';
    end if;

    if v_product.stock < (v_item->>'qty')::integer then
      raise exception 'สต็อก % ไม่พอ (คงเหลือ % ต้องการ %)',
        v_product.name, v_product.stock, (v_item->>'qty')::integer;
    end if;

    v_line_total := (v_item->>'price')::numeric * (v_item->>'qty')::integer;

    insert into public.order_items
      (order_id, product_id, product_name, qty, price, cost, subtotal)
    values
      (p_order_id, v_item->>'productId', v_item->>'productName',
       (v_item->>'qty')::integer, (v_item->>'price')::numeric,
       (v_item->>'cost')::numeric, v_line_total);

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

  if p_customer_id is not null and p_customer_id <> '' then
    update public.customers
    set
      lifetime = lifetime + p_total,
      orders = orders + 1,
      last_order = current_date
    where id = p_customer_id;
  end if;

  insert into public.activities (actor, action, target, kind)
  values (p_salesperson,
          'ขายหน้าร้าน ' || p_code || ' มูลค่า ' || p_total::text,
          p_customer_name, 'order');

  return v_order;
end;
$$;

-- delete_product_safe: soft delete ถ้ามีประวัติขาย, hard delete ถ้าไม่มี
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
    update public.products
    set deleted_at = now(), status = 'discontinued'
    where id = p_product_id;
    return 'soft';
  else
    delete from public.products where id = p_product_id;
    return 'hard';
  end if;
end;
$$;

-- increment_promotion_used: เพิ่มจำนวนการใช้งาน +1
create or replace function public.increment_promotion_used(p_id uuid)
returns void language plpgsql security definer as $$
begin
  update public.promotions
  set used_count = used_count + 1
  where id = p_id;
end;
$$;

-- record_care_atomic: บันทึกการดูแลแบบ atomic + กัน duplicate
create or replace function public.record_care_atomic(
  p_cultivation_id text,
  p_stage_id       text,
  p_sequence       integer,
  p_action_date    date default null,
  p_product_id     text default null,
  p_notes          text default null
) returns uuid
language plpgsql
security definer
as $$
declare
  v_id uuid;
  v_exists uuid;
begin
  select id into v_exists
    from public.cultivation_schedules
    where cultivation_id = p_cultivation_id
      and stage_id = p_stage_id
      and sequence = p_sequence
    limit 1;

  if v_exists is not null then
    raise exception 'DUPLICATE_CARE_RECORD: บันทึกการดูแลนี้มีอยู่แล้ว (cultivation=%, stage=%, sequence=%)',
      p_cultivation_id, p_stage_id, p_sequence
      using errcode = 'unique_violation';
  end if;

  insert into public.cultivation_schedules
    (cultivation_id, stage_id, sequence, action_date, product_id, notes)
  values
    (p_cultivation_id, p_stage_id, p_sequence, p_action_date, p_product_id, p_notes)
  returning id into v_id;

  update public.cultivations
    set current_sequence = greatest(current_sequence, p_sequence)
    where id = p_cultivation_id;

  return v_id;
end;
$$;

-- notify_expiring_products: สร้าง notification เตือนสินค้าใกล้หมดอายุ
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

-- ============================================================
-- Row Level Security (anon all — single-user app)
-- ============================================================

alter table public.products              enable row level security;
alter table public.warehouses            enable row level security;
alter table public.stock_movements       enable row level security;
alter table public.customers             enable row level security;
alter table public.cultivations          enable row level security;
alter table public.orders                enable row level security;
alter table public.order_items           enable row level security;
alter table public.activities            enable row level security;
alter table public.notifications          enable row level security;
alter table public.crop_stages           enable row level security;
alter table public.stage_products        enable row level security;
alter table public.cultivation_schedules enable row level security;
alter table public.care_program_rounds   enable row level security;
alter table public.care_program_groups   enable row level security;
alter table public.care_program_options  enable row level security;
alter table public.store_settings        enable row level security;
alter table public.promotions             enable row level security;
alter table public.categories             enable row level security;

drop policy if exists "anon all products"              on public.products;
drop policy if exists "anon all warehouses"            on public.warehouses;
drop policy if exists "anon all movements"            on public.stock_movements;
drop policy if exists "anon all customers"             on public.customers;
drop policy if exists "anon all cultivations"          on public.cultivations;
drop policy if exists "anon all orders"                on public.orders;
drop policy if exists "anon all order_items"           on public.order_items;
drop policy if exists "anon all activities"            on public.activities;
drop policy if exists "anon all notifications"         on public.notifications;
drop policy if exists "anon all crop_stages"           on public.crop_stages;
drop policy if exists "anon all stage_products"        on public.stage_products;
drop policy if exists "anon all cultivation_schedules" on public.cultivation_schedules;
drop policy if exists "anon all care_program_rounds"  on public.care_program_rounds;
drop policy if exists "anon all care_program_groups"  on public.care_program_groups;
drop policy if exists "anon all care_program_options" on public.care_program_options;
drop policy if exists "anon all store_settings"       on public.store_settings;
drop policy if exists "anon all promotions"            on public.promotions;
drop policy if exists "anon all categories"            on public.categories;

create policy "anon all products"              on public.products              for all using (true) with check (true);
create policy "anon all warehouses"            on public.warehouses            for all using (true) with check (true);
create policy "anon all movements"            on public.stock_movements       for all using (true) with check (true);
create policy "anon all customers"             on public.customers             for all using (true) with check (true);
create policy "anon all cultivations"          on public.cultivations          for all using (true) with check (true);
create policy "anon all orders"                on public.orders                for all using (true) with check (true);
create policy "anon all order_items"           on public.order_items           for all using (true) with check (true);
create policy "anon all activities"            on public.activities            for all using (true) with check (true);
create policy "anon all notifications"         on public.notifications          for all using (true) with check (true);
create policy "anon all crop_stages"           on public.crop_stages           for all using (true) with check (true);
create policy "anon all stage_products"        on public.stage_products        for all using (true) with check (true);
create policy "anon all cultivation_schedules" on public.cultivation_schedules for all using (true) with check (true);
create policy "anon all care_program_rounds"  on public.care_program_rounds   for all using (true) with check (true);
create policy "anon all care_program_groups"  on public.care_program_groups   for all using (true) with check (true);
create policy "anon all care_program_options" on public.care_program_options  for all using (true) with check (true);
create policy "anon all store_settings"       on public.store_settings        for all using (true) with check (true);
create policy "anon all promotions"            on public.promotions             for all using (true) with check (true);
create policy "anon all categories"            on public.categories             for all using (true) with check (true);

-- Storage bucket: product-images
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images',
  'product-images',
  true,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "anon all product-images" on storage.objects;
create policy "anon all product-images" on storage.objects for all
  using (bucket_id = 'product-images')
  with check (bucket_id = 'product-images');

-- ============================================================
-- Views
-- ============================================================

-- drop views ก่อนสร้างใหม่ เพื่อกัน error "cannot change name of view column"
-- (กรณีรันซ้ำบน DB ที่มี view เดิมที่มีคอลัมน์ต่างชื่อ เช่น emoji → image_url)
drop view if exists public.v_cultivation_next_round cascade;
drop view if exists public.v_expiring_products cascade;
drop view if exists public.v_profit_by_month cascade;
drop view if exists public.v_profit_by_day cascade;
drop view if exists public.v_dashboard_stats cascade;
drop view if exists public.v_best_customers cascade;
drop view if exists public.v_top_products cascade;
drop view if exists public.v_revenue_trend cascade;
drop view if exists public.v_sales_by_day cascade;
drop view if exists public.v_warehouse_summary cascade;

create or replace view public.v_warehouse_summary as
select
  w.id, w.name, w.capacity,
  count(distinct sm.product_id) filter (where sm.type in ('รับเข้า','ปรับปรุง','โอนย้าย')) as items_in,
  count(distinct sm.product_id) filter (where sm.type = 'จ่ายออก') as items_out,
  coalesce(sum(sm.qty), 0) as net_qty
from public.warehouses w
left join public.stock_movements sm on sm.warehouse = w.name
group by w.id, w.name, w.capacity;

create or replace view public.v_sales_by_day as
select
  to_char(date, 'Dy') as day_short,
  extract(isodow from date)::int as day_idx,
  coalesce(sum(total), 0) as sales,
  count(*) as orders
from public.orders
where date >= current_date - interval '6 days'
  and status not in ('cancelled','refunded')
group by date, day_short, day_idx
order by day_idx;

create or replace view public.v_revenue_trend as
select
  to_char(date_trunc('month', date), 'YYYY-MM') as month_key,
  case extract(month from date)
    when 1 then 'ม.ค.' when 2 then 'ก.พ.' when 3 then 'มี.ค.' when 4 then 'เม.ย.'
    when 5 then 'พ.ค.' when 6 then 'มิ.ย.' when 7 then 'ก.ค.' when 8 then 'ส.ค.'
    when 9 then 'ก.ย.' when 10 then 'ต.ค.' when 11 then 'พ.ย.' when 12 then 'ธ.ค.'
  end as month,
  coalesce(sum(total), 0) as revenue,
  0 as target
from public.orders
where date >= date_trunc('month', current_date) - interval '7 months'
  and status not in ('cancelled','refunded')
group by month_key, month
order by month_key;

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

create or replace view public.v_best_customers as
select c.id, c.name, c.code, c.type, c.tier,
       coalesce(sum(o.total), 0) as lifetime,
       count(o.id) as orders,
       max(o.date)::text as last_order
from public.customers c
left join public.orders o on o.customer_id = c.id and o.status not in ('cancelled','refunded')
group by c.id, c.name, c.code, c.type, c.tier
order by lifetime desc
limit 5;

create or replace view public.v_dashboard_stats as
select
  (select coalesce(sum(total), 0) from public.orders
     where date = current_date and status not in ('cancelled','refunded')) as today_sales,
  (select count(*) from public.orders
     where date = current_date and status not in ('cancelled','refunded')) as today_orders,
  (select count(*) from public.customers) as total_customers,
  (select count(*) from public.products where status in ('low','out')) as low_stock_count,
  (select coalesce(sum(total), 0) from public.orders
     where date_trunc('month', date) = date_trunc('month', current_date)
       and status not in ('cancelled','refunded')) as month_sales,
  (select count(*) from public.orders
     where status = 'pending') as pending_orders,
  (select coalesce(sum(oi.subtotal - (oi.qty * oi.cost)), 0)
     from public.order_items oi
     join public.orders o on oi.order_id = o.id
     where o.date = current_date and o.status not in ('cancelled','refunded')) as today_profit,
  (select coalesce(sum(oi.subtotal - (oi.qty * oi.cost)), 0)
     from public.order_items oi
     join public.orders o on oi.order_id = o.id
     where date_trunc('month', o.date) = date_trunc('month', current_date)
       and o.status not in ('cancelled','refunded')) as month_profit,
  (select coalesce(sum(oi.qty * oi.cost), 0)
     from public.order_items oi
     join public.orders o on oi.order_id = o.id
     where date_trunc('month', o.date) = date_trunc('month', current_date)
       and o.status not in ('cancelled','refunded')) as month_cogs;

create or replace view public.v_profit_by_day as
select
  o.date,
  to_char(o.date, 'Dy') as day_short,
  extract(isodow from o.date)::int as day_idx,
  coalesce(sum(oi.subtotal), 0) as revenue,
  coalesce(sum(oi.qty * oi.cost), 0) as cogs,
  coalesce(sum(oi.subtotal - (oi.qty * oi.cost)), 0) as profit
from public.orders o
join public.order_items oi on oi.order_id = o.id
where o.date >= current_date - interval '6 days'
  and o.status not in ('cancelled','refunded')
group by o.date, day_short, day_idx
order by day_idx;

create or replace view public.v_profit_by_month as
select
  to_char(date_trunc('month', o.date), 'YYYY-MM') as month_key,
  case extract(month from o.date)
    when 1 then 'ม.ค.' when 2 then 'ก.พ.' when 3 then 'มี.ค.' when 4 then 'เม.ย.'
    when 5 then 'พ.ค.' when 6 then 'มิ.ย.' when 7 then 'ก.ค.' when 8 then 'ส.ค.'
    when 9 then 'ก.ย.' when 10 then 'ต.ค.' when 11 then 'พ.ย.' when 12 then 'ธ.ค.'
  end as month,
  coalesce(sum(oi.subtotal), 0) as revenue,
  coalesce(sum(oi.qty * oi.cost), 0) as cogs,
  coalesce(sum(oi.subtotal - (oi.qty * oi.cost)), 0) as profit
from public.orders o
join public.order_items oi on oi.order_id = o.id
where o.date >= date_trunc('month', current_date) - interval '7 months'
  and o.status not in ('cancelled','refunded')
group by month_key, month
order by month_key;

create or replace view public.v_expiring_products as
select
  id, name, sku, barcode, category, brand, stock, unit, image_url, expiry_date,
  case
    when expiry_date < current_date then 'expired'
    when expiry_date <= current_date + interval '7 days' then 'critical'
    when expiry_date <= current_date + interval '30 days' then 'warning'
    else 'ok'
  end as expiry_status,
  expiry_date - current_date as days_until_expiry
from public.products
where deleted_at is null
  and expiry_date is not null
  and expiry_date <= current_date + interval '30 days'
order by expiry_date asc;

create or replace view public.v_cultivation_next_round as
with last_schedule as (
  select
    cultivation_id, stage_id, sequence,
    action_date as last_action_date,
    row_number() over (partition by cultivation_id order by action_date desc nulls last, created_at desc) as rn
  from public.cultivation_schedules
),
stage_rounds_max as (
  select stage_id, max(sequence) as rounds_max
  from public.care_program_rounds
  group by stage_id
),
stage_max_seq as (
  select stage_id, max(sequence) as max_sequence
  from public.stage_products
  group by stage_id
),
calc as (
  select
    c.id as cultivation_id,
    c.customer_id,
    c.stage_id as current_stage_id,
    c.current_sequence,
    ls.last_action_date,
    cs_cur.frequency_days,
    cs_cur.sort_order,
    coalesce(srm.rounds_max, sms.max_sequence, 1) as rounds_max,
    case
      when c.current_sequence < coalesce(srm.rounds_max, sms.max_sequence, 1)
        then c.stage_id
      else (select id from public.crop_stages
            where sort_order = cs_cur.sort_order + 1
              and crop_type = cs_cur.crop_type)
    end as next_stage_id,
    case
      when c.current_sequence < coalesce(srm.rounds_max, sms.max_sequence, 1)
        then c.current_sequence + 1
      else 1
    end as next_sequence
  from public.cultivations c
  left join last_schedule ls on ls.cultivation_id = c.id and ls.rn = 1
  left join public.crop_stages cs_cur on cs_cur.id = c.stage_id
  left join stage_rounds_max srm on srm.stage_id = c.stage_id
  left join stage_max_seq sms on sms.stage_id = c.stage_id
)
select
  calc.cultivation_id,
  calc.customer_id,
  calc.current_stage_id,
  cs_cur.name as current_stage_name,
  cs_cur.emoji as current_emoji,
  calc.current_sequence,
  calc.rounds_max,
  calc.next_stage_id,
  cs_next.name as next_stage_name,
  cs_next.emoji as next_emoji,
  cs_next.description as next_description,
  calc.next_sequence,
  cs_next.frequency_days as next_frequency_days,
  case
    when calc.last_action_date is null then null
    when cs_next.frequency_days is not null
      then calc.last_action_date + (cs_next.frequency_days || ' days')::interval
    else null
  end as next_action_date,
  case
    when calc.last_action_date is null then null
    when cs_next.frequency_days is not null
      then extract(day from (calc.last_action_date + (cs_next.frequency_days || ' days')::interval - current_date))::int
    else null
  end as days_until_next
from calc
left join public.crop_stages cs_cur on cs_cur.id = calc.current_stage_id
left join public.crop_stages cs_next on cs_next.id = calc.next_stage_id;

-- ============================================================
-- Seed: warehouses
-- ============================================================
insert into public.warehouses (id, name, items, value, capacity) values
  ('wh1', 'คลังหลัก', 1284, 3420000, 78)
on conflict (name) do nothing;

-- ============================================================
-- Seed: categories (หมวดหมู่สินค้าเริ่มต้น — ผู้ใช้เพิ่มได้ภายหลัง)
-- ============================================================
insert into public.categories (name, sort_order) values
  ('ปุ๋ยเคมี', 1),
  ('ปุ๋ยอินทรีย์', 2),
  ('ยาปราบศัตรูพืช', 3),
  ('เมล็ดพันธุ์', 4),
  ('อุปกรณ์เกษตร', 5),
  ('ฮอร์โมน/สารเสริม', 6)
on conflict (name) do nothing;

-- ============================================================
-- Seed: products (16 รายการพื้นฐาน)
-- ============================================================
insert into public.products (id, name, sku, barcode, category, brand, price, cost, stock, min_stock, unit) values
  ('p1',  'ปุ๋ยยูเรีย 46-0-0',         'FRT-4600',   '8850001', 'ปุ๋ยเคมี',         'ตราหัววัว', 780, 640, 320, 60, 'ชิ้น'),
  ('p2',  'ปุ๋ยสูตร 15-15-15',          'FRT-1515',   '8850002', 'ปุ๋ยเคมี',         'ตรากระต่าย', 920, 760, 148, 50, 'ชิ้น'),
  ('p3',  'ปุ๋ยสูตร 16-20-0',           'FRT-1620',   '8850003', 'ปุ๋ยเคมี',         'ตราหัววัว', 850, 700,  32, 40, 'ชิ้น'),
  ('p4',  'ปุ๋ยคอกมูลไก่อัดเม็ด',        'ORG-CHK1',   '8850004', 'ปุ๋ยอินทรีย์',     'ไร่ทองดี',   240, 170, 512, 80, 'ชิ้น'),
  ('p5',  'ปุ๋ยหมักชีวภาพ 25 กก.',       'ORG-BIO25',  '8850005', 'ปุ๋ยอินทรีย์',     'กรีนฟาร์ม',  310, 220,   0, 40, 'ชิ้น'),
  ('p6',  'ไกลโฟเซต 1 ลิตร',            'PST-GLY1',   '8850006', 'ยาปราบศัตรูพืช',   'อะกริโปร',   320, 245,  96, 30, 'ชิ้น'),
  ('p7',  'อะบาเม็กติน 500 มล.',        'PST-ABA5',   '8850007', 'ยาปราบศัตรูพืช',   'อะกริโปร',   285, 210,  18, 25, 'ชิ้น'),
  ('p8',  'เมล็ดข้าวโพดหวาน',           'SED-CRN1',   '8850008', 'เมล็ดพันธุ์',       'ซีดโปร',     145,  98, 240, 50, 'ชิ้น'),
  ('p9',  'เมล็ดพันธุ์ข้าว กข.43',       'SED-RIC43',  '8850009', 'เมล็ดพันธุ์',       'ซีดโปร',     620, 480,  74, 30, 'ชิ้น'),
  ('p10', 'เครื่องพ่นยาสะพายหลัง',       'EQP-SPR20',  '8850010', 'อุปกรณ์การเกษตร',  'ฟาร์มเทค',  1850,1420,  22, 10, 'ชิ้น'),
  ('p11', 'สายยางเกษตร 20 ม.',          'EQP-HOSE20', '8850011', 'อุปกรณ์การเกษตร',  'ฟาร์มเทค',   480, 350,  61, 15, 'ชิ้น'),
  ('p12', 'ฮอร์โมนไข่ 1 ลิตร',           'HRM-EGG1',   '8850012', 'ฮอร์โมนพืช',       'กรีนฟาร์ม',  260, 180, 130, 30, 'ชิ้น'),
  ('p13', 'สาหร่ายสกัดเข้มข้น',          'HRM-SEA5',   '8850013', 'ฮอร์โมนพืช',       'กรีนฟาร์ม',  390, 300,  12, 20, 'ชิ้น'),
  ('p14', 'ปุ๋ยเกล็ดละลายน้ำ',           'FRT-WSF1',   '8850014', 'ปุ๋ยเคมี',         'ตรากระต่าย', 430, 330, 205, 40, 'ชิ้น'),
  ('p15', 'กับดักแมลงกาวเหนียว',        'PST-TRAP',   '8850015', 'ยาปราบศัตรูพืช',   'อะกริโปร',    65,  38, 640,100, 'ชิ้น'),
  ('p16', 'ถุงเพาะชำ 100 ใบ',           'EQP-BAG100', '8850016', 'อุปกรณ์การเกษตร',  'ฟาร์มเทค',    95,  60, 380, 60, 'ชิ้น')
on conflict (sku) do nothing;

-- ============================================================
-- Seed: products ลำไย (20 SKU)
-- ============================================================
insert into public.products (id, name, sku, barcode, category, brand, price, cost, stock, min_stock, unit) values
  ('lp01', 'สาหร่ายอะมิโนเข้มข้น', 'HRM-AMINO', '8901001', 'ฮอร์โมนพืช', 'LonganPro', 420, 310, 120, 20, 'ชิ้น'),
  ('lp02', 'ปุ๋ยเกร็ดสูตร 15-0-0', 'FRT-1500', '8901002', 'ปุ๋ยเคมี', 'LonganPro', 560, 430, 90, 15, 'ชิ้น'),
  ('lp03', 'ปุ๋ยเกร็ดสูตร 30-10-10', 'FRT-301010', '8901003', 'ปุ๋ยเคมี', 'LonganPro', 620, 480, 95, 15, 'ชิ้น'),
  ('lp04', 'ปุ๋ยเกร็ดสูตร 30-20-10', 'FRT-302010', '8901004', 'ปุ๋ยเคมี', 'LonganPro', 640, 500, 88, 15, 'ชิ้น'),
  ('lp05', 'ธาตุอาหารรองเสริมรวม', 'NUT-MICRO', '8901005', 'ธาตุอาหารรอง', 'LonganPro', 390, 290, 70, 12, 'ชิ้น'),
  ('lp06', 'ปุ๋ยเกร็ดสูตร 21-21-21', 'FRT-212121', '8901006', 'ปุ๋ยเคมี', 'LonganPro', 590, 460, 80, 12, 'ชิ้น'),
  ('lp07', 'ปุ๋ยเกร็ดสูตร 20-20-20', 'FRT-202020', '8901007', 'ปุ๋ยเคมี', 'LonganPro', 570, 445, 82, 12, 'ชิ้น'),
  ('lp08', 'ปุ๋ยเกร็ดสูตร 4-24-24', 'FRT-42424', '8901008', 'ปุ๋ยเคมี', 'LonganPro', 610, 475, 60, 10, 'ชิ้น'),
  ('lp09', 'ปุ๋ยเกร็ดสูตร 8-24-24', 'FRT-82424', '8901009', 'ปุ๋ยเคมี', 'LonganPro', 615, 480, 58, 10, 'ชิ้น'),
  ('lp10', 'แมกนีเซียมเสริมใบ', 'MIN-MG', '8901010', 'ธาตุอาหารรอง', 'LonganPro', 350, 260, 66, 10, 'ชิ้น'),
  ('lp11', 'ปุ๋ยเกร็ดสูตร 0-52-34', 'FRT-05234', '8901011', 'ปุ๋ยเคมี', 'LonganPro', 680, 530, 64, 10, 'ชิ้น'),
  ('lp12', 'โพแทสเซียมคลอเรต', 'CHL-KCLO3', '8901012', 'สารควบคุมการออกดอก', 'LonganPro', 780, 620, 54, 8, 'ชิ้น'),
  ('lp13', 'โซเดียมคลอเรต', 'CHL-NACLO3', '8901013', 'สารควบคุมการออกดอก', 'LonganPro', 760, 600, 52, 8, 'ชิ้น'),
  ('lp14', 'เสือดอก', 'BLOOM-TIGER', '8901014', 'สารบำรุงพืช', 'LonganPro', 490, 370, 45, 8, 'ชิ้น'),
  ('lp15', 'ยาเปิดตาดอก', 'BLOOM-OPEN', '8901015', 'สารบำรุงพืช', 'LonganPro', 520, 390, 44, 8, 'ชิ้น'),
  ('lp16', 'ปุ๋ยเกร็ดสูตร 6-12-36', 'FRT-61236', '8901016', 'ปุ๋ยเคมี', 'LonganPro', 650, 510, 57, 10, 'ชิ้น'),
  ('lp17', 'ปุ๋ยเกร็ดสูตร 10-52-17', 'FRT-105217', '8901017', 'ปุ๋ยเคมี', 'LonganPro', 690, 545, 62, 10, 'ชิ้น'),
  ('lp18', 'ตัวผสมเกสร ไดมอนด์', 'POL-DIAMOND', '8901018', 'สารบำรุงพืช', 'LonganPro', 460, 345, 36, 6, 'ชิ้น'),
  ('lp19', 'ปุ๋ยเกร็ดสูตรตัวท้ายสูง 13-13-21', 'FRT-131321', '8901019', 'ปุ๋ยเคมี', 'LonganPro', 640, 500, 55, 10, 'ชิ้น'),
  ('lp20', 'เชื้อราตัวขัดผิว', 'BIO-SKIN', '8901020', 'ชีวภัณฑ์', 'LonganPro', 540, 410, 40, 8, 'ชิ้น')
on conflict (sku) do update set
  name = excluded.name,
  category = excluded.category,
  brand = excluded.brand,
  price = excluded.price,
  cost = excluded.cost,
  min_stock = excluded.min_stock,
  unit = excluded.unit;

-- ============================================================
-- Seed: stock_movements (18 รายการตัวอย่าง)
-- ============================================================
insert into public.stock_movements (code, type, product_id, product_name, qty, warehouse, by_user, date, status)
select
  'MV-26' || lpad((3301 + i)::text, 4, '0'),
  case i % 4 when 0 then 'รับเข้า' when 1 then 'จ่ายออก' when 2 then 'ปรับปรุง' else 'ปรับปรุง' end,
  'p' || ((i % 16) + 1)::text,
  (select name from public.products where id = 'p' || ((i % 16) + 1)::text),
  case when i % 4 = 1 then -1 else 1 end * (10 + i * 7),
  'คลังหลัก',
  case i % 4 when 0 then 'ธนกร' when 1 then 'ปิยะ' when 2 then 'มนูญ' else 'วรัญญา' end,
  ('2026-08-' || lpad((7 - (i % 7))::text, 2, '0'))::date,
  case i % 4 when 0 then 'completed' when 1 then 'completed' when 2 then 'pending' else 'draft' end
from generate_series(0, 17) as i
where not exists (select 1 from public.stock_movements);

-- ============================================================
-- Seed: customers (12 ราย)
-- ============================================================
insert into public.customers (id, name, code, phone, email, address, type, tier, lifetime, orders, last_order, since, notes, tags) values
  ('c1',  'สมชาย ใจดี',              'CUS-1024', '0812345678', 'customer1@puithai.co.th',  '44 หมู่ 1 ต.หนองบัว อ.เมือง จ.นครราชสีมา 30000', 'เกษตรกร',     'Silver',   18000,  6, '2026-08-01', '2020-01-12', 'ชอบสั่งปุ๋ยสูตรเสมอก่อนฤดูฝน ต้องการใบกำกับภาษีทุกครั้ง', '{"ลูกค้าประจำ","เครดิต 30 วัน"}'),
  ('c2',  'วิภา ทองคำ',              'CUS-1025', '0823456781', 'customer2@puithai.co.th',  '45 หมู่ 2 ต.หนองบัว อ.เมือง จ.นครราชสีมา 30000', 'ร้านค้าปลีก',  'Gold',     42500,  9, '2026-08-02', '2021-02-12', 'ขอราคาส่งเมื่อสั่งเกิน 50 กระสอบ ติดต่อผ่านไลน์เป็นหลัก', '{"ลูกค้าประจำ"}'),
  ('c3',  'สหกรณ์การเกษตรบ้านโนน',     'CUS-1026', '0834567812', 'customer3@puithai.co.th',  '46 หมู่ 3 ต.หนองบัว อ.เมือง จ.นครราชสีมา 30000', 'สหกรณ์',       'Platinum', 73500, 12, '2026-08-03', '2022-03-12', 'สั่งปุ๋ยรายเดือน ต้องการส่งฟรีในรัศมี 50 กม.', '{"ลูกค้าประจำ","เครดิต 30 วัน"}'),
  ('c4',  'ประเสริฐ ศรีสุข',           'CUS-1027', '0845678123', 'customer4@puithai.co.th',  '47 หมู่ 4 ต.หนองบัว อ.เมือง จ.นครราชสีมา 30000', 'เกษตรกร',     'Bronze',   96500, 15, '2026-08-04', '2023-04-12', 'ชอบสั่งปุ๋ยสูตรเสมอก่อนฤดูฝน ต้องการใบกำกับภาษีทุกครั้ง', '{"ลูกค้าประจำ"}'),
  ('c5',  'ร้านเกษตรรุ่งเรือง',         'CUS-1028', '0856781234', 'customer5@puithai.co.th',  '48 หมู่ 5 ต.หนองบัว อ.เมือง จ.นครราชสีมา 30000', 'ร้านค้าปลีก',  'Silver',  127500, 18, '2026-08-05', '2024-05-12', 'ขอราคาส่งเมื่อสั่งเกิน 50 กระสอบ ติดต่อผ่านไลน์เป็นหลัก', '{"ลูกค้าประจำ","เครดิต 30 วัน"}'),
  ('c6',  'มานะ พูนผล',               'CUS-1029', '0867812345', 'customer6@puithai.co.th',  '49 หมู่ 6 ต.หนองบัว อ.เมือง จ.นครราชสีมา 30000', 'เกษตรกร',     'Gold',    158500, 21, '2026-08-06', '2020-06-12', 'ชอบสั่งปุ๋ยสูตรเสมอก่อนฤดูฝน ต้องการใบกำกับภาษีทุกครั้ง', '{"ลูกค้าประจำ"}'),
  ('c7',  'กนกวรรณ แสงทอง',           'CUS-1030', '0878123456', 'customer7@puithai.co.th',  '50 หมู่ 7 ต.หนองบัว อ.เมือง จ.นครราชสีมา 30000', 'ร้านค้าปลีก',  'Bronze',  189500, 24, '2026-08-07', '2021-07-12', 'ขอราคาส่งเมื่อสั่งเกิน 50 กระสอบ ติดต่อผ่านไลน์เป็นหลัก', '{"ลูกค้าประจำ"}'),
  ('c8',  'บจก. ไร่เขียวขจี',          'CUS-1031', '0881234567', 'customer8@puithai.co.th',  '51 หมู่ 8 ต.หนองบัว อ.เมือง จ.นครราชสีมา 30000', 'องค์กร',       'Platinum', 220500, 27, '2026-08-01', '2022-08-12', 'สั่งปุ๋ยรายเดือน ต้องการส่งฟรีในรัศมี 50 กม.', '{"ลูกค้าประจำ","เครดิต 30 วัน"}'),
  ('c9',  'สุนีย์ บุญมา',              'CUS-1032', '0892345678', 'customer9@puithai.co.th',  '52 หมู่ 9 ต.หนองบัว อ.เมือง จ.นครราชสีมา 30000', 'เกษตรกร',     'Silver',  251500, 30, '2026-08-02', '2023-09-12', 'ชอบสั่งปุ๋ยสูตรเสมอก่อนฤดูฝน ต้องการใบกำกับภาษีทุกครั้ง', '{"ลูกค้าประจำ"}'),
  ('c10', 'อำนวย เกษตรกิจ',           'CUS-1033', '0812345670', 'customer10@puithai.co.th', '53 หมู่ 1 ต.หนองบัว อ.เมือง จ.นครราชสีมา 30000', 'เกษตรกร',     'Gold',    282500, 33, '2026-08-03', '2024-01-12', 'ขอราคาส่งเมื่อสั่งเกิน 50 กระสอบ ติดต่อผ่านไลน์เป็นหลัก', '{"ลูกค้าประจำ","เครดิต 30 วัน"}'),
  ('c11', 'ชูใจ พึ่งพา',              'CUS-1034', '0823456780', 'customer11@puithai.co.th', '54 หมู่ 2 ต.หนองบัว อ.เมือง จ.นครราชสีมา 30000', 'ร้านค้าปลีก',  'Bronze',  313500, 36, '2026-08-04', '2020-02-12', 'ชอบสั่งปุ๋ยสูตรเสมอก่อนฤดูฝน ต้องการใบกำกับภาษีทุกครั้ง', '{"ลูกค้าประจำ"}'),
  ('c12', 'สหกรณ์ชาวสวนยางใต้',        'CUS-1035', '0834567801', 'customer12@puithai.co.th', '55 หมู่ 3 ต.หนองบัว อ.เมือง จ.นครราชสีมา 30000', 'สหกรณ์',       'Platinum', 344500, 39, '2026-08-05', '2021-03-12', 'สั่งปุ๋ยรายเดือน ต้องการส่งฟรีในรัศมี 50 กม.', '{"ลูกค้าประจำ","เครดิต 30 วัน"}')
on conflict (code) do nothing;

-- ============================================================
-- Seed: cultivations (ลำไย 12 ระยะ)
-- ============================================================
insert into public.cultivations (id, customer_id, crop, stage, area, planted_date, expected_harvest, location, note, stage_id, current_sequence) values
  ('cul-1-1',  'c1',  'ลำไย', 'แตกใบอ่อน ใบสอง',     5,  '2026-01-01', '2026-05-15', 'แปลงหลังบ้าน',     'เริ่มใส่ปุ๋ยสูตร 15-15-15 แล้ว', 'stage_03', 1),
  ('cul-1-2',  'c1',  'ลำไย', 'แตกใบอ่อน ใบแรก',     8,  '2026-02-15', '2026-05-01', 'แปลงทุ่งนา',        null, 'stage_02', 0),
  ('cul-2-1',  'c2',  'ลำไย', 'ดอกบาน',             12, '2025-11-01', '2026-03-15', 'แปลงสวน',           null, 'stage_08', 0),
  ('cul-3-1',  'c3',  'ลำไย', 'เตรียมต้นหลังเก็บเกี่ยว', 25, '2026-07-01', '2027-05-15', 'แปลงเช่า',          null, 'stage_01', 0),
  ('cul-3-2',  'c3',  'ลำไย', 'แตกใบอ่อน ใบแรก',     18, '2026-06-01', '2026-09-15', 'แปลงหัวไร่ปลายทุ่ง', null, 'stage_02', 0),
  ('cul-3-3',  'c3',  'ลำไย', 'แตกใบอ่อน ใบสอง',     30, '2026-01-15', '2026-05-30', 'แปลงทุ่งนา',        null, 'stage_03', 0),
  ('cul-4-1',  'c4',  'ลำไย', 'ดอกบาน',             10, '2025-10-01', '2027-04-15', 'แปลงสวน',           null, 'stage_08', 0),
  ('cul-4-2',  'c4',  'ลำไย', 'ก่อนเก็บ',            6,  '2026-05-01', '2026-07-15', 'แปลงหลังบ้าน',      null, 'stage_12', 0),
  ('cul-6-1',  'c6',  'ลำไย', 'แตกใบอ่อน ใบสอง',     15, '2025-09-01', '2027-01-15', 'แปลงเช่า',          null, 'stage_03', 0),
  ('cul-6-2',  'c6',  'ลำไย', 'แตกใบอ่อน ใบแรก',     4,  '2026-06-15', '2026-08-25', 'แปลงหัวไร่ปลายทุ่ง', null, 'stage_02', 0),
  ('cul-9-1',  'c9',  'ลำไย', 'ดอกบาน',              3,  '2026-04-01', '2026-07-15', 'แปลงหลังบ้าน',      null, 'stage_08', 0),
  ('cul-10-1', 'c10', 'ลำไย', 'แตกใบอ่อน ใบสอง',      7,  '2026-01-20', '2026-05-30', 'แปลงทุ่งนา',        null, 'stage_03', 0),
  ('cul-10-2', 'c10', 'ลำไย', 'แตกใบอ่อน ใบแรก',     2,  '2026-06-01', '2026-08-20', 'แปลงสวน',           null, 'stage_02', 0),
  ('cul-12-1', 'c12', 'ลำไย', 'ก่อนเก็บ',            40, '2025-08-01', '2027-02-15', 'แปลงเช่า',          null, 'stage_12', 0),
  ('cul-12-2', 'c12', 'ลำไย', 'แตกใบอ่อน ใบสอง',     22, '2025-07-01', '2027-01-15', 'แปลงหัวไร่ปลายทุ่ง', null, 'stage_03', 0),
  ('cul-12-3', 'c12', 'ลำไย', 'ดอกบาน',             15, '2025-12-01', '2026-04-15', 'แปลงทุ่งนา',        null, 'stage_08', 0)
on conflict (id) do nothing;

-- ============================================================
-- Seed: orders (24 รายการ)
-- ============================================================
insert into public.orders (id, code, customer_id, customer_name, date, total, items, status, channel, salesperson, payment)
select
  'o' || (i + 1)::text,
  'SO-26' || lpad((1204 + i)::text, 4, '0'),
  'c' || ((i % 12) + 1)::text,
  (select name from public.customers where id = 'c' || ((i % 12) + 1)::text),
  ('2026-08-' || lpad((7 - (i % 7))::text, 2, '0'))::date,
  (1450 + i * 1870 + (i % 4) * 2600)::numeric,
  (2 + (i % 7)),
  case i % 6
    when 0 then 'paid' when 1 then 'pending' when 2 then 'processing'
    when 3 then 'paid' when 4 then 'cancelled' else 'refunded'
  end,
  case i % 3 when 0 then 'POS' when 1 then 'Online' else 'Sales Rep' end,
  case i % 4 when 0 then 'ณัฐพล ว.' when 1 then 'จิราภรณ์ ส.' when 2 then 'อดิศักดิ์ ท.' else 'พรทิพย์ ม.' end,
  case i % 5 when 0 then 'เงินสด' when 1 then 'โอนเงิน' when 2 then 'บัตรเครดิต' when 3 then 'QR PromptPay' else 'เครดิต 30 วัน' end
from generate_series(0, 23) as i
on conflict (code) do nothing;

-- ============================================================
-- Seed: order_items
-- ============================================================
insert into public.order_items (order_id, product_id, product_name, qty, price, cost, subtotal)
select
  'o' || (i + 1)::text,
  'p' || ((i % 16) + 1)::text,
  (select name from public.products where id = 'p' || ((i % 16) + 1)::text),
  (1 + (i % 5)),
  (select price from public.products where id = 'p' || ((i % 16) + 1)::text),
  (select cost from public.products where id = 'p' || ((i % 16) + 1)::text),
  (1 + (i % 5)) * (select price from public.products where id = 'p' || ((i % 16) + 1)::text)
from generate_series(0, 23) as i
where not exists (
  select 1 from public.order_items oi
  where oi.order_id = 'o' || (i + 1)::text
    and oi.product_id = 'p' || ((i % 16) + 1)::text
);

insert into public.order_items (order_id, product_id, product_name, qty, price, cost, subtotal)
select
  'o' || (i + 1)::text,
  'p' || (((i + 5) % 16) + 1)::text,
  (select name from public.products where id = 'p' || (((i + 5) % 16) + 1)::text),
  (2 + (i % 3)),
  (select price from public.products where id = 'p' || (((i + 5) % 16) + 1)::text),
  (select cost from public.products where id = 'p' || (((i + 5) % 16) + 1)::text),
  (2 + (i % 3)) * (select price from public.products where id = 'p' || (((i + 5) % 16) + 1)::text)
from generate_series(0, 17) as i
where not exists (
  select 1 from public.order_items oi
  where oi.order_id = 'o' || (i + 1)::text
    and oi.product_id = 'p' || (((i + 5) % 16) + 1)::text
);

-- ============================================================
-- Seed: activities
-- ============================================================
insert into public.activities (actor, action, target, kind, created_at)
select * from (values
  ('ณัฐพล ว.',   'สร้างคำสั่งขาย',     'SO-261204',                'order',    now() - interval '5 minutes'),
  ('ระบบ',       'แจ้งเตือนสต็อกต่ำ',  'ปุ๋ยสูตร 16-20-0',          'stock',    now() - interval '18 minutes'),
  ('จิราภรณ์ ส.', 'เพิ่มลูกค้าใหม่',    'สุนีย์ บุญมา',              'customer', now() - interval '42 minutes'),
  ('พรทิพย์ ม.',  'รับชำระเงิน',       'SO-261198 · ฿24,500',       'payment',  now() - interval '1 hour'),
  ('อดิศักดิ์ ท.', 'ปรับปรุงสต็อก',     'คลังหลัก · +120 กระสอบ',    'stock',    now() - interval '2 hours'),
  ('ระบบ',       'สำรองข้อมูลอัตโนมัติ', 'สำเร็จ',                   'system',   now() - interval '3 hours')
) as v(actor, action, target, kind, created_at)
where not exists (select 1 from public.activities);

-- ============================================================
-- Seed: notifications
-- ============================================================
insert into public.notifications (title, description, unread, link, created_at)
select * from (values
  ('สินค้าใกล้หมด 5 รายการ',      'ตรวจสอบคลังหลักก่อนเปิดร้านพรุ่งนี้', true,  '/products?status=low',    now() - interval '10 minutes'),
  ('ใบสั่งซื้อรออนุมัติ',         'PO-2610 มูลค่า ฿182,000',            true,  '/sales?status=pending',   now() - interval '1 hour'),
  ('โปรโมชันจะหมดอายุ',          'ลดราคาปุ๋ยอินทรีย์ สิ้นสุดใน 2 วัน',  false, '/promotions',             now() - interval '4 hours'),
  ('ยอดขายเดือนนี้ถึง 94% ของเป้า', 'เหลืออีก ฿70,000 ถึงเป้าหมาย',       false, '/sales',                  now() - interval '1 day')
) as v(title, description, unread, link, created_at)
where not exists (select 1 from public.notifications);

-- ============================================================
-- Seed: crop_stages (12 ระยะลำไย)
-- ============================================================
insert into public.crop_stages (id, name, emoji, description, days_min, days_max, frequency_days, sort_order) values
  ('stage_01', 'เตรียมต้นหลังเก็บเกี่ยว',        '🌱', 'ช่วงเวลา: 45-60 วัน (ทุก 15 วัน)', 45, 60, 15, 1),
  ('stage_02', 'แตกใบอ่อน ใบแรก',              '🌿', 'ช่วงเวลา: 10-15 วัน (1 ครั้ง)', 10, 15, null, 2),
  ('stage_03', 'แตกใบอ่อน ใบสอง',              '🍃', 'ช่วงเวลารวม: 20-30 วัน (ทุก 7 วัน)', 20, 30, 7, 3),
  ('stage_04', 'ราดสาร',                       '💀', 'ช่วงเวลา: กรอบ 10 วัน (สารควบคุมการออกดอก)', null, 10, null, 4),
  ('stage_05', 'เปิดตาดอก',                   '🌸', 'ช่วงเวลา: 10-14 วัน (ทุก 5-7 วัน)', 10, 14, 6, 5),
  ('stage_06', 'ยืดช่อดอก',                   '🌺', 'ช่วงเวลา: 10-14 วัน (ทุก 5-7 วัน)', 10, 14, 6, 6),
  ('stage_07', 'บำรุงช่อดอก',                 '🌷', 'ช่วงเวลา: 10-14 วัน (ทุก 5-7 วัน)', 10, 14, 6, 7),
  ('stage_08', 'ดอกบาน',                     '🌼', 'ช่วงเวลา: 10-14 วัน (ทุก 5-7 วัน)', 10, 14, 6, 8),
  ('stage_09', 'ลูกเล็ก',                    '🍒', 'ช่วงเวลา: 60 วัน (ทุก 10-15 วัน)', 60, 60, 12, 9),
  ('stage_10', 'ลูกมะเขือพวง',               '🍊', 'ช่วงเวลา: 60 วัน (ทุก 10-15 วัน)', 60, 60, 12, 10),
  ('stage_11', 'ลูกแก้ว',                    '🍏', 'ช่วงเวลา: 45 วัน (ทุก 10 วัน)', 45, 45, 10, 11),
  ('stage_12', 'ก่อนเก็บ',                   '👍', 'ช่วงเวลา: 20 วัน (ทุก 8-10 วัน)', 20, 20, 9, 12)
on conflict (id) do nothing;

-- ============================================================
-- Seed: crop_stages (21 ระยะทุเรียน)
-- ============================================================
insert into public.crop_stages (id, name, emoji, description, days_min, days_max, frequency_days, sort_order, crop_type) values
  ('durian_01', 'ฟื้นต้นหลังเก็บเกี่ยว',           '🌱', '2-4 สัปดาห์ (ทุก 10-14 วัน)', 14, 28, 10, 1, 'ทุเรียน'),
  ('durian_02', 'แตกใบอ่อน ชุดที่ 1',            '🍃', '15-30 วัน (ทุก 7 วัน)', 15, 30, 7, 2, 'ทุเรียน'),
  ('durian_03', 'ใบเพสลาด / ใบเริ่มแก่',         '🌿', '10-20 วัน (ทุก 7-10 วัน)', 10, 20, 7, 3, 'ทุเรียน'),
  ('durian_04', 'แตกใบอ่อน ชุดที่ 2',            '🍃', '20-30 วัน (ทุก 7 วัน)', 20, 30, 7, 4, 'ทุเรียน'),
  ('durian_05', 'ใบแก่ ชุดที่ 2',                '🌳', '2-3 สัปดาห์ (ทุก 10-14 วัน)', 14, 21, 10, 5, 'ทุเรียน'),
  ('durian_06', 'แตกใบอ่อน ชุดที่ 3',            '🍃', '20-30 วัน (ทุก 7-10 วัน)', 20, 30, 7, 6, 'ทุเรียน'),
  ('durian_07', 'ใบแก่พร้อมออกดอก',             '🌳', '2-3 สัปดาห์ (ทุก 7-14 วัน)', 14, 21, 7, 7, 'ทุเรียน'),
  ('durian_08', 'พักต้น / ชักนำการออกดอก',       '🌱', '2-4 สัปดาห์ (ทุก 5-7 วัน)', 14, 28, 5, 8, 'ทุเรียน'),
  ('durian_09', 'เริ่มเห็นตาดอก',               '🌼', '7-14 วัน (ทุก 5-7 วัน)', 7, 14, 5, 9, 'ทุเรียน'),
  ('durian_10', 'ตาดอก / ช่อดอกพัฒนา',          '🌸', '7-14 วัน (ทุก 5-7 วัน)', 7, 14, 5, 10, 'ทุเรียน'),
  ('durian_11', 'ช่อดอกยืด',                   '🌸', '7-14 วัน (ทุก 5-7 วัน)', 7, 14, 5, 11, 'ทุเรียน'),
  ('durian_12', 'ดอกบาน',                     '🌺', '5-10 วัน (ติดตามเป็นหลัก)', 5, 10, null, 12, 'ทุเรียน'),
  ('durian_13', 'ติดผลอ่อน',                   '🟢', '1-3 สัปดาห์ (ทุก 7 วัน)', 7, 21, 7, 13, 'ทุเรียน'),
  ('durian_14', 'ผลระยะปิ่น / ผลเล็ก',          '🟢', '2-3 สัปดาห์ (ทุก 7-10 วัน)', 14, 21, 7, 14, 'ทุเรียน'),
  ('durian_15', 'ผลอายุประมาณ 1 เดือน',         '🟢', '4 สัปดาห์ (ทุก 7-10 วัน)', 28, 28, 7, 15, 'ทุเรียน'),
  ('durian_16', 'ผลขยาย ระยะที่ 1',             '🟡', '5-8 สัปดาห์ (ทุก 7-10 วัน)', 35, 56, 7, 16, 'ทุเรียน'),
  ('durian_17', 'ผลขยาย ระยะที่ 2',             '🟡', '8-12 สัปดาห์ (ทุก 10-14 วัน)', 56, 84, 10, 17, 'ทุเรียน'),
  ('durian_18', 'ผลเริ่มแก่',                  '🟠', '12-15 สัปดาห์ (ทุก 10-14 วัน)', 84, 105, 10, 18, 'ทุเรียน'),
  ('durian_19', 'ผลแก่ใกล้เก็บเกี่ยว',          '🟤', '15-18 สัปดาห์ (ตรวจแปลงเป็นหลัก)', 105, 126, null, 19, 'ทุเรียน'),
  ('durian_20', 'ก่อนเก็บเกี่ยว',              '📦', 'ช่วงท้าย (ยึด PHI)', null, 14, null, 20, 'ทุเรียน'),
  ('durian_21', 'เก็บเกี่ยว',                  '🧺', 'ตามความแก่ของผล', null, null, null, 21, 'ทุเรียน')
on conflict (id) do nothing;
insert into public.stage_products (stage_id, product_id, formula, sequence)
select 'stage_01', p.id, f.formula, f.sequence
from (
  values
    ('HRM-AMINO', 'ครั้งที่ 1: สาหร่ายอะมิโน + 15-0-0', 1),
    ('FRT-1500', 'ครั้งที่ 1: ปุ๋ยเกร็ดสูตรตัวหน้าสูง 15-0-0', 1),
    ('HRM-AMINO', 'ครั้งที่ 2: สาหร่ายอะมิโน + 30-10-10', 2),
    ('FRT-301010', 'ครั้งที่ 2: ปุ๋ยเกร็ดสูตรตัวหน้าสูง 30-10-10', 2),
    ('HRM-AMINO', 'ครั้งที่ 3: สาหร่ายอะมิโน + 30-20-10', 3),
    ('FRT-302010', 'ครั้งที่ 3: ปุ๋ยเกร็ดสูตรตัวหน้าสูง 30-20-10', 3)
) as f(sku, formula, sequence)
join public.products p on p.sku = f.sku
on conflict do nothing;

insert into public.stage_products (stage_id, product_id, formula, sequence)
select 'stage_02', p.id, f.formula, 1
from (
  values
    ('NUT-MICRO', 'ธาตุอาหารรองเสริม'),
    ('FRT-212121', 'ปุ๋ยเกร็ดสูตรเสมอ 21-21-21'),
    ('FRT-202020', 'ปุ๋ยเกร็ดสูตรเสมอ 20-20-20')
) as f(sku, formula)
join public.products p on p.sku = f.sku
on conflict do nothing;

insert into public.stage_products (stage_id, product_id, formula, sequence)
select 'stage_03', p.id, f.formula, f.sequence
from (
  values
    ('HRM-AMINO', 'ครั้งที่ 1: สาหร่ายอะมิโน', 1),
    ('FRT-301010', 'ครั้งที่ 1: ปุ๋ยเกร็ดสูตรตัวหน้าสูง 30-10-10', 1),
    ('FRT-212121', 'ครั้งที่ 2: ปุ๋ยเกร็ดสูตรเสมอ 21-21-21', 2),
    ('FRT-202020', 'ครั้งที่ 2: ปุ๋ยเกร็ดสูตรเสมอ 20-20-20', 2),
    ('FRT-42424', 'ครั้งที่ 3: ปุ๋ยเกร็ดสูตรตัวหน้าต่ำ 4-24-24', 3),
    ('FRT-82424', 'ครั้งที่ 3: ปุ๋ยเกร็ดสูตรตัวหน้าต่ำ 8-24-24', 3),
    ('MIN-MG', 'ครั้งที่ 4: แมกนีเซียม', 4),
    ('FRT-05234', 'ครั้งที่ 4: สูตรตัดไนโตรเจน 0-52-34', 4)
) as f(sku, formula, sequence)
join public.products p on p.sku = f.sku
on conflict do nothing;

insert into public.stage_products (stage_id, product_id, formula, sequence)
select 'stage_04', p.id, f.formula, f.sequence
from (
  values
    ('CHL-KCLO3', 'ทางใบ ครั้งที่ 1', 1),
    ('CHL-NACLO3', 'ทางใบ ครั้งที่ 1', 1),
    ('CHL-KCLO3', 'ทางใบ ครั้งที่ 2', 2),
    ('CHL-NACLO3', 'ทางใบ ครั้งที่ 2', 2),
    ('CHL-KCLO3', 'ทางใบ ครั้งที่ 3', 3),
    ('CHL-NACLO3', 'ทางใบ ครั้งที่ 3', 3),
    ('CHL-NACLO3', 'ทางดิน ครั้งที่ 4', 4)
) as f(sku, formula, sequence)
join public.products p on p.sku = f.sku
on conflict do nothing;

insert into public.stage_products (stage_id, product_id, formula, sequence)
select 'stage_05', p.id, f.formula, 1
from (
  values
    ('BLOOM-TIGER', 'เสือดอก'),
    ('BLOOM-OPEN', 'ยาเปิดตาดอก'),
    ('FRT-61236', 'ปุ๋ยเกร็ดสูตร 6-12-36')
) as f(sku, formula)
join public.products p on p.sku = f.sku
on conflict do nothing;

insert into public.stage_products (stage_id, product_id, formula, sequence)
select 'stage_06', p.id, 'ปุ๋ยเกร็ดสูตร 10-52-17', 1
from public.products p where p.sku = 'FRT-105217'
on conflict do nothing;

insert into public.stage_products (stage_id, product_id, formula, sequence)
select 'stage_07', p.id, 'ปุ๋ยเกร็ดสูตร 10-52-17', 1
from public.products p where p.sku = 'FRT-105217'
on conflict do nothing;

insert into public.stage_products (stage_id, product_id, formula, sequence)
select 'stage_08', p.id, 'ตัวผสมเกสร (ไดมอนด์)', 1
from public.products p where p.sku = 'POL-DIAMOND'
on conflict do nothing;

insert into public.stage_products (stage_id, product_id, formula, sequence)
select 'stage_09', p.id, f.formula, 1
from (
  values
    ('FRT-1500', 'ปุ๋ยเกร็ดสูตรตัวหน้าสูง 15-0-0'),
    ('FRT-301010', 'ปุ๋ยเกร็ดสูตรตัวหน้าสูง 30-10-10'),
    ('FRT-302010', 'ปุ๋ยเกร็ดสูตรตัวหน้าสูง 30-20-10')
) as f(sku, formula)
join public.products p on p.sku = f.sku
on conflict do nothing;

insert into public.stage_products (stage_id, product_id, formula, sequence)
select 'stage_10', p.id, f.formula, 1
from (
  values
    ('FRT-212121', 'ปุ๋ยเกร็ดสูตรเสมอ 21-21-21'),
    ('FRT-202020', 'ปุ๋ยเกร็ดสูตรเสมอ 20-20-20')
) as f(sku, formula)
join public.products p on p.sku = f.sku
on conflict do nothing;

insert into public.stage_products (stage_id, product_id, formula, sequence)
select 'stage_11', p.id, f.formula, 1
from (
  values
    ('FRT-131321', 'ปุ๋ยเกร็ดสูตรตัวท้ายสูง 13-13-21'),
    ('FRT-82424', 'สูตรเร่งคุณภาพผล 8-24-24')
) as f(sku, formula)
join public.products p on p.sku = f.sku
on conflict do nothing;

insert into public.stage_products (stage_id, product_id, formula, sequence)
select 'stage_12', p.id, 'เชื้อราตัวขัดผิว', 1
from public.products p where p.sku = 'BIO-SKIN'
on conflict do nothing;

-- ============================================================
-- Seed: store_settings (single row)
-- ============================================================
insert into public.store_settings (id, store_name, store_address, store_phone, tax_id, footer_text)
values (
  1,
  'ปุ๋ยไทย CRM',
  '123 ถนนเกษตร ต.ในเมือง อ.เมือง จ.ขอนแก่น 40000',
  '043-123-456',
  null,
  null
)
on conflict (id) do nothing;

-- ============================================================
-- Seed: promotions (3 รายการตัวอย่าง)
-- ============================================================
insert into public.promotions (name, kind, value, scope_type, scope, start_date, end_date, budget, priority, status, note)
values
  ('ลดปุ๋ยอินทรีย์ต้อนรับฤดูฝน', 'ส่วนลด', '-10%', 'category', 'ปุ๋ยอินทรีย์', '2026-06-01', '2026-09-30', 500, 2, 'active', 'ลด 10% สำหรับปุ๋ยอินทรีย์ทุกรายการ'),
  ('คูปองส่วนลด 200 บาท', 'คูปอง', '฿200', 'all', 'ทั้งหมด', '2026-06-01', '2026-12-31', 1000, 3, 'active', 'ใช้ได้กับยอดขั้นต่ำ 1,000 บาท'),
  ('ชุดบำรุงลำไย 3 ระยะ', 'ชุดสินค้า', '฿1,290', 'product', 'HRM-AMINO+FRT-301010+CHL-KCLO3', '2026-06-01', '2026-12-31', 200, 1, 'active', 'ชุดสินค้า 3 ชิ้น ราคาพิเศษ')
on conflict do nothing;

-- ============================================================
-- Sync warehouse aggregate ครั้งแรก (ทำตรง ๆ เพราะ recalc_warehouse_main เป็น trigger function)
-- ============================================================
insert into public.warehouses (id, name, items, value, capacity)
values (
  'wh1',
  'คลังหลัก',
  coalesce((select sum(stock) from public.products where deleted_at is null), 0),
  coalesce((select sum(stock * cost) from public.products where deleted_at is null), 0),
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

-- ============================================================
-- เสร็จแล้ว — รัน schema นี้ครั้งเดียวใน SQL Editor
-- ตาราง: products, warehouses, stock_movements, customers, cultivations,
--        orders, order_items, activities, notifications, crop_stages,
--        stage_products, cultivation_schedules, care_program_rounds,
--        care_program_groups, care_program_options, store_settings, promotions
-- Views: v_warehouse_summary, v_sales_by_day, v_revenue_trend, v_top_products,
--        v_best_customers, v_dashboard_stats, v_profit_by_day, v_profit_by_month,
--        v_expiring_products, v_cultivation_next_round
-- RPCs: record_stock_movement, create_sale_transaction, delete_product_safe,
--        increment_promotion_used, record_care_atomic, notify_expiring_products
-- ============================================================
