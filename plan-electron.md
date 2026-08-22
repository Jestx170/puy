# Plan: ย้าย Supabase → SQLite + แพ็ก Electron Desktop App

> **เป้าหมาย:** แอปรันบนเครื่องเดียว คนเดียว offline ได้ 100% ไม่ต้องพึ่ง cloud
>
> **เหตุผลที่ย้าย:** โปรเจกต์ไม่ได้ใช้ฟีเจอร์พิเศษของ Supabase (no realtime, no storage, no auth, no edge functions) ใช้แค่ hosted PostgreSQL แต่ต้อง online ตลอด + มีความเสี่ยงด้าน security (anon key ฝังใน bundle, RLS เปิดหมด)

---

## สถาปัตยกรรมเป้าหมาย

```
┌─────────────────────────────────────────────────┐
│  Electron App (.exe / .dmg installer)           │
│                                                 │
│  Main process (Node.js)                         │
│  ├─ better-sqlite3 → app.db (ไฟล์เดียว)         │  ← embedded DB, ไม่ต้องรัน server
│  └─ BrowserWindow                               │
│       └─ loadURL("http://localhost:PORT")       │  ← Vite dev หรือ static server
└─────────────────────────────────────────────────┘

ไม่ต้องมี Nitro server แยก
ไม่ต้องมี Supabase
ไม่ต้องมี internet
```

---

## เฟส 1: ย้าย Database จาก Supabase → SQLite

### 1.1 ติดตั้ง `better-sqlite3`

```bash
npm add better-sqlite3
npm add -D @types/better-sqlite3
```

**เวอร์ชันที่ตรวจแล้วปลอดภัย (ออกมาแล้ว >7 วัน):**
- `better-sqlite3@13.0.3` (2026-08-05, 11 วัน)

> ⚠️ `better-sqlite3` เป็น native module ต้อง rebuild สำหรับ Electron:
> ```bash
> npm add -D electron-rebuild
> npx electron-rebuild -f -w better-sqlite3
> ```

### 1.2 แปลง schema PG → SQLite

**ไฟล์ใหม่:** `db/schema.sql`

การแปลงที่ต้องทำ:

| PG syntax | SQLite equivalent | หมายเหตุ |
| --- | --- | --- |
| `text primary key` | `TEXT PRIMARY KEY` | เหมือนเดิม |
| `uuid primary key default gen_random_uuid()` | `TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16))))` | สร้าง UUID ใน SQLite |
| `numeric(12,2)` | `REAL` | SQLite ไม่มี precision |
| `timestamptz default now()` | `TEXT DEFAULT (datetime('now'))` | เก็บเป็น ISO 8601 text |
| `date default current_date` | `TEXT DEFAULT (date('now'))` | |
| `text[] not null default '{}'` | `TEXT NOT NULL DEFAULT '[]'` | เก็บเป็น JSON array string |
| `check (status in (...))` | `CHECK (status IN (...))` | syntax เดียวกัน |
| `references ... on delete cascade` | `REFERENCES ... ON DELETE CASCADE` | เหมือนเดิม |
| `gen_random_uuid()` | `lower(hex(randomblob(16)))` | |
| `generate_series(0, 23)` | recursive CTE | ต้องเขียนใหม่ใน seed |
| `date_trunc('month', date)` | `strftime('%Y-%m', date)` | ใน views |
| `extract(month from date)` | `cast(strftime('%m', date) as integer)` | |
| `to_char(date, 'Dy')` | `CASE strftime('%w', date) ...` | แมปตัวย่อวันเอง |
| `interval '6 days'` | `date('now', '-6 days')` | |
| `filter (where ...)` | `SUM(CASE WHEN ... THEN 1 END)` | SQLite ไม่มง `FILTER` syntax |
| `create extension pgcrypto` | ไม่ต้อง | SQLite มี `randomblob()` ในตัว |

**ตารางทั้งหมด (9):**
1. `products` — 16 seed
2. `warehouses` — 1 seed (คลังหลัก)
3. `stock_movements` — 18 seed
4. `customers` — 12 seed
5. `cultivations` — 16 seed
6. `orders` — 24 seed
7. `order_items` — ~42 seed
8. `activities` — 6 seed
9. `notifications` — 4 seed

