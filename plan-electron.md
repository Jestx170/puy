# Plan: ย้าย Supabase → SQLite + Python Backend + PyInstaller Desktop App

> **เป้าหมาย:** แอปรันบนเครื่องเดียว คนเดียว offline ได้ 100% ไม่ต้องพึ่ง cloud
>
> **เหตุผลที่เปลี่ยนจาก Electron:** `better-sqlite3` รันไม่ได้ใน browser/renderer process ต้องมี IPC bridge ซับซ้อน ส่วน Python มี `sqlite3` built-in ใช้ตรง ๆ ได้เลย แถว PyInstaller ได้ installer เล็กกว่า Electron 3-4 เท่า (30-50 MB vs 150-180 MB)

---

## สถาปัตยกรรมเป้าหมาย

```
┌──────────────────────────────────────────┐
│  PyInstaller .exe (ไฟล์เดียว)            │
│                                          │
│  Python (FastAPI + uvicorn)              │
│  ├─ sqlite3 → app.db (ไฟล์เดียว)         │  ← embedded DB, built-in
│  ├─ REST API (/api/products, ฯลฯ)       │
│  ├─ serve static frontend (dist/)        │
│  └─ เปิด browser ไป localhost:PORT        │
│                                          │
│  ไม่ต้องมี Electron                       │
│  ไม่ต้องมี Chromium bundled              │
│  ไม่ต้องมี IPC bridge                     │
│  ไม่ต้องมี Supabase                       │
│  ไม่ต้องมี internet                       │
└──────────────────────────────────────────┘
```

---

## เฟส 1: แปลง Frontend จาก SSR → SPA

TanStack Start ใช้ SSR ต้องเปลี่ยนเป็น SPA เพราะ Python เสิร์ฟ static files

### 1.1 แปลง loader เป็น client-side useQuery

**ไฟล์ที่มี loader (2 ไฟล์):**
- `src/routes/products.$productId.tsx`
- `src/routes/sales.$orderId.tsx`

เปลี่ยนจาก:
```typescript
export const Route = createFileRoute('/products/$productId')({
  loader: async ({ params }) => {
    return await productsApi.get(params.productId)
  },
  component: ProductDetailPage,
})
```
เป็น:
```typescript
export const Route = createFileRoute('/products/$productId')({
  component: ProductDetailPage,
})

function ProductDetailPage() {
  const { productId } = Route.useParams()
  const { data: product } = useQuery({
    queryKey: ["product", productId],
    queryFn: () => productsApi.get(productId),
  })
  // ...
}
```

### 1.2 เปลี่ยน Vite config เป็น SPA

**ไฟล์:** `vite.config.ts`

ลบ TanStack Start plugin ออก เปลี่ยนเป็น Vite SPA ปกติ:
```typescript
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import tsConfigPaths from "vite-tsconfig-paths"

export default defineConfig({
  plugins: [react(), tailwindcss(), tsConfigPaths()],
  build: {
    outDir: "dist",
  },
})
```

### 1.3 ลบ SSR dependencies

```bash
npm remove @tanstack/start @tanstack/start-vite-plugin nitropack
```

**ไฟล์ที่ลบ:**
- `src/server.ts`
- `src/start.ts`

### 1.4 ทดสอบ SPA

```bash
npm run dev          # รันด้วย Vite dev server
npx vite build       # build → dist/
npx vite preview     # preview production build
```

---

## เฟส 2: เขียน Python Backend

### 2.1 โครงสร้างโฟลเดอร์

```
backend/
├── app.py              # FastAPI main + static serve + browser launch
├── db.py               # SQLite connection + schema init
├── schema.sql          # SQLite schema (แปลงจาก PG)
├── routes/
│   ├── __init__.py
│   ├── products.py     # CRUD products
│   ├── customers.py    # CRUD customers + cultivations
│   ├── orders.py       # orders + POS checkout (atomic)
│   ├── inventory.py    # stock movements (weighted avg + FEFO)
│   ├── promotions.py
│   ├── categories.py
│   ├── settings.py
│   ├── activities.py
│   ├── notifications.py
│   └── dashboard.py     # stats + charts + profit
├── services/
│   ├── __init__.py
│   ├── stock.py        # record_stock_movement (atomic, weighted avg, FEFO)
│   ├── sale.py         # create_sale_transaction (atomic)
│   └── product.py      # delete_product_safe (soft/hard delete)
├── requirements.txt
└── build.py            # PyInstaller build script
```

