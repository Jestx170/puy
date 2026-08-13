// ============================================================
// Fieldstone ERP — Mock data (seed/fallback)
// Types อยู่ใน @/types, format functions อยู่ใน @/lib/format
// ไฟล์นี้เก็บเฉพาะ mock data + re-export เพื่อ backward compat
// ============================================================

// re-export types และ format functions เพื่อไม่ให้ import เดิมพัง
export type {
  Money,
  Product,
  ProductStatus,
  Customer,
  CustomerType,
  MemberTier,
  Cultivation,
  CultivationStage,
  Order,
  OrderStatus,
  OrderChannel,
  PaymentMethod,
  Movement,
  MovementType,
  MovementStatus,
  Warehouse,
  Promotion,
  PromotionKind,
  PromotionStatus,
  ActivityItem,
  ActivityKind,
  AppNotification,
  AppUser,
  RoleName,
} from "@/types";
export { cultivationStages, stageTone } from "@/types";
export { currency, compactCurrency, numberFmt } from "@/lib/format";

// import สำหรับใช้ในไฟล์นี้
import type {
  Product,
  Customer,
  Order,
  Movement,
  Promotion,
  ActivityItem,
  AppNotification,
  AppUser,
  RoleName,
  MemberTier,
  Cultivation,
  CultivationStage,
  OrderStatus,
} from "@/types";
import { cultivationStages } from "@/types";
import { currency, compactCurrency, numberFmt } from "@/lib/format";

/* ---------------------------------- Products --------------------------------- */

export const categories = [
  "ปุ๋ยเคมี",
  "ปุ๋ยอินทรีย์",
  "ยาปราบศัตรูพืช",
  "เมล็ดพันธุ์",
  "อุปกรณ์การเกษตร",
  "ฮอร์โมนพืช",
];

const rawProducts: Array<[string, string, string, string, number, number, number, number, string]> =
  [
    ["ปุ๋ยยูเรีย 46-0-0", "FRT-4600", "ปุ๋ยเคมี", "ตราหัววัว", 780, 640, 320, 60, "🌾"],
    ["ปุ๋ยสูตร 15-15-15", "FRT-1515", "ปุ๋ยเคมี", "ตรากระต่าย", 920, 760, 148, 50, "🌱"],
    ["ปุ๋ยสูตร 16-20-0", "FRT-1620", "ปุ๋ยเคมี", "ตราหัววัว", 850, 700, 32, 40, "🌿"],
    ["ปุ๋ยคอกมูลไก่อัดเม็ด", "ORG-CHK1", "ปุ๋ยอินทรีย์", "ไร่ทองดี", 240, 170, 512, 80, "🐔"],
    ["ปุ๋ยหมักชีวภาพ 25 กก.", "ORG-BIO25", "ปุ๋ยอินทรีย์", "กรีนฟาร์ม", 310, 220, 0, 40, "♻️"],
    ["ไกลโฟเซต 1 ลิตร", "PST-GLY1", "ยาปราบศัตรูพืช", "อะกริโปร", 320, 245, 96, 30, "🧴"],
    ["อะบาเม็กติน 500 มล.", "PST-ABA5", "ยาปราบศัตรูพืช", "อะกริโปร", 285, 210, 18, 25, "🧪"],
    ["เมล็ดข้าวโพดหวาน", "SED-CRN1", "เมล็ดพันธุ์", "ซีดโปร", 145, 98, 240, 50, "🌽"],
    ["เมล็ดพันธุ์ข้าว กข.43", "SED-RIC43", "เมล็ดพันธุ์", "ซีดโปร", 620, 480, 74, 30, "🍚"],
    ["เครื่องพ่นยาสะพายหลัง", "EQP-SPR20", "อุปกรณ์การเกษตร", "ฟาร์มเทค", 1850, 1420, 22, 10, "🎒"],
    ["สายยางเกษตร 20 ม.", "EQP-HOSE20", "อุปกรณ์การเกษตร", "ฟาร์มเทค", 480, 350, 61, 15, "🪢"],
    ["ฮอร์โมนไข่ 1 ลิตร", "HRM-EGG1", "ฮอร์โมนพืช", "กรีนฟาร์ม", 260, 180, 130, 30, "🥚"],
    ["สาหร่ายสกัดเข้มข้น", "HRM-SEA5", "ฮอร์โมนพืช", "กรีนฟาร์ม", 390, 300, 12, 20, "🌊"],
    ["ปุ๋ยเกล็ดละลายน้ำ", "FRT-WSF1", "ปุ๋ยเคมี", "ตรากระต่าย", 430, 330, 205, 40, "💧"],
    ["กับดักแมลงกาวเหนียว", "PST-TRAP", "ยาปราบศัตรูพืช", "อะกริโปร", 65, 38, 640, 100, "🪤"],
    ["ถุงเพาะชำ 100 ใบ", "EQP-BAG100", "อุปกรณ์การเกษตร", "ฟาร์มเทค", 95, 60, 380, 60, "🛍️"],
  ];