**Views (8) — ต้องเขียนใหม่ทั้งหมด:**
- `v_warehouse_summary`
- `v_sales_by_day`
- `v_revenue_trend`
- `v_top_products`
- `v_best_customers`
- `v_dashboard_stats`
- `v_profit_by_day`
- `v_profit_by_month`

**Triggers (3):**
- `trg_products_updated` → `touch_updated_at()`
- `trg_products_status` → `calc_product_status()`
- `trg_customers_updated` → `touch_updated_at()`

> **หมายเหตุ:** SQLite trigger syntax ต่างจาก PG เล็กน้อย (`BEFORE UPDATE OF col` แทน `BEFORE UPDATE OF col`) แต่ทำได้

### 1.3 สร้าง DB initialization module

**ไฟล์ใหม่:** `src/lib/db.ts`

```typescript
import Database from "better-sqlite3";
import { readFileSync } from "node:fs";
import { join } from "node:path";

let db: Database.Database | undefined;

export function getDb(): Database.Database {
  if (!db) {
    const dbPath = process.env.DB_PATH ?? join(process.cwd(), "app.db");
    db = new Database(dbPath);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");

    // รัน schema ครั้งแรก (ถ้าตารางยังไม่มี)
    const schema = readFileSync(join(process.cwd(), "db/schema.sql"), "utf-8");
    db.exec(schema);
  }
  return db;
}
```

### 1.4 แก้ data layer (9 ไฟล์)

**ไฟล์ที่ต้องแก้:** `src/lib/api/*.ts` (929 บรรทัด)

แต่ละไฟล์เปลี่ยนจาก:
```typescript
const { data, error } = await supabase.from("products").select("*").order("name");
```
เป็น:
```typescript
const db = getDb();
const data = db.prepare("SELECT * FROM products ORDER BY name").all();
```

**รายการไฟล์:**

| ไฟล์ | บรรทัด | การเปลี่ยน |
| --- | --- | --- |
| `products.ts` | 111 | `supabase.from("products")` → SQL queries |
| `warehouses.ts` | 35 | `supabase.from("warehouses")` → SQL queries |
| `movements.ts` | 74 | `supabase.from("stock_movements")` → SQL queries |
| `customers.ts` | 172 | `supabase.from("customers")` + `cultivations` → SQL |
| `orders.ts` | 151 | `supabase.from("orders")` + `order_items` → SQL |
| `activities.ts` | 57 | `supabase.from("activities")` → SQL |
| `notifications.ts` | 59 | `supabase.from("notifications")` → SQL |
| `dashboard.ts` | 250 | `supabase.from("v_*")` → SQL queries (views ยังใช้ได้ใน SQLite) |
| `index.ts` | 20 | barrel export — ไม่ต้องแก้ |

**สิ่งที่ต้องระวัง:**
- `better-sqlite3` เป็น **synchronous** — ไม่ใช่ async ต้องเปลี่ยน function signature จาก `async` เป็น sync หรือใช้ `Promise.resolve()`
- แต่ `useQuery` รองรับทั้ง sync และ async return ได้ (คืนค่าตรง ๆ ได้)
- snake_case ↔ camelCase mapping ยังต้องทำเหมือนเดิม

### 1.5 ลบ Supabase dependencies

```bash
npm remove @supabase/supabase-js
```

**ไฟล์ที่ลบ:**
- `src/lib/supabase.ts`
- `supabase/` (folder — เก็บไว้ทำอ้างอิงได้ แต่ไม่ใช้แล้ว)