### 2.2 ติดตั้ง Python dependencies

**ไฟล์:** `backend/requirements.txt`

```
fastapi==0.115.0
uvicorn[standard]==0.30.6
pydantic==2.9.2
```

> `sqlite3` เป็น Python built-in ไม่ต้องติดตั้ง

### 2.3 แปลง schema PG → SQLite

**ไฟล์ใหม่:** `backend/schema.sql`

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
| `filter (where ...)` | `SUM(CASE WHEN ... THEN 1 END)` | SQLite ไม่มี `FILTER` syntax |
| `create extension pgcrypto` | ไม่ต้อง | SQLite มี `randomblob()` ในตัว |

**ตารางทั้งหมด (15):**
1. `products`
2. `warehouses`
3. `stock_movements`
4. `customers`
5. `cultivations`
6. `orders`
7. `order_items`
8. `activities`
9. `notifications`
10. `categories`
11. `crop_stages`
12. `stage_products`
13. `cultivation_schedules`
14. `promotions`
15. `store_settings`

**Views (10) — เขียนใหม่ทั้งหมด:**
- `v_dashboard_stats`
- `v_sales_by_day`
- `v_revenue_trend`
- `v_top_products`
- `v_best_customers`
- `v_warehouse_summary`
- `v_profit_by_day`
- `v_profit_by_month`
- `v_expiring_products`
- `v_next_round_recommendations`

**Triggers (3):**
- `trg_products_updated` → `touch_updated_at()`
- `trg_products_status` → `calc_product_status()`
- `trg_customers_updated` → `touch_updated_at()`

### 2.4 DB initialization module

**ไฟล์:** `backend/db.py`

```python
import sqlite3
import os
from pathlib import Path

def get_db_path() -> str:
    """หาที่เก็บ app.db — ใช้ user data dir ใน production"""
    if os.environ.get("DB_PATH"):
        return os.environ["DB_PATH"]
    # PyInstaller: ใช้โฟลเดอร์ข้าง .exe
    if getattr(sys, 'frozen', False):
        base = os.path.dirname(sys.executable)
        return os.path.join(base, "data", "app.db")
    # Dev: ใช้โฟลเดอร์ backend
    return os.path.join(os.path.dirname(__file__), "app.db")

def get_db() -> sqlite3.Connection:
    db_path = get_db_path()
    os.makedirs(os.path.dirname(db_path), exist_ok=True)
    db = sqlite3.connect(db_path)
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA journal_mode = WAL")
    db.execute("PRAGMA foreign_keys = ON")
    return db

def init_db():
    """รัน schema ครั้งแรก (ถ้าตารางยังไม่มี)"""
    db = get_db()
    schema_path = os.path.join(os.path.dirname(__file__), "schema.sql")
    with open(schema_path, "r", encoding="utf-8") as f:
        db.executescript(f.read())
    db.close()
```

### 2.5 FastAPI main

**ไฟล์:** `backend/app.py`

```python
import sys
import os
import webbrowser
import threading
import uvicorn
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

from db import init_db
from routes import (
    products, customers, orders, inventory,
    promotions, categories, settings,
    activities, notifications, dashboard,
)

app = FastAPI(title="ปุ๋ยไทย CRM")

# CORS สำหรับ dev mode (frontend รัน port อื่น)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# API routes
app.include_router(products.router, prefix="/api")
app.include_router(customers.router, prefix="/api")
app.include_router(orders.router, prefix="/api")
app.include_router(inventory.router, prefix="/api")
app.include_router(promotions.router, prefix="/api")
app.include_router(categories.router, prefix="/api")
app.include_router(settings.router, prefix="/api")
app.include_router(activities.router, prefix="/api")
app.include_router(notifications.router, prefix="/api")
app.include_router(dashboard.router, prefix="/api")

# Serve frontend (production)
if os.path.exists("static"):
    app.mount("/", StaticFiles(directory="static", html=True), name="static")

def open_browser():
    """เปิด browser หลัง server start"""
    import time
    time.sleep(1)
    webbrowser.open("http://localhost:8000")

if __name__ == "__main__":
    init_db()
    if not os.environ.get("DEV"):
        threading.Thread(target=open_browser, daemon=True).start()
    uvicorn.run(app, host="127.0.0.1", port=8000, log_level="warning")
```

### 2.6 ตัวอย่าง route (products)

**ไฟล์:** `backend/routes/products.py`

