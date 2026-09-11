// ============================================================
// Fieldstone ERP — Agronomy engine
// แปลงข้อมูลการเพาะปลูกของลูกค้า (พืช/ช่วง/พื้นที่/วันปลูก)
// ให้เป็นข้อเสนอขายที่จับต้องได้: สินค้าอะไร ปริมาณเท่าไหร่ เมื่อไหร่
// ============================================================

import type { Cultivation, CultivationStage, Customer, Product } from "@/types";
import { cultivationStages } from "@/types";

/* ------------------------- 1) รอบการดูแลลำไย ------------------------- */

/**
 * จำนวนวันของแต่ละระยะ (ค่ากลางของช่วงในตารางโปรแกรมดูแลลำไย)
 * ใช้คำนวณว่า ณ วันนี้แปลงควรอยู่ระยะไหน และอีกกี่วันจะเข้าระยะถัดไป
 */
export const stageDurationDays: Record<CultivationStage, number> = {
  เตรียมต้นหลังเก็บเกี่ยว: 52, // 45-60 วัน
  "แตกใบอ่อน ใบแรก": 12, // 10-15 วัน
  "แตกใบอ่อน ใบสอง": 25, // 20-30 วัน
  ราดสาร: 10, // กรอบ 10 วัน
  เปิดตาดอก: 12, // 10-14 วัน
  ยืดช่อดอก: 12,
  บำรุงช่อดอก: 12,
  ดอกบาน: 12,
  ลูกเล็ก: 60,
  ลูกมะเขือพวง: 60,
  ลูกแก้ว: 45,
  ก่อนเก็บ: 20,
};

/** ความถี่การพ่นของแต่ละระยะ (วัน/ครั้ง) — null = ทำครั้งเดียว/ตามสภาพต้น */
export const stageFrequencyDays: Record<CultivationStage, number | null> = {
  เตรียมต้นหลังเก็บเกี่ยว: 15,
  "แตกใบอ่อน ใบแรก": null,
  "แตกใบอ่อน ใบสอง": 7,
  ราดสาร: 2,
  เปิดตาดอก: 6,
  ยืดช่อดอก: 6,
  บำรุงช่อดอก: 6,
  ดอกบาน: 6,
  ลูกเล็ก: 12,
  ลูกมะเขือพวง: 12,
  ลูกแก้ว: 10,
  ก่อนเก็บ: 9,
};

/** ความยาวรอบการดูแลลำไยทั้งรอบ (วัน) — รวมทุกระยะ */
export const LONGAN_CYCLE_DAYS = cultivationStages.reduce(
  (sum, stage) => sum + stageDurationDays[stage],
  0,
);

/** ระบบนี้รองรับลำไยเท่านั้น จึงใช้รอบเดียวกับทุกแปลง */
export const cycleDaysFor = (_crop?: string) => LONGAN_CYCLE_DAYS;

/** ขอบเขตสะสมของแต่ละระยะ (สัดส่วน 0-1 ของรอบทั้งหมด) */
const stageBounds = (() => {
  let acc = 0;
  return cultivationStages.map((stage) => {
    const start = acc;
    acc += stageDurationDays[stage] / LONGAN_CYCLE_DAYS;
    return { stage, start, end: acc };
  });
})();

/* ------------------------ 2) สินค้าที่ต้องใช้ในแต่ละช่วง ------------------------ */

export interface StageItem {
  /** SKU ของสินค้าในคลัง */
  sku: string;
  /**
   * ปริมาณที่ใช้ต่อไร่ (หน่วยตามสินค้า)
   * null = ไม่คิดตามพื้นที่ (อุปกรณ์ ซื้อครั้งเดียว) ให้ใช้ fixedQty
   */
  ratePerRai: number | null;
  fixedQty?: number;
  /** เหตุผลที่แนะนำ — แสดงให้พนักงานขายใช้พูดกับลูกค้า */
  reason: string;
}

