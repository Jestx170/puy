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
│   │   ├── products.ts
│   │   ├── warehouses.ts
│   │   ├── movements.ts
│   │   ├── customers.ts     # + cultivationsApi
│   │   ├── orders.ts
│   │   ├── activities.ts
│   │   ├── notifications.ts
│   │   └── dashboard.ts     # stats + charts + top products/customers
│   ├── supabase.ts          # Supabase client
│   ├── auth.tsx             # auth context (localStorage, admin/admin123)
│   ├── format.ts            # currency, compactCurrency, numberFmt
│   ├── export.ts            # toCSV, downloadCSV, exportToCSV
│   └── utils.ts             # cn()
│
├── types/
│   └── index.ts             # domain types ทั้งหมด (Product, Customer, Order, ฯลฯ)
│
├── data/
│   └── mock.ts              # mock data (seed/fallback) + re-export types & format
│
└── hooks/
    └── use-mobile.tsx

supabase/
└── schema.sql               # SQL schema ทั้งหมด (ตาราง + views + RLS + seed)
```

## แนวทางการเขียนโค้ด

### Types
- domain types อยู่ใน `@/types` เท่านั้น — ไม่ประกาศ interface ซ้ำในไฟล์อื่น
- `src/data/mock.ts` re-export types จาก `@/types` เพื่อ backward compat (import เดิมยังใช้ได้)

### Data fetching
- ใช้ `useQuery` จาก `@tanstack/react-query` ดึงข้อมูลจาก Supabase
- ใส่ `placeholderData` เป็น mock data เพื่อ fallback เมื่อ Supabase ล่ม/ยังไม่มีข้อมูล
- data layer แปลง snake_case (DB) ↔ camelCase (TS) ให้เอง

```tsx
const { data: list = seedProducts, isLoading } = useQuery({
  queryKey: ["products"],
  queryFn: () => productsApi.list(),
  placeholderData: seedProducts,
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
- RLS อนุญาต anon ทุกตาราง (single-user app)
- trigger `calc_product_status` คำนวณ `products.status` จาก stock/min_stock อัตโนมัติ

## หมายเหตุ

- warning `vite-tsconfig-paths` มาจาก `@lovable.dev/vite-tanstack-config` — ไม่กระทบการทำงาน ปิดไม่ได้จาก user config
- auth เป็น localStorage-based (admin/admin123) ไม่ใช่ Supabase Auth
