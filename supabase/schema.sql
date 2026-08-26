-- ============================================================ 
-- Fieldstone ERP — Supabase schema (รวมทุกตาราง)
-- รันใน Supabase Dashboard → SQL Editor (รันครั้งเดียว)
-- ============================================================ 

-- Extensions
create extension if not exists "pgcrypto";

-- ============================================================
-- 1) products
-- ============================================================
create table if not exists public.products (
  id          text primary key,
  name        text not null,
  sku         text not null unique,
  barcode     text,
  category    text not null,
  brand       text not null default 'ไม่ระบุ',
  price       numeric(12,2) not null default 0,
  cost        numeric(12,2) not null default 0,
  stock       integer not null default 0,
  min_stock   integer not null default 0,
  unit        text not null default 'ชิ้น',
  status      text not null default 'active'
              check (status in ('active','low','out','discontinued')),
  emoji       text not null default '📦',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- trigger: อัปเดต updated_at อัตโนมัติ
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_products_updated on public.products;
create trigger trg_products_updated
  before update on public.products
  for each row execute function public.touch_updated_at();

-- trigger: คำนวณ status จาก stock/min_stock อัตโนมัติ
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

drop trigger if exists trg_products_status on public.products;
create trigger trg_products_status
  before insert or update of stock, min_stock on public.products
  for each row execute function public.calc_product_status();

-- ============================================================
-- 2) warehouses
-- ============================================================
create table if not exists public.warehouses (
  id        text primary key,
  name      text not null unique,
  items     integer not null default 0,
  value     numeric(14,2) not null default 0,
  capacity  integer not null default 0  -- เปอร์เซ็นต์การใช้งาน 0-100
);

-- ============================================================
-- 3) stock_movements
-- ============================================================
create table if not exists public.stock_movements (
  id          uuid primary key default gen_random_uuid(),
  code        text not null,
  type        text not null check (type in ('รับเข้า','จ่ายออก','ปรับปรุง','โอนย้าย')),
  product_id  text references public.products(id) on delete set null,
  product_name text not null,
  qty         integer not null,           -- บวก=รับเข้า, ลบ=จ่ายออก
  warehouse   text not null,
  by_user     text not null default 'admin',
  note        text,
  status      text not null default 'completed'
              check (status in ('completed','pending','draft')),
  created_at  timestamptz not null default now(),
  date        date not null default current_date
);

create index if not exists idx_movements_type on public.stock_movements(type);
create index if not exists idx_movements_product on public.stock_movements(product_id);
create index if not exists idx_movements_date on public.stock_movements(date desc);

-- ============================================================
-- Row Level Security
-- ============================================================
alter table public.products        enable row level security;
alter table public.warehouses      enable row level security;
alter table public.stock_movements enable row level security;

-- อนุญาตทุกอย่างสำหรับ anon (single-user app, ไม่มี role)
drop policy if exists "anon all products"   on public.products;
drop policy if exists "anon all warehouses" on public.warehouses;
drop policy if exists "anon all movements"  on public.stock_movements;

create policy "anon all products"   on public.products   for all using (true) with check (true);
create policy "anon all warehouses" on public.warehouses for all using (true) with check (true);
create policy "anon all movements"  on public.stock_movements for all using (true) with check (true);

-- ============================================================
-- Seed: warehouses
-- ============================================================
insert into public.warehouses (id, name, items, value, capacity) values
  ('wh1', 'คลังหลัก',    1284, 3420000, 78)
on conflict (name) do nothing;