**ไฟล์ที่แก้:**
- `.env` / `.env.example` — ลบ `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- `AGENTS.md` — อัปเดตส่วน Supabase
- `README.md` — อัปเดตส่วน database

### 1.6 ทดสอบเฟส 1

```bash
npx tsc --noEmit     # typecheck
npm run lint         # lint
npm run dev          # รันและทดสอบทุกหน้า manual
```

**ทดสอบทุกหน้า:**
- แดชบอร์ด — สถิติ + กราฟ + top products/customers
- สินค้า — list + detail + edit + delete
- คลัง — รับเข้า + จ่ายออก + ปรับปรุง + นับสต็อก
- POS — ขาย + พิมพ์ใบเสร็จ
- ลูกค้า — list + detail + edit + delete
- การขาย — list + detail
- กิจกรรม + การแจ้งเตือน

---

## เฟส 2: แพ็ก Electron Desktop App + Inno Setup

### 2.1 ติดตั้ง Electron dependencies

```bash
npm add -D electron@43.3.0 electron-builder@26.15.7 electron-rebuild concurrently@9.2.4 wait-on@9.1.0 cross-env@10.1.0
```

**เวอร์ชันที่ตรวจแล้วปลอดภัย (ออกมาแล้ว >7 วัน):**
- `electron@43.3.0` (2026-08-04, 12 วัน) — ⚠️ 43.4.0 ออก 2026-08-11 (5 วัน) ใหม่เกิน 7 วัน ใช้ 43.3.0
- `electron-builder@26.15.7` (2026-07-18, 29 วัน)
- `concurrently@9.2.4` (2026-07-11, 36 วัน) — ⚠️ 10.0.5 ออกวันนี้ ใหม่เกิน ใช้ 9.2.4
- `wait-on@9.1.0` (2026-07-21, 26 วัน)
- `cross-env@10.1.0` (2025-09-29, เก่าแล้ว)

### 2.2 สร้าง Electron main process

**ไฟล์ใหม่:** `electron/main.cjs`

```javascript
const { app, BrowserWindow } = require("electron");
const { fork } = require("node:child_process");
const { join } = require("node:path");

let serverProcess = null;
let mainWindow = null;

const PORT = process.env.PORT || 47831;