```python
from fastapi import APIRouter, HTTPException
from db import get_db

router = APIRouter(tags=["products"])

@router.get("/products")
def list_products(category: str = None, status: str = None):
    db = get_db()
    query = "SELECT * FROM products WHERE deleted_at IS NULL"
    params = []
    if category:
        query += " AND category = ?"
        params.append(category)
    if status:
        query += " AND status = ?"
        params.append(status)
    query += " ORDER BY name"
    rows = db.execute(query, params).fetchall()
    db.close()
    return [dict(r) for r in rows]

@router.get("/products/{product_id}")
def get_product(product_id: str):
    db = get_db()
    row = db.execute("SELECT * FROM products WHERE id = ?", (product_id,)).fetchone()
    db.close()
    if not row:
        raise HTTPException(404, "Product not found")
    return dict(row)

@router.post("/products")
def create_product(product: dict):
    db = get_db()
    db.execute(
        """INSERT INTO products (id, name, sku, barcode, category, brand,
           price, cost, stock, min_stock, unit, image_url)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (product["id"], product["name"], product["sku"], product.get("barcode"),
         product.get("category"), product.get("brand"), product["price"],
         product.get("cost", 0), product.get("stock", 0), product.get("min_stock", 0),
         product.get("unit", "ชิ้น"), product.get("image_url"))
    )
    db.commit()
    db.close()
    return product

# ... update, delete ตามรูปแบบเดียวกัน
```

### 2.7 บริการที่ซับซ้อน (atomic transactions)

**ไฟล์:** `backend/services/stock.py`

```python
from db import get_db

def record_stock_movement(product_id: str, movement_type: str, qty: int,
                          unit_cost: float = None, expiry_date: str = None,
                          note: str = None, reference: str = None):
    """บันทึก stock movement + อัปเดต products.stock + weighted avg cost + FEFO"""
    db = get_db()
    try:
        # ดึงสต็อกปัจจุบัน
        product = db.execute(
            "SELECT stock, cost FROM products WHERE id = ?", (product_id,)
        ).fetchone()
        if not product:
            raise ValueError("Product not found")

        # คำนวณ signed qty
        if movement_type in ("จ่ายออก", "ปรับปรุง"):
            signed_qty = -abs(qty)
        else:
            signed_qty = abs(qty)

        new_stock = product["stock"] + signed_qty
        if new_stock < 0:
            raise ValueError("Stock cannot be negative")

        # Weighted average cost (รับเข้าเท่านั้น)
        new_cost = product["cost"]
        if movement_type == "รับเข้า" and unit_cost is not None and unit_cost >= 0:
            if product["stock"] > 0:
                new_cost = round(
                    (product["stock"] * product["cost"] + abs(signed_qty) * unit_cost)
                    / (product["stock"] + abs(signed_qty)), 2
                )
            else:
                new_cost = unit_cost

        # บันทึก movement
        db.execute(
            """INSERT INTO stock_movements
               (id, product_id, type, qty, stock_before, stock_after,
                unit_cost, expiry_date, note, reference, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))""",
            (generate_id(), product_id, movement_type, signed_qty,
             product["stock"], new_stock, unit_cost, expiry_date, note, reference)
        )

        # อัปเดต products
        db.execute(
            "UPDATE products SET stock = ?, cost = ? WHERE id = ?",
            (new_stock, new_cost, product_id)
        )

        # FEFO: อัปเดต expiry_date เป็นวันที่ใกล้สุด
        nearest_expiry = db.execute(
            """SELECT MIN(expiry_date) as exp FROM stock_movements
               WHERE product_id = ? AND type = 'รับเข้า' AND stock_after > 0
               AND expiry_date IS NOT NULL""",
            (product_id,)
        ).fetchone()
        if nearest_expiry and nearest_expiry["exp"]:
            db.execute(
                "UPDATE products SET expiry_date = ? WHERE id = ?",
                (nearest_expiry["exp"], product_id)
            )

        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
```

**ไฟล์:** `backend/services/sale.py`

```python
def create_sale_transaction(order: dict, items: list):
    """atomic: order + items + stock + customer + activity"""
    db = get_db()
    try:
        db.execute("BEGIN")
        # 1. สร้าง order
        db.execute("INSERT INTO orders ...", (...))
        # 2. สร้าง order_items + ลดสต็อก
        for item in items:
            db.execute("INSERT INTO order_items ...", (...))
            db.execute("UPDATE products SET stock = stock - ? WHERE id = ?",
                       (item["qty"], item["product_id"]))
            db.execute("INSERT INTO stock_movements ...", (...))
        # 3. อัปเดตยอดสะสมลูกค้า
        db.execute("UPDATE customers SET total_spent = total_spent + ? WHERE id = ?",
                   (order["total"], order["customer_id"]))
        # 4. log activity
        db.execute("INSERT INTO activities ...", (...))
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
```

