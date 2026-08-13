// ============================================================
// Fieldstone ERP — Type definitions
// รวมทุก type ของ domain model ในโปรเจกต์
// ============================================================

export type Money = number;

// --- Product ---

export type ProductStatus = "active" | "low" | "out" | "draft";

export interface Product {
  id: string;
  name: string;
  sku: string;
  barcode: string;
  category: string;
  brand: string;
  price: number;
  cost: number;
  stock: number;
  minStock: number;
  unit: string;
  status: ProductStatus;
  emoji: string;
}

// --- Customer ---

export type MemberTier = "Bronze" | "Silver" | "Gold" | "Platinum";

export type CustomerType = "เกษตรกร" | "ร้านค้าปลีก" | "สหกรณ์" | "องค์กร";

export interface Customer {
  id: string;
  name: string;
  code: string;
  phone: string;
  email: string;
  address: string;
  type: CustomerType;
  tier: MemberTier;
  lifetime: number;
  orders: number;
  lastOrder: string;
  since: string;
  notes: string;
  tags: string[];
  cultivations: Cultivation[];
}

// --- Cultivation (แปลงเพาะปลูก) ---

export const cultivationStages = [
  "เตรียมดิน",
  "ปลูก",
  "ดูแล/บำรุง",
  "ออกดอก/ติดผล",
  "เก็บเกี่ยว",
] as const;

export type CultivationStage = (typeof cultivationStages)[number];

export const stageTone: Record<
  CultivationStage,
  "neutral" | "info" | "success" | "warning" | "danger"
> = {
  เตรียมดิน: "neutral",
  ปลูก: "info",
  "ดูแล/บำรุง": "success",
  "ออกดอก/ติดผล": "warning",
  เก็บเกี่ยว: "danger",
};

export interface Cultivation {
  id: string;
  crop: string;
  stage: CultivationStage;
  area: number;
  plantedDate: string;
  expectedHarvest: string;
  location: string;
  note?: string | undefined;
}

// --- Order ---

export type OrderStatus = "paid" | "pending" | "processing" | "cancelled" | "refunded";

export type OrderChannel = "POS" | "Online" | "Sales Rep";

export type PaymentMethod = "เงินสด" | "โอนเงิน" | "บัตรเครดิต" | "QR PromptPay" | "เครดิต 30 วัน";

export interface Order {
  id: string;
  code: string;
  customer: string;
  customerId: string;
  date: string;
  total: number;
  items: number;
  status: OrderStatus;
  channel: OrderChannel;
  salesperson: string;
  payment: PaymentMethod;
}

// --- Inventory ---

export type MovementType = "รับเข้า" | "จ่ายออก" | "ปรับปรุง" | "โอนย้าย";

export type MovementStatus = "completed" | "pending" | "draft";

export interface Movement {
  id: string;
  code: string;
  type: MovementType;
  product: string;
  qty: number;
  warehouse: string;
  by: string;
  date: string;
  status: MovementStatus;
}

export interface Warehouse {
  id: string;
  name: string;
  items: number;
  value: number;
  capacity: number;
}

// --- Promotion ---

export type PromotionKind = "ส่วนลด" | "คูปอง" | "แคมเปญ" | "ชุดสินค้า";

export type PromotionStatus = "active" | "scheduled" | "ended" | "paused";

export interface Promotion {
  id: string;
  name: string;
  kind: PromotionKind;
  value: string;
  scope: string;
  start: string;
  end: string;
  used: number;
  budget: number;
  priority: number;
  status: PromotionStatus;
}

// --- Activity & Notification ---

export type ActivityKind = "order" | "customer" | "stock" | "payment" | "system";

export interface ActivityItem {
  id: string;
  actor: string;
  action: string;
  target: string;
  time: string;
  kind: ActivityKind;
}

/** ตั้งชื่อ AppNotification เพื่อไม่ให้ชนกับ `Notification` ของ DOM */
export interface AppNotification {
  id: string;
  title: string;
  description: string;
  unread: boolean;
  /** ระยะเวลาแบบอ่านง่าย เช่น "10 นาที" */
  time: string;
  /** ปลายทางเมื่อกดที่การแจ้งเตือน เช่น "/products?status=low" */
  link?: string | undefined;
}

// --- User (admin คนเดียว) ---

export type RoleName = "Owner";

export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: RoleName;
  branch: string;
  status: "active" | "invited" | "suspended";
  lastActive: string;
}
