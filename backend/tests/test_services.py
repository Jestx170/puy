from __future__ import annotations

import os
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from db import get_db, init_db
from services import create_sale_transaction, record_stock_movement


class ServiceTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        os.environ["DB_PATH"] = str(Path(self.temp_dir.name) / "app.db")
        init_db()
        db = get_db()
        db.execute("INSERT INTO products (id, name, sku, category, stock, cost, min_stock) VALUES ('p1', 'สินค้า', 'SKU-1', 'ปุ๋ย', 10, 10, 2)")
        db.execute("INSERT INTO customers (id, name, code) VALUES ('c1', 'ลูกค้า', 'C-1')")
        db.commit()
        db.close()

    def tearDown(self) -> None:
        self.temp_dir.cleanup()
        os.environ.pop("DB_PATH", None)

    def test_stock_movement_updates_stock_and_weighted_cost(self) -> None:
        record_stock_movement("p1", "รับเข้า", 5, unit_cost=20)
        row = get_db().execute("SELECT stock, cost FROM products WHERE id = 'p1'").fetchone()
        self.assertEqual(row["stock"], 15)
        self.assertEqual(row["cost"], 13.33)

    def test_stock_movement_rejects_negative_stock(self) -> None:
        with self.assertRaises(ValueError):
            record_stock_movement("p1", "จ่ายออก", 11)

    def test_sale_is_idempotent_and_decrements_stock_once(self) -> None:
        payload = {
            "id": "order-1",
            "code": "SO-1",
            "customer_id": "c1",
            "customer_name": "ลูกค้า",
            "total": 30,
            "items": [{"product_id": "p1", "product_name": "สินค้า", "qty": 2, "price": 15}],
        }
        create_sale_transaction(payload)
        create_sale_transaction(payload)
        db = get_db()
        self.assertEqual(db.execute("SELECT stock FROM products WHERE id = 'p1'").fetchone()["stock"], 8)
        self.assertEqual(db.execute("SELECT COUNT(*) count FROM orders").fetchone()["count"], 1)
        self.assertEqual(db.execute("SELECT orders FROM customers WHERE id = 'c1'").fetchone()["orders"], 1)


if __name__ == "__main__":
    unittest.main()
