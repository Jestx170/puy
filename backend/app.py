from __future__ import annotations

import json
import mimetypes
import os
import threading
import time
import uuid
import webbrowser
from pathlib import Path
from typing import Optional, Union

from fastapi import FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from db import data_dir, get_db, init_db
from services import create_sale_transaction, delete_product_safe, record_stock_movement

app = FastAPI(title="ปุ๋ยไทย CRM", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


class ProductInput(BaseModel):
    id: Optional[str] = None
    name: str
    sku: str
    barcode: Optional[str] = None
    category: str
    brand: str = "ไม่ระบุ"
    price: float = 0
    cost: float = 0
    stock: int = Field(default=0, ge=0)
    min_stock: int = Field(default=0, ge=0)
    unit: str = "ชิ้น"
    image_url: Optional[str] = None
    expiry_date: Optional[str] = None


class MovementInput(BaseModel):
    type: str
    product_id: str
    qty: int = Field(gt=0)
    warehouse: str = "คลังหลัก"
    by_user: str = "admin"
    note: Optional[str] = None
    reference: Optional[str] = None
    unit_cost: Optional[float] = None
    expiry_date: Optional[str] = None


class SaleInput(BaseModel):
    id: str
    code: str
    customer_id: Optional[str] = None
    customer_name: str
    total: float
    status: str = "paid"
    channel: str = "POS"
    salesperson: str = "admin"
    payment: str = "เงินสด"
    items: list[dict]


def rows(query: str, params: tuple = ()) -> list[dict]:
    db = get_db()
    try:
        return [dict(row) for row in db.execute(query, params).fetchall()]
    finally:
        db.close()


def row(query: str, params: tuple = ()) -> Optional[dict]:
    result = rows(query, params)
    return result[0] if result else None


def require_row(value: Optional[dict], detail: str = "ไม่พบข้อมูล") -> dict:
    if value is None:
        raise HTTPException(status_code=404, detail=detail)
    return value


@app.on_event("startup")
def startup() -> None:
    init_db()


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/products")
def list_products(category: Optional[str] = None, status: Optional[str] = None) -> list[dict]:
    query = "SELECT * FROM products WHERE deleted_at IS NULL"
    params: list[str] = []
    if category and category != "all":
        query += " AND category = ?"
        params.append(category)
    if status and status != "all":
        query += " AND status = ?"
        params.append(status)
    return rows(query + " ORDER BY name", tuple(params))


@app.get("/api/products/{product_id}")
def get_product(product_id: str) -> dict:
    return require_row(row("SELECT * FROM products WHERE id = ?", (product_id,)), "ไม่พบสินค้า")


@app.post("/api/products")
def create_product(payload: ProductInput) -> dict:
    product_id = payload.id or f"p-{uuid.uuid4().hex[:12]}"
    db = get_db()
    try:
        db.execute(
            """INSERT INTO products (id, name, sku, barcode, category, brand, price, cost, stock, min_stock, unit, image_url, expiry_date)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (product_id, payload.name, payload.sku, payload.barcode, payload.category, payload.brand, payload.price,
             payload.cost, payload.stock, payload.min_stock, payload.unit, payload.image_url, payload.expiry_date),
        )
        db.commit()
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    finally:
        db.close()
    return get_product(product_id)


@app.patch("/api/products/{product_id}")
def update_product(product_id: str, payload: dict) -> dict:
    require_row(row("SELECT id FROM products WHERE id = ?", (product_id,)), "ไม่พบสินค้า")
    allowed = {"name", "sku", "barcode", "category", "brand", "price", "cost", "stock", "min_stock", "unit", "image_url", "expiry_date"}
    changes = [(key, value) for key, value in payload.items() if key in allowed]
    if changes:
        db = get_db()
        try:
            assignments = ", ".join(f"{key} = ?" for key, _ in changes)
            db.execute(f"UPDATE products SET {assignments}, updated_at = datetime('now') WHERE id = ?", tuple(value for _, value in changes) + (product_id,))
            db.commit()
        finally:
            db.close()
    return get_product(product_id)


@app.delete("/api/products/{product_id}")
def remove_product(product_id: str) -> dict[str, str]:
    try:
        return {"result": delete_product_safe(product_id)}
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/api/inventory/movements")
def list_movements(type: Optional[str] = None, status: Optional[str] = None) -> list[dict]:
    query = "SELECT * FROM stock_movements WHERE 1 = 1"
    params: list[str] = []
    if type and type != "all":
        query += " AND type = ?"
        params.append(type)
    if status and status != "all":
        query += " AND status = ?"
        params.append(status)
    return rows(query + " ORDER BY created_at DESC", tuple(params))


@app.post("/api/inventory/movements")
def create_movement(payload: MovementInput) -> dict:
    try:
        return dict(record_stock_movement(**payload.model_dump()))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/api/orders")
def list_orders(status: Optional[str] = None, channel: Optional[str] = None, limit: Optional[int] = Query(default=None, ge=1, le=1000)) -> list[dict]:
    query = "SELECT * FROM orders WHERE 1 = 1"
    params: list[Union[str, int]] = []
    if status and status != "all":
        query += " AND status = ?"
        params.append(status)
    if channel and channel != "all":
        query += " AND channel = ?"
        params.append(channel)
    query += " ORDER BY date DESC"
    if limit:
        query += " LIMIT ?"
        params.append(limit)
    return rows(query, tuple(params))


@app.get("/api/orders/{order_id}")
def get_order(order_id: str) -> dict:
    return require_row(row("SELECT * FROM orders WHERE id = ?", (order_id,)), "ไม่พบคำสั่งขาย")


@app.get("/api/orders/{order_id}/items")
def get_order_items(order_id: str) -> list[dict]:
    return rows("SELECT * FROM order_items WHERE order_id = ? ORDER BY rowid", (order_id,))


@app.post("/api/orders/transaction")
def sale_transaction(payload: SaleInput) -> dict:
    try:
        return dict(create_sale_transaction(payload.model_dump()))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.patch("/api/orders/{order_id}/status")
def update_order_status(order_id: str, payload: dict) -> dict:
    require_row(row("SELECT id FROM orders WHERE id = ?", (order_id,)), "ไม่พบคำสั่งขาย")
    db = get_db()
    try:
        db.execute("UPDATE orders SET status = ? WHERE id = ?", (payload["status"], order_id))
        db.commit()
    finally:
        db.close()
    return get_order(order_id)


@app.get("/api/categories")
def list_categories() -> list[dict]:
    return rows("SELECT * FROM categories ORDER BY sort_order, name")


@app.post("/api/categories")
def create_category(payload: dict) -> dict:
    db = get_db()
    try:
        db.execute("INSERT INTO categories (name, sort_order) VALUES (?, ?)", (payload["name"], payload.get("sort_order", 0)))
        db.commit()
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    finally:
        db.close()
    return require_row(row("SELECT * FROM categories WHERE name = ?", (payload["name"],)))


@app.delete("/api/categories")
def delete_category_query(name: str) -> dict[str, bool]:
    db = get_db()
    try:
        db.execute("DELETE FROM categories WHERE name = ?", (name,))
        db.commit()
    finally:
        db.close()
    return {"ok": True}


@app.delete("/api/categories/{name}")
def delete_category(name: str) -> dict[str, bool]:
    db = get_db()
    try:
        db.execute("DELETE FROM categories WHERE name = ?", (name,))
        db.commit()
    finally:
        db.close()
    return {"ok": True}


@app.get("/api/settings")
def get_settings() -> dict:
    return require_row(row("SELECT * FROM store_settings WHERE id = 1"))


@app.put("/api/settings")
def update_settings(payload: dict) -> dict:
    allowed = {"store_name", "store_address", "store_phone", "tax_id", "footer_text"}
    db = get_db()
    try:
        changes = [(key, value) for key, value in payload.items() if key in allowed]
        if changes:
            assignments = ", ".join(f"{key} = ?" for key, _ in changes)
            db.execute(f"UPDATE store_settings SET {assignments}, updated_at = datetime('now') WHERE id = 1", tuple(value for _, value in changes))
            db.commit()
    finally:
        db.close()
    return get_settings()


@app.get("/api/dashboard/stats")
def dashboard_stats() -> dict:
    return require_row(row("SELECT * FROM v_dashboard_stats"))


@app.get("/api/dashboard/top-products")
def top_products() -> list[dict]:
    return rows("""SELECT p.*, COALESCE(SUM(CASE WHEN o.status NOT IN ('cancelled','refunded') THEN oi.qty ELSE 0 END), 0) sold,
        COALESCE(SUM(CASE WHEN o.status NOT IN ('cancelled','refunded') THEN oi.subtotal ELSE 0 END), 0) revenue
        FROM products p LEFT JOIN order_items oi ON oi.product_id = p.id LEFT JOIN orders o ON o.id = oi.order_id
        WHERE p.deleted_at IS NULL GROUP BY p.id ORDER BY sold DESC LIMIT 5""")


@app.get("/api/products/expiring")
def expiring_products() -> list[dict]:
    return rows("SELECT * FROM v_expiring_products ORDER BY expiry_date")


@app.post("/api/storage/product-images/{product_id}")
def upload_product_image(product_id: str, file: UploadFile = File(...)) -> dict[str, str]:
    require_row(row("SELECT id FROM products WHERE id = ?", (product_id,)), "ไม่พบสินค้า")
    allowed = {"image/jpeg", "image/png", "image/webp", "image/gif"}
    if file.content_type not in allowed:
        raise HTTPException(status_code=400, detail="รองรับเฉพาะไฟล์รูปภาพ")
    image_dir = data_dir() / "images"
    image_dir.mkdir(parents=True, exist_ok=True)
    suffix = Path(file.filename or "image.jpg").suffix.lower() or ".jpg"
    target = image_dir / f"{product_id}-{uuid.uuid4().hex[:10]}{suffix}"
    target.write_bytes(file.file.read())
    url = f"/api/storage/files/{target.name}"
    update_product(product_id, {"image_url": url})
    return {"url": url}


@app.get("/api/storage/files/{filename}")
def serve_product_image(filename: str) -> FileResponse:
    target = (data_dir() / "images" / filename).resolve()
    image_root = (data_dir() / "images").resolve()
    if image_root not in target.parents or not target.is_file():
        raise HTTPException(status_code=404, detail="ไม่พบรูปภาพ")
    return FileResponse(target, media_type=mimetypes.guess_type(target.name)[0] or "application/octet-stream")


@app.get("/api/warehouses")
def list_warehouses() -> list[dict]:
    return rows("SELECT * FROM warehouses ORDER BY name")


@app.get("/api/customers")
def list_customers() -> list[dict]:
    result = rows("SELECT * FROM customers ORDER BY name")
    for item in result:
        item["tags"] = json.loads(item["tags"] or "[]")
    return result


@app.get("/api/customers/{customer_id}")
def get_customer(customer_id: str) -> dict:
    result = require_row(row("SELECT * FROM customers WHERE id = ?", (customer_id,)), "ไม่พบลูกค้า")
    result["tags"] = json.loads(result["tags"] or "[]")
    return result


@app.post("/api/customers")
def create_customer(payload: dict) -> dict:
    customer_id = payload.get("id") or f"c-{uuid.uuid4().hex[:12]}"
    db = get_db()
    try:
        db.execute("""INSERT INTO customers (id, name, code, phone, email, address, type, tier, lifetime, orders, last_order, since, notes, tags)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (customer_id, payload["name"], payload["code"], payload.get("phone", ""), payload.get("email", ""),
             payload.get("address", ""), payload.get("type", "เกษตรกร"), payload.get("tier", "Bronze"), payload.get("lifetime", 0),
             payload.get("orders", 0), payload.get("last_order"), payload.get("since"), payload.get("notes", ""), json.dumps(payload.get("tags", []), ensure_ascii=False)))
        db.commit()
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    finally:
        db.close()
    return get_customer(customer_id)


@app.patch("/api/customers/{customer_id}")
def update_customer(customer_id: str, payload: dict) -> dict:
    require_row(row("SELECT id FROM customers WHERE id = ?", (customer_id,)), "ไม่พบลูกค้า")
    allowed = {"name", "phone", "email", "address", "type", "tier", "lifetime", "orders", "last_order", "since", "notes", "tags"}
    changes = [(key, json.dumps(value, ensure_ascii=False) if key == "tags" else value) for key, value in payload.items() if key in allowed]
    if changes:
        db = get_db()
        try:
            db.execute(f"UPDATE customers SET {', '.join(f'{key} = ?' for key, _ in changes)}, updated_at = datetime('now') WHERE id = ?",
                       tuple(value for _, value in changes) + (customer_id,))
            db.commit()
        finally:
            db.close()
    return get_customer(customer_id)


@app.delete("/api/customers/{customer_id}")
def delete_customer(customer_id: str) -> dict[str, bool]:
    db = get_db()
    try:
        db.execute("DELETE FROM customers WHERE id = ?", (customer_id,))
        db.commit()
    finally:
        db.close()
    return {"ok": True}


@app.get("/api/cultivations")
def list_cultivations(customer_id: Optional[str] = None) -> list[dict]:
    if customer_id:
        return rows("SELECT * FROM cultivations WHERE customer_id = ? ORDER BY planted_date DESC", (customer_id,))
    return rows("SELECT * FROM cultivations ORDER BY planted_date DESC")


@app.get("/api/cultivations/next-round")
def next_round_early(customer_id: str) -> list[dict]:
    return rows("""SELECT c.id cultivation_id, c.customer_id, c.stage_id current_stage_id, c.stage current_stage_name,
        c.current_sequence, NULL next_stage_id, NULL next_stage_name, NULL next_emoji, NULL next_description,
        c.current_sequence + 1 next_sequence, NULL next_frequency_days, NULL next_action_date, NULL days_until_next
        FROM cultivations c WHERE c.customer_id = ?""", (customer_id,))


@app.get("/api/cultivations/{cultivation_id}")
def get_cultivation(cultivation_id: str) -> dict:
    return require_row(row("SELECT * FROM cultivations WHERE id = ?", (cultivation_id,)), "ไม่พบแปลง")


@app.post("/api/cultivations")
def create_cultivation(payload: dict) -> dict:
    cultivation_id = payload.get("id") or f"cult-{uuid.uuid4().hex[:12]}"
    db = get_db()
    try:
        db.execute("""INSERT INTO cultivations (id, customer_id, crop, stage, area, planted_date, expected_harvest, location, note, stage_id, current_sequence)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (cultivation_id, payload["customer_id"], payload.get("crop", "ลำไย"), payload.get("stage", "เตรียมต้นหลังเก็บเกี่ยว"),
             payload.get("area", 0), payload.get("planted_date"), payload.get("expected_harvest"), payload.get("location", ""),
             payload.get("note"), payload.get("stage_id"), payload.get("current_sequence", 0)))
        db.commit()
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    finally:
        db.close()
    return get_cultivation(cultivation_id)


@app.patch("/api/cultivations/{cultivation_id}")
def update_cultivation(cultivation_id: str, payload: dict) -> dict:
    require_row(row("SELECT id FROM cultivations WHERE id = ?", (cultivation_id,)), "ไม่พบแปลง")
    allowed = {"crop", "stage", "area", "planted_date", "expected_harvest", "location", "note", "stage_id", "current_sequence"}
    changes = [(key, value) for key, value in payload.items() if key in allowed]
    db = get_db()
    try:
        if changes:
            db.execute(f"UPDATE cultivations SET {', '.join(f'{key} = ?' for key, _ in changes)} WHERE id = ?",
                       tuple(value for _, value in changes) + (cultivation_id,))
            db.commit()
    finally:
        db.close()
    return get_cultivation(cultivation_id)


@app.delete("/api/cultivations/{cultivation_id}")
def delete_cultivation(cultivation_id: str) -> dict[str, bool]:
    db = get_db()
    try:
        db.execute("DELETE FROM cultivations WHERE id = ?", (cultivation_id,))
        db.commit()
    finally:
        db.close()
    return {"ok": True}


@app.get("/api/cultivations/{cultivation_id}/schedules")
def list_schedules(cultivation_id: str) -> list[dict]:
    return rows("SELECT * FROM cultivation_schedules WHERE cultivation_id = ? ORDER BY action_date DESC", (cultivation_id,))


@app.post("/api/cultivations/schedules")
def create_schedule(payload: dict) -> dict:
    schedule_id = payload.get("id") or uuid.uuid4().hex
    db = get_db()
    try:
        db.execute("""INSERT INTO cultivation_schedules (id, cultivation_id, stage_id, product_id, action_date, sequence, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?)""", (schedule_id, payload["cultivation_id"], payload["stage_id"], payload.get("product_id"),
                                               payload.get("action_date"), payload.get("sequence", 1), payload.get("notes")))
        db.execute("UPDATE cultivations SET stage_id = ?, current_sequence = ? WHERE id = ?",
                   (payload["stage_id"], payload.get("sequence", 1), payload["cultivation_id"]))
        db.commit()
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    finally:
        db.close()
    return require_row(row("SELECT * FROM cultivation_schedules WHERE id = ?", (schedule_id,)))


@app.get("/api/cultivations/next-round")
def next_round(customer_id: str) -> list[dict]:
    return rows("""SELECT c.id cultivation_id, c.customer_id, c.stage_id current_stage_id, c.stage current_stage_name,
        c.current_sequence, NULL next_stage_id, NULL next_stage_name, NULL next_emoji, NULL next_description,
        c.current_sequence + 1 next_sequence, NULL next_frequency_days, NULL next_action_date, NULL days_until_next
        FROM cultivations c WHERE c.customer_id = ?""", (customer_id,))


@app.post("/api/activities")
def create_activity(payload: dict) -> dict:
    db = get_db()
    try:
        cursor = db.execute("INSERT INTO activities (actor, action, target, kind) VALUES (?, ?, ?, ?)",
                            (payload.get("actor", "admin"), payload["action"], payload.get("target", ""), payload.get("kind", "system")))
        db.commit()
        return require_row(row("SELECT * FROM activities WHERE rowid = ?", (cursor.lastrowid,)))
    finally:
        db.close()


@app.get("/api/activities")
def list_activities(limit: int = Query(default=20, ge=1, le=100)) -> list[dict]:
    return rows("SELECT * FROM activities ORDER BY created_at DESC LIMIT ?", (limit,))


@app.get("/api/notifications")
def list_notifications() -> list[dict]:
    return rows("SELECT * FROM notifications ORDER BY created_at DESC")


@app.patch("/api/notifications/{notification_id}")
def mark_notification(notification_id: str, payload: dict) -> dict:
    db = get_db()
    try:
        db.execute("UPDATE notifications SET unread = ? WHERE id = ?", (int(bool(payload.get("unread", False))), notification_id))
        db.commit()
    finally:
        db.close()
    return require_row(row("SELECT * FROM notifications WHERE id = ?", (notification_id,)))


@app.get("/api/promotions")
def list_promotions(
    status: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
) -> list[dict]:
    query = "SELECT * FROM promotions WHERE 1 = 1"
    params: list[str] = []
    if status:
        query += " AND status = ?"
        params.append(status)
    if start_date:
        query += " AND start_date <= ?"
        params.append(start_date)
    if end_date:
        query += " AND end_date >= ?"
        params.append(end_date)
    return rows(query + " ORDER BY priority", tuple(params))


@app.post("/api/promotions")
def create_promotion(payload: dict) -> dict:
    promotion_id = payload.get("id") or uuid.uuid4().hex
    db = get_db()
    try:
        db.execute("""INSERT INTO promotions (id, name, kind, value, scope_type, scope, start_date, end_date, budget, priority, status, note)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (promotion_id, payload["name"], payload["kind"], payload["value"], payload.get("scope_type", "all"), payload.get("scope", "ทั้งหมด"),
             payload["start_date"], payload["end_date"], payload.get("budget", 100), payload.get("priority", 5), payload.get("status", "active"), payload.get("note")))
        db.commit()
    finally:
        db.close()
    return require_row(row("SELECT * FROM promotions WHERE id = ?", (promotion_id,)))


@app.patch("/api/promotions/{promotion_id}")
def update_promotion(promotion_id: str, payload: dict) -> dict:
    require_row(row("SELECT id FROM promotions WHERE id = ?", (promotion_id,)), "ไม่พบโปรโมชัน")
    allowed = {"name", "kind", "value", "scope_type", "scope", "start_date", "end_date", "budget", "priority", "status", "note"}
    changes = [(key, value) for key, value in payload.items() if key in allowed]
    db = get_db()
    try:
        if changes:
            db.execute(f"UPDATE promotions SET {', '.join(f'{key} = ?' for key, _ in changes)}, updated_at = datetime('now') WHERE id = ?",
                       tuple(value for _, value in changes) + (promotion_id,))
            db.commit()
    finally:
        db.close()
    return require_row(row("SELECT * FROM promotions WHERE id = ?", (promotion_id,)))


@app.delete("/api/promotions/{promotion_id}")
def delete_promotion(promotion_id: str) -> dict[str, bool]:
    db = get_db()
    try:
        db.execute("DELETE FROM promotions WHERE id = ?", (promotion_id,))
        db.commit()
    finally:
        db.close()
    return {"ok": True}


@app.post("/api/promotions/{promotion_id}/increment")
def increment_promotion(promotion_id: str) -> dict[str, bool]:
    db = get_db()
    try:
        db.execute("UPDATE promotions SET used_count = used_count + 1 WHERE id = ?", (promotion_id,))
        db.commit()
    finally:
        db.close()
    return {"ok": True}


@app.get("/api/dashboard/sales-by-day")
def sales_by_day() -> list[dict]:
    return rows("""SELECT CASE strftime('%w', date) WHEN '0' THEN 'Sun' WHEN '1' THEN 'Mon' WHEN '2' THEN 'Tue' WHEN '3' THEN 'Wed' WHEN '4' THEN 'Thu' WHEN '5' THEN 'Fri' ELSE 'Sat' END day_short,
        CAST(strftime('%w', date) AS INTEGER) day_idx, COALESCE(SUM(total), 0) sales, COUNT(*) orders FROM orders
        WHERE date >= date('now', '-6 days') AND status NOT IN ('cancelled','refunded') GROUP BY date ORDER BY date""")


@app.get("/api/dashboard/revenue-trend")
def revenue_trend() -> list[dict]:
    return rows("""SELECT strftime('%Y-%m', date) month_key, strftime('%m', date) month, COALESCE(SUM(total), 0) revenue, 0 target
        FROM orders WHERE date >= date('now', '-7 months') AND status NOT IN ('cancelled','refunded') GROUP BY month_key ORDER BY month_key""")


@app.get("/api/dashboard/profit-by-day")
def profit_by_day() -> list[dict]:
    return rows("""SELECT o.date, CASE strftime('%w', o.date) WHEN '0' THEN 'Sun' WHEN '1' THEN 'Mon' WHEN '2' THEN 'Tue' WHEN '3' THEN 'Wed' WHEN '4' THEN 'Thu' WHEN '5' THEN 'Fri' ELSE 'Sat' END day_short,
        CAST(strftime('%w', o.date) AS INTEGER) day_idx, SUM(oi.subtotal) revenue, SUM(oi.qty * oi.cost) cogs,
        SUM(oi.subtotal - oi.qty * oi.cost) profit FROM orders o JOIN order_items oi ON oi.order_id = o.id
        WHERE o.date >= date('now', '-6 days') AND o.status NOT IN ('cancelled','refunded') GROUP BY o.date ORDER BY o.date""")


@app.get("/api/dashboard/profit-by-month")
def profit_by_month() -> list[dict]:
    return rows("""SELECT strftime('%Y-%m', o.date) month_key, strftime('%m', o.date) month,
        SUM(oi.subtotal) revenue, SUM(oi.qty * oi.cost) cogs, SUM(oi.subtotal - oi.qty * oi.cost) profit
        FROM orders o JOIN order_items oi ON oi.order_id = o.id WHERE o.status NOT IN ('cancelled','refunded')
        GROUP BY month_key ORDER BY month_key""")


@app.get("/api/dashboard/best-customers")
def best_customers() -> list[dict]:
    return rows("""SELECT c.id, c.name, c.code, c.type, c.tier, COALESCE(SUM(o.total), 0) lifetime,
        COUNT(o.id) orders, MAX(o.date) last_order FROM customers c LEFT JOIN orders o ON o.customer_id = c.id
        AND o.status NOT IN ('cancelled','refunded') GROUP BY c.id ORDER BY lifetime DESC LIMIT 5""")


@app.get("/api/warehouses/summary")
def warehouse_summary() -> list[dict]:
    return rows("SELECT * FROM warehouses ORDER BY name")


@app.get("/api/crop-stages")
def list_crop_stages(crop_type: str = "ลำไย") -> list[dict]:
    return rows("SELECT * FROM crop_stages WHERE crop_type = ? ORDER BY sort_order", (crop_type,))


@app.get("/api/crop-stages/{stage_id}")
def get_crop_stage(stage_id: str) -> dict:
    return require_row(row("SELECT * FROM crop_stages WHERE id = ?", (stage_id,)), "ไม่พบระยะการปลูก")


@app.get("/api/stage-products")
def list_stage_products(stage_id: str, sequence: Optional[int] = None) -> list[dict]:
    if sequence is None:
        return rows("SELECT * FROM stage_products WHERE stage_id = ? ORDER BY sequence", (stage_id,))
    return rows("SELECT * FROM stage_products WHERE stage_id = ? AND sequence = ? ORDER BY sequence", (stage_id, sequence))


def _static_dir() -> Path:
    bundled = getattr(__import__("sys"), "_MEIPASS", None)
    return Path(bundled) / "static" if bundled else Path(__file__).resolve().parent.parent / "dist"


def open_browser() -> None:
    time.sleep(1)
    webbrowser.open("http://127.0.0.1:8000")


static_dir = _static_dir()
if static_dir.is_dir():
    app.mount("/assets", StaticFiles(directory=static_dir / "assets"), name="assets")


@app.get("/{path:path}")
def spa_fallback(path: str) -> FileResponse:
    if path.startswith("api/"):
        raise HTTPException(status_code=404, detail="ไม่พบ API")
    index = static_dir / "index.html"
    if not index.is_file():
        raise HTTPException(status_code=404, detail="ยังไม่ได้ build frontend")
    return FileResponse(index)


if __name__ == "__main__":
    import uvicorn

    init_db()
    if not os.environ.get("DEV"):
        threading.Thread(target=open_browser, daemon=True).start()
    uvicorn.run(app, host="127.0.0.1", port=int(os.environ.get("PORT", "8000")), log_level="warning")