/** คู่มือการขายตามระยะการดูแลลำไย (SKU ตรงกับ catalog ลำไยใน Supabase) */
export const stagePlaybook: Record<CultivationStage, { advice: string; items: StageItem[] }> = {
  เตรียมต้นหลังเก็บเกี่ยว: {
    advice: "ฟื้นต้นหลังตัดแต่งกิ่ง/เก็บผล พ่นทุก 15 วัน ประมาณ 3 ครั้ง เน้นดันใบ",
    items: [
      { sku: "HRM-AMINO", ratePerRai: 0.25, reason: "สาหร่ายอะมิโน ฟื้นต้นหลังเก็บเกี่ยว" },
      { sku: "FRT-1500", ratePerRai: 0.3, reason: "ตัวหน้าสูง 15-0-0 ดันใบชุดแรก" },
      { sku: "FRT-301010", ratePerRai: 0.3, reason: "ตัวหน้าสูง 30-10-10 เร่งการแตกยอด" },
      { sku: "FRT-302010", ratePerRai: 0.3, reason: "ตัวหน้าสูง 30-20-10 สลับสูตรกันดื้อ" },
    ],
  },
  "แตกใบอ่อน ใบแรก": {
    advice: "พ่น 1 ครั้งหลังใบเพสลาด เสริมธาตุรองและสูตรเสมอให้ใบสมบูรณ์",
    items: [
      { sku: "NUT-MICRO", ratePerRai: 0.2, reason: "ธาตุอาหารรองเสริม ป้องกันใบขาดธาตุ" },
      { sku: "FRT-212121", ratePerRai: 0.3, reason: "สูตรเสมอ 21-21-21 บำรุงใบชุดแรก" },
      { sku: "FRT-202020", ratePerRai: 0.3, reason: "สูตรเสมอ 20-20-20 ใช้สลับได้" },
    ],
  },
  "แตกใบอ่อน ใบสอง": {
    advice: "พ่นทุก 7 วัน 4 ครั้ง แต่ละครั้งสูตรไม่เหมือนกัน ปิดท้ายด้วยตัดไนโตรเจน",
    items: [
      { sku: "HRM-AMINO", ratePerRai: 0.25, reason: "ครั้งที่ 1: สาหร่ายอะมิโน + ตัวหน้าสูง" },
      { sku: "FRT-301010", ratePerRai: 0.3, reason: "ครั้งที่ 1: ตัวหน้าสูง 30-10-10" },
      { sku: "FRT-212121", ratePerRai: 0.3, reason: "ครั้งที่ 2: สูตรเสมอ 21-21-21" },
      { sku: "FRT-42424", ratePerRai: 0.3, reason: "ครั้งที่ 3: ตัวหน้าต่ำ 4-24-24 คุมใบ" },
      { sku: "MIN-MG", ratePerRai: 0.2, reason: "ครั้งที่ 4: แมกนีเซียม เพิ่มความเขียวเข้ม" },
      { sku: "FRT-05234", ratePerRai: 0.25, reason: "ครั้งที่ 4: 0-52-34 ตัดไนโตรเจนสะสมอาหาร" },
    ],
  },
  ราดสาร: {
    advice: "กรอบ 10 วัน — ทางใบ 3 ครั้ง (เว้น 1 เว้น 2) แล้วทางดินไม่เกิน 2 วันหลังครั้งสุดท้าย",
    items: [
      { sku: "CHL-KCLO3", ratePerRai: 0.5, reason: "โพแทสเซียมคลอเรต ทางใบ ชักนำการออกดอก" },
      { sku: "CHL-NACLO3", ratePerRai: 0.6, reason: "โซเดียมคลอเรต ใช้ทางใบและราดทางดิน" },
    ],
  },
  เปิดตาดอก: {
    advice: "พ่นทุก 5-7 วัน ประมาณ 2 ครั้ง เปิดตาดอกให้สม่ำเสมอ",
    items: [
      { sku: "BLOOM-TIGER", ratePerRai: 0.2, reason: "เสือดอก กระตุ้นการเปิดตาดอก" },
      { sku: "BLOOM-OPEN", ratePerRai: 0.2, reason: "ยาเปิดตาดอก ช่วยแทงช่อพร้อมกัน" },
      { sku: "FRT-61236", ratePerRai: 0.3, reason: "6-12-36 สะสมโพแทสเซียมช่วงเปิดตา" },
    ],
  },
  ยืดช่อดอก: {
    advice: "พ่นทุก 5-7 วัน 2 ครั้ง ยืดช่อให้ยาวสม่ำเสมอ",
    items: [{ sku: "FRT-105217", ratePerRai: 0.3, reason: "10-52-17 ยืดช่อดอก เพิ่มความสมบูรณ์" }],
  },
  บำรุงช่อดอก: {
    advice: "พ่นทุก 5-7 วัน 2 ครั้ง ใช้สูตรเดียวกับยืดช่อดอก",
    items: [{ sku: "FRT-105217", ratePerRai: 0.3, reason: "10-52-17 บำรุงช่อก่อนดอกบาน" }],
  },
  ดอกบาน: {
    advice: "พ่นทุก 5-7 วัน 2 ครั้ง เน้นตัวผสมเกสรให้ติดผลดี",
    items: [{ sku: "POL-DIAMOND", ratePerRai: 0.2, reason: "ไดมอนด์ ช่วยผสมเกสร เพิ่มการติดผล" }],
  },
  ลูกเล็ก: {
    advice: "60 วัน พ่นทุก 10-15 วัน (4-6 ครั้ง) เร่งการเจริญเติบโตของผล",
    items: [
      { sku: "FRT-301010", ratePerRai: 0.3, reason: "ตัวหน้าสูง 30-10-10 เร่งขยายผล" },
      { sku: "FRT-1500", ratePerRai: 0.25, reason: "15-0-0 เสริมไนโตรเจนช่วงลูกเล็ก" },
    ],
  },
  ลูกมะเขือพวง: {
    advice: "60 วัน พ่นทุก 10-15 วัน (4-6 ครั้ง) ใช้สูตรเสมอให้ผลโตสม่ำเสมอ",
    items: [
      { sku: "FRT-212121", ratePerRai: 0.3, reason: "สูตรเสมอ 21-21-21 ขยายขนาดผล" },
      { sku: "FRT-202020", ratePerRai: 0.3, reason: "สูตรเสมอ 20-20-20 ใช้สลับได้" },
    ],
  },
  ลูกแก้ว: {
    advice: "45 วัน พ่นทุก 10 วัน (4 ครั้ง) เร่งความหวานและคุณภาพผล",
    items: [
      { sku: "FRT-131321", ratePerRai: 0.3, reason: "ตัวท้ายสูง 13-13-21 เพิ่มความหวาน" },
      { sku: "FRT-82424", ratePerRai: 0.25, reason: "8-24-24 เสริมคุณภาพเนื้อผล" },
    ],
  },
  ก่อนเก็บ: {
    advice: "20 วันก่อนเก็บ พ่นทุก 8-10 วัน 2 ครั้ง ป้องกันโรคและขัดผิวผล",
    items: [
      { sku: "BIO-SKIN", ratePerRai: 0.25, reason: "เชื้อราตัวขัดผิว ผิวผลสวย ลดโรคก่อนเก็บ" },
    ],
  },
};

