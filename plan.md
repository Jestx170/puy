# แผนพัฒนาต่อ — ปุ๋ยไทย CRM (AgriFlow Dashboard)

> อ้างอิง: `README.md` (สเปก Phase 1) และตรวจสอบโค้ดปัจจุบันใน `src/`
> วันที่ตรวจสอบ: 2026-08-07

---

## 1. สรุปสถานะปัจจุบัน

### โมดูลที่ทำเสร็จแล้ว (route + UI สมบูรณ์)

| โมดูล | Route | ไฟล์ | หมายเหตุ |
|---|---|---|---|
| แดชบอร์ด | `/` | `routes/index.tsx` | KPI, กราฟยอดขาย/รายได้, สินค้าขายดี, ลูกค้าดี, คำสั่งล่าสุด, แจ้งเตือนสต็อก, กิจกรรม |
| ลูกค้า CRM | `/customers` | `routes/customers.tsx` | รายชื่อซ้าย + โปรไฟล์ขวา พร้อม Tabs (โปรไฟล์/ประวัติซื้อ/คำสั่ง/เอกสาร/แนะนำสินค้า) |
| POS | `/pos` | `routes/pos.tsx` | ลูกค้า + ค้นหา/บาร์โค้ด + หมวดหมู่ + กริดสินค้า + ตะกร้า + ชำระเงิน (เงินสด/QR/บัตร/โอน) |
| สินค้า | `/products`, `/products/$productId` | `routes/products.index.tsx`, `routes/products.$productId.tsx` | มุมมอง Grid/Table, กรอง/เรียง/แบ่งหน้า, หน้ารายละเอียด + แก้ไขด่วน/ลบ |
| คลังสินค้า | `/inventory` + 6 หน้าย่อย | `routes/inventory.*.tsx` + `components/inventory/InventoryOpsPage.tsx` | ภาพรวม + รับเข้า/จ่ายออก/ปรับปรุง/โอนย้าย/ประวัติ/ตรวจนับ (ใช้ component ร่วม) |
| การขาย | `/sales`, `/sales/$orderId` | `routes/sales.index.tsx`, `routes/sales.$orderId.tsx` | สถิติ + ตารางคำสั่งขาย + หน้ารายละเอียด (สินค้า/ลูกค้า/ชำระ/เอกสาร/ไทม์ไลน์) |

### โครงสร้างที่มีอยู่แล้ว (ใช้ซ้ำได้)

- **Layout**: `AppSidebar` (collapsible, ไอคอน+ป้าย, เมนูย่อยคลัง), `TopBar` (ค้นหา Cmd+K, แจ้งเตือน, สร้างใหม่, เมนูผู้ใช้), `PageHeader` (breadcrumb + actions)
- **Common components**: `StatCard`, `StatusBadge`, `DataToolbar` (Toolbar/FilterSelect/Pagination/usePagination), `EmptyState`
- **shadcn/ui**: ติดตั้งครบทั้งหมด (table, tabs, dialog, alert-dialog, context-menu, command, dropdown-menu, popover, select, scroll-area, progress, badge, avatar, ฯลฯ)
- **Charts**: recharts (Area/Bar/Line)
- **Mock data**: `src/data/mock.ts` — มีข้อมูลตัวอย่างครบทุกโมดูล รวมถึง `promotions`, `appUsers`, `roles`, `permissionMatrix`
- **Routing**: TanStack Router (file-based), มี `head`/meta/OG สำหรับ SEO ทุกหน้า
- **Toast/Sonner**: ใช้งานแล้วทั่วโปรเจกต์

---

## 2. สิ่งที่เหลือต้องทำ (ตามสเปก README)

### 2.1 โมดูลที่ขาด — กดแล้ว 404

> ⚠️ สำคัญที่สุด: `AppSidebar` และ `TopBar` ลิงก์ไป `/promotions` และ `/users` แล้ว
> แต่ **ไม่มีไฟล์ route** — ผู้ใช้กดแล้วจะเจอ 404 ทันที
> (mock data พร้อมใช้ใน `src/data/mock.ts` ทั้งคู่)

#### A. โปรโมชัน (Promotion) — `/promotions`

