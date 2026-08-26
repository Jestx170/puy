-- ============================================================
-- Fieldstone ERP — Cultivation stages (โปรแกรมการดูแลลำไย 12 ระยะ)
-- รันใน Supabase Dashboard → SQL Editor (รันซ้ำได้ ใช้ on conflict)
-- ============================================================

-- ============================================================
-- 1) crop_stages — ระยะการเจริญเติบโต
-- ============================================================
create table if not exists public.crop_stages (
  id             text primary key,
  name           text not null,
  emoji          text not null,
  description    text,
  days_min       integer,           -- จำนวนวันน้อยสุดของระยะนี้
  days_max       integer,           -- จำนวนวันมากสุดของระยะนี้
  frequency_days integer,           -- ความถี่ (วัน/ครั้ง) เช่น 15 = ทุก 15 วัน
  sort_order     integer not null,  -- ลำดับแสดง
  crop_type      text not null default 'ลำไย',
  created_at     timestamptz not null default now()
);

create index if not exists idx_crop_stages_type on public.crop_stages(crop_type, sort_order);

-- ============================================================
-- 2) stage_products — สินค้าที่ใช้ในแต่ละระยะ
-- ============================================================
create table if not exists public.stage_products (
  id          uuid primary key default gen_random_uuid(),
  stage_id    text not null references public.crop_stages(id) on delete cascade,
  product_id  text references public.products(id) on delete cascade,
  formula     text,                 -- สูตร/รายละเอียด เช่น "15-0-0 เน้นดันใบ"
  sequence    integer not null default 1,  -- ลำดับในระยะ (ถ้ามีหลายครั้ง)
  is_optional boolean not null default false,
  created_at  timestamptz not null default now()
);

create index if not exists idx_stage_products_stage on public.stage_products(stage_id, sequence);

-- ============================================================
-- 3) cultivation_schedules — ประวัติการดูแลจริง (เก็บว่าทำอะไรไปแล้ว)
-- ============================================================
create table if not exists public.cultivation_schedules (
  id             uuid primary key default gen_random_uuid(),
  cultivation_id text not null references public.cultivations(id) on delete cascade,
  stage_id       text not null references public.crop_stages(id),
  product_id     text references public.products(id) on delete set null,
  action_date    date not null default current_date,
  sequence       integer not null default 1,  -- ครั้งที่เท่าไรใน stage นี้
  notes          text,
  created_at     timestamptz not null default now()
);

create index if not exists idx_schedules_cultivation
  on public.cultivation_schedules(cultivation_id, action_date desc);
create index if not exists idx_schedules_stage
  on public.cultivation_schedules(stage_id);

-- ============================================================
-- 4) เพิ่มคอลัมน์ใน cultivations
-- ============================================================
alter table public.cultivations add column if not exists stage_id text references public.crop_stages(id);
alter table public.cultivations add column if not exists current_sequence integer default 0;

-- อัปเดต CHECK constraint ของคอลัมน์ stage ให้รองรับระยะลำไย 12 ระยะ
-- (ของเดิมรับแค่ 5 ช่วงแบบทั่วไป ทำให้บันทึกแปลงลำไยไม่ผ่าน)
alter table public.cultivations drop constraint if exists cultivations_stage_check;
alter table public.cultivations
  add constraint cultivations_stage_check
  check (
    stage in (
      -- generic 5 ช่วง (ของเดิม)
      'เตรียมดิน','ปลูก','ดูแล/บำรุง','ออกดอก/ติดผล','เก็บเกี่ยว',
      -- longan 12 ระยะ (ใหม่)
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
    )
  );

-- ============================================================
-- 5) Row Level Security
-- ============================================================
alter table public.crop_stages          enable row level security;
alter table public.stage_products       enable row level security;
alter table public.cultivation_schedules enable row level security;

drop policy if exists "anon all crop_stages"          on public.crop_stages;
drop policy if exists "anon all stage_products"       on public.stage_products;
drop policy if exists "anon all cultivation_schedules" on public.cultivation_schedules;