-- ============================================================
-- Seed: products (16 รายการจาก mock)
-- ============================================================
insert into public.products (id, name, sku, barcode, category, brand, price, cost, stock, min_stock, unit, emoji) values
  ('p1',  'ปุ๋ยยูเรีย 46-0-0',         'FRT-4600',   '8850001', 'ปุ๋ยเคมี',         'ตราหัววัว', 780, 640, 320, 60, 'ชิ้น', '🌾'),
  ('p2',  'ปุ๋ยสูตร 15-15-15',          'FRT-1515',   '8850002', 'ปุ๋ยเคมี',         'ตรากระต่าย', 920, 760, 148, 50, 'ชิ้น', '🌱'),
  ('p3',  'ปุ๋ยสูตร 16-20-0',           'FRT-1620',   '8850003', 'ปุ๋ยเคมี',         'ตราหัววัว', 850, 700,  32, 40, 'ชิ้น', '🌿'),
  ('p4',  'ปุ๋ยคอกมูลไก่อัดเม็ด',        'ORG-CHK1',   '8850004', 'ปุ๋ยอินทรีย์',     'ไร่ทองดี',   240, 170, 512, 80, 'ชิ้น', '🐔'),
  ('p5',  'ปุ๋ยหมักชีวภาพ 25 กก.',       'ORG-BIO25',  '8850005', 'ปุ๋ยอินทรีย์',     'กรีนฟาร์ม',  310, 220,   0, 40, 'ชิ้น', '♻️'),
  ('p6',  'ไกลโฟเซต 1 ลิตร',            'PST-GLY1',   '8850006', 'ยาปราบศัตรูพืช',   'อะกริโปร',   320, 245,  96, 30, 'ชิ้น', '🧴'),
  ('p7',  'อะบาเม็กติน 500 มล.',        'PST-ABA5',   '8850007', 'ยาปราบศัตรูพืช',   'อะกริโปร',   285, 210,  18, 25, 'ชิ้น', '🧪'),
  ('p8',  'เมล็ดข้าวโพดหวาน',           'SED-CRN1',   '8850008', 'เมล็ดพันธุ์',       'ซีดโปร',     145,  98, 240, 50, 'ชิ้น', '🌽'),
  ('p9',  'เมล็ดพันธุ์ข้าว กข.43',       'SED-RIC43',  '8850009', 'เมล็ดพันธุ์',       'ซีดโปร',     620, 480,  74, 30, 'ชิ้น', '🍚'),
  ('p10', 'เครื่องพ่นยาสะพายหลัง',       'EQP-SPR20',  '8850010', 'อุปกรณ์การเกษตร',  'ฟาร์มเทค',  1850,1420,  22, 10, 'ชิ้น', '🎒'),
  ('p11', 'สายยางเกษตร 20 ม.',          'EQP-HOSE20', '8850011', 'อุปกรณ์การเกษตร',  'ฟาร์มเทค',   480, 350,  61, 15, 'ชิ้น', '🪢'),
  ('p12', 'ฮอร์โมนไข่ 1 ลิตร',           'HRM-EGG1',   '8850012', 'ฮอร์โมนพืช',       'กรีนฟาร์ม',  260, 180, 130, 30, 'ชิ้น', '🥚'),
  ('p13', 'สาหร่ายสกัดเข้มข้น',          'HRM-SEA5',   '8850013', 'ฮอร์โมนพืช',       'กรีนฟาร์ม',  390, 300,  12, 20, 'ชิ้น', '🌊'),
  ('p14', 'ปุ๋ยเกล็ดละลายน้ำ',           'FRT-WSF1',   '8850014', 'ปุ๋ยเคมี',         'ตรากระต่าย', 430, 330, 205, 40, 'ชิ้น', '💧'),
  ('p15', 'กับดักแมลงกาวเหนียว',        'PST-TRAP',   '8850015', 'ยาปราบศัตรูพืช',   'อะกริโปร',    65,  38, 640,100, 'ชิ้น', '🪤'),
  ('p16', 'ถุงเพาะชำ 100 ใบ',           'EQP-BAG100', '8850016', 'อุปกรณ์การเกษตร',  'ฟาร์มเทค',    95,  60, 380, 60, 'ชิ้น', '🛍️')
on conflict (sku) do nothing;

