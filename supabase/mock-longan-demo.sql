-- ============================================================
-- Demo data: ลำไย (สำหรับทดสอบหน้าแนะนำสินค้า/รอบถัดไป)
-- ใช้หลังจากรัน migration-cultivation-stages.sql แล้ว
-- ============================================================

-- ลูกค้าทดสอบ
insert into public.customers (
  id, name, code, phone, email, address, type, tier, lifetime, orders, notes, tags
) values (
  'c-demo-longan',
  'สวนลำไยทดสอบ',
  'CUST-DEMO-LONGAN',
  '0890000000',
  'demo-longan@example.com',
  'ต.ทดสอบ อ.เมือง จ.เชียงใหม่',
  'เกษตรกร',
  'Silver',
  0,
  0,
  'ข้อมูลทดสอบสำหรับโชว์ระบบแนะนำสินค้า',
  array['demo', 'longan']
)
on conflict (id) do update set
  name = excluded.name,
  code = excluded.code,
  phone = excluded.phone,
  email = excluded.email,
  address = excluded.address,
  type = excluded.type,
  tier = excluded.tier,
  notes = excluded.notes,
  tags = excluded.tags;

-- แปลงลำไยทดสอบ (อยู่ช่วงแตกใบอ่อน ใบสอง)
insert into public.cultivations (
  id, customer_id, crop, stage, area, planted_date, expected_harvest, location, note, stage_id, current_sequence
) values (
  'cul-demo-longan-01',
  'c-demo-longan',
  'ลำไย',
  'แตกใบอ่อน ใบสอง',
  12,
  current_date - interval '35 day',
  current_date + interval '145 day',
  'โซน A',
  'แปลงทดสอบระบบแนะนำ',
  'stage_03',
  1
)
on conflict (id) do update set
  customer_id = excluded.customer_id,
  crop = excluded.crop,
  stage = excluded.stage,
  area = excluded.area,
  planted_date = excluded.planted_date,
  expected_harvest = excluded.expected_harvest,
  location = excluded.location,
  note = excluded.note,
  stage_id = excluded.stage_id,
  current_sequence = excluded.current_sequence;

-- ประวัติรอบล่าสุด (เพื่อให้ระบบคำนวณ next round/date ได้)
insert into public.cultivation_schedules (
  cultivation_id, stage_id, product_id, action_date, sequence, notes
) values
  ('cul-demo-longan-01', 'stage_03', 'p1', current_date - interval '7 day', 1, 'พ่นครั้งที่ 1 แล้ว')
on conflict do nothing;

-- ถ้าต้องการรีเซ็ตรอบถัดไปแบบชัด ๆ ให้รัน:
-- update public.cultivations
-- set stage_id = 'stage_03', current_sequence = 1
-- where id = 'cul-demo-longan-01';
