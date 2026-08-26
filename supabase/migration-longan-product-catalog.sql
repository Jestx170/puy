-- ============================================================
-- Fieldstone ERP — Longan product catalog + stage mapping
-- เพิ่มสินค้า "ชุดลำไย" และ map เข้ากับโปรแกรมดูแล 12 ระยะแบบใช้งานจริง
-- รันหลัง migration-cultivation-stages.sql
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 1) เพิ่ม/อัปเดตสินค้าในตาราง products
-- ------------------------------------------------------------
insert into public.products (
  id, name, sku, barcode, category, brand, price, cost, stock, min_stock, unit, emoji
) values
  ('lp01', 'สาหร่ายอะมิโนเข้มข้น', 'HRM-AMINO', '8901001', 'ฮอร์โมนพืช', 'LonganPro', 420, 310, 120, 20, 'ชิ้น', '🌊'),
  ('lp02', 'ปุ๋ยเกร็ดสูตร 15-0-0', 'FRT-1500', '8901002', 'ปุ๋ยเคมี', 'LonganPro', 560, 430, 90, 15, 'ชิ้น', '🧪'),
  ('lp03', 'ปุ๋ยเกร็ดสูตร 30-10-10', 'FRT-301010', '8901003', 'ปุ๋ยเคมี', 'LonganPro', 620, 480, 95, 15, 'ชิ้น', '🧪'),
  ('lp04', 'ปุ๋ยเกร็ดสูตร 30-20-10', 'FRT-302010', '8901004', 'ปุ๋ยเคมี', 'LonganPro', 640, 500, 88, 15, 'ชิ้น', '🧪'),
  ('lp05', 'ธาตุอาหารรองเสริมรวม', 'NUT-MICRO', '8901005', 'ธาตุอาหารรอง', 'LonganPro', 390, 290, 70, 12, 'ชิ้น', '🧬'),
  ('lp06', 'ปุ๋ยเกร็ดสูตร 21-21-21', 'FRT-212121', '8901006', 'ปุ๋ยเคมี', 'LonganPro', 590, 460, 80, 12, 'ชิ้น', '🧪'),
  ('lp07', 'ปุ๋ยเกร็ดสูตร 20-20-20', 'FRT-202020', '8901007', 'ปุ๋ยเคมี', 'LonganPro', 570, 445, 82, 12, 'ชิ้น', '🧪'),
  ('lp08', 'ปุ๋ยเกร็ดสูตร 4-24-24', 'FRT-42424', '8901008', 'ปุ๋ยเคมี', 'LonganPro', 610, 475, 60, 10, 'ชิ้น', '🧪'),
  ('lp09', 'ปุ๋ยเกร็ดสูตร 8-24-24', 'FRT-82424', '8901009', 'ปุ๋ยเคมี', 'LonganPro', 615, 480, 58, 10, 'ชิ้น', '🧪'),
  ('lp10', 'แมกนีเซียมเสริมใบ', 'MIN-MG', '8901010', 'ธาตุอาหารรอง', 'LonganPro', 350, 260, 66, 10, 'ชิ้น', '🧂'),
  ('lp11', 'ปุ๋ยเกร็ดสูตร 0-52-34', 'FRT-05234', '8901011', 'ปุ๋ยเคมี', 'LonganPro', 680, 530, 64, 10, 'ชิ้น', '🧪'),
  ('lp12', 'โพแทสเซียมคลอเรต', 'CHL-KCLO3', '8901012', 'สารควบคุมการออกดอก', 'LonganPro', 780, 620, 54, 8, 'ชิ้น', '⚗️'),
  ('lp13', 'โซเดียมคลอเรต', 'CHL-NACLO3', '8901013', 'สารควบคุมการออกดอก', 'LonganPro', 760, 600, 52, 8, 'ชิ้น', '⚗️'),
  ('lp14', 'เสือดอก', 'BLOOM-TIGER', '8901014', 'สารบำรุงพืช', 'LonganPro', 490, 370, 45, 8, 'ชิ้น', '🌸'),
  ('lp15', 'ยาเปิดตาดอก', 'BLOOM-OPEN', '8901015', 'สารบำรุงพืช', 'LonganPro', 520, 390, 44, 8, 'ชิ้น', '🌸'),
  ('lp16', 'ปุ๋ยเกร็ดสูตร 6-12-36', 'FRT-61236', '8901016', 'ปุ๋ยเคมี', 'LonganPro', 650, 510, 57, 10, 'ชิ้น', '🧪'),
  ('lp17', 'ปุ๋ยเกร็ดสูตร 10-52-17', 'FRT-105217', '8901017', 'ปุ๋ยเคมี', 'LonganPro', 690, 545, 62, 10, 'ชิ้น', '🧪'),
  ('lp18', 'ตัวผสมเกสร ไดมอนด์', 'POL-DIAMOND', '8901018', 'สารบำรุงพืช', 'LonganPro', 460, 345, 36, 6, 'ชิ้น', '💎'),
  ('lp19', 'ปุ๋ยเกร็ดสูตรตัวท้ายสูง 13-13-21', 'FRT-131321', '8901019', 'ปุ๋ยเคมี', 'LonganPro', 640, 500, 55, 10, 'ชิ้น', '🧪'),
  ('lp20', 'เชื้อราตัวขัดผิว', 'BIO-SKIN', '8901020', 'ชีวภัณฑ์', 'LonganPro', 540, 410, 40, 8, 'ชิ้น', '🦠')