-- ============================================================
-- Seed: stock_movements (ตัวอย่าง 18 รายการ)
-- หมายเหตุ: ตารางนี้ PK เป็น uuid จึงใช้ `on conflict` กันซ้ำไม่ได้
-- ต้องใช้ `where not exists` เพื่อให้รัน schema ซ้ำได้โดยไม่เพิ่มข้อมูลซ้ำ
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
-- View: สรุปสต็อกตามคลัง (ใช้ใน dashboard)
-- ============================================================
create or replace view public.v_warehouse_summary as
select
  w.id,
  w.name,
  w.capacity,
  count(distinct sm.product_id) filter (where sm.type in ('รับเข้า','ปรับปรุง','โอนย้าย')) as items_in,
  count(distinct sm.product_id) filter (where sm.type = 'จ่ายออก') as items_out,
  coalesce(sum(sm.qty), 0) as net_qty
from public.warehouses w
left join public.stock_movements sm on sm.warehouse = w.name
group by w.id, w.name, w.capacity;

-- ============================================================
-- เสร็จแล้ว — ตารางที่สร้าง: products, warehouses, stock_movements
-- รัน schema นี้ครั้งเดียวใน SQL Editor แล้วข้อมูลจะพร้อมใช้
-- ============================================================

-- ============================================================ 
-- Part 2: customers + orders + activity
-- ============================================================ 

-- ============================================================
-- 1) customers
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

drop trigger if exists trg_customers_updated on public.customers;
create trigger trg_customers_updated
  before update on public.customers
  for each row execute function public.touch_updated_at();

-- ============================================================
-- 2) cultivations (แปลงเพาะปลูกของลูกค้า)
-- ============================================================
create table if not exists public.cultivations (
  id               text primary key,
  customer_id      text not null references public.customers(id) on delete cascade,
  crop             text not null,
  stage            text not null default 'เตรียมดิน'
                   check (stage in (
                     'เตรียมดิน','ปลูก','ดูแล/บำรุง','ออกดอก/ติดผล','เก็บเกี่ยว',
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
  area             numeric(8,2) not null default 0,   -- ไร่
  planted_date     date,
  expected_harvest date,
  location         text not null default '',
  note             text,
  created_at       timestamptz not null default now()
);

create index if not exists idx_cultivations_customer on public.cultivations(customer_id);

-- ============================================================
-- 3) orders
-- ============================================================
create table if not exists public.orders (
  id           text primary key,
  code         text not null unique,
  customer_id  text references public.customers(id) on delete set null,
  customer_name text not null,
  order_date   timestamptz not null default now(),
  date         date not null default current_date,
  total        numeric(14,2) not null default 0,
  items        integer not null default 0,
  status       text not null default 'pending'
               check (status in ('paid','pending','processing','cancelled','refunded')),
  channel      text not null default 'POS'
               check (channel in ('POS','Online','Sales Rep')),
  salesperson  text not null default 'admin',
  payment      text not null default 'เงินสด'
               check (payment in ('เงินสด','โอนเงิน','บัตรเครดิต','QR PromptPay','เครดิต 30 วัน')),
  created_at   timestamptz not null default now()
);

create index if not exists idx_orders_customer on public.orders(customer_id);
create index if not exists idx_orders_date on public.orders(date desc);
create index if not exists idx_orders_status on public.orders(status);

-- ============================================================
-- 4) order_items
-- ============================================================
create table if not exists public.order_items (
  id          uuid primary key default gen_random_uuid(),
  order_id    text not null references public.orders(id) on delete cascade,
  product_id  text references public.products(id) on delete set null,
  product_name text not null,
  qty         integer not null default 1,
  price       numeric(12,2) not null default 0,
  cost        numeric(12,2) not null default 0,
  subtotal    numeric(14,2) not null default 0
);

create index if not exists idx_order_items_order on public.order_items(order_id);
create index if not exists idx_order_items_product on public.order_items(product_id);

-- ============================================================
-- 5) activities (ไทม์ไลน์กิจกรรม)
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
-- 6) notifications
-- ============================================================
create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  description text not null default '',
  unread      boolean not null default true,
  -- ปลายทางเมื่อกดที่การแจ้งเตือน เช่น '/products?status=low'
  link        text,
  created_at  timestamptz not null default now()
);

-- เพิ่มคอลัมน์ให้ตารางที่สร้างไว้ก่อนหน้า (create table if not exists จะไม่เพิ่มคอลัมน์ให้)
alter table public.notifications add column if not exists link text;