---

## เฟส 3: แก้ Frontend data layer

### 3.1 สร้าง API client

**ไฟล์ใหม่:** `src/lib/api/client.ts`

```typescript
const API_BASE = import.meta.env.VITE_API_BASE ?? "/api"

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  })
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(error.detail ?? "API Error")
  }
  return res.json()
}

export { apiFetch }
```

### 3.2 แก้ data layer (10 ไฟล์)

แต่ละไฟล์เปลี่ยนจาก:
```typescript
const { data, error } = await supabase.from("products").select("*").order("name")
```
เป็น:
```typescript
return apiFetch<Product[]>("/products")
```

| ไฟล์ | การเปลี่ยน |
| --- | --- |
| `products.ts` | `supabase.from("products")` → `apiFetch("/products")` |
| `warehouses.ts` | `supabase.from("warehouses")` → `apiFetch("/warehouses")` |
| `movements.ts` | `supabase.from("stock_movements")` → `apiFetch("/inventory/movements")` |
| `customers.ts` | `supabase.from("customers")` + `cultivations` → `apiFetch` |
| `orders.ts` | `supabase.from("orders")` + `order_items` → `apiFetch` |
| `activities.ts` | `supabase.from("activities")` → `apiFetch` |
| `notifications.ts` | `supabase.from("notifications")` → `apiFetch` |
| `categories.ts` | `supabase.from("categories")` → `apiFetch` |
| `promotions.ts` | `supabase.from("promotions")` → `apiFetch` |
| `settings.ts` | `supabase.from("store_settings")` → `apiFetch` |
| `dashboard.ts` | `supabase.from("v_*")` → `apiFetch("/dashboard/*")` |

### 3.3 ลบ Supabase dependencies

```bash
npm remove @supabase/supabase-js
```

**ไฟล์ที่ลบ:**
- `src/lib/supabase.ts`

**ไฟล์ที่แก้:**
- `.env` / `.env.example` — ลบ `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` เพิ่ม `VITE_API_BASE`
- `AGENTS.md` — อัปเดตส่วน Supabase
- `README.md` — อัปเดตส่วน database

---

## เฟส 4: PyInstaller Packaging

### 4.1 ติดตั้ง PyInstaller

```bash
pip install pyinstaller
```

### 4.2 Build script

**ไฟล์:** `backend/build.py`

```python
import os
import sys
import PyInstaller.__main__

# ตรวจว่า frontend build แล้ว
if not os.path.exists("dist"):
    print("ERROR: รัน npm run build ก่อน")
    sys.exit(1)

PyInstaller.__main__.run([
    "backend/app.py",
    "--onefile",
    "--name", "ปุ๋ยไทยCRM",
    # รวม schema.sql
    "--add-data", "backend/schema.sql:.",
    # รวม frontend static files
    "--add-data", "dist:static",
    # ซ่อน console (Windows)
    "--noconsole",
    # icon
    "--icon", "public/Logo.ico",
    # collect data
    "--collect-data", "fastapi",
    "--collect-data", "uvicorn",
])
```

### 4.3 npm scripts

**ไฟล์:** `package.json`

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit",
    "lint": "eslint .",
    "test": "vitest",
    "backend:dev": "cd backend && uvicorn app:app --reload --port 8000",
    "desktop:build": "npm run build && python backend/build.py",
    "desktop:dev": "concurrently \"npm:dev\" \"npm:backend:dev\""
  }
}
```

### 4.4 ทดสอบ + สร้าง installer

```bash
# Dev mode (frontend + backend แยก)
npm run desktop:dev
# → frontend: http://localhost:5173
# → backend: http://localhost:8000

