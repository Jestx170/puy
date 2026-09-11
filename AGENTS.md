<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

# Fieldstone ERP (ปุ๋ยไทย CRM)

ระบบ ERP/CRM สำหรับร้านค้าเกษตร — TanStack Start + React 19 + Tailwind v4 + shadcn/ui + Supabase

## คำสั่งที่ใช้บ่อย

```bash
npm run dev          # dev server (port 8080)
npx tsc --noEmit     # typecheck — ต้องผ่าน 0 error ก่อน commit
npx vite build       # production build
npm run lint         # eslint — ต้องผ่าน 0 error (prettier บังคับ format)
npx eslint . --fix   # จัด format อัตโนมัติ
```

## Package manager

โปรเจกต์นี้ใช้ **npm** เป็นมาตรฐาน (`package-lock.json`) — `bun.lock` ถูกลบออกแล้ว

⚠️ **ข้อควรระวังด้านความปลอดภัย:** `bunfig.toml` มี supply-chain guard
`minimumReleaseAge = 86400` (ห้ามติดตั้ง package ที่เผยแพร่ไม่ถึง 24 ชม.)
แต่ **npm ไม่รองรับ option นี้** ดังนั้นเมื่อเพิ่ม dependency ใหม่ด้วย npm ต้อง
**ตรวจสอบด้วยตัวเองว่า version ที่ติดตั้งเผยแพร่มาแล้วอย่างน้อย 7 วัน**

```bash
npm view <package> time.<version>   # เช็ควันเผยแพร่ก่อนติดตั้ง
```

ห้ามแก้/ลบ `bunfig.toml` หรือค่า `minimumReleaseAge` เพื่อแก้ปัญหา build —
ให้ปรึกษาเจ้าของโปรเจกต์ก่อน

## โครงสร้างโปรเจกต์

```
src/
├── routes/                  # หน้าเว็บ (TanStack Router file-based routing)
│   ├── __root.tsx           # root layout + AuthGuard
│   ├── index.tsx            # แดชบอร์ด /
│   ├── login.tsx            # /login
│   ├── customers.tsx        # /customers
│   ├── pos.tsx              # /pos
│   ├── products.index.tsx   # /products
│   ├── products.$productId.tsx
│   ├── inventory.*.tsx      # /inventory + 6 หน้าย่อย
│   ├── sales.index.tsx      # /sales
│   ├── sales.$orderId.tsx
│   └── promotions.index.tsx # /promotions
│
├── components/
│   ├── ui/                  # shadcn/ui primitives (ไม่ควรแก้ตรง ๆ)
│   ├── common/              # component ที่ใช้ซ้ำทั่วแอป
│   │   ├── StatCard.tsx     # การ์ดสถิติ (tone: default/warning/info)
│   │   ├── StatusBadge.tsx  # badge สถานะ
│   │   ├── DataToolbar.tsx  # Toolbar/FilterSelect/Pagination/usePagination
│   │   └── EmptyState.tsx
│   ├── layout/              # โครงหน้า
│   │   ├── AppSidebar.tsx   # เมนูข้าง
│   │   ├── TopBar.tsx       # แถบบน + Cmd+K + keyboard shortcuts (g+key)
│   │   └── PageHeader.tsx   # หัวข้อหน้า + breadcrumb + actions
│   └── inventory/
│       └── InventoryOpsPage.tsx  # component ร่วมของ 6 หน้าคลัง
│
├── lib/
│   ├── api/                 # Supabase data layer (แยกตาม domain)
│   │   ├── index.ts         # barrel export — import { productsApi } from "@/lib/api"
│   │   ├── products.ts      # CRUD + adjustStock (RPC) + safe delete (RPC)
│   │   ├── warehouses.ts
│   │   ├── movements.ts     # create via RPC record_stock_movement (atomic)
│   │   ├── customers.ts     # + cultivationsApi
│   │   ├── orders.ts        # + createSaleTransaction (RPC atomic) + getItems
│   │   ├── activities.ts
│   │   ├── notifications.ts
│   │   └── dashboard.ts     # stats + charts + top products/customers
│   ├── supabase.ts          # Supabase client
│   ├── auth.tsx             # auth context (localStorage, admin/admin123)
│   ├── format.ts            # currency, compactCurrency, numberFmt
│   ├── export.ts            # toCSV, downloadCSV, exportToCSV
│   ├── constants.ts         # productCategories, productUnits (domain constants)
│   ├── agronomy.ts          # cultivation cycle engine + sales recommendations
│   └── utils.ts             # cn()
│
├── types/
│   └── index.ts             # domain types ทั้งหมด (Product, Customer, Order, OrderItem, ฯลฯ)
│
└── hooks/
    └── use-mobile.tsx

supabase/
├── schema.sql               # SQL schema ทั้งหมด (ตาราง + views + RLS + seed)
└── migration-phase2.sql     # migration: image_url, audit trail, RPC functions, CHECK constraints
```