on conflict (sku) do update set
  name = excluded.name,
  category = excluded.category,
  brand = excluded.brand,
  price = excluded.price,
  cost = excluded.cost,
  min_stock = excluded.min_stock,
  unit = excluded.unit,
  emoji = excluded.emoji;

-- ------------------------------------------------------------
-- 2) รีเซ็ต mapping stage_products ของลำไย แล้วใส่ใหม่ตามตารางดูแล
-- ------------------------------------------------------------
delete from public.stage_products
where stage_id in (
  'stage_01','stage_02','stage_03','stage_04','stage_05','stage_06',
  'stage_07','stage_08','stage_09','stage_10','stage_11','stage_12'
);

-- stage_01: เตรียมต้นหลังเก็บเกี่ยว (3 ครั้ง, สูตรไม่เหมือนกัน)
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
join public.products p on p.sku = f.sku;

-- stage_02: แตกใบอ่อน ใบแรก
insert into public.stage_products (stage_id, product_id, formula, sequence)
select 'stage_02', p.id, f.formula, 1
from (
  values
    ('NUT-MICRO', 'ธาตุอาหารรองเสริม'),
    ('FRT-212121', 'ปุ๋ยเกร็ดสูตรเสมอ 21-21-21'),
    ('FRT-202020', 'ปุ๋ยเกร็ดสูตรเสมอ 20-20-20')
) as f(sku, formula)
join public.products p on p.sku = f.sku;

-- stage_03: แตกใบอ่อน ใบสอง (4 ครั้ง สูตรไม่ซ้ำ)
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
join public.products p on p.sku = f.sku;

-- stage_04: ราดสาร (ทางใบ 3 ครั้ง + ทางดิน 1 ครั้ง)
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
join public.products p on p.sku = f.sku;

-- stage_05: เปิดตาดอก
insert into public.stage_products (stage_id, product_id, formula, sequence)
select 'stage_05', p.id, f.formula, 1
from (
  values
    ('BLOOM-TIGER', 'เสือดอก'),
    ('BLOOM-OPEN', 'ยาเปิดตาดอก'),
    ('FRT-61236', 'ปุ๋ยเกร็ดสูตร 6-12-36')
) as f(sku, formula)
join public.products p on p.sku = f.sku;

-- stage_06: ยืดช่อดอก
insert into public.stage_products (stage_id, product_id, formula, sequence)
select 'stage_06', p.id, 'ปุ๋ยเกร็ดสูตร 10-52-17', 1
from public.products p
where p.sku = 'FRT-105217';

-- stage_07: บำรุงช่อดอก
insert into public.stage_products (stage_id, product_id, formula, sequence)
select 'stage_07', p.id, 'ปุ๋ยเกร็ดสูตร 10-52-17', 1
from public.products p
where p.sku = 'FRT-105217';

-- stage_08: ดอกบาน
insert into public.stage_products (stage_id, product_id, formula, sequence)
select 'stage_08', p.id, 'ตัวผสมเกสร (ไดมอนด์)', 1
from public.products p
where p.sku = 'POL-DIAMOND';

-- stage_09: ลูกเล็ก (ตัวหน้าสูง)
insert into public.stage_products (stage_id, product_id, formula, sequence)
select 'stage_09', p.id, f.formula, 1
from (
  values
    ('FRT-1500', 'ปุ๋ยเกร็ดสูตรตัวหน้าสูง 15-0-0'),
    ('FRT-301010', 'ปุ๋ยเกร็ดสูตรตัวหน้าสูง 30-10-10'),
    ('FRT-302010', 'ปุ๋ยเกร็ดสูตรตัวหน้าสูง 30-20-10')
) as f(sku, formula)
join public.products p on p.sku = f.sku;

-- stage_10: ลูกมะเขือพวง (สูตรเสมอ)
insert into public.stage_products (stage_id, product_id, formula, sequence)
select 'stage_10', p.id, f.formula, 1
from (
  values
    ('FRT-212121', 'ปุ๋ยเกร็ดสูตรเสมอ 21-21-21'),
    ('FRT-202020', 'ปุ๋ยเกร็ดสูตรเสมอ 20-20-20')
) as f(sku, formula)
join public.products p on p.sku = f.sku;

-- stage_11: ลูกแก้ว (ตัวท้ายสูง)
insert into public.stage_products (stage_id, product_id, formula, sequence)
select 'stage_11', p.id, f.formula, 1
from (
  values
    ('FRT-131321', 'ปุ๋ยเกร็ดสูตรตัวท้ายสูง 13-13-21'),
    ('FRT-82424', 'สูตรเร่งคุณภาพผล 8-24-24')
) as f(sku, formula)
join public.products p on p.sku = f.sku;

-- stage_12: ก่อนเก็บ
insert into public.stage_products (stage_id, product_id, formula, sequence)
select 'stage_12', p.id, 'เชื้อราตัวขัดผิว', 1
from public.products p
where p.sku = 'BIO-SKIN';

commit;

-- ------------------------------------------------------------
-- ตรวจสอบหลังรัน
-- ------------------------------------------------------------
-- select stage_id, sequence, count(*) as items
-- from public.stage_products
-- where stage_id like 'stage_%'
-- group by stage_id, sequence
-- order by stage_id, sequence;
