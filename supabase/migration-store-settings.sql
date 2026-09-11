-- ============================================================
-- Fieldstone ERP — Store settings (ข้อมูลร้านสำหรับใบเสร็จ/ใบเสนอราคา)
--
-- Migration ใหม่ (additive) — รันหลัง migration-care-program-rounds.sql
-- เก็บข้อมูลร้านแบบ single-row (id = 1) ให้พนักงานแก้ไขผ่านหน้า /settings
-- ค่าที่เก็บ: ชื่อร้าน, ที่อยู่, โทร, Tax ID, ข้อความ footer ใบเสร็จ
-- ============================================================

-- ============================================================
-- 1) store_settings — single-row table (id = 1 เท่านั้น)
-- ============================================================
create table if not exists public.store_settings (
  id           integer primary key default 1,
  store_name   text not null default 'ปุ๋ยไทย CRM',
  store_address text,
  store_phone  text,
  tax_id       text,                          -- เลขประจำตัวผู้เสียภาษี
  footer_text  text,                          -- ข้อความปิดท้ายใบเสร็จ (null = ใช้ default)
  updated_at   timestamptz not null default now(),
  constraint store_settings_single_row check (id = 1)
);

-- ============================================================
-- 2) Row Level Security (anon all — single-user app)
-- ============================================================
alter table public.store_settings enable row level security;

drop policy if exists "anon all store_settings" on public.store_settings;
create policy "anon all store_settings" on public.store_settings
  for all using (true) with check (true);

-- ============================================================
-- 3) Seed: ค่าเริ่มต้น (single row id = 1)
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
-- เสร็จแล้ว — ตาราง store_settings (single row)
-- รัน migration นี้หลัง migration-care-program-rounds.sql
-- ============================================================
