// ============================================================
// Fieldstone ERP — Type definitions
// รวมทุก type ของ domain model ในโปรเจกต์
// ============================================================

export type Money = number;

// --- Product ---

export type ProductStatus = "active" | "low" | "out" | "discontinued";

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

/** ระยะการดูแลลำไย 18 ระยะ (ตามตารางโปรแกรมของร้าน — แยกครั้งย่อยของใบสองและราดสาร) */
export const longanStages = [
  "เตรียมต้นหลังเก็บเกี่ยว",
  "แตกใบอ่อน ใบแรก",
  "แตกใบอ่อน ใบสอง ครั้งที่ 1",
  "แตกใบอ่อน ใบสอง ครั้งที่ 2",
  "แตกใบอ่อน ใบสอง ครั้งที่ 3",
  "แตกใบอ่อน ใบสอง ครั้งที่ 4",
  "ราดสาร ทางใบ ครั้งที่ 1",
  "ราดสาร ทางใบ ครั้งที่ 2",
  "ราดสาร ทางใบ ครั้งที่ 3",
  "ราดสาร ทางดิน",
  "เปิดตาดอก",
  "ยืดช่อดอก",
  "บำรุงช่อดอก",
  "ดอกบาน",
  "ลูกเล็ก",
  "ลูกมะเขือพวง",
  "ลูกแก้ว",
  "ก่อนเก็บ",
] as const;

/** ระยะการดูแลทุเรียน 21 ระยะ (ตามตารางโปรแกรมของร้าน) */
export const durianStages = [
  "ฟื้นต้นหลังเก็บเกี่ยว",
  "แตกใบอ่อน ชุดที่ 1",
  "ใบเพสลาด / ใบเริ่มแก่",
  "แตกใบอ่อน ชุดที่ 2",
  "ใบแก่ ชุดที่ 2",
  "แตกใบอ่อน ชุดที่ 3",
  "ใบแก่พร้อมออกดอก",
  "พักต้น / ชักนำการออกดอก",
  "เริ่มเห็นตาดอก",
  "ตาดอก / ช่อดอกพัฒนา",
  "ช่อดอกยืด",
  "ดอกบาน",
  "ติดผลอ่อน",
  "ผลระยะปิ่น / ผลเล็ก",
  "ผลอายุประมาณ 1 เดือน",
  "ผลขยาย ระยะที่ 1",
  "ผลขยาย ระยะที่ 2",
  "ผลเริ่มแก่",
  "ผลแก่ใกล้เก็บเกี่ยว",
  "ก่อนเก็บเกี่ยว",
  "เก็บเกี่ยว",
] as const;

/** ระยะที่ระบบใช้งานอยู่ — รวมทุกพืชที่ ready (ใช้ใน UI ที่ไม่กรองตาม crop) */
export const cultivationStages = [...longanStages, ...durianStages] as const;

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
  { id: "durian", name: "ทุเรียน", stages: durianStages, ready: true },
];

/** พืชที่เลือกได้จริงในฟอร์ม (มีตารางดูแลแล้ว) */
export const readyCropPrograms = cropPrograms.filter((c) => c.ready);

/** พืชเริ่มต้นของแปลงใหม่ */
export const DEFAULT_CROP = "ลำไย";

/** ระยะทั้งหมดของพืชที่เลือก — ใช้แทน cultivationStages ใน UI ที่กรองตาม crop */
export function stagesForCrop(crop: string): readonly string[] {
  const program = cropPrograms.find((p) => p.name === crop && p.ready);
  return program?.stages ?? longanStages;
}