create index if not exists idx_notifications_created on public.notifications(created_at desc);

-- ============================================================
-- Row Level Security
-- ============================================================
alter table public.customers      enable row level security;
alter table public.cultivations   enable row level security;
alter table public.orders         enable row level security;
alter table public.order_items    enable row level security;
alter table public.activities     enable row level security;
alter table public.notifications  enable row level security;

drop policy if exists "anon all customers"      on public.customers;
drop policy if exists "anon all cultivations"   on public.cultivations;
drop policy if exists "anon all orders"         on public.orders;
drop policy if exists "anon all order_items"    on public.order_items;
drop policy if exists "anon all activities"     on public.activities;
drop policy if exists "anon all notifications"  on public.notifications;

create policy "anon all customers"      on public.customers      for all using (true) with check (true);
create policy "anon all cultivations"   on public.cultivations   for all using (true) with check (true);
create policy "anon all orders"         on public.orders         for all using (true) with check (true);
create policy "anon all order_items"    on public.order_items    for all using (true) with check (true);
create policy "anon all activities"     on public.activities     for all using (true) with check (true);
create policy "anon all notifications"  on public.notifications  for all using (true) with check (true);

-- ============================================================
-- Views สำหรับแดชบอร์ด
-- ============================================================

-- สรุปยอดขายรายวัน (7 วันล่าสุด)
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

-- สรุปรายได้รายเดือน (8 เดือนล่าสุด)
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

-- สินค้าขายดี (top 5 ตามยอดขาย)
create or replace view public.v_top_products as
select
  p.id, p.name, p.sku, p.category, p.brand, p.price, p.cost,
  p.stock, p.min_stock, p.unit, p.status, p.emoji,
  coalesce(sum(oi.qty), 0) as sold,
  coalesce(sum(oi.subtotal), 0) as revenue
from public.products p
left join public.order_items oi on oi.product_id = p.id
left join public.orders o on oi.order_id = o.id and o.status not in ('cancelled','refunded')
group by p.id, p.name, p.sku, p.category, p.brand, p.price, p.cost,
         p.stock, p.min_stock, p.unit, p.status, p.emoji
order by sold desc
limit 5;

-- ลูกค้ายอดสูง (top 5)
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

-- สถิติแดชบอร์ดหลัก
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
  -- กำไรรวมวันนี้ (ยอดขาย - ต้นทุนสินค้าขาย)
  (select coalesce(sum(oi.subtotal - (oi.qty * oi.cost)), 0)
     from public.order_items oi
     join public.orders o on oi.order_id = o.id
     where o.date = current_date and o.status not in ('cancelled','refunded')) as today_profit,
  -- กำไรรวมเดือนนี้
  (select coalesce(sum(oi.subtotal - (oi.qty * oi.cost)), 0)
     from public.order_items oi
     join public.orders o on oi.order_id = o.id
     where date_trunc('month', o.date) = date_trunc('month', current_date)
       and o.status not in ('cancelled','refunded')) as month_profit,
  -- ต้นทุนสินค้าขายเดือนนี้ (COGS)
  (select coalesce(sum(oi.qty * oi.cost), 0)
     from public.order_items oi
     join public.orders o on oi.order_id = o.id
     where date_trunc('month', o.date) = date_trunc('month', current_date)
       and o.status not in ('cancelled','refunded')) as month_cogs;

-- กำไรรายวัน (7 วันล่าสุด)
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