/* --------------------------- 3) คำนวณความคืบหน้าแปลง --------------------------- */

export interface StageProgress {
  /** จำนวนวันตั้งแต่วันปลูก (ลบ = ยังไม่ถึงวันปลูก) */
  daysSincePlanted: number;
  /** ความยาวรอบการปลูกของพืชนี้ (วัน) */
  cycleDays: number;
  /** ความคืบหน้า 0-100 */
  progressPct: number;
  /** ช่วงที่ควรอยู่ตามปฏิทินการปลูก */
  expectedStage: CultivationStage;
  /** ช่วงถัดไป (null = อยู่ช่วงสุดท้ายแล้ว) */
  nextStage: CultivationStage | null;
  /** อีกกี่วันจะเข้าช่วงถัดไป (null = ไม่มีช่วงถัดไป) */
  daysToNextStage: number | null;
  /**
   * ปฏิทินเดินหน้าไปไกลกว่าช่วงที่บันทึกไว้
   * = แปลงน่าจะโตข้ามช่วงแล้วแต่ยังไม่มีใครอัปเดตข้อมูล → ต้องโทรเช็ก + มีโอกาสขาย
   * (ถ้าบันทึกล้ำหน้าปฏิทินถือว่าปกติ เช่น พืชยืนต้น หรือเกษตรกรทำเร็วกว่ากำหนด)
   */
  isBehindSchedule: boolean;
  /** ช่วงที่บันทึกไว้ตามหลังปฏิทินอยู่กี่ขั้น */
  stagesBehind: number;
}