export const products: Product[] = rawProducts.map(
  ([name, sku, category, brand, price, cost, stock, minStock, emoji], i) => ({
    id: `p${i + 1}`,
    name,
    sku,
    barcode: `885${(1000000 + i * 7331).toString().padStart(7, "0")}`,
    category,
    brand,
    price,
    cost,
    stock,
    minStock,
    unit: category === "ปุ๋ยเคมี" || category === "ปุ๋ยอินทรีย์" ? "กระสอบ" : "ชิ้น",
    status: stock === 0 ? "out" : stock < minStock ? "low" : "active",
    emoji,
  }),
);

export const lowStockProducts = products.filter((p) => p.status !== "active");

/* --------------------------------- Customers --------------------------------- */

// (types อยู่ใน @/types — ที่นี่เก็บแค่ mock data)

const names = [
  "สมชาย ใจดี",
  "วิภา ทองคำ",
  "สหกรณ์การเกษตรบ้านโนน",
  "ประเสริฐ ศรีสุข",
  "ร้านเกษตรรุ่งเรือง",
  "มานะ พูนผล",
  "กนกวรรณ แสงทอง",
  "บจก. ไร่เขียวขจี",
  "สุนีย์ บุญมา",
  "อำนวย เกษตรกิจ",
  "ชูใจ พึ่งพา",
  "สหกรณ์ชาวสวนยางใต้",
];

// พืชที่ปลูกในแต่ละแปลง (สุ่มจากชุดนี้)
const cropPool = [
  { crop: "ข้าว กข.43", emoji: "🍚", daysToHarvest: 110 },
  { crop: "ข้าวโพดหวาน", emoji: "🌽", daysToHarvest: 75 },
  { crop: "อ้อย", emoji: "🎋", daysToHarvest: 300 },
  { crop: "มันสำปะหลัง", emoji: "🥔", daysToHarvest: 90 },
  { crop: "ยางพารา", emoji: "🌳", daysToHarvest: 1800 },
  { crop: "ปาล์มน้ำมัน", emoji: "🌴", daysToHarvest: 1080 },
  { crop: "ข้าว กข.49", emoji: "🌾", daysToHarvest: 115 },
  { crop: "ถั่วเหลือง", emoji: "🫘", daysToHarvest: 70 },
  { crop: "พริก", emoji: "🌶️", daysToHarvest: 100 },
  { crop: "มะเขือเทศ", emoji: "🍅", daysToHarvest: 80 },
];

const plotLocations = ["แปลงหลังบ้าน", "แปลงทุ่งนา", "แปลงหัวไร่ปลายทุ่ง", "แปลงสวน", "แปลงเช่า"];

// สร้างแปลงเพาะปลูกให้ลูกค้าแต่ละราย (เกษตรกร/สหกรณ์ จะมีหลายแปลง, ร้านค้า/องค์กร อาจไม่มี)
function buildCultivations(i: number): Cultivation[] {
  const types: Customer["type"][] = ["เกษตรกร", "ร้านค้าปลีก", "สหกรณ์", "องค์กร"];
  const type = types[i % 4]!;
  // ร้านค้าปลีก/องค์กร ไม่มีแปลงเพาะปลูกของตัวเอง
  if (type === "ร้านค้าปลีก" || type === "องค์กร") return [];

  const count = type === "สหกรณ์" ? 3 : 1 + (i % 2); // เกษตรกร 1-2 แปลง, สหกรณ์ 3 แปลง
  return Array.from({ length: count }, (_, j) => {
    const crop = cropPool[(i + j) % cropPool.length]!;
    const stage = cultivationStages[(i + j * 2) % cultivationStages.length]!;
    const planted = `2026-0${1 + ((i + j) % 7)}-${String(1 + ((i * 3 + j) % 27)).padStart(2, "0")}`;
    // คำนวณวันเก็บเกี่ยวคาดการณ์ (ปีเดียวกัน/ปีถัดไป)
    const plantedMonth = 1 + ((i + j) % 7);
    const harvestMonth = ((plantedMonth - 1 + Math.ceil(crop.daysToHarvest / 30)) % 12) + 1;
    const harvestYear = plantedMonth + Math.ceil(crop.daysToHarvest / 30) > 12 ? 2027 : 2026;
    const expectedHarvest = `${harvestYear}-0${harvestMonth}-15`;
    return {
      id: `cul-${i + 1}-${j + 1}`,
      crop: crop.crop,
      stage,
      area: 2 + ((i + j * 3) % 18), // 2-19 ไร่
      plantedDate: planted,
      expectedHarvest,
      location: plotLocations[(i + j) % plotLocations.length]!,
      note: j === 0 && i % 2 === 0 ? "เริ่มใส่ปุ๋ยสูตร 15-15-15 แล้ว" : undefined,
    };
  });
}

