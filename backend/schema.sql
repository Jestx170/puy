PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  sku TEXT NOT NULL UNIQUE,
  barcode TEXT,
  category TEXT NOT NULL,
  brand TEXT NOT NULL DEFAULT 'ไม่ระบุ',
  price REAL NOT NULL DEFAULT 0,
  cost REAL NOT NULL DEFAULT 0,
  stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  min_stock INTEGER NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'ชิ้น',
  status TEXT NOT NULL DEFAULT 'active',
  image_url TEXT,
  deleted_at TEXT,
  expiry_date TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS warehouses (
  id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, items INTEGER NOT NULL DEFAULT 0,
  value REAL NOT NULL DEFAULT 0, capacity INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))), name TEXT NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS stock_movements (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))), code TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('รับเข้า','จ่ายออก','ปรับปรุง','โอนย้าย')),
  product_id TEXT REFERENCES products(id) ON DELETE SET NULL, product_name TEXT NOT NULL,
  qty INTEGER NOT NULL, unit_cost REAL, expiry_date TEXT, warehouse TEXT NOT NULL DEFAULT 'คลังหลัก',
  by_user TEXT NOT NULL DEFAULT 'admin', note TEXT, status TEXT NOT NULL DEFAULT 'completed',
  stock_before INTEGER, stock_after INTEGER, reference TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')), date TEXT NOT NULL DEFAULT (date('now'))
);
CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, code TEXT NOT NULL UNIQUE, phone TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '', address TEXT NOT NULL DEFAULT '', type TEXT NOT NULL DEFAULT 'เกษตรกร',
  tier TEXT NOT NULL DEFAULT 'Bronze', lifetime REAL NOT NULL DEFAULT 0, orders INTEGER NOT NULL DEFAULT 0,
  last_order TEXT, since TEXT, notes TEXT NOT NULL DEFAULT '', tags TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS crop_stages (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, emoji TEXT NOT NULL DEFAULT '🌱', description TEXT,
  days_min INTEGER, days_max INTEGER, frequency_days INTEGER, sort_order INTEGER NOT NULL,
  crop_type TEXT NOT NULL DEFAULT 'ลำไย', created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS cultivations (
  id TEXT PRIMARY KEY, customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  crop TEXT NOT NULL DEFAULT 'ลำไย', stage TEXT NOT NULL, area REAL NOT NULL DEFAULT 0,
  planted_date TEXT, expected_harvest TEXT, location TEXT NOT NULL DEFAULT '', note TEXT,
  stage_id TEXT REFERENCES crop_stages(id), current_sequence INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY, code TEXT NOT NULL UNIQUE, customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL, order_date TEXT NOT NULL DEFAULT (datetime('now')), date TEXT NOT NULL DEFAULT (date('now')),
  total REAL NOT NULL DEFAULT 0, items INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending', channel TEXT NOT NULL DEFAULT 'POS', salesperson TEXT NOT NULL DEFAULT 'admin',
  payment TEXT NOT NULL DEFAULT 'เงินสด', created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS order_items (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))), order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id TEXT REFERENCES products(id) ON DELETE SET NULL, product_name TEXT NOT NULL,
  qty INTEGER NOT NULL DEFAULT 1, price REAL NOT NULL DEFAULT 0, cost REAL NOT NULL DEFAULT 0, subtotal REAL NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS activities (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))), actor TEXT NOT NULL, action TEXT NOT NULL,
  target TEXT NOT NULL DEFAULT '', kind TEXT NOT NULL DEFAULT 'system', created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))), title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '',
  unread INTEGER NOT NULL DEFAULT 1, link TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS stage_products (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))), stage_id TEXT NOT NULL REFERENCES crop_stages(id) ON DELETE CASCADE,
  product_id TEXT REFERENCES products(id) ON DELETE CASCADE, formula TEXT, sequence INTEGER NOT NULL DEFAULT 1,
  is_optional INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS cultivation_schedules (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))), cultivation_id TEXT NOT NULL REFERENCES cultivations(id) ON DELETE CASCADE,
  stage_id TEXT NOT NULL REFERENCES crop_stages(id), product_id TEXT REFERENCES products(id) ON DELETE SET NULL,
  action_date TEXT, sequence INTEGER NOT NULL DEFAULT 1, notes TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(cultivation_id, stage_id, sequence)
);
CREATE TABLE IF NOT EXISTS care_program_rounds (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))), stage_id TEXT NOT NULL REFERENCES crop_stages(id) ON DELETE CASCADE,
  sequence INTEGER NOT NULL, method TEXT, spacing_note TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(stage_id, sequence)
);
CREATE TABLE IF NOT EXISTS care_program_groups (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))), round_id TEXT NOT NULL REFERENCES care_program_rounds(id) ON DELETE CASCADE,
  group_key TEXT NOT NULL, label TEXT NOT NULL, alternatives INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')), UNIQUE(round_id, group_key)
);
CREATE TABLE IF NOT EXISTS care_program_options (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))), group_id TEXT NOT NULL REFERENCES care_program_groups(id) ON DELETE CASCADE,
  sku TEXT NOT NULL, label TEXT NOT NULL, product_id TEXT REFERENCES products(id) ON DELETE SET NULL,
  sort_order INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT (datetime('now')), UNIQUE(group_id, sku)
);
CREATE TABLE IF NOT EXISTS store_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1), store_name TEXT NOT NULL DEFAULT 'ปุ๋ยไทย CRM', store_address TEXT,
  store_phone TEXT, tax_id TEXT, footer_text TEXT, updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS promotions (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))), name TEXT NOT NULL,
  kind TEXT NOT NULL, value TEXT NOT NULL, scope_type TEXT NOT NULL DEFAULT 'all', scope TEXT NOT NULL DEFAULT 'ทั้งหมด',
  start_date TEXT NOT NULL, end_date TEXT NOT NULL, used_count INTEGER NOT NULL DEFAULT 0,
  budget INTEGER NOT NULL DEFAULT 100, priority INTEGER NOT NULL DEFAULT 5, status TEXT NOT NULL DEFAULT 'active',
  note TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
