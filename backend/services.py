from __future__ import annotations

import json
import sqlite3
import uuid
from datetime import date, datetime
from typing import Optional

from db import transaction


def _id() -> str:
    return uuid.uuid4().hex


def record_stock_movement(
    product_id: str,
    movement_type: str,
    qty: int,
    warehouse: str = "คลังหลัก",
    by_user: str = "admin",
    note: Optional[str] = None,
    reference: Optional[str] = None,
    unit_cost: float | None = None,
    expiry_date: Optional[str] = None,
) -> sqlite3.Row:
    if qty <= 0:
        raise ValueError("จำนวนต้องมากกว่า 0")
    if movement_type not in {"รับเข้า", "จ่ายออก", "ปรับปรุง", "โอนย้าย"}:
        raise ValueError("ประเภทการเคลื่อนไหวไม่ถูกต้อง")

    with transaction() as db:
        product = db.execute("SELECT * FROM products WHERE id = ?", (product_id,)).fetchone()
        if product is None:
            raise ValueError("ไม่พบสินค้า")
        signed_qty = -abs(qty) if movement_type == "จ่ายออก" else abs(qty)
        new_stock = product["stock"] + signed_qty
        if new_stock < 0:
            raise ValueError(f"สต็อก {product['name']} ไม่พอ (คงเหลือ {product['stock']})")

        new_cost = product["cost"]
        if movement_type == "รับเข้า" and unit_cost is not None and unit_cost >= 0:
            new_cost = unit_cost if product["stock"] == 0 else round(
                (product["stock"] * product["cost"] + qty * unit_cost) / new_stock, 2
            )
        code_prefix = {"รับเข้า": "IN", "จ่ายออก": "OUT", "ปรับปรุง": "ADJ", "โอนย้าย": "MV"}[movement_type]
        code = f"{code_prefix}-{datetime.now():%Y%m%d%H%M%S}-{_id()[:6]}"
        db.execute(
            """INSERT INTO stock_movements
            (id, code, type, product_id, product_name, qty, unit_cost, expiry_date, warehouse, by_user,
             note, reference, stock_before, stock_after)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (_id(), code, movement_type, product_id, product["name"], signed_qty, unit_cost, expiry_date,
             warehouse, by_user, note, reference, product["stock"], new_stock),
        )
        db.execute(
            "UPDATE products SET stock = ?, cost = ?, expiry_date = COALESCE(?, expiry_date), updated_at = datetime('now') WHERE id = ?",
            (new_stock, new_cost, expiry_date if movement_type == "รับเข้า" else None, product_id),
        )
        return db.execute("SELECT * FROM stock_movements WHERE code = ?", (code,)).fetchone()


def create_sale_transaction(payload: dict) -> sqlite3.Row:
    payload = {
        **payload,
        "customerId": payload.get("customerId", payload.get("customer_id")),
        "customerName": payload.get("customerName", payload.get("customer_name", "")),
        "salesperson": payload.get("salesperson", "admin"),
        "items": [
            {
                **item,
                "productId": item.get("productId", item.get("product_id")),
                "productName": item.get("productName", item.get("product_name")),
            }
            for item in payload.get("items", [])
        ],
    }
    with transaction() as db:
        existing = db.execute("SELECT * FROM orders WHERE id = ?", (payload["id"],)).fetchone()
        if existing is not None:
            return existing
        items = payload.get("items") or []
        if not items:
            raise ValueError("ต้องมีสินค้าอย่างน้อย 1 รายการ")
        db.execute(
            """INSERT INTO orders (id, code, customer_id, customer_name, total, items, status, channel, salesperson, payment)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (payload["id"], payload["code"], payload.get("customerId"), payload["customerName"], payload["total"],
             len(items), payload.get("status", "paid"), payload.get("channel", "POS"),
             payload.get("salesperson", "admin"), payload.get("payment", "เงินสด")),
        )
        for item in items:
            product = db.execute("SELECT * FROM products WHERE id = ?", (item["productId"],)).fetchone()
            if product is None:
                raise ValueError(f"ไม่พบสินค้า {item['productId']}")
            qty = int(item["qty"])
            if qty <= 0 or product["stock"] < qty:
                raise ValueError(f"สต็อก {product['name']} ไม่พอ")
            subtotal = float(item["price"]) * qty
            db.execute(
                "INSERT INTO order_items (order_id, product_id, product_name, qty, price, cost, subtotal) VALUES (?, ?, ?, ?, ?, ?, ?)",
                (payload["id"], product["id"], item.get("productName", product["name"]), qty, item["price"], product["cost"], subtotal),
            )
            db.execute("UPDATE products SET stock = stock - ?, updated_at = datetime('now') WHERE id = ?", (qty, product["id"]))
            db.execute(
                """INSERT INTO stock_movements (code, type, product_id, product_name, qty, warehouse, by_user, note,
                reference, stock_before, stock_after) VALUES (?, 'จ่ายออก', ?, ?, ?, 'คลังหลัก', ?, ?, ?, ?, ?)""",
                (f"OUT-{payload['code']}-{_id()[:6]}", product["id"], product["name"], -qty,
                 payload.get("salesperson", "admin"), f"ขาย POS {payload['code']}", payload["code"], product["stock"], product["stock"] - qty),
            )
        if payload.get("customerId"):
            db.execute(
                "UPDATE customers SET lifetime = lifetime + ?, orders = orders + 1, last_order = date('now'), updated_at = datetime('now') WHERE id = ?",
                (payload["total"], payload["customerId"]),
            )
        db.execute("INSERT INTO activities (actor, action, target, kind) VALUES (?, ?, ?, 'order')",
                   (payload.get("salesperson", "admin"), f"ขายหน้าร้าน {payload['code']} มูลค่า {payload['total']}", payload["customerName"]))
        return db.execute("SELECT * FROM orders WHERE id = ?", (payload["id"],)).fetchone()


def delete_product_safe(product_id: str) -> str:
    with transaction() as db:
        has_orders = db.execute("SELECT 1 FROM order_items WHERE product_id = ? LIMIT 1", (product_id,)).fetchone()
        if has_orders:
            db.execute("UPDATE products SET deleted_at = datetime('now'), status = 'discontinued' WHERE id = ?", (product_id,))
            return "soft"
        db.execute("DELETE FROM products WHERE id = ?", (product_id,))
        return "hard"


def row_json(row: Optional[sqlite3.Row]) -> Optional[dict]:
    return dict(row) if row is not None else None