export const customers: Customer[] = names.map((name, i) => {
  const tiers: MemberTier[] = ["Bronze", "Silver", "Gold", "Platinum"];
  const types: Customer["type"][] = ["เกษตรกร", "ร้านค้าปลีก", "สหกรณ์", "องค์กร"];
  const lifetime = 18000 + i * 24500 + (i % 3) * 31000;
  return {
    id: `c${i + 1}`,
    name,
    code: `CUS-${(1024 + i).toString()}`,
    phone: `08${(10000000 + i * 1234567).toString().slice(0, 8)}`,
    email: `customer${i + 1}@puithai.co.th`,
    address: `${44 + i} หมู่ ${1 + (i % 9)} ต.หนองบัว อ.เมือง จ.นครราชสีมา 30000`,
    type: types[i % 4]!,
    tier: tiers[(i + 1) % 4]!,
    lifetime,
    orders: 6 + i * 3,
    lastOrder: `2026-08-${String(1 + (i % 7)).padStart(2, "0")}`,
    since: `20${20 + (i % 5)}-0${1 + (i % 8)}-12`,
    notes:
      i % 2 === 0
        ? "ชอบสั่งปุ๋ยสูตรเสมอก่อนฤดูฝน ต้องการใบกำกับภาษีทุกครั้ง"
        : "ขอราคาส่งเมื่อสั่งเกิน 50 กระสอบ ติดต่อผ่านไลน์เป็นหลัก",
    tags: i % 3 === 0 ? ["ลูกค้าประจำ", "เครดิต 30 วัน"] : ["ลูกค้าประจำ"],
    cultivations: buildCultivations(i),
  };
});

// ดึงรายชื่อพืชทั้งหมดที่ลูกค้าปลูก (สำหรับใช้กรอง)
export const allCrops = Array.from(
  new Set(customers.flatMap((c) => c.cultivations.map((cul) => cul.crop))),
).sort();

/* ----------------------------------- Orders ---------------------------------- */

// (types อยู่ใน @/types)

const salespeople = ["admin"];
const statuses: OrderStatus[] = ["paid", "pending", "processing", "paid", "cancelled", "refunded"];

export const orders: Order[] = Array.from({ length: 24 }, (_, i) => {
  const cust = customers[i % customers.length]!;
  return {
    id: `o${i + 1}`,
    code: `SO-26${String(1204 + i)}`,
    customer: cust.name,
    customerId: cust.id,
    date: `2026-08-${String(7 - (i % 7)).padStart(2, "0")} ${String(9 + (i % 9)).padStart(2, "0")}:${String((i * 7) % 60).padStart(2, "0")}`,
    total: 1450 + i * 1870 + (i % 4) * 2600,
    items: 2 + (i % 7),
    status: statuses[i % statuses.length]!,
    channel: (["POS", "Online", "Sales Rep"] as const)[i % 3]!,
    salesperson: salespeople[i % salespeople.length]!,
    payment: (["เงินสด", "โอนเงิน", "บัตรเครดิต", "QR PromptPay", "เครดิต 30 วัน"] as const)[
      i % 5
    ]!,
  };
});

/* ---------------------------------- Charts ----------------------------------- */

export const salesByDay = [
  { day: "จ.", sales: 42000, orders: 18 },
  { day: "อ.", sales: 51000, orders: 24 },
  { day: "พ.", sales: 38000, orders: 16 },
  { day: "พฤ.", sales: 62000, orders: 29 },
  { day: "ศ.", sales: 74000, orders: 33 },
  { day: "ส.", sales: 91000, orders: 41 },
  { day: "อา.", sales: 68000, orders: 27 },
];

export const revenueTrend = [
  { month: "ม.ค.", revenue: 820000, target: 750000 },
  { month: "ก.พ.", revenue: 910000, target: 800000 },
  { month: "มี.ค.", revenue: 1040000, target: 900000 },
  { month: "เม.ย.", revenue: 870000, target: 900000 },
  { month: "พ.ค.", revenue: 1280000, target: 1000000 },
  { month: "มิ.ย.", revenue: 1460000, target: 1100000 },
  { month: "ก.ค.", revenue: 1610000, target: 1200000 },
  { month: "ส.ค.", revenue: 1180000, target: 1250000 },
];