CREATE INDEX IF NOT EXISTS idx_movements_product ON stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_movements_date ON stock_movements(date DESC);
CREATE INDEX IF NOT EXISTS idx_orders_date ON orders(date DESC);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_cultivations_customer ON cultivations(customer_id);
CREATE INDEX IF NOT EXISTS idx_schedules_cultivation ON cultivation_schedules(cultivation_id, action_date DESC);

CREATE TRIGGER IF NOT EXISTS trg_products_status_insert AFTER INSERT ON products
BEGIN
  UPDATE products SET status = CASE WHEN stock = 0 THEN 'out' WHEN stock < min_stock THEN 'low' ELSE 'active' END WHERE id = NEW.id;
END;
CREATE TRIGGER IF NOT EXISTS trg_products_status_update AFTER UPDATE OF stock, min_stock ON products
BEGIN
  UPDATE products SET status = CASE WHEN stock = 0 THEN 'out' WHEN stock < min_stock THEN 'low' ELSE 'active' END, updated_at = datetime('now') WHERE id = NEW.id;
END;
CREATE TRIGGER IF NOT EXISTS trg_products_updated AFTER UPDATE ON products
WHEN NEW.updated_at = OLD.updated_at
BEGIN
  UPDATE products SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE VIEW IF NOT EXISTS v_expiring_products AS
SELECT id, name, sku, barcode, category, brand, stock, unit, image_url, expiry_date,
  CASE WHEN expiry_date < date('now') THEN 'expired' WHEN expiry_date <= date('now', '+7 days') THEN 'critical' ELSE 'warning' END AS expiry_status,
  CAST(julianday(expiry_date) - julianday(date('now')) AS INTEGER) AS days_until_expiry
FROM products WHERE deleted_at IS NULL AND expiry_date IS NOT NULL AND expiry_date <= date('now', '+30 days');
CREATE VIEW IF NOT EXISTS v_dashboard_stats AS
SELECT
 (SELECT COALESCE(SUM(total), 0) FROM orders WHERE date = date('now') AND status NOT IN ('cancelled','refunded')) AS today_sales,
 (SELECT COUNT(*) FROM orders WHERE date = date('now') AND status NOT IN ('cancelled','refunded')) AS today_orders,
 (SELECT COUNT(*) FROM customers) AS total_customers,
 (SELECT COUNT(*) FROM products WHERE status IN ('low','out')) AS low_stock_count,
 (SELECT COALESCE(SUM(total), 0) FROM orders WHERE strftime('%Y-%m', date) = strftime('%Y-%m', 'now') AND status NOT IN ('cancelled','refunded')) AS month_sales,
 (SELECT COUNT(*) FROM orders WHERE status = 'pending') AS pending_orders,
 (SELECT COALESCE(SUM(oi.subtotal - oi.qty * oi.cost), 0) FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE o.date = date('now') AND o.status NOT IN ('cancelled','refunded')) AS today_profit,
 (SELECT COALESCE(SUM(oi.subtotal - oi.qty * oi.cost), 0) FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE strftime('%Y-%m', o.date) = strftime('%Y-%m', 'now') AND o.status NOT IN ('cancelled','refunded')) AS month_profit,
 (SELECT COALESCE(SUM(oi.qty * oi.cost), 0) FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE strftime('%Y-%m', o.date) = strftime('%Y-%m', 'now') AND o.status NOT IN ('cancelled','refunded')) AS month_cogs;

INSERT OR IGNORE INTO warehouses(id, name, capacity) VALUES ('wh1', 'คลังหลัก', 0);
INSERT OR IGNORE INTO store_settings(id, store_name) VALUES (1, 'ปุ๋ยไทย CRM');
INSERT OR IGNORE INTO categories(name, sort_order) VALUES ('ปุ๋ยเคมี', 1), ('ปุ๋ยอินทรีย์', 2), ('ยาปราบศัตรูพืช', 3), ('เมล็ดพันธุ์', 4), ('อุปกรณ์เกษตร', 5), ('ฮอร์โมน/สารเสริม', 6);
INSERT OR IGNORE INTO crop_stages(id, name, sort_order, crop_type) VALUES
 ('stage_01','เตรียมต้นหลังเก็บเกี่ยว',1,'ลำไย'), ('stage_02','แตกใบอ่อน ใบแรก',2,'ลำไย'),
 ('stage_03','แตกใบอ่อน ใบสอง',3,'ลำไย'), ('stage_04','ราดสาร',4,'ลำไย'),
 ('stage_05','เปิดตาดอก',5,'ลำไย'), ('stage_06','ยืดช่อดอก',6,'ลำไย'),
 ('stage_07','บำรุงช่อดอก',7,'ลำไย'), ('stage_08','ดอกบาน',8,'ลำไย'),
 ('stage_09','ลูกเล็ก',9,'ลำไย'), ('stage_10','ลูกมะเขือพวง',10,'ลำไย'),
 ('stage_11','ลูกแก้ว',11,'ลำไย'), ('stage_12','ก่อนเก็บ',12,'ลำไย');