const MS_PER_DAY = 86_400_000;

/** ตัดเวลาออกให้เหลือแค่วันที่ เพื่อให้การนับวันไม่คลาดจากชั่วโมง */
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

export function stageProgress(cul: Cultivation, today = new Date()): StageProgress {
  const cycleDays = cycleDaysFor(cul.crop);
  const planted = new Date(cul.plantedDate);
  const daysSincePlanted = Math.floor(
    (startOfDay(today).getTime() - startOfDay(planted).getTime()) / MS_PER_DAY,
  );

  const rawPct = (daysSincePlanted / cycleDays) * 100;
  const progressPct = Math.max(0, Math.min(100, Math.round(rawPct)));
  const fraction = Math.max(0, Math.min(1, daysSincePlanted / cycleDays));

  // หาช่วงตามปฏิทิน: ช่วงแรกที่ fraction ยังไม่เกินขอบบน
  const hit = stageBounds.find((b) => fraction < b.end) ?? stageBounds[stageBounds.length - 1]!;
  const expectedStage = hit.stage;

  const idx = cultivationStages.indexOf(expectedStage);
  const nextStage = idx < cultivationStages.length - 1 ? cultivationStages[idx + 1]! : null;
  const daysToNextStage = nextStage
    ? Math.max(0, Math.ceil(hit.end * cycleDays) - daysSincePlanted)
    : null;

  const stagesBehind = idx - cultivationStages.indexOf(cul.stage);

  return {
    daysSincePlanted,
    cycleDays,
    progressPct,
    expectedStage,
    nextStage,
    daysToNextStage,
    isBehindSchedule: stagesBehind > 0,
    stagesBehind: Math.max(0, stagesBehind),
  };
}

/* ----------------------------- 4) สินค้าแนะนำ ----------------------------- */

export interface RecommendedItem {
  product: Product;
  /** ปริมาณที่แนะนำ (ปัดขึ้นเป็นจำนวนเต็ม) */
  qty: number;
  reason: string;
  /** มูลค่ารวมของรายการนี้ */
  subtotal: number;
  /** สินค้าไม่พอในคลัง */
  shortStock: boolean;
}

/** ปัดปริมาณขึ้นเป็นจำนวนเต็ม แต่ไม่น้อยกว่า 1 */
const roundQty = (n: number) => Math.max(1, Math.ceil(n));

/**
 * แนะนำสินค้าสำหรับแปลงเดียว ตามช่วงการปลูกและพื้นที่
 * ใช้ช่วงที่บันทึกไว้เป็นหลัก (ถ้าอยากใช้ปฏิทินให้ส่ง stage มาเอง)
 */