export const topProducts = products.slice(0, 5).map((p, i) => ({
  ...p,
  sold: 420 - i * 61,
  revenue: (420 - i * 61) * p.price,
}));

export const bestCustomers = [...customers].sort((a, b) => b.lifetime - a.lifetime).slice(0, 5);

/* --------------------------------- Activity ---------------------------------- */

// (types อยู่ใน @/types)

export const activities: ActivityItem[] = [
  {
    id: "a1",
    actor: "ณัฐพล ว.",
    action: "สร้างคำสั่งขาย",
    target: "SO-261204",
    time: "5 นาทีที่แล้ว",
    kind: "order",
  },
  {
    id: "a2",
    actor: "ระบบ",
    action: "แจ้งเตือนสต็อกต่ำ",
    target: "ปุ๋ยสูตร 16-20-0",
    time: "18 นาทีที่แล้ว",
    kind: "stock",
  },
  {
    id: "a3",
    actor: "จิราภรณ์ ส.",
    action: "เพิ่มลูกค้าใหม่",
    target: "สุนีย์ บุญมา",
    time: "42 นาทีที่แล้ว",
    kind: "customer",
  },
  {
    id: "a4",
    actor: "พรทิพย์ ม.",
    action: "รับชำระเงิน",
    target: "SO-261198 · ฿24,500",
    time: "1 ชม.ที่แล้ว",
    kind: "payment",
  },
  {
    id: "a5",
    actor: "อดิศักดิ์ ท.",
    action: "ปรับปรุงสต็อก",
    target: "คลังหลัก · +120 กระสอบ",
    time: "2 ชม.ที่แล้ว",
    kind: "stock",
  },
  {
    id: "a6",
    actor: "ระบบ",
    action: "สำรองข้อมูลอัตโนมัติ",
    target: "สำเร็จ",
    time: "3 ชม.ที่แล้ว",
    kind: "system",
  },
];

export const notifications: AppNotification[] = [
  {
    id: "n1",
    title: "สินค้าใกล้หมด 5 รายการ",
    description: "ตรวจสอบคลังหลักก่อนเปิดร้านพรุ่งนี้",
    time: "10 นาที",
    unread: true,
    link: "/products?status=low",
  },
  {
    id: "n2",
    title: "ใบสั่งซื้อรออนุมัติ",
    description: "PO-2610 มูลค่า ฿182,000",
    time: "1 ชม.",
    unread: true,
    link: "/sales?status=pending",
  },
  {
    id: "n3",
    title: "โปรโมชันจะหมดอายุ",
    description: "ลดราคาปุ๋ยอินทรีย์ สิ้นสุดใน 2 วัน",
    time: "4 ชม.",
    unread: false,
    link: "/promotions",
  },
  {
    id: "n4",
    title: "ยอดขายเดือนนี้ถึง 94% ของเป้า",
    description: "เหลืออีก ฿70,000 ถึงเป้าหมาย",
    time: "เมื่อวาน",
    unread: false,
    link: "/sales",
  },
];

/* --------------------------------- Inventory --------------------------------- */

// (types อยู่ใน @/types)

export const movements: Movement[] = Array.from({ length: 18 }, (_, i) => ({
  id: `m${i + 1}`,
  code: `MV-26${String(3301 + i)}`,
  type: (["รับเข้า", "จ่ายออก", "ปรับปรุง", "ปรับปรุง"] as const)[i % 4]!,
  product: products[i % products.length]!.name,
  qty: (i % 4 === 1 ? -1 : 1) * (10 + i * 7),
  warehouse: "คลังหลัก",
  by: salespeople[i % salespeople.length]!,
  date: `2026-08-${String(7 - (i % 7)).padStart(2, "0")}`,
  status: (["completed", "completed", "pending", "draft"] as const)[i % 4]!,
}));

export const warehouses = [
  { id: "wh1", name: "คลังหลัก", items: 1284, value: 3420000, capacity: 78 },
];

export const stockMovementChart = [
  { day: "จ.", in: 320, out: 210 },
  { day: "อ.", in: 180, out: 260 },
  { day: "พ.", in: 410, out: 190 },
  { day: "พฤ.", in: 240, out: 320 },
  { day: "ศ.", in: 520, out: 380 },
  { day: "ส.", in: 300, out: 460 },
  { day: "อา.", in: 150, out: 180 },
];

