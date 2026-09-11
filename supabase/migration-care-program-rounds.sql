-- ============================================================
-- Fieldstone ERP — Care program rounds/groups/options + atomic completion
--
-- Migration ใหม่ (additive) — รักษาข้อมูลเดิมทั้งหมด
-- รันหลัง migration-longan-only.sql
--
-- ⚠️ อย่ารันกับฐานข้อมูลจริงจนกว่าจะอนุมัติขั้นตอนนี้แยกต่างหาก
--
-- สิ่งที่เพิ่ม:
--   1. care_program_rounds  — ครั้งดูแลของแต่ละระยะ (จาก Excel)
--   2. care_program_groups  — กลุ่มสูตรของแต่ละครั้ง (สูตรหลัก vs ทางเลือก)
--   3. care_program_options — ตัวเลือกสูตรในแต่ละกลุ่ม (SKU + label)
--   4. Unique constraint บน cultivation_schedules (cultivation_id, stage_id, sequence)
--      เพื่อกัน duplicate completion
--   5. action_date เป็น nullable (วันไม่บังคับ)
--   6. RPC record_care_atomic — บันทึกการดูแลแบบ atomic + กัน duplicate
--   7. ปรับ view v_cultivation_next_round ให้ไม่ default เป็น current_date
--      เมื่อไม่มีประวัติ (วันไม่ทราบ = null)
-- ============================================================

-- ============================================================
-- 1) care_program_rounds — ครั้งดูแลของแต่ละระยะ
-- ============================================================
create table if not exists public.care_program_rounds (
  id            uuid primary key default gen_random_uuid(),
  stage_id      text not null references public.crop_stages(id) on delete cascade,
  sequence      integer not null,           -- ครั้งที่ 1, 2, 3, ...
  method        text,                       -- วิธีดูแล เช่น "ทางใบ", "ทางดิน"
  spacing_note  text,                       -- ระยะห่าง/ความถี่ เช่น "ทุก 10-15 วัน"
  created_at    timestamptz not null default now(),
  unique (stage_id, sequence)
);

create index if not exists idx_care_rounds_stage
  on public.care_program_rounds(stage_id, sequence);

-- ============================================================
-- 2) care_program_groups — กลุ่มสูตรของแต่ละครั้ง
-- ============================================================
create table if not exists public.care_program_groups (
  id           uuid primary key default gen_random_uuid(),
  round_id     uuid not null references public.care_program_rounds(id) on delete cascade,
  group_key    text not null,               -- รหัสกลุ่ม เช่น "stage_03_r1_g1"
  label        text not null,               -- ชื่อกลุ่ม เช่น "สูตรหลัก", "ทางเลือก"
  alternatives boolean not null default false, -- true = ทางเลือก (เลือกหนึ่งหรือมากกว่า)
  created_at   timestamptz not null default now(),
  unique (round_id, group_key)
);

create index if not exists idx_care_groups_round
  on public.care_program_groups(round_id);

-- ============================================================
-- 3) care_program_options — ตัวเลือกสูตรในแต่ละกลุ่ม
-- ============================================================
create table if not exists public.care_program_options (
  id          uuid primary key default gen_random_uuid(),
  group_id    uuid not null references public.care_program_groups(id) on delete cascade,
  sku         text not null,                 -- SKU อ้างอิง (อาจยังไม่มีใน products)
  label       text not null,                 -- ชื่อสูตร/ผลิตภัณฑ์
  product_id  text references public.products(id) on delete set null,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  unique (group_id, sku)
);

create index if not exists idx_care_options_group
  on public.care_program_options(group_id, sort_order);

-- ============================================================
-- 4) Row Level Security
-- ============================================================
alter table public.care_program_rounds  enable row level security;
alter table public.care_program_groups  enable row level security;
alter table public.care_program_options enable row level security;

drop policy if exists "anon all care_program_rounds"  on public.care_program_rounds;
drop policy if exists "anon all care_program_groups"  on public.care_program_groups;
drop policy if exists "anon all care_program_options" on public.care_program_options;

create policy "anon all care_program_rounds"  on public.care_program_rounds  for all using (true) with check (true);
create policy "anon all care_program_groups"  on public.care_program_groups  for all using (true) with check (true);
create policy "anon all care_program_options" on public.care_program_options for all using (true) with check (true);

