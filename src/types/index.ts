// ============================================================
// Fieldstone ERP — Type definitions
// รวมทุก type ของ domain model ในโปรเจกต์
// ============================================================

export type Money = number;

// --- Product ---

export type ProductStatus = "active" | "low" | "out" | "draft" | "discontinued";

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
  /** URL ของรูปภาพสินค้าใน Supabase Storage (ถ้าไม่มีแสดง icon Package) */
  imageUrl?: string | undefined;
  /** วันหมดอายุสินค้า (ถ้ามี) เช่น "2026-12-31" */
  expiryDate?: string | undefined;
  /** soft delete timestamp — ถ้ามีค่าแสดงว่าสินค้าถูกตัดออกจากแคตตาล็อกแล้ว */
  deletedAt?: string | undefined;
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
//
// โครงสร้างรองรับหลายพืช แต่ตอนนี้มีตารางโปรแกรมดูแลของ "ลำไย" พืชเดียว
// เมื่อจะเพิ่มพืชใหม่ (ทุเรียน มังคุด เงาะ) ให้ทำ 3 อย่าง:
//   1. เพิ่มรายการระยะของพืชนั้น (เช่น durianStages) ไว้ในไฟล์นี้
//   2. เพิ่ม entry ใน `cropPrograms` พร้อมตั้ง ready: true
//   3. เพิ่ม playbook ของพืชนั้นใน @/lib/agronomy และ seed crop_stages/stage_products ใน Supabase

/** ระยะการดูแลลำไย 12 ระยะ (ตามตารางโปรแกรมของร้าน) */
export const longanStages = [
  "เตรียมต้นหลังเก็บเกี่ยว",
  "แตกใบอ่อน ใบแรก",
  "แตกใบอ่อน ใบสอง",
  "ราดสาร",
  "เปิดตาดอก",
  "ยืดช่อดอก",
  "บำรุงช่อดอก",
  "ดอกบาน",
  "ลูกเล็ก",
  "ลูกมะเขือพวง",
  "ลูกแก้ว",
  "ก่อนเก็บ",
] as const;

/** ระยะที่ระบบใช้งานอยู่ — ตอนนี้เท่ากับของลำไย เพราะมีโปรแกรมเดียว */
export const cultivationStages = longanStages;

export type CultivationStage = (typeof cultivationStages)[number];

/** โปรแกรมการดูแลของแต่ละพืช — ใช้เป็นทะเบียนกลางสำหรับขยายพืชในอนาคต */
export interface CropProgram {
  /** รหัสภายใน เช่น "longan" */
  id: string;
  /** ชื่อพืชที่บันทึกลง cultivations.crop และใช้เป็น crop_stages.crop_type */
  name: string;
  /** ระยะทั้งหมดของพืชนี้ (ว่าง = ยังไม่มีตารางดูแล) */
  stages: readonly string[];
  /** พร้อมใช้งานจริงหรือยัง — false = ยังทำตารางดูแลไม่เสร็จ */
  ready: boolean;
}

export const cropPrograms: readonly CropProgram[] = [
  { id: "longan", name: "ลำไย", stages: longanStages, ready: true },
  { id: "durian", name: "ทุเรียน", stages: [], ready: false },
  { id: "mangosteen", name: "มังคุด", stages: [], ready: false },
  { id: "rambutan", name: "เงาะ", stages: [], ready: false },
];

/** พืชที่เลือกได้จริงในฟอร์ม (มีตารางดูแลแล้ว) */
export const readyCropPrograms = cropPrograms.filter((c) => c.ready);

/** พืชเริ่มต้นของแปลงใหม่ */
export const DEFAULT_CROP = "ลำไย";

/** รหัสระยะในตาราง crop_stages ของแต่ละชื่อระยะ */
export const stageIdByName: Record<CultivationStage, string> = {
  เตรียมต้นหลังเก็บเกี่ยว: "stage_01",
  "แตกใบอ่อน ใบแรก": "stage_02",
  "แตกใบอ่อน ใบสอง": "stage_03",
  ราดสาร: "stage_04",
  เปิดตาดอก: "stage_05",
  ยืดช่อดอก: "stage_06",
  บำรุงช่อดอก: "stage_07",
  ดอกบาน: "stage_08",
  ลูกเล็ก: "stage_09",
  ลูกมะเขือพวง: "stage_10",
  ลูกแก้ว: "stage_11",
  ก่อนเก็บ: "stage_12",
};

