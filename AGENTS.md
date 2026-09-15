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

ระบบ ERP/CRM สำหรับร้านค้าเกษตร — React 19 + Vite SPA + Tailwind v4 + shadcn/ui + FastAPI + SQLite + PyInstaller

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
│   ├── api/                 # REST data layer แยกตาม domain
│   │   ├── index.ts         # barrel export — import { productsApi } from "@/lib/api"
│   │   ├── client.ts        # fetch wrapper สำหรับ FastAPI
│   │   ├── products.ts      # CRUD + stock movement + safe delete
│   │   ├── warehouses.ts
│   │   ├── movements.ts
│   │   ├── customers.ts     # + cultivationsApi
│   │   ├── orders.ts        # + atomic sale transaction
│   │   ├── activities.ts
│   │   ├── notifications.ts
│   │   └── dashboard.ts     # stats + charts + top products/customers
│   ├── local-api.ts         # local REST compatibility adapter
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

backend/
├── app.py                  # FastAPI routes + static SPA server
├── db.py                   # SQLite connection + initialization
├── schema.sql              # SQLite schema + seed data
├── services.py             # atomic stock/sale/product services
└── build.py                # PyInstaller packaging
```

## แนวทางการเขียนโค้ด

### Types
- domain types อยู่ใน `@/types` เท่านั้น — ไม่ประกาศ interface ซ้ำในไฟล์อื่น
- ไม่มี `src/data/mock.ts` อีกต่อไป — ลบออกแล้วใน Phase 2 (production-ready)

### Data fetching
- ใช้ `useQuery` จาก `@tanstack/react-query` ดึงข้อมูลผ่าน FastAPI REST API
- **ไม่มี mock fallback อีกต่อไป** — ใช้ default value เป็น empty array `[]` หรือ `undefined`
- data layer แปลง snake_case (DB) ↔ camelCase (TS) ให้เอง
- การเขียน/แก้ข้อมูลที่สำคัญ (POS checkout, stock adjustment) ใช้ SQLite transaction ใน `backend/services.py`

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

## FastAPI + SQLite

- ตั้งค่า optional ใน `.env`: `VITE_API_BASE=/api`
- schema อยู่ที่ `backend/schema.sql` และ initialize อัตโนมัติเมื่อ backend เริ่มทำงาน
- ฐานข้อมูล production อยู่ใน user data directory ไม่ใช่ข้าง executable
- business transaction สำคัญอยู่ที่ `backend/services.py`
- `record_stock_movement` รองรับ weighted-average cost, expiry และป้องกัน stock ติดลบ
- `create_sale_transaction` ทำ order, items, stock, customer totals และ activity ใน transaction เดียว
- รูปสินค้าเก็บใน local data directory ผ่าน FastAPI storage endpoint
- ระบบออกแบบสำหรับ single-user/local desktop ไม่รองรับการแชร์ SQLite file ให้หลายเครื่องเขียนพร้อมกัน

### คำสั่ง backend

```bash
python -m venv .venv
.venv/bin/pip install -r backend/requirements.txt
python backend/app.py
npm run desktop:build
```

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