create policy "anon all crop_stages"          on public.crop_stages          for all using (true) with check (true);
create policy "anon all stage_products"       on public.stage_products       for all using (true) with check (true);
create policy "anon all cultivation_schedules" on public.cultivation_schedules for all using (true) with check (true);

-- ============================================================
-- 6) Seed: ระยะการเจริญเติบโต 12 ระยะ (ลำไย)
-- ============================================================
insert into public.crop_stages (id, name, emoji, description, days_min, days_max, frequency_days, sort_order) values
  ('stage_01', 'เตรียมต้นหลังเก็บเกี่ยว',        '🌱', 'ช่วงเวลา: 45-60 วัน (ทุก 15 วัน)', 45, 60, 15, 1),
  ('stage_02', 'แตกใบอ่อน ใบแรก',              '🌿', 'ช่วงเวลา: 10-15 วัน (1 ครั้ง)', 10, 15, null, 2),
  ('stage_03', 'แตกใบอ่อน ใบสอง',              '🍃', 'ช่วงเวลารวม: 20-30 วัน (ทุก 7 วัน)', 20, 30, 7, 3),
  ('stage_04', 'ราดสาร (สารควบคุมการออกดอก)',  '💀', 'ช่วงเวลา: กรอบ 10 วัน', null, 10, null, 4),
  ('stage_05', 'เปิดตาดอก',                   '🌸', 'ช่วงเวลา: 10-14 วัน (ทุก 5-7 วัน)', 10, 14, 6, 5),
  ('stage_06', 'ยืดช่อดอก',                   '🌺', 'ช่วงเวลา: 10-14 วัน (ทุก 5-7 วัน)', 10, 14, 6, 6),
  ('stage_07', 'บำรุงช่อดอก',                 '🌷', 'ช่วงเวลา: 10-14 วัน (ทุก 5-7 วัน)', 10, 14, 6, 7),
  ('stage_08', 'ดอกบาน',                     '🌼', 'ช่วงเวลา: 10-14 วัน (ทุก 5-7 วัน)', 10, 14, 6, 8),
  ('stage_09', 'ลูกเล็ก',                    '🍒', 'ช่วงเวลา: 60 วัน (ทุก 10-15 วัน)', 60, 60, 12, 9),
  ('stage_10', 'ลูกมะเขือพวง',               '🍊', 'ช่วงเวลา: 60 วัน (ทุก 10-15 วัน)', 60, 60, 12, 10),
  ('stage_11', 'ลูกแก้ว',                    '🍏', 'ช่วงเวลา: 45 วัน (ทุก 10 วัน)', 45, 45, 10, 11),
  ('stage_12', 'ก่อนเก็บ',                   '👍', 'ช่วงเวลา: 20 วัน (ทุก 8-10 วัน)', 20, 20, 9, 12)
on conflict (id) do nothing;

-- backfill stage_id สำหรับข้อมูลแปลงเดิมที่มี stage เป็นข้อความ
update public.cultivations
set stage_id = case stage
  when 'เตรียมต้นหลังเก็บเกี่ยว' then 'stage_01'
  when 'แตกใบอ่อน ใบแรก' then 'stage_02'
  when 'แตกใบอ่อน ใบสอง' then 'stage_03'
  when 'ราดสาร' then 'stage_04'
  when 'เปิดตาดอก' then 'stage_05'
  when 'ยืดช่อดอก' then 'stage_06'
  when 'บำรุงช่อดอก' then 'stage_07'
  when 'ดอกบาน' then 'stage_08'
  when 'ลูกเล็ก' then 'stage_09'
  when 'ลูกมะเขือพวง' then 'stage_10'
  when 'ลูกแก้ว' then 'stage_11'
  when 'ก่อนเก็บ' then 'stage_12'
  else stage_id
end
where stage_id is null;

-- ============================================================
-- 7) Seed: stage_products (สินค้าที่ใช้ในแต่ละระยะ)
-- ============================================================
-- หมายเหตุ: product_id อ้างอิงจาก seed ใน schema.sql (p1-p16)
-- ถ้าเปลี่ยน product_id ในอนาคต ต้องอัปเดต mapping นี้ด้วย