/** อีโมจิประจำระยะ ใช้ให้ตรงกับ crop_stages.emoji */
export const stageEmoji: Record<CultivationStage, string> = {
  เตรียมต้นหลังเก็บเกี่ยว: "🌱",
  "แตกใบอ่อน ใบแรก": "🌿",
  "แตกใบอ่อน ใบสอง": "🍃",
  ราดสาร: "💀",
  เปิดตาดอก: "🌸",
  ยืดช่อดอก: "🌺",
  บำรุงช่อดอก: "🌷",
  ดอกบาน: "🌼",
  ลูกเล็ก: "🍒",
  ลูกมะเขือพวง: "🍊",
  ลูกแก้ว: "🍏",
  ก่อนเก็บ: "👍",
};

export const stageTone: Record<
  CultivationStage,
  "neutral" | "info" | "success" | "warning" | "danger"
> = {
  เตรียมต้นหลังเก็บเกี่ยว: "neutral",
  "แตกใบอ่อน ใบแรก": "success",
  "แตกใบอ่อน ใบสอง": "success",
  ราดสาร: "danger",
  เปิดตาดอก: "warning",
  ยืดช่อดอก: "warning",
  บำรุงช่อดอก: "warning",
  ดอกบาน: "warning",
  ลูกเล็ก: "info",
  ลูกมะเขือพวง: "info",
  ลูกแก้ว: "info",
  ก่อนเก็บ: "danger",
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
  /** รหัสระยะการเจริญเติบโต (เช่น stage_01) จากตาราง crop_stages */
  stageId?: string | undefined;
  /** ครั้งที่เท่าไรใน stage ปัจจุบัน (เริ่มที่ 0) */
  currentSequence?: number | undefined;
}

// --- Crop Stage (ระยะการเจริญเติบโต — โปรแกรมการดูแลลำไย 12 ระยะ) ---

export interface CropStage {
  id: string;
  name: string;
  emoji: string;
  description: string | null;
  daysMin: number | null;
  daysMax: number | null;
  frequencyDays: number | null;
  sortOrder: number;
  cropType: string;
}

export interface StageProduct {
  id: string;
  stageId: string;
  productId: string | null;
  formula: string | null;
  sequence: number;
  isOptional: boolean;
}

export interface CultivationSchedule {
  id: string;
  cultivationId: string;
  stageId: string;
  productId: string | null;
  actionDate: string;
  sequence: number;
  notes: string | null;
}

/** ข้อมูลรอบถัดไปของแปลง — ใช้ใน UI แนะนำสินค้า */
export interface NextRoundInfo {
  cultivationId: string;
  customerId: string;
  currentStageId: string | null;
  currentStageName: string | null;
  currentEmoji: string | null;
  currentSequence: number;
  nextStageId: string | null;
  nextStageName: string | null;
  nextEmoji: string | null;
  nextDescription: string | null;
  nextSequence: number;
  nextFrequencyDays: number | null;
  nextActionDate: string | null;
  /** อีกกี่วันจะถึงรอบถัดไป (ติดลบ = เลยกำหนดแล้ว, null = ไม่ทราบ) */
  daysUntilNext: number | null;
}

/** สินค้าที่แนะนำในรอบถัดไป */
export interface RecommendedProduct {
  productId: string;
  productName: string;
  sku: string;
  price: number;
  stock: number;
  formula: string | null;
  sequence: number;
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

/** รายการสินค้าในออเดอร์ (จากตาราง order_items) */
export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  productName: string;
  qty: number;
  price: number;
  cost: number;
  subtotal: number;
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
  /** audit trail — stock ก่อน/หลังการเคลื่อนไหว */
  stockBefore?: number | null;
  stockAfter?: number | null;
  /** อ้างอิงเอกสารต้นทาง เช่น เลขที่ออเดอร์ POS */
  reference?: string | null;
  note?: string | null;
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
