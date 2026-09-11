-- ============================================================
-- Fieldstone ERP — Promotions (โปรโมชัน/ส่วนลด/คูปอง/แคมเปญ/ชุดสินค้า)
--
-- Migration ใหม่ (additive) — รันหลัง migration-store-settings.sql
-- เก็บโปรโมชันใน Supabase ให้บันทึกถาวร รีเฟรชไม่หาย
-- เชื่อมกับ POS และใบเสนอราคาเพื่อคำนวณส่วนลดอัตโนมัติ
-- ============================================================

-- ============================================================
-- 1) promotions — ตารางหลัก
-- ============================================================
create table if not exists public.promotions (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  kind        text not null check (kind in ('ส่วนลด','คูปอง','แคมเปญ','ชุดสินค้า')),
  value       text not null,                  -- "-15%", "฿200", "10+1", "฿1,290"
  scope_type  text not null default 'all' check (scope_type in ('category','product','customer','all')),
  scope       text not null default 'ทั้งหมด', -- ค่าขอบเขตจริง (ชื่อหมวด/สินค้า/กลุ่มลูกค้า/ทั้งหมด)
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
-- 2) Row Level Security (anon all — single-user app)
-- ============================================================
alter table public.promotions enable row level security;

drop policy if exists "anon all promotions" on public.promotions;
create policy "anon all promotions" on public.promotions
  for all using (true) with check (true);

-- ============================================================
-- 3) updated_at trigger
-- ============================================================
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_promotions_updated_at on public.promotions;
create trigger trg_promotions_updated_at
  before update on public.promotions
  for each row execute function public.touch_updated_at();

-- ============================================================
-- 4) RPC: increment_promotion_used — เพิ่มจำนวนการใช้ +1
-- ============================================================
create or replace function public.increment_promotion_used(p_id uuid)
returns void language plpgsql security definer as $$
begin
  update public.promotions
  set used_count = used_count + 1
  where id = p_id;
end;
$$;

-- ============================================================
-- 5) Seed: ตัวอย่างโปรโมชัน (ทางเลือก — ลบได้ถ้าไม่ต้องการ)
-- ============================================================
insert into public.promotions (name, kind, value, scope_type, scope, start_date, end_date, budget, priority, status, note)
values
  ('ลดปุ๋ยอินทรีย์ต้อนรับฤดูฝน', 'ส่วนลด', '-10%', 'category', 'ปุ๋ยอินทรีย์', '2026-06-01', '2026-09-30', 500, 2, 'active', 'ลด 10% สำหรับปุ๋ยอินทรีย์ทุกรายการ'),
  ('คูปองส่วนลด 200 บาท', 'คูปอง', '฿200', 'all', 'ทั้งหมด', '2026-06-01', '2026-12-31', 1000, 3, 'active', 'ใช้ได้กับยอดขั้นต่ำ 1,000 บาท'),
  ('ชุดบำรุงลำไย 3 ระยะ', 'ชุดสินค้า', '฿1,290', 'product', 'HRM-AMINO+FRT-301010+CHL-KCLO3', '2026-06-01', '2026-12-31', 200, 1, 'active', 'ชุดสินค้า 3 ชิ้น ราคาพิเศษ')
on conflict do nothing;

-- ============================================================
-- เสร็จแล้ว — ตาราง promotions พร้อมใช้งาน
-- รัน migration นี้หลัง migration-store-settings.sql
-- ============================================================