**สเปกจาก README:**
- Promotion Center: การ์ดส่วนลด/คูปอง/แคมเปญ/ชุดสินค้า + กฎ
- Promotion Builder: เงื่อนไข (สินค้า, กลุ่มลูกค้า, ช่วงวันที่, ลำดับความสำคัญ) + พรีวิว
- แสดงแคมเปญที่กำลังทำงาน

**Mock ที่มี:** `promotions` (6 รายการ, มี kind/value/scope/start/end/used/budget/priority/status)

**งานที่ต้องทำ:**
1. สร้าง `src/routes/promotions.index.tsx`
   - PageHeader + breadcrumb
   - StatCard สรุป (โปรโมชัน active / ใช้งานเดือนนี้ / งบประมาณ / Conversion)
   - แท็บหรือกรองตาม `kind` (ส่วนลด/คูปอง/แคมเปญ/ชุดสินค้า) และ `status`
   - การ์ดโปรโมชัน (แสดงชื่อ, ประเภท, มูลค่า, ขอบเขต, ช่วงวันที่, สถานะ, ความคืบหน้า used/budget)
   - ปุ่ม "สร้างโปรโมชัน" (เปิด dialog/sheet)
   - ใช้ `Toolbar`/`FilterSelect`/`Pagination` ตามรูปแบบที่มี
2. (optional) Promotion Builder เป็น dialog/sheet ฝั่งขวา หรือ route แยก `/promotions/new`
   - ฟอร์ม: ชื่อ, ประเภท, มูลค่า, ขอบเขต (เลือกหมวด/สินค้า/กลุ่มลูกค้า), ช่วงวันที่ (Calendar), ลำดับความสำคัญ, พรีวิว
3. รีเจเนอเรต `routeTree.gen.ts` (TanStack ทำอัตโนมัติตอน dev/build)

#### B. ผู้ใช้และสิทธิ์ (User & Permission) — `/users`

**สเปกจาก README:**
- Admin Workspace: รายชื่อผู้ใช้, รายชื่อ Role, Permission Matrix (ตารางโต้ตอบได้)
- Roles: Owner/Manager/Cashier/Sales/Warehouse
- Permissions: View/Create/Update/Delete/Approve/Export/Print
- แสดง permission matrix เป็นตารางโต้ตอบ

**Mock ที่มี:** `appUsers` (7 คน), `roles` (5 บทบาท), `permissionMatrix` (5 roles × 8 modules × 7 actions), `permissionActions`, `permissionModules`

**งานที่ต้องทำ:**
1. สร้าง `src/routes/users.index.tsx`
   - PageHeader + breadcrumb
   - Tabs 3 ส่วน: "ผู้ใช้" / "บทบาท" / "สิทธิ์"
   - **แท็บผู้ใช้**: ตาราง `appUsers` (ชื่อ, อีเมล, บทบาท, สาขา, สถานะ, ใช้งานล่าสุด) + กรอง/ค้นหา/แบ่งหน้า + ปุ่ม "เชิญผู้ใช้" (dialog)
   - **แท็บบทบาท**: การ์ด `roles` (ชื่อ, คำอธิบาย, จำนวนสมาชิก) + ปุ่มแก้ไข
   - **แท็บสิทธิ์**: Permission Matrix — ตาราง `permissionModules` (แถว) × `permissionActions` (คอลัมน์) ต่อ role, ใช้ Checkbox/Switch โต้ตอบได้ (toggle ใน state ท้องถิ่น + toast)
   - เลือก role ด้านบนเพื่อเปลี่ยนเมทริกซ์ที่แสดง
2. รีเจเนเรต `routeTree.gen.ts`

---

### 2.2 ส่วนเสริม / ขัดแต่ง (ทำหลัก 2.1 ก่อน)

#### C. ฟอร์มสร้าง/แก้ไข (ตอนนี้ปุ่มส่วนใหญ่แค่ toast)