/** รหัสระยะในตาราง crop_stages — แยกตามพืชเพราะชื่อระยะอาจซ้ำข้ามพืช (เช่น "ดอกบาน") */
export const longanStageIdByName: Record<string, string> = {
  เตรียมต้นหลังเก็บเกี่ยว: "stage_01",
  "แตกใบอ่อน ใบแรก": "stage_02",
  "แตกใบอ่อน ใบสอง ครั้งที่ 1": "stage_03",
  "แตกใบอ่อน ใบสอง ครั้งที่ 2": "stage_03",
  "แตกใบอ่อน ใบสอง ครั้งที่ 3": "stage_03",
  "แตกใบอ่อน ใบสอง ครั้งที่ 4": "stage_03",
  "ราดสาร ทางใบ ครั้งที่ 1": "stage_04",
  "ราดสาร ทางใบ ครั้งที่ 2": "stage_04",
  "ราดสาร ทางใบ ครั้งที่ 3": "stage_04",
  "ราดสาร ทางดิน": "stage_04",
  เปิดตาดอก: "stage_05",
  ยืดช่อดอก: "stage_06",
  บำรุงช่อดอก: "stage_07",
  ดอกบาน: "stage_08",
  ลูกเล็ก: "stage_09",
  ลูกมะเขือพวง: "stage_10",
  ลูกแก้ว: "stage_11",
  ก่อนเก็บ: "stage_12",
};

export const durianStageIdByName: Record<string, string> = {
  ฟื้นต้นหลังเก็บเกี่ยว: "durian_01",
  "แตกใบอ่อน ชุดที่ 1": "durian_02",
  "ใบเพสลาด / ใบเริ่มแก่": "durian_03",
  "แตกใบอ่อน ชุดที่ 2": "durian_04",
  "ใบแก่ ชุดที่ 2": "durian_05",
  "แตกใบอ่อน ชุดที่ 3": "durian_06",
  ใบแก่พร้อมออกดอก: "durian_07",
  "พักต้น / ชักนำการออกดอก": "durian_08",
  เริ่มเห็นตาดอก: "durian_09",
  "ตาดอก / ช่อดอกพัฒนา": "durian_10",
  ช่อดอกยืด: "durian_11",
  ดอกบาน: "durian_12",
  ติดผลอ่อน: "durian_13",
  "ผลระยะปิ่น / ผลเล็ก": "durian_14",
  "ผลอายุประมาณ 1 เดือน": "durian_15",
  "ผลขยาย ระยะที่ 1": "durian_16",
  "ผลขยาย ระยะที่ 2": "durian_17",
  ผลเริ่มแก่: "durian_18",
  ผลแก่ใกล้เก็บเกี่ยว: "durian_19",
  ก่อนเก็บเกี่ยว: "durian_20",
  เก็บเกี่ยว: "durian_21",
};

/** ดึงรหัสระยะตามพืช — ใช้แทน stageIdByName ที่ซ้ำข้ามพืชไม่ได้ */
export function stageIdForCrop(crop: string, stage: string): string | undefined {
  if (crop === "ทุเรียน") return durianStageIdByName[stage];
  return longanStageIdByName[stage];
}

/** @deprecated ใช้ stageIdForCrop แทน — เก็บไว้เพื่อ backward compat (ลำไยเท่านั้น) */
export const stageIdByName = longanStageIdByName;

export const stageRounds: Record<string, readonly string[]> = {
  "แตกใบอ่อน ใบสอง": longanStages.slice(2, 6),
  ราดสาร: longanStages.slice(6, 10),
};

export function cultivationStageSelection(stage: string, completedSequence = 0): string {
  const rounds = stageRounds[stage];
  return rounds ? rounds[Math.max(0, Math.min(rounds.length - 1, completedSequence))]! : stage;
}

export function cultivationStageStorage(stage: string, completedSequence?: number, crop?: string) {
  const parent = Object.entries(stageRounds).find(([, rounds]) => rounds.includes(stage));
  return {
    stage: parent?.[0] ?? stage,
    stageId: crop ? stageIdForCrop(crop, stage) : stageIdByName[stage],
    currentSequence: completedSequence ?? (parent ? parent[1].indexOf(stage) : 0),
  };
}