export function recommendForCultivation(
  cul: Cultivation,
  products: Product[],
  stage: CultivationStage = cul.stage,
): RecommendedItem[] {
  const bySku = new Map(products.map((p) => [p.sku, p]));
  const playbook = stagePlaybook[stage];
  if (!playbook) return [];

  return playbook.items.flatMap((item) => {
    const product = bySku.get(item.sku);
    if (!product) return [];
    const qty =
      item.ratePerRai === null
        ? (item.fixedQty ?? 1)
        : roundQty(item.ratePerRai * Math.max(1, cul.area));
    return [
      {
        product,
        qty,
        reason: item.reason,
        subtotal: product.price * qty,
        shortStock: product.stock < qty,
      },
    ];
  });
}

/**
 * รวมสินค้าแนะนำของทุกแปลงของลูกค้าหนึ่งราย
 * SKU ซ้ำจะถูกรวมปริมาณเข้าด้วยกัน
 */
export function recommendForCustomer(
  cultivations: Cultivation[],
  products: Product[],
): RecommendedItem[] {
  const merged = new Map<string, RecommendedItem>();

  for (const cul of cultivations) {
    for (const item of recommendForCultivation(cul, products)) {
      const existing = merged.get(item.product.sku);
      if (existing) {
        existing.qty += item.qty;
        existing.subtotal = existing.product.price * existing.qty;
        existing.shortStock = existing.product.stock < existing.qty;
      } else {
        merged.set(item.product.sku, { ...item });
      }
    }
  }

  return [...merged.values()].sort((a, b) => b.subtotal - a.subtotal);
}

/* -------------------- 5) ลูกค้าที่ควรติดต่อ (เข้าช่วงถัดไป) -------------------- */

/** สรุปจำนวนแปลงเพาะปลูกแยกตามระยะ — สำหรับแดชบอร์ด */
export interface StageDistribution {
  stage: CultivationStage;
  plots: number;
  /** พื้นที่รวมของแปลงในระยะนี้ (ไร่) */
  area: number;
}

/**
 * นับแปลงเพาะปลูกแยกตามระยะ จากข้อมูลจริงที่ดึงจาก cultivations table
 * ระยะที่ไม่มีแปลงจะถูกแสดงด้วย (plots: 0) เพื่อให้เห็นทั้ง 12 ระยะ
 */
export function cultivationsByStage(cultivations: Cultivation[]): StageDistribution[] {
  const counts = new Map<CultivationStage, { plots: number; area: number }>();
  for (const stage of cultivationStages) {
    counts.set(stage, { plots: 0, area: 0 });
  }
  for (const cul of cultivations) {
    const entry = counts.get(cul.stage);
    if (entry) {
      entry.plots += 1;
      entry.area += cul.area;
    }
  }
  return cultivationStages.map((stage) => ({
    stage,
    plots: counts.get(stage)?.plots ?? 0,
    area: counts.get(stage)?.area ?? 0,
  }));
}

export type FollowUpKind = "upcoming" | "overdue";

export interface FollowUp {
  customer: Customer;
  cultivation: Cultivation;
  progress: StageProgress;
  kind: FollowUpKind;
  /** ช่วงที่ควรขายสินค้าให้ตอนนี้ */
  targetStage: CultivationStage;
  /** เหตุผลที่ต้องติดต่อ — ใช้เป็นบทพูดให้พนักงานขาย */
  trigger: string;
  /** มูลค่าที่คาดว่าจะขายได้ถ้าปิดดีลช่วงนี้ */
  opportunity: number;
}

/**
 * หาลูกค้าที่ควรติดต่อ จาก 2 สัญญาณ
 *
 * 1. `upcoming` — แปลงกำลังจะเข้าช่วงถัดไปภายใน `withinDays` → เสนอขายล่วงหน้าก่อนคู่แข่ง
 * 2. `overdue`  — ปฏิทินเดินไปไกลกว่าช่วงที่บันทึก → แปลงน่าจะโตข้ามช่วงแล้วแต่ไม่มีใครอัปเดต
 *                 ต้องโทรเช็ก และมีโอกาสขายของช่วงที่ควรอยู่ตอนนี้ทันที
 *
 * เรียง overdue ขึ้นก่อน (เสียโอกาสไปแล้ว เร่งด่วนกว่า) แล้วตามด้วยความใกล้เปลี่ยนช่วง
 */