-- Stage 1: เตรียมต้นหลังเก็บเกี่ยว (ทุก 15 วัน, 3 ครั้ง)
insert into public.stage_products (stage_id, product_id, formula, sequence) values
  ('stage_01', 'p1', 'สาหร่าย/อะมิโน + ปุ๋ยเกร็ดสูตรตัวหน้าสูง (15-0-0, 30-10-10, 30-20-10) — เน้นดันใบ ฟื้นต้น', 1),
  ('stage_01', 'p2', 'ปุ๋ยเกร็ดสูตรตัวหน้าสูง (30-10-10)', 2)
on conflict do nothing;

-- Stage 2: แตกใบอ่อน ใบแรก (1 ครั้ง)
insert into public.stage_products (stage_id, product_id, formula) values
  ('stage_02', 'p2', 'ธาตุอาหารรอง-เสริม + ปุ๋ยเกร็ดสูตรเสมอ (21-21-21, 20-20-20)')
on conflict do nothing;

-- Stage 3: แตกใบอ่อน ใบสอง (4 ครั้ง สูตรต่างกัน)
insert into public.stage_products (stage_id, product_id, formula, sequence) values
  ('stage_03', 'p1', 'ครั้งที่ 1: สาหร่าย/อะมิโน + ปุ๋ยตัวหน้าสูง (15-0-0, 30-10-10, 30-20-10)', 1),
  ('stage_03', 'p2', 'ครั้งที่ 2: ปุ๋ยเกร็ดสูตรเสมอ (21-21-21, 20-20-20)', 2),
  ('stage_03', 'p3', 'ครั้งที่ 3: ปุ๋ยเกร็ดสูตรตัวหน้าต่ำ (4-24-24, 8-24-24)', 3),
  ('stage_03', 'p4', 'ครั้งที่ 4: แมกนีเซียม + ปุ๋ยตัวหน้าต่ำ หรือตัดไนโตรเจน (0-52-34)', 4)
on conflict do nothing;

-- Stage 4: ราดสาร (ทางใบ 3 ครั้ง + ทางดิน 1 ครั้ง)
insert into public.stage_products (stage_id, product_id, formula, sequence) values
  ('stage_04', 'p5', 'ทางใบ ครั้งที่ 1-3: โพแทสเซียมคลอเรต / โซเดียมคลอเรต (เว้นระยะ 1 เว้น 2 วัน)', 1),
  ('stage_04', 'p6', 'ทางดิน: โซเดียมคลอเรต (ไม่เกิน 2 วันหลังราดสารทางใบครั้งสุดท้าย)', 2)
on conflict do nothing;

-- Stage 5: เปิดตาดอก (2 ครั้ง)
insert into public.stage_products (stage_id, product_id, formula) values
  ('stage_05', 'p7', 'เสือดอก/ยาเปิดตาดอก + ปุ๋ยเกร็ดสูตร 6-12-36')
on conflict do nothing;

-- Stage 6: ยืดช่อดอก (2 ครั้ง)
insert into public.stage_products (stage_id, product_id, formula) values
  ('stage_06', 'p8', 'ปุ๋ยเกร็ดสูตร 10-52-17')
on conflict do nothing;

-- Stage 7: บำรุงช่อดอก (2 ครั้ง, สูตรเดียวกับยืดช่อดอก)
insert into public.stage_products (stage_id, product_id, formula) values
  ('stage_07', 'p8', 'ปุ๋ยเกร็ดสูตร 10-52-17')
on conflict do nothing;

-- Stage 8: ดอกบาน (2 ครั้ง)
insert into public.stage_products (stage_id, product_id, formula) values
  ('stage_08', 'p9', 'ตัวผสมเกสร (ไดมอนด์) — ช่วยการติดผล')
on conflict do nothing;