function startServer() {
  // ใน dev mode ไม่ต้องรัน server เพราะ Vite dev server รันอยู่แล้ว
  if (process.env.ELECTRON_DEV) return;

  serverProcess = fork(join(__dirname, "..", ".output", "server", "index.mjs"), [], {
    env: { ...process.env, PORT: String(PORT) },
    stdio: "pipe",
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  const url = process.env.ELECTRON_DEV
    ? "http://localhost:8081"
    : `http://localhost:${PORT}`;
  mainWindow.loadURL(url);
}

app.whenReady().then(() => {
  startServer();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("quit", () => {
  if (serverProcess) serverProcess.kill();
});
```

> **หมายเหตุ:** หลังย้าย SQLite แล้ว อาจไม่ต้องรัน Nitro server แล้ว — แต่ TanStack Start ยังต้องการ SSR สำหรับ loaders ใน `products.$productId.tsx` และ `sales.$orderId.tsx` (2 ไฟล์) ต้องเช็คว่าสามารถย้าย loader มาเป็น client-side `useQuery` ได้ไหม ถ้าได้ ไม่ต้องรัน server เลย

### 2.3 เพิ่ม npm scripts

**ไฟล์:** `package.json`

```json
{
  "main": "electron/main.cjs",
  "scripts": {
    "dev": "vite dev",
    "build": "vite build",
    "lint": "eslint .",
    "format": "prettier --write .",
    "electron:dev": "concurrently \"npm:dev\" \"wait-on http://localhost:8081 && cross-env ELECTRON_DEV=1 electron .\"",
    "electron:rebuild": "electron-rebuild -f -w better-sqlite3",
    "electron:build": "npm run build && electron-builder",
    "electron:start": "npm run build && electron .",
    "build:win": "npm run build && electron-builder --win",
    "installer:win": "iscc installer/installer.iss"
  }
}
```

### 2.4 `electron-builder` config

**ไฟล์ใหม่:** `electron-builder.yml`

```yaml
appId: com.fieldstone.erp
productName: ปุ๋ยไทย CRM
directories:
  output: release
files:
  - .output/**/*
  - electron/**/*
  - db/**/*
  - package.json
extraResources:
  - from: db/schema.sql
    to: db/schema.sql
mac:
  target: dmg
  category: public.app-category.business
win:
  target: dir                    # ให้ Inno Setup ทำ installer
linux:
  target: AppImage
```

> **สำคัญ:** `better-sqlite3` เป็น native module ต้อง rebuild สำหรับ Electron ก่อน build:
> ```bash
> npm run electron:rebuild
> ```

### 2.5 Inno Setup script (Windows installer)

**ไฟล์ใหม่:** `installer/installer.iss`

```ini
#define MyAppName "ปุ๋ยไทย CRM"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "Fieldstone"
#define MyAppExeName "ปุ๋ยไทย CRM.exe"
#define BuildOutput "release\win-unpacked"

[Setup]
AppId={{A1B2C3D4-E5F6-7890-ABCD-EF1234567890}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={autopf}\{#MyAppName}
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes
OutputDir=installer\Output
OutputBaseFilename=ปุ๋ยไทยCRM-Setup-{#MyAppVersion}
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
ArchitecturesInstallIn64BitMode=x64
ArchitecturesAllowed=x64
LanguageDetectionMethod=uilanguage
ShowLanguageDialog=yes

[Languages]
Name: "thai"; MessagesFile: "compiler:Languages\Thai.isl"
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "สร้าง shortcut บน Desktop"; GroupDescription: "Additional shortcuts:"

[Files]
Source: "{#BuildOutput}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"
Name: "{group}\Uninstall {#MyAppName}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "เปิด {#MyAppName}"; Flags: nowait postinstall skipifsilent

[UninstallDelete]
Type: filesandordirs; Name: "{app}"
```

### 2.6 GitHub Actions (build Windows installer จาก macOS)

เนื่องจาก Inno Setup รันได้แค่ Windows และเครื่องผู้ใช้เป็น macOS:

**ไฟล์ใหม่:** `.github/workflows/build-windows.yml`

```yaml
name: Build Windows Installer
on:
  workflow_dispatch:
  push:
    tags: ['v*']
jobs:
  build:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm run electron:rebuild
      - run: npm run build:win
      - name: Install Inno Setup
        run: choco install innosetup -y
      - run: iscc installer/installer.iss
      - uses: actions/upload-artifact@v4
        with:
          name: ปุ๋ยไทยCRM-Setup
          path: installer/Output/*.exe
```

### 2.7 ทดสอบ + สร้าง installer

```bash
# ทดสอบรัน (dev mode)
npm run electron:dev

# ทดสอบรัน (production build)
npm run electron:start

# สร้าง macOS installer
npm run electron:build
# → release/ปุ๋ยไทย CRM-1.0.0.dmg

# สร้าง Windows installer (ต้องรันบน Windows หรือ CI)
npm run build:win
npm run installer:win
# → installer/Output/ปุ๋ยไทยCRM-Setup-1.0.0.exe
```

---

## ไฟล์ที่จะสร้าง/แก้

### เฟส 1: SQLite Migration

| ไฟล์ | การกระทำ |
| --- | --- |
| `package.json` | แก้ — เพิ่ม `better-sqlite3`, `@types/better-sqlite3`, ลบ `@supabase/supabase-js` |
| `db/schema.sql` | สร้างใหม่ — schema SQLite (9 ตาราง + 8 views + 3 triggers + seed) |
| `src/lib/db.ts` | สร้างใหม่ — DB initialization + connection |
| `src/lib/api/products.ts` | แก้ — เปลี่ยนจาก Supabase → SQLite |
| `src/lib/api/warehouses.ts` | แก้ — เปลี่ยนจาก Supabase → SQLite |
| `src/lib/api/movements.ts` | แก้ — เปลี่ยนจาก Supabase → SQLite |
| `src/lib/api/customers.ts` | แก้ — เปลี่ยนจาก Supabase → SQLite |
| `src/lib/api/orders.ts` | แก้ — เปลี่ยนจาก Supabase → SQLite |
| `src/lib/api/activities.ts` | แก้ — เปลี่ยนจาก Supabase → SQLite |
| `src/lib/api/notifications.ts` | แก้ — เปลี่ยนจาก Supabase → SQLite |
| `src/lib/api/dashboard.ts` | แก้ — เปลี่ยนจาก Supabase → SQLite |
| `src/lib/supabase.ts` | ลบ |
| `supabase/` | เก็บไว้ทำอ้างอิง (ไม่ลบ) |
| `.env` / `.env.example` | แก้ — ลบ Supabase vars |
| `AGENTS.md` | แก้ — อัปเดตส่วน database |
| `README.md` | แก้ — อัปเดตส่วน database |

### เฟส 2: Electron Packaging

| ไฟล์ | การกระทำ |
| --- | --- |
| `package.json` | แก้ — เพิ่ม Electron devDeps + scripts + `main` |
| `electron/main.cjs` | สร้างใหม่ — Electron main process |
| `electron-builder.yml` | สร้างใหม่ — packaging config |
| `installer/installer.iss` | สร้างใหม่ — Inno Setup script (ภาษาไทย) |
| `.github/workflows/build-windows.yml` | สร้างใหม่ — CI สำหรับ Windows installer |
| `.gitignore` | แก้ — เพิ่ม `release/`, `installer/Output/`, `app.db`, `app.db-*` |

---

## สรุป installer ที่จะได้ตาม platform

| Platform | เครื่องมือ | ผลลัพธ์ | รันบน |
| --- | --- | --- | --- |
| **Windows** | Inno Setup | `ปุ๋ยไทยCRM-Setup-1.0.0.exe` — installer ภาษาไทย | Windows เครื่องเป้าหมาย หรือ GitHub Actions |
| **macOS** | electron-builder | `ปุ๋ยไทย CRM-1.0.0.dmg` | macOS เครื่องตัวเอง |
| **Linux** | electron-builder | `ปุ๋ยไทย CRM-1.0.0.AppImage` | Linux (ถ้าต้องการ) |

---

## ข้อควรระวัง

### SQLite limitations ที่ต้องจัดการ

| ข้อ | วิธีจัดการ |
| --- | --- |
| `date_trunc()` ไม่มี | ใช้ `strftime('%Y-%m', date)` แทน |
| `extract(month from date)` ไม่มี | ใช้ `cast(strftime('%m', date) as integer)` |
| `to_char(date, 'Dy')` ไม่มี | ใช้ `CASE strftime('%w', date) WHEN '0' THEN 'Sun' ...` |
| `interval '6 days'` ไม่มี | ใช้ `date('now', '-6 days')` |
| `filter (where ...)` ไม่มง | ใช้ `SUM(CASE WHEN ... THEN 1 END)` |
| `generate_series()` ไม่มี | ใช้ recursive CTE ใน seed |
| `text[]` (array) ไม่มี | เก็บเป็น JSON string `'["tag1","tag2"]'` |
| `jsonb` ไม่มี | เก็บเป็น TEXT (โปรเจกต์นี้ไม่มี jsonb อยู่แล้ว) |
| `gen_random_uuid()` ไม่มี | ใช้ `lower(hex(randomblob(16)))` |
| `on conflict (col) do nothing` | SQLite รองรับ `INSERT OR IGNORE` หรือ `ON CONFLICT(col) DO NOTHING` (เหมือนกัน) |

### Electron + native module

| ข้อ | วิธีจัดการ |
| --- | --- |
| `better-sqlite3` เป็น native module | ต้อง `electron-rebuild` ก่อน build |
| Node version ต้องตรงกับ Electron's Node | ใช้ `electron-rebuild` จัดการให้ |
| ขนาด installer ใหญ่ | ~150-180 MB (Chromium + Node + app) — ปกติสำหรับ Electron |

### การเปลี่ยนจาก async → sync

`better-sqlite3` เป็น synchronous API แต่ `useQuery` รองรับทั้ง sync และ async:
```typescript
// ได้ทั้งคู่
queryFn: () => productsApi.list()           // sync return
queryFn: async () => productsApi.list()     // async wrapper (ไม่จำเป็นแต่ใช้ได้)
```

---

## ลำดับการทำงาน

1. **เฟส 1 ก่อน** — ย้าย SQLite ให้ครบ + ทดสอบทุกหน้าใน dev mode (รัน `npm run dev` ปกติ)
2. **เฟส 2 ตาม** — แพ็ก Electron + สร้าง installer

เหตุผล: ถ้าทำ Electron ก่อน แล้ว SQLite ยังไม่เสร็จ จะต้องแก้และ rebuild installer ซ้ำ ๆ เปลืองเวลา

---

## สิ่งที่จะ **ไม่** ทำใน plan นี้

- ไม่ย้าย auth ไป Supabase Auth (เป็นงานแยก — และถ้าไม่ใช้ Supabase แล้ว ไม่จำเป็น)
- ไม่เพิ่ม auto-update (`electron-updater`)
- ไม่เพิ่ม encryption สำหรับ DB file (SQLite มี extension `sqleet` แต่ไม่อยู่ใน plan นี้)
- ไม่แก้ UI / หน้า / component (แก้แค่ data layer ด้านใน)
- ไม่เพิ่ม migration tool (ใช้ schema.sql รันครั้งเดียวตอนเปิดแอปครั้งแรก)