export const stageTone: Record<string, "neutral" | "info" | "success" | "warning" | "danger"> = {
  // ลำไย
  เตรียมต้นหลังเก็บเกี่ยว: "neutral",
  "แตกใบอ่อน ใบแรก": "success",
  "แตกใบอ่อน ใบสอง ครั้งที่ 1": "success",
  "แตกใบอ่อน ใบสอง ครั้งที่ 2": "success",
  "แตกใบอ่อน ใบสอง ครั้งที่ 3": "success",
  "แตกใบอ่อน ใบสอง ครั้งที่ 4": "success",
  "ราดสาร ทางใบ ครั้งที่ 1": "danger",
  "ราดสาร ทางใบ ครั้งที่ 2": "danger",
  "ราดสาร ทางใบ ครั้งที่ 3": "danger",
  "ราดสาร ทางดิน": "danger",
  เปิดตาดอก: "warning",
  ยืดช่อดอก: "warning",
  บำรุงช่อดอก: "warning",
  ดอกบาน: "warning",
  ลูกเล็ก: "info",
  ลูกมะเขือพวง: "info",
  ลูกแก้ว: "info",
  ก่อนเก็บ: "danger",
  // ทุเรียน
  ฟื้นต้นหลังเก็บเกี่ยว: "neutral",
  "แตกใบอ่อน ชุดที่ 1": "success",
  "ใบเพสลาด / ใบเริ่มแก่": "success",
  "แตกใบอ่อน ชุดที่ 2": "success",
  "ใบแก่ ชุดที่ 2": "success",
  "แตกใบอ่อน ชุดที่ 3": "success",
  ใบแก่พร้อมออกดอก: "neutral",
  "พักต้น / ชักนำการออกดอก": "warning",
  เริ่มเห็นตาดอก: "warning",
  "ตาดอก / ช่อดอกพัฒนา": "warning",
  ช่อดอกยืด: "warning",
  // "ดอกบาน" ใช้ค่าเดียวกันทั้งลำไยและทุเรียน
  ติดผลอ่อน: "info",
  "ผลระยะปิ่น / ผลเล็ก": "info",
  "ผลอายุประมาณ 1 เดือน": "info",
  "ผลขยาย ระยะที่ 1": "info",
  "ผลขยาย ระยะที่ 2": "info",
  ผลเริ่มแก่: "warning",
  ผลแก่ใกล้เก็บเกี่ยว: "danger",
  ก่อนเก็บเกี่ยว: "danger",
  เก็บเกี่ยว: "danger",
};

export interface Cultivation {
  id: string;
  crop: string;
  stage: string;
  area: number;
  plantedDate: string;
  expectedHarvest: string;
  location: string;
  note?: string | undefined;
  /** รหัสระยะการเจริญเติบโต (เช่น stage_01, durian_01) จากตาราง crop_stages */
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
  /** ต้นทุนต่อหน่วย ณ วันที่รับเข้า (ใช้คำนวณ weighted average cost) */
  unitCost?: number | undefined;
  /** วันหมดอายุของล็อตที่รับเข้า (FEFO — First Expired First Out) */
  expiryDate?: string | undefined;
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

export type PromotionScopeType = "category" | "product" | "customer" | "all";

export interface Promotion {
  id: string;
  name: string;
  kind: PromotionKind;
  value: string;
  scope: string;
  /** ประเภทขอบเขต (category/product/customer/all) — ใช้ตอนกรองสินค้า/ลูกค้า */
  scopeType?: PromotionScopeType | undefined;
  start: string;
  end: string;
  used: number;
  budget: number;
  priority: number;
  status: PromotionStatus;
  note?: string | undefined;
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

/** ข้อมูลร้านสำหรับพิมพ์ใบเสร็จ/ใบเสนอราคา (single-row table id = 1) */
export interface StoreSettings {
  storeName: string;
  storeAddress: string | null;
  storePhone: string | null;
  /** เลขประจำตัวผู้เสียภาษี (Tax ID) */
  taxId: string | null;
  /** ข้อความปิดท้ายใบเสร็จ (null = ใช้ default ใน print.ts) */
  footerText: string | null;
  updatedAt: string;
}

/** ค่าเริ่มต้นของข้อมูลร้าน (ใช้ก่อน Supabase ตอบกลับ หรือเมื่อยังไม่มี row) */
export const DEFAULT_STORE_SETTINGS: StoreSettings = {
  storeName: "ปุ๋ยไทย CRM",
  storeAddress: "123 ถนนเกษตร ต.ในเมือง อ.เมือง จ.ขอนแก่น 40000",
  storePhone: "043-123-456",
  taxId: null,
  footerText: null,
  updatedAt: new Date().toISOString(),
};