/* -------------------------------- Promotions --------------------------------- */

// (types อยู่ใน @/types)

export const promotions: Promotion[] = [
  {
    id: "pr1",
    name: "ลดปุ๋ยอินทรีย์ต้อนรับฤดูฝน",
    kind: "ส่วนลด",
    value: "-15%",
    scope: "หมวดปุ๋ยอินทรีย์",
    start: "2026-07-01",
    end: "2026-08-09",
    used: 312,
    budget: 500,
    priority: 1,
    status: "active",
  },
  {
    id: "pr2",
    name: "คูปองลูกค้าใหม่ NEWFARM",
    kind: "คูปอง",
    value: "฿200",
    scope: "ลูกค้าใหม่ทั้งหมด",
    start: "2026-06-15",
    end: "2026-12-31",
    used: 84,
    budget: 300,
    priority: 3,
    status: "active",
  },
  {
    id: "pr3",
    name: "ซื้อ 10 แถม 1 ยูเรีย",
    kind: "แคมเปญ",
    value: "10+1",
    scope: "FRT-4600",
    start: "2026-08-01",
    end: "2026-08-31",
    used: 47,
    budget: 200,
    priority: 2,
    status: "active",
  },
  {
    id: "pr4",
    name: "ชุดเริ่มต้นปลูกข้าวโพด",
    kind: "ชุดสินค้า",
    value: "฿1,290",
    scope: "3 รายการ",
    start: "2026-08-10",
    end: "2026-09-30",
    used: 0,
    budget: 150,
    priority: 4,
    status: "scheduled",
  },
  {
    id: "pr5",
    name: "ส่วนลดสมาชิก Platinum",
    kind: "ส่วนลด",
    value: "-8%",
    scope: "สมาชิก Platinum",
    start: "2026-01-01",
    end: "2026-12-31",
    used: 521,
    budget: 1000,
    priority: 1,
    status: "active",
  },
  {
    id: "pr6",
    name: "เคลียร์สต็อกเมล็ดพันธุ์",
    kind: "แคมเปญ",
    value: "-25%",
    scope: "หมวดเมล็ดพันธุ์",
    start: "2026-05-01",
    end: "2026-06-30",
    used: 198,
    budget: 200,
    priority: 5,
    status: "ended",
  },
];

/* ----------------------------- Users & Permissions --------------------------- */

// (types อยู่ใน @/types)

export const appUsers: AppUser[] = [
  {
    id: "u1",
    name: "admin",
    email: "admin@puithai.co.th",
    role: "Owner",
    branch: "สำนักงานใหญ่",
    status: "active",
    lastActive: "ออนไลน์",
  },
];

export const roles: Array<{ name: RoleName; desc: string; members: number }> = [
  { name: "Owner", desc: "สิทธิ์เต็มทุกโมดูล รวมการตั้งค่าระบบและการเงิน", members: 1 },
];

// ระบบนี้ใช้งานโดย admin คนเดียว — ไม่มีระบบ multi-role/permission แล้ว

/* ----------------------------------- Docs ------------------------------------ */

export const documents = [
  {
    id: "d1",
    name: "ใบเสนอราคา QT-26109.pdf",
    size: "184 KB",
    date: "2026-07-28",
    kind: "ใบเสนอราคา",
  },
  {
    id: "d2",
    name: "ใบกำกับภาษี INV-26551.pdf",
    size: "212 KB",
    date: "2026-08-02",
    kind: "ใบกำกับภาษี",
  },
  { id: "d3", name: "สัญญาเครดิต 30 วัน.pdf", size: "96 KB", date: "2026-03-11", kind: "สัญญา" },
];

export const timeline = [
  {
    id: "t1",
    title: "ชำระเงินครบถ้วน",
    desc: "รับชำระ ฿24,500 ผ่าน QR PromptPay",
    time: "7 ส.ค. 2026 · 14:20",
  },
  {
    id: "t2",
    title: "จัดส่งสินค้าแล้ว",
    desc: "ส่งโดยรถบรรทุกขนส่ง",
    time: "7 ส.ค. 2026 · 10:05",
  },
  {
    id: "t3",
    title: "ยืนยันคำสั่งขาย",
    desc: "อนุมัติโดย จิราภรณ์ สุขใจ",
    time: "6 ส.ค. 2026 · 16:48",
  },
  {
    id: "t4",
    title: "สร้างคำสั่งขาย",
    desc: "สร้างจาก POS โดย ณัฐพล วงศ์ดี",
    time: "6 ส.ค. 2026 · 16:31",
  },
];