-- กำไรรายเดือน (8 เดือนล่าสุด)
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
-- Seed: cultivations
-- ============================================================
insert into public.cultivations (id, customer_id, crop, stage, area, planted_date, expected_harvest, location, note) values
  ('cul-1-1',  'c1',  'ข้าว กข.43',    'ดูแล/บำรุง',     5,  '2026-01-01', '2026-05-15', 'แปลงหลังบ้าน',     'เริ่มใส่ปุ๋ยสูตร 15-15-15 แล้ว'),
  ('cul-1-2',  'c1',  'ข้าวโพดหวาน',  'ปลูก',           8,  '2026-02-15', '2026-05-01', 'แปลงทุ่งนา',        null),
  ('cul-2-1',  'c2',  'ข้าว กข.49',    'ออกดอก/ติดผล',   12, '2025-11-01', '2026-03-15', 'แปลงสวน',           null),
  ('cul-3-1',  'c3',  'อ้อย',          'เตรียมดิน',       25, '2026-07-01', '2027-05-15', 'แปลงเช่า',          null),
  ('cul-3-2',  'c3',  'มันสำปะหลัง',   'ปลูก',           18, '2026-06-01', '2026-09-15', 'แปลงหัวไร่ปลายทุ่ง', null),
  ('cul-3-3',  'c3',  'ข้าว กข.43',    'ดูแล/บำรุง',     30, '2026-01-15', '2026-05-30', 'แปลงทุ่งนา',        null),
  ('cul-4-1',  'c4',  'ยางพารา',       'ออกดอก/ติดผล',   10, '2025-10-01', '2027-04-15', 'แปลงสวน',           null),
  ('cul-4-2',  'c4',  'ข้าวโพดหวาน',  'เก็บเกี่ยว',      6,  '2026-05-01', '2026-07-15', 'แปลงหลังบ้าน',      null),
  ('cul-6-1',  'c6',  'ปาล์มน้ำมัน',    'ดูแล/บำรุง',     15, '2025-09-01', '2027-01-15', 'แปลงเช่า',          null),
  ('cul-6-2',  'c6',  'ถั่วเหลือง',    'ปลูก',           4,  '2026-06-15', '2026-08-25', 'แปลงหัวไร่ปลายทุ่ง', null),
  ('cul-9-1',  'c9',  'พริก',          'ออกดอก/ติดผล',    3,  '2026-04-01', '2026-07-15', 'แปลงหลังบ้าน',      null),
  ('cul-10-1', 'c10', 'ข้าว กข.43',    'ดูแล/บำรุง',      7,  '2026-01-20', '2026-05-30', 'แปลงทุ่งนา',        null),
  ('cul-10-2', 'c10', 'มะเขือเทศ',     'ปลูก',            2,  '2026-06-01', '2026-08-20', 'แปลงสวน',           null),
  ('cul-12-1', 'c12', 'ยางพารา',       'เก็บเกี่ยว',     40, '2025-08-01', '2027-02-15', 'แปลงเช่า',          null),
  ('cul-12-2', 'c12', 'ปาล์มน้ำมัน',    'ดูแล/บำรุง',     22, '2025-07-01', '2027-01-15', 'แปลงหัวไร่ปลายทุ่ง', null),
  ('cul-12-3', 'c12', 'ข้าว กข.49',    'ออกดอก/ติดผล',   15, '2025-12-01', '2026-04-15', 'แปลงทุ่งนา',        null)
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
-- Seed: order_items (2-7 รายการต่อ order)
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
-- กันซ้ำแบบเจาะจงคู่ (order_id, product_id)
where not exists (
  select 1 from public.order_items oi
  where oi.order_id = 'o' || (i + 1)::text
    and oi.product_id = 'p' || ((i % 16) + 1)::text
);

-- เพิ่ม order item ที่ 2 สำหรับบาง order
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

-- เติม link ให้แถวเดิมที่ยังว่าง (กรณีสร้างตารางไว้ก่อนจะมีคอลัมน์นี้)
update public.notifications set link = '/products?status=low'  where link is null and title like 'สินค้าใกล้หมด%';
update public.notifications set link = '/sales?status=pending' where link is null and title like 'ใบสั่งซื้อรออนุมัติ%';
update public.notifications set link = '/promotions'           where link is null and title like 'โปรโมชันจะหมดอายุ%';
update public.notifications set link = '/sales'                where link is null and title like 'ยอดขายเดือนนี้%';

-- ============================================================
-- เสร็จแล้ว — ตารางที่สร้าง: customers, cultivations, orders, order_items, activities, notifications
-- Views: v_sales_by_day, v_revenue_trend, v_top_products, v_best_customers, v_dashboard_stats
-- ============================================================