ตอนนี้ปุ่ม "เพิ่มลูกค้า/สินค้า/โปรโมชัน/ผู้ใช้" ส่วนใหญ่แค่ `toast()` ไม่มีฟอร์มจริง
ถ้าต้องการให้สมบูรณ์ขึ้น ให้เพิ่ม Dialog/Sheet ฟอร์ม (ใช้ `react-hook-form` + `zod` ที่ติดตั้งแล้ว):
- ฟอร์มเพิ่ม/แก้ไขลูกค้า
- ฟอร์มเพิ่ม/แก้ไขสินค้า (ปัจจุบันมีเฉพาะหน้ารายละเอียดแบบ read-only + ปุ่ม "แก้ไขด่วน" ที่ยังไม่เปิดฟอร์ม)
- ฟอร์มรับเข้า/จ่ายออก/ปรับปรุง/โอนย้าย (ตอนนี้ `InventoryOpsPage` มีแค่ตารางรายการ ไม่มีฟอร์มบันทึก)
- ฟอร์ม Promotion Builder

#### D. ฟีเจอร์ที่ README ระบุแต่ยังไม่มี

- **Dashboard widgets ที่จัดเรียงได้** (README: "widgets that can easily be rearranged in the future") — ตอนนี้เป็น layout ตายตัว พร้อมขยายได้แต่ยังไม่มี drag-and-drop
- **Keyboard shortcuts** นอกเหนือ Cmd+K (README ระบุไว้)
- **Mobile friendly** — ตรวจสอบการตอบสนองของ POS และตารางบนจอเล็ก (POS ใช้ grid 3 คอลัมน์ อาจต้องปรับบนมือถือ)
- **Context Menu** ในหน้าอื่น ๆ นอกจาก Products (README ระบุไว้ใน Common Components)
- **Confirmation Dialog** ในจุดที่ใช้แค่ toast (เช่น ยกเลิกคำสั่งขาย, ลบโปรโมชัน)

#### E. คุณภาพ/เสถียรภาพ

- ลบ warning: `vite-tsconfig-paths` plugin → เปลี่ยนเป็น `resolve.tsconfigPaths: true` ใน `vite.config.ts` (Vite รองรับ native แล้ว)
- พิจารณาอัปเกรด recharts v2 → v3 (deprecation warning)
- ตรวจ typecheck/lint หลังเพิ่ม route ใหม่ (`npm run build` / lint)

---

## 3. ลำดับความสำคัญ (แนะนำ)

1. **เร่งด่วน — ซ่อม 404**: สร้าง route `/promotions` และ `/users` (งาน A + B)
   - เหตุผล: เมนูลิงก์ไปแล้ว ผู้ใช้กดแล้วพัง ต้องทำก่อนเพื่อให้ navigation สมบูรณ์
   - ใช้ mock data ที่มี และ component ร่วม (`PageHeader`, `StatCard`, `DataToolbar`, `StatusBadge`, `EmptyState`, `Tabs`, `Table`, `Checkbox/Switch`)
2. **รองลงมา — ฟอร์มบันทึก** (งาน C) โดยเฉพาะฟอร์มคลังสินค้า เพราะ `InventoryOpsPage` ตอนนี้มีแค่ตาราง
3. **เสริม — ฟีเจอร์ UX** (งาน D) ตามความต้องการ
4. **กลัด — คุณภาพ** (งาน E)

---

## 4. ข้อตกลง/ข้อจำกัด

- ทุกหน้าใช้ข้อมูลจาก `src/data/mock.ts` (ยังไม่มี backend) — การเปลี่ยนแปลงเก็บใน state ท้องถิ่น + toast เท่านั้น
- รักษารูปแบบเดิม: ภาษาไทยใน UI, `card-soft`, `rounded-xl`, สีผ่าน CSS variables, meta/OG tags ทุกหน้า
- หลังเพิ่ม/แก้ไฟล์ route ต้องรัน dev หรือ build เพื่อให้ `routeTree.gen.ts` อัปเดต
- ห้าม force-push / rewrite git history (ตาม `AGENTS.md` — เชื่อมกับ Lovable)

---

## 5. สรุปสั้น ๆ

- **ทำแล้ว 6/8 โมดูล** (แดชบอร์ด, CRM, POS, สินค้า, คลัง, การขาย)
- **เหลือ 2 โมดูลที่เมนูลิงก์ไปแล้วแต่ยังไม่มีหน้า**: โปรโมชัน + ผู้ใช้และสิทธิ์ (mock data พร้อม)
- **เสริมได้**: ฟอร์มบันทึกจริง, widget จัดเรียงได้, keyboard shortcuts, mobile polish
- **กลัด**: ลบ deprecation warning (vite-tsconfig-paths, recharts v2)