export function findFollowUps(
  customers: Customer[],
  products: Product[],
  withinDays = 21,
  today = new Date(),
): FollowUp[] {
  const out: FollowUp[] = [];

  for (const customer of customers) {
    for (const cultivation of customer.cultivations) {
      const progress = stageProgress(cultivation, today);

      let kind: FollowUpKind;
      let targetStage: CultivationStage;
      let trigger: string;

      if (progress.isBehindSchedule) {
        kind = "overdue";
        targetStage = progress.expectedStage;
        trigger = `ตามปฏิทินควรอยู่ช่วง “${progress.expectedStage}” แล้ว แต่บันทึกไว้ว่า “${cultivation.stage}” — ควรโทรเช็กและเสนอปุ๋ยช่วงนี้`;
      } else if (
        progress.nextStage !== null &&
        progress.daysToNextStage !== null &&
        progress.daysToNextStage <= withinDays
      ) {
        kind = "upcoming";
        targetStage = progress.nextStage;
        trigger = `อีก ${progress.daysToNextStage} วันจะเข้าช่วง “${progress.nextStage}” — เสนอขายล่วงหน้าได้`;
      } else {
        continue;
      }

      const opportunity = recommendForCultivation(cultivation, products, targetStage).reduce(
        (s, i) => s + i.subtotal,
        0,
      );

      out.push({ customer, cultivation, progress, kind, targetStage, trigger, opportunity });
    }
  }

  const rank = (f: FollowUp) => (f.kind === "overdue" ? 0 : 1);
  return out.sort(
    (a, b) =>
      rank(a) - rank(b) ||
      (a.progress.daysToNextStage ?? 999) - (b.progress.daysToNextStage ?? 999) ||
      b.opportunity - a.opportunity,
  );
}

/* ------------------ 6) พยากรณ์ความต้องการสินค้าล่วงหน้า ------------------ */

export interface DemandItem {
  product: Product;
  /** ปริมาณที่คาดว่าลูกค้าทั้งหมดจะต้องใช้ */
  qty: number;
  /** จำนวนแปลงที่ต้องใช้สินค้านี้ */
  plots: number;
  /** มูลค่ายอดขายที่คาดการณ์ */
  value: number;
  /** สต็อกคงเหลือปัจจุบัน */
  stock: number;
  /** ต้องสั่งเพิ่มเท่าไหร่ (0 = พอ) */
  shortfall: number;
}

/**
 * พยากรณ์ความต้องการสินค้าในอีก `days` วันข้างหน้า
 * ดูว่าแต่ละแปลงจะอยู่ช่วงไหน ณ วันนั้น แล้วรวมสินค้าที่ต้องใช้
 */
export function forecastDemand(
  customers: Customer[],
  products: Product[],
  days = 30,
  today = new Date(),
): DemandItem[] {
  const future = new Date(startOfDay(today).getTime() + days * MS_PER_DAY);
  const merged = new Map<string, DemandItem>();

  for (const customer of customers) {
    for (const cul of customer.cultivations) {
      // ช่วงที่แปลงนี้จะอยู่ ณ วันในอนาคต
      const futureStage = stageProgress(cul, future).expectedStage;
      for (const item of recommendForCultivation(cul, products, futureStage)) {
        const existing = merged.get(item.product.sku);
        if (existing) {
          existing.qty += item.qty;
          existing.plots += 1;
          existing.value = existing.product.price * existing.qty;
          existing.shortfall = Math.max(0, existing.qty - existing.stock);
        } else {
          merged.set(item.product.sku, {
            product: item.product,
            qty: item.qty,
            plots: 1,
            value: item.subtotal,
            stock: item.product.stock,
            shortfall: Math.max(0, item.qty - item.product.stock),
          });
        }
      }
    }
  }

  return [...merged.values()].sort((a, b) => b.value - a.value);
}