## แนวทางการเขียนโค้ด

### Types
- domain types อยู่ใน `@/types` เท่านั้น — ไม่ประกาศ interface ซ้ำในไฟล์อื่น
- ไม่มี `src/data/mock.ts` อีกต่อไป — ลบออกแล้วใน Phase 2 (production-ready)

### Data fetching
- ใช้ `useQuery` จาก `@tanstack/react-query` ดึงข้อมูลจาก Supabase
- **ไม่มี mock fallback อีกต่อไป** — ใช้ default value เป็น empty array `[]` หรือ `undefined`
- data layer แปลง snake_case (DB) ↔ camelCase (TS) ให้เอง
- การเขียน/แก้ข้อมูลที่สำคัญ (POS checkout, stock adjustment) ใช้ RPC function เพื่อ atomicity

```tsx
const { data: list = [], isLoading } = useQuery({
  queryKey: ["products"],
  queryFn: () => productsApi.list(),
});
```

### Format
- ใช้ `currency()`, `compactCurrency()`, `numberFmt()` จาก `@/lib/format`
- ไม่เขียน `Intl.NumberFormat` ตรง ๆ ในหน้า

### Export CSV
- ใช้ `exportToCSV(rows, filename, columns?)` จาก `@/lib/export`
- ส่งออกเฉพาะข้อมูลที่กรองแล้ว (ตาม filter ปัจจุบัน)

### UI conventions
- `StatCard` tone รองรับแค่ `default` | `warning` | `info` (ไม่มี `success`)
- ใช้ `AlertDialog` สำหรับ action ที่ทำลายข้อมูล ไม่ใช่แค่ toast
- ปุ่ม/การ์ดใช้ `rounded-xl`, การ์ดใช้ class `card-soft`

## Supabase

- ตั้งค่าใน `.env`: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- รัน `supabase/schema.sql` ใน Supabase Dashboard → SQL Editor (ครั้งเดียว)
- รัน `supabase/migration-phase2.sql` เพื่อเพิ่ม: `image_url`, `deleted_at`, audit trail
  (`stock_before`/`stock_after`/`reference`), `CHECK stock >= 0`, RPC functions
  (`create_sale_transaction`, `record_stock_movement`, `delete_product_safe`)