# Build desktop app (ไฟล์เดียว)
npm run desktop:build
# → dist/ปุ๋ยไทยCRM.exe (Windows)
# → dist/ปุ๋ยไทยCRM (macOS/Linux)
```

### 4.5 Inno Setup (Windows installer ภาษาไทย)

**ไฟล์:** `installer/installer.iss`

```ini
#define MyAppName "ปุ๋ยไทย CRM"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "Fieldstone"
#define MyAppExeName "ปุ๋ยไทยCRM.exe"

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
Source: "dist\ปุ๋ยไทยCRM.exe"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"
Name: "{group}\Uninstall {#MyAppName}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "เปิด {#MyAppName}"; Flags: nowait postinstall skipifsilent
```

### 4.6 GitHub Actions (build Windows installer จาก macOS)

**ไฟล์:** `.github/workflows/build-windows.yml`

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
      - uses: actions/setup-python@v5
        with:
          python-version: '3.12'
      - run: npm ci
      - run: npm run build
      - run: pip install -r backend/requirements.txt pyinstaller
      - run: python backend/build.py
      - name: Install Inno Setup
        run: choco install innosetup -y
      - run: iscc installer/installer.iss
      - uses: actions/upload-artifact@v4
        with:
          name: ปุ๋ยไทยCRM-Setup
          path: installer/Output/*.exe
```

---

## ไฟล์ที่จะสร้าง/แก้

### เฟส 1: SSR → SPA

| ไฟล์ | การกระทำ |
| --- | --- |
| `vite.config.ts` | แก้ — ลบ TanStack Start plugin, เปลี่ยนเป็น SPA |
| `src/routes/products.$productId.tsx` | แก้ — แปลง loader เป็น useQuery |
| `src/routes/sales.$orderId.tsx` | แก้ — แปลง loader เป็น useQuery |
| `src/server.ts` | ลบ |
| `src/start.ts` | ลบ |
| `package.json` | แก้ — ลบ SSR deps, เพิ่ม scripts |

### เฟส 2: Python Backend

| ไฟล์ | การกระทำ |
| --- | --- |
| `backend/app.py` | สร้างใหม่ — FastAPI main + static serve + browser launch |
| `backend/db.py` | สร้างใหม่ — SQLite connection + schema init |
| `backend/schema.sql` | สร้างใหม่ — SQLite schema (15 ตาราง + 10 views + 3 triggers + seed) |
| `backend/routes/*.py` | สร้างใหม่ — 10 route files |
| `backend/services/*.py` | สร้างใหม่ — 3 service files (atomic transactions) |
| `backend/requirements.txt` | สร้างใหม่ — fastapi, uvicorn, pydantic |

### เฟส 3: Frontend data layer

| ไฟล์ | การกระทำ |
| --- | --- |
| `src/lib/api/client.ts` | สร้างใหม่ — fetch wrapper |
| `src/lib/api/products.ts` | แก้ — Supabase → fetch |
| `src/lib/api/warehouses.ts` | แก้ — Supabase → fetch |
| `src/lib/api/movements.ts` | แก้ — Supabase → fetch |
| `src/lib/api/customers.ts` | แก้ — Supabase → fetch |
| `src/lib/api/orders.ts` | แก้ — Supabase → fetch |
| `src/lib/api/activities.ts` | แก้ — Supabase → fetch |
| `src/lib/api/notifications.ts` | แก้ — Supabase → fetch |
| `src/lib/api/categories.ts` | แก้ — Supabase → fetch |
| `src/lib/api/promotions.ts` | แก้ — Supabase → fetch |
| `src/lib/api/settings.ts` | แก้ — Supabase → fetch |
| `src/lib/api/dashboard.ts` | แก้ — Supabase → fetch |
| `src/lib/supabase.ts` | ลบ |
| `.env` / `.env.example` | แก้ — ลบ Supabase vars, เพิ่ม `VITE_API_BASE` |
| `AGENTS.md` | แก้ — อัปเดตส่วน database |
| `README.md` | แก้ — อัปเดตส่วน database |

### เฟส 4: PyInstaller

| ไฟล์ | การกระทำ |
| --- | --- |
| `backend/build.py` | สร้างใหม่ — PyInstaller build script |
| `installer/installer.iss` | สร้างใหม่ — Inno Setup script (ภาษาไทย) |
| `.github/workflows/build-windows.yml` | สร้างใหม่ — CI สำหรับ Windows installer |
| `.gitignore` | แก้ — เพิ่ม `dist/`, `build/`, `*.spec`, `app.db`, `app.db-*` |
| `package.json` | แก้ — เพิ่ม `desktop:build`, `desktop:dev`, `backend:dev` scripts |

---

## สรุป installer ที่จะได้ตาม platform

| Platform | เครื่องมือ | ผลลัพธ์ | ขนาด (โดยประมาณ) |
| --- | --- | --- | --- |
| **Windows** | PyInstaller + Inno Setup | `ปุ๋ยไทยCRM-Setup-1.0.0.exe` | ~40-50 MB |
| **macOS** | PyInstaller | `ปุ๋ยไทยCRM` (executable) | ~35-45 MB |
| **Linux** | PyInstaller | `ปุ๋ยไทยCRM` (executable) | ~35-45 MB |

เทียบกับ Electron: 150-180 MB (เพราะ bundled Chromium)

---

## ข้อควรระวัง

### SQLite limitations ที่ต้องจัดการ

| ข้อ | วิธีจัดการ |
| --- | --- |
| `date_trunc()` ไม่มี | ใช้ `strftime('%Y-%m', date)` แทน |
| `extract(month from date)` ไม่มี | ใช้ `cast(strftime('%m', date) as integer)` |
| `to_char(date, 'Dy')` ไม่มี | ใช้ `CASE strftime('%w', date) WHEN '0' THEN 'Sun' ...` |
| `interval '6 days'` ไม่มี | ใช้ `date('now', '-6 days')` |
| `filter (where ...)` ไม่มี | ใช้ `SUM(CASE WHEN ... THEN 1 END)` |
| `generate_series()` ไม่มี | ใช้ recursive CTE ใน seed |
| `text[]` (array) ไม่มี | เก็บเป็น JSON string `'["tag1","tag2"]'` |
| `jsonb` ไม่มี | เก็บเป็น TEXT |
| `gen_random_uuid()` ไม่มี | ใช้ `lower(hex(randomblob(16)))` |
| `on conflict (col) do nothing` | SQLite รองรับ `INSERT OR IGNORE` หรือ `ON CONFLICT(col) DO NOTHING` |

### RPC → Python functions

PostgreSQL RPC ที่ต้องเขียนเป็น Python:

| PG RPC | Python equivalent | ไฟล์ |
| --- | --- | --- |
| `record_stock_movement` | `record_stock_movement()` | `services/stock.py` |
| `create_sale_transaction` | `create_sale_transaction()` | `services/sale.py` |
| `delete_product_safe` | `delete_product_safe()` | `services/product.py` |
| `increment_promotion_used` | inline ใน route | `routes/promotions.py` |

### การเปลี่ยนจาก async → sync

Python `sqlite3` เป็น synchronous แต่ FastAPI รองรับ sync function ได้:
```python
@router.get("/products")
def list_products():  # sync — FastAPI รันใน threadpool อัตโนมัติ
    ...
```

### PyInstaller + SQLite

| ข้อ | วิธีจัดการ |
| --- | --- |
| `schema.sql` ต้องรวมใน .exe | `--add-data backend/schema.sql:.` |
| `app.db` ต้องอยู่นอก .exe | สร้างใน user data dir ไม่ใช่ temp dir |
| `static/` (frontend) ต้องรวม | `--add-data dist:static` |
| ขนาด .exe | ~40-50 MB (Python runtime + FastAPI + uvicorn + static) |

### TanStack Start → Vite SPA

| ข้อ | วิธีจัดการ |
| --- | --- |
| `loader` ใน 2 ไฟล์ | แปลงเป็น `useQuery` ใน component |
| `createFileRoute` | เปลี่ยนเป็น `createRoute` หรือใช้ react-router |
| SSR หาย | ไม่มีผล เพราะ Python เสิร์ฟ static |
| `__root.tsx` | เก็บไว้ แต่ลบ SSR-specific code |

---

## ลำดับการทำงาน

1. **เฟส 1 ก่อน** — แปลง SSR → SPA + ทดสอบ `npm run dev`
2. **เฟส 2 ตาม** — เขียน Python backend + ทดสอบ API ด้วย curl
3. **เฟส 3 ต่อ** — แก้ frontend data layer + ทดสอบทุกหน้า
4. **เฟส 4 สุดท้าย** — PyInstaller + Inno Setup + CI

เหตุผล: ถ้าทำ PyInstaller ก่อน แล้ว backend ยังไม่เสร็จ จะต้อง rebuild ซ้ำ ๆ เปลืองเวลา

---

## สิ่งที่จะ **ไม่** ทำใน plan นี้

- ไม่ย้าย auth (เป็น localStorage ต่อไป)
- ไม่เพิ่ม auto-update
- ไม่เพิ่ม encryption สำหรับ DB file
- ไม่แก้ UI / หน้า / component (แก้แค่ data layer)
- ไม่เพิ่ม migration tool (ใช้ schema.sql รันครั้งเดียวตอนเปิดแอปครั้งแรก)
- ไม่เปลี่ยน frontend framework (ยังใช้ React + TanStack Router)