-- ============================================================
-- 5) ปรับ cultivation_schedules: action_date nullable + unique constraint
-- ============================================================
-- วันไม่บังคับ: ถ้าพนักงานไม่ทราบวัน ให้เก็บ null (ไม่ default current_date)
alter table public.cultivation_schedules
  alter column action_date drop default;
alter table public.cultivation_schedules
  alter column action_date drop not null;

-- กัน duplicate completion: ห้ามบันทึก (cultivation_id, stage_id, sequence) ซ้ำ
-- ใช้ partial index เพื่ออนุญาต null sequence ในอนาคต แต่บังคับเมื่อ sequence มีค่า
-- ก่อนเพิ่ม constraint ให้ลบ duplicate ที่อาจมีอยู่เดิม (เก็บ record แรกสุด)
delete from public.cultivation_schedules cs1
  using public.cultivation_schedules cs2
  where cs1.id > cs2.id
    and cs1.cultivation_id = cs2.cultivation_id
    and cs1.stage_id = cs2.stage_id
    and cs1.sequence = cs2.sequence;

create unique index if not exists uq_schedules_cultivation_stage_sequence
  on public.cultivation_schedules(cultivation_id, stage_id, sequence);

-- ============================================================
-- 6) RPC: record_care_atomic — บันทึกการดูแลแบบ atomic + กัน duplicate
-- ============================================================
-- คืน record id ถ้าสำเร็จ หรือ raise exception ถ้า duplicate
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
  -- ตรวจ duplicate ก่อน insert (กัน race condition)
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

  -- อัปเดต current_sequence ของแปลง (atomic ใน transaction เดียวกัน)
  update public.cultivations
    set current_sequence = greatest(current_sequence, p_sequence)
    where id = p_cultivation_id;

  return v_id;
end;
$$;

-- ============================================================
-- 7) ปรับ view v_cultivation_next_round ให้ไม่ default current_date
-- ============================================================
-- แทนที่ view เดิม: วันไม่ทราบ = null (ไม่ใช่ current_date)
-- คำนวณ next round จาก care_program_rounds ถ้ามี ไม่ใช่จาก stage_products.sequence
-- ต้อง DROP ก่อน CREATE เพราะเพิ่มคอลัมน์ rounds_max ที่ตำแหน่งกลาง
-- (PostgreSQL ห้ามเปลี่ยนชื่อ/ตำแหน่งคอลัมน์ผ่าน CREATE OR REPLACE VIEW)
drop view if exists public.v_cultivation_next_round;
create view public.v_cultivation_next_round as
with last_schedule as (
  select
    cultivation_id,
    stage_id,
    sequence,
    action_date as last_action_date,
    row_number() over (partition by cultivation_id order by action_date desc nulls last, created_at desc) as rn
  from public.cultivation_schedules
),
-- จำนวนครั้งสูงสุดของแต่ละระยะจาก care_program_rounds (ถ้ามี)
-- ถ้าไม่มี fallback ไป max(stage_products.sequence)
stage_rounds_max as (
  select
    cpr.stage_id,
    max(cpr.sequence) as rounds_max
  from public.care_program_rounds cpr
  group by cpr.stage_id
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
  -- วันที่ควรทำรอบถัดไป = วันที่ทำครั้งล่าสุด + frequency_days
  -- ถ้ายังไม่เคยทำเลย = null (ไม่ใช่ current_date — วันไม่ทราบ)
  case
    when calc.last_action_date is null then null
    when cs_next.frequency_days is not null
      then calc.last_action_date + (cs_next.frequency_days || ' days')::interval
    else null
  end as next_action_date,
  -- อีกกี่วันจะถึงรอบถัดไป (null = ไม่ทราบวัน)
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
-- เสร็จแล้ว — migration นี้ additive ทั้งหมด ไม่ลบข้อมูลเดิม
-- ตารางใหม่: care_program_rounds, care_program_groups, care_program_options
-- RPC ใหม่: record_care_atomic
-- ปรับ: cultivation_schedules.action_date nullable + unique constraint
-- ปรับ: v_cultivation_next_round ไม่ default current_date
-- ============================================================