- สร้าง storage bucket `product-images` (public, 5MB, image/* MIME types)
- RLS อนุญาต anon ทุกตาราง (single-user app)
- trigger `calc_product_status` คำนวณ `products.status` จาก stock/min_stock อัตโนมัติ
- RPC `create_sale_transaction` — POS checkout แบบ atomic (order + items + stock + customer + activity)
- RPC `record_stock_movement` — stock in/out/adjustment แบบ atomic + audit trail
- RPC `delete_product_safe` — soft delete ถ้ามีประวัติขาย, hard delete ถ้าไม่มี

### ลำดับการรัน migration (สำคัญ — ต้องเรียงตามนี้)

```
1. schema.sql                             # ตารางหลักทั้งหมด
2. migration-phase2.sql                   # image_url, audit trail, RPC
3. migration-storage-bucket.sql           # bucket product-images
4. migration-cultivation-stages.sql       # crop_stages / stage_products / cultivation_schedules + view
5. migration-longan-product-catalog.sql   # สินค้าลำไย 20 SKU + map เข้า 12 ระยะ
6. migration-longan-only.sql              # บีบ constraint เหลือ 12 ระยะลำไย + แปลงข้อมูลเก่า
7. migration-care-program-rounds.sql     # care_program_rounds/groups/options + RPC atomic + unique + nullable date
8. migration-store-settings.sql           # store_settings (single row) — ข้อมูลร้านสำหรับใบเสร็จ
9. migration-promotions.sql               # promotions table + RPC increment_promotion_used + seed
10. mock-longan-demo.sql                   # (ทางเลือก) ข้อมูลเดโมสำหรับทดสอบ
```

⚠️ `migration-care-program-rounds.sql` เป็น additive — รักษาข้อมูลเดิม
แต่ทำให้ `cultivation_schedules.action_date` เป็น nullable และเพิ่ม unique constraint
บน `(cultivation_id, stage_id, sequence)` เพื่อกัน duplicate completion
**ห้ามรันกับฐานข้อมูลจริงจนกว่าจะอนุมัติขั้นตอนนี้แยกต่างหาก**

## โปรโมชัน (Promotions)

- ตาราง `promotions` เก็บ: ชื่อ, ประเภท (ส่วนลด/คูปอง/แคมเปญ/ชุดสินค้า), มูลค่า, ขอบเขต, ช่วงเวลา, งบ, ลำดับ
- API: `promotionsApi.list/listActive/create/update/remove/incrementUsed` ใน `src/lib/api/promotions.ts`
- `calcDiscountAmount(promo, subtotal)` — คำนวณส่วนลดอัตโนมัติ:
  - ส่วนลด: parse % จาก value (เช่น "-15%" → 15% ของ subtotal)
  - คูปอง: parse ฿ จาก value (เช่น "฿200" → 200 บาท)
  - แคมเปญ/ชุดสินค้า: คืน 0 (พนักงานกรอกเอง)
- POS: เลือกโปรโมชันใน CartPanel → คำนวณส่วนลดอัตโนมัติ (แทนกรอกเอง)
- ใบเสนอราคา (customers.tsx): เลือกโปรโมชันก่อนพิมพ์ → แสดงส่วนลดในใบเสนอราคา
- RPC `increment_promotion_used` — เพิ่มจำนวนการใช้งาน +1

## ตั้งค่าร้าน (Store Settings)

- ตาราง `store_settings` (single-row, `id = 1`) เก็บ: ชื่อร้าน, ที่อยู่, โทร, Tax ID, footer text
- แก้ไขผ่านหน้า `/settings` (เมนู "ตั้งค่าร้าน" ใน sidebar)
- API: `settingsApi.get()` / `settingsApi.update()` ใน `src/lib/api/settings.ts`
- ค่า default อยู่ใน `DEFAULT_STORE_SETTINGS` ใน `@/types` (ใช้ก่อน Supabase ตอบ)
- ใบเสร็จ/ใบเสนอราคา (`printReceipt`) ดึงค่าจาก `useQuery(["store-settings"])` — ไม่ hardcode
- รองรับ Tax ID แสดงใต้ที่อยู่ในหัวใบเสร็จ

## Domain: ลำไยเท่านั้น

ระบบนี้รองรับ **ลำไย** พืชเดียว — ระยะการเจริญเติบโตมี 12 ระยะตายตัว

- `cultivationStages` ใน `@/types` = 12 ระยะลำไย (เตรียมต้นหลังเก็บเกี่ยว → ก่อนเก็บ)
- `stageIdByName` map ชื่อระยะ → `crop_stages.id` (`stage_01`..`stage_12`)
- `stagePlaybook` ใน `@/lib/agronomy` มี 12 entry ใช้ SKU จริงจาก catalog ลำไย
  (`HRM-AMINO`, `FRT-1500`, `CHL-KCLO3`, `FRT-105217`, `POL-DIAMOND`, `BIO-SKIN` ฯลฯ)
- `LONGAN_CYCLE_DAYS` = ผลรวม `stageDurationDays` (332 วัน) ใช้คำนวณ progress
- แหล่งคำแนะนำมี 2 ทาง: client-side (`stagePlaybook` คิดตามไร่) และ DB (`stage_products` ตาม sequence)
- ชื่อระยะในโค้ดต้องตรงกับ `crop_stages.name` เป๊ะ (เช่น `ราดสาร` ไม่ใช่ `ราดสาร (สารควบคุมการออกดอก)`)

## หมายเหตุ

- warning `vite-tsconfig-paths` มาจาก `@lovable.dev/vite-tanstack-config` — ไม่กระทบการทำงาน ปิดไม่ได้จาก user config
- auth เป็น localStorage-based (admin/admin123) ไม่ใช่ Supabase Auth

### การเลือกระยะย่อยลำไย

- UI และ `stagePlaybook` ใช้ 18 ตัวเลือก: แยกใบสอง 4 ครั้ง และราดสารทางใบ 3 ครั้ง/ทางดิน 1 ครั้ง ส่วนฐานข้อมูลยังใช้ 12 ระยะหลักเดิม
- ห้ามเปลี่ยนเลข `stage_01`..`stage_12` ตามลำดับ UI เพราะผูกกับสินค้าและประวัติเดิม
- `cultivationStageStorage` แปลงตัวเลือกเป็นชื่อระยะหลัก + `stage_id` + `current_sequence`; ครั้งที่กำลังจะดูแล N ใช้ `current_sequence = N - 1` ตามสัญญาของ view รอบถัดไป
- `cultivationStageSelection` แปลงกลับเป็นตัวเลือกใน UI; เมื่อครบ 4 ครั้งยังคงแสดงครั้งที่ 4 จนมีการเปลี่ยนระยะหลัก
- การแก้ข้อมูลแปลงโดยไม่เปลี่ยนระยะต้องรักษา `current_sequence` เดิม ไม่รีเซ็ตเป็น 0
- การเลือกรอบในฟอร์มไม่สร้างรายการประวัติการดูแล; ประวัติสร้างเมื่อกดบันทึกทำแล้วเท่านั้น