-- Stage 9: ลูกเล็ก (4-6 ครั้ง)
insert into public.stage_products (stage_id, product_id, formula) values
  ('stage_09', 'p1', 'ปุ๋ยเกร็ดสูตรตัวหน้าสูง (เร่งการเจริญเติบโตของผล)')
on conflict do nothing;

-- Stage 10: ลูกมะเขือพวง (4-6 ครั้ง)
insert into public.stage_products (stage_id, product_id, formula) values
  ('stage_10', 'p2', 'ปุ๋ยเกร็ดสูตรเสมอ')
on conflict do nothing;

-- Stage 11: ลูกแก้ว (4 ครั้ง)
insert into public.stage_products (stage_id, product_id, formula) values
  ('stage_11', 'p3', 'ปุ๋ยเกร็ดสูตรตัวท้ายสูง (เร่งความหวาน/คุณภาพผล)')
on conflict do nothing;

-- Stage 12: ก่อนเก็บ (2 ครั้ง)
insert into public.stage_products (stage_id, product_id, formula) values
  ('stage_12', 'p10', 'เชื้อราตัวขัดผิว (ป้องกันโรค เพิ่มความสวยของผิวผล ก่อนเก็บเกี่ยว)')
on conflict do nothing;

-- ============================================================
-- 8) View: คำนวณรอบถัดไปของแต่ละแปลง
-- ============================================================
create or replace view public.v_cultivation_next_round as
with last_schedule as (
  select
    cultivation_id,
    stage_id,
    sequence,
    action_date as last_action_date,
    row_number() over (partition by cultivation_id order by action_date desc, created_at desc) as rn
  from public.cultivation_schedules
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
    -- ถ้ายังทำไม่ครบใน stage นี้ → รอบถัดไปอยู่ stage เดิม
    -- ถ้าครบแล้ว → ไป stage ถัดไป
    case
      when c.current_sequence < sms.max_sequence then c.stage_id
      else (select id from public.crop_stages
            where sort_order = cs_cur.sort_order + 1
              and crop_type = cs_cur.crop_type)
    end as next_stage_id,
    case
      when c.current_sequence < sms.max_sequence then c.current_sequence + 1
      else 1
    end as next_sequence
  from public.cultivations c
  left join last_schedule ls on ls.cultivation_id = c.id and ls.rn = 1
  left join public.crop_stages cs_cur on cs_cur.id = c.stage_id
  left join stage_max_seq sms on sms.stage_id = c.stage_id
)
select
  calc.cultivation_id,
  calc.customer_id,
  calc.current_stage_id,
  cs_cur.name as current_stage_name,
  cs_cur.emoji as current_emoji,
  calc.current_sequence,
  calc.next_stage_id,
  cs_next.name as next_stage_name,
  cs_next.emoji as next_emoji,
  cs_next.description as next_description,
  calc.next_sequence,
  cs_next.frequency_days as next_frequency_days,
  -- วันที่ควรทำรอบถัดไป = วันที่ทำครั้งล่าสุด + frequency_days
  -- ถ้ายังไม่เคยทำเลย = วันนี้
  case
    when calc.last_action_date is null then current_date
    when cs_next.frequency_days is not null
      then calc.last_action_date + (cs_next.frequency_days || ' days')::interval
    else current_date
  end as next_action_date,
  -- อีกกี่วันจะถึงรอบถัดไป (ติดลบ = เลยกำหนดแล้ว)
  case
    when calc.last_action_date is null then 0
    when cs_next.frequency_days is not null
      then extract(day from (calc.last_action_date + (cs_next.frequency_days || ' days')::interval - current_date))::int
    else null
  end as days_until_next
from calc
left join public.crop_stages cs_cur on cs_cur.id = calc.current_stage_id
left join public.crop_stages cs_next on cs_next.id = calc.next_stage_id;

-- ============================================================
-- เสร็จแล้ว — ตารางที่สร้าง: crop_stages, stage_products, cultivation_schedules
-- View: v_cultivation_next_round
-- รัน schema นี้ครั้งเดียวใน SQL Editor แล้วข้อมูลจะพร้อมใช้
-- ============================================================
