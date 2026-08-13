// ============================================================
// Fieldstone ERP — Agronomy engine
// แปลงข้อมูลการเพาะปลูกของลูกค้า (พืช/ช่วง/พื้นที่/วันปลูก)
// ให้เป็นข้อเสนอขายที่จับต้องได้: สินค้าอะไร ปริมาณเท่าไหร่ เมื่อไหร่
// ============================================================

import type { Cultivation, CultivationStage, Customer, Product } from "@/types";
import { cultivationStages } from "@/types";

/* ------------------------- 1) รอบการปลูกของแต่ละพืช ------------------------- */

/** จำนวนวันจากปลูกถึงเก็บเกี่ยวของแต่ละพืช */
export const cropCycleDays: Record<string, number> = {
  "ข้าว กข.43": 110,
  "ข้าว กข.49": 115,
  ข้าวโพดหวาน: 75,
  อ้อย: 300,
  มันสำปะหลัง: 90,
  ยางพารา: 1800,
  ปาล์มน้ำมัน: 1080,
  ถั่วเหลือง: 70,
  พริก: 100,
  มะเขือเทศ: 80,
};

/** ค่าเริ่มต้นถ้าไม่รู้จักพืชชนิดนั้น */
const DEFAULT_CYCLE_DAYS = 100;

export const cycleDaysFor = (crop: string) => cropCycleDays[crop] ?? DEFAULT_CYCLE_DAYS;

/**
 * สัดส่วนของรอบการปลูกที่แต่ละช่วงกินเวลา (รวมกัน = 1)
 * ใช้คำนวณว่า ณ วันนี้แปลงควรอยู่ช่วงไหน และอีกกี่วันจะเข้าช่วงถัดไป
 */
const stageShare: Record<CultivationStage, number> = {
  เตรียมดิน: 0.08,
  ปลูก: 0.1,
  "ดูแล/บำรุง": 0.37,
  "ออกดอก/ติดผล": 0.3,
  เก็บเกี่ยว: 0.15,
};

/** ขอบเขตสะสมของแต่ละช่วง เช่น ดูแล/บำรุง = 0.18 → 0.55 */
const stageBounds = (() => {
  let acc = 0;
  return cultivationStages.map((stage) => {
    const start = acc;
    acc += stageShare[stage];
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

/** คู่มือการขายตามช่วงการปลูก */
export const stagePlaybook: Record<CultivationStage, { advice: string; items: StageItem[] }> = {
  เตรียมดิน: {
    advice: "ช่วงปรับปรุงดินก่อนปลูก เน้นอินทรียวัตถุและกำจัดวัชพืชเดิม",
    items: [
      {
        sku: "ORG-CHK1",
        ratePerRai: 2,
        reason: "ปรับโครงสร้างดิน เพิ่มอินทรียวัตถุก่อนปลูก",
      },
      {
        sku: "ORG-BIO25",
        ratePerRai: 1.5,
        reason: "เพิ่มจุลินทรีย์ดิน ช่วยรากเดินดีในระยะแรก",
      },
      {
        sku: "PST-GLY1",
        ratePerRai: 0.5,
        reason: "กำจัดวัชพืชเดิมก่อนเตรียมแปลง",
      },
    ],
  },
  ปลูก: {
    advice: "ช่วงลงกล้า/หยอดเมล็ด ต้องมีปุ๋ยรองพื้นและวัสดุเพาะ",
    items: [
      {
        sku: "FRT-1515",
        ratePerRai: 0.5,
        reason: "ปุ๋ยรองพื้นสูตรเสมอ ให้ธาตุครบช่วงตั้งตัว",
      },
      {
        sku: "FRT-1620",
        ratePerRai: 0.4,
        reason: "ฟอสฟอรัสสูง เร่งการแตกราก",
      },
      {
        sku: "EQP-BAG100",
        ratePerRai: null,
        fixedQty: 1,
        reason: "ถุงเพาะชำสำหรับเตรียมต้นกล้าสำรอง",
      },
    ],
  },
  "ดูแล/บำรุง": {
    advice: "ช่วงเร่งการเจริญเติบโต ต้องคุมโรคแมลงและเสริมไนโตรเจน",
    items: [
      {
        sku: "FRT-4600",
        ratePerRai: 0.5,
        reason: "ยูเรียเร่งใบและลำต้น ช่วงสร้างทรงพุ่ม",
      },
      {
        sku: "PST-ABA5",
        ratePerRai: 0.25,
        reason: "คุมหนอนและเพลี้ยในระยะเจริญเติบโต",
      },
      {
        sku: "PST-TRAP",
        ratePerRai: 2,
        reason: "กับดักเฝ้าระวังแมลง ลดการใช้สารเคมี",
      },
    ],
  },
  "ออกดอก/ติดผล": {
    advice: "ช่วงชี้ผลผลิต ต้องเสริมธาตุรองและฮอร์โมนให้ติดผลดี",
    items: [
      {
        sku: "FRT-WSF1",
        ratePerRai: 0.2,
        reason: "ปุ๋ยเกล็ดฉีดพ่นทางใบ ดูดซึมเร็วช่วงติดผล",
      },
      {
        sku: "HRM-EGG1",
        ratePerRai: 0.25,
        reason: "ฮอร์โมนไข่ ช่วยขั้วเหนียว ลดดอกร่วง",
      },
      {
        sku: "HRM-SEA5",
        ratePerRai: 0.2,
        reason: "สาหร่ายสกัด เพิ่มขนาดและคุณภาพผล",
      },
    ],
  },
  เก็บเกี่ยว: {
    advice: "ช่วงเก็บผลผลิต เตรียมอุปกรณ์และวางแผนปุ๋ยรอบถัดไป",
    items: [
      {
        sku: "EQP-SPR20",
        ratePerRai: null,
        fixedQty: 1,
        reason: "เครื่องพ่นยาสำรองไว้ใช้รอบถัดไป",
      },
      {
        sku: "EQP-HOSE20",
        ratePerRai: null,
        fixedQty: 1,
        reason: "สายยางเกษตรสำหรับให้น้ำรอบใหม่",
      },
      {
        sku: "ORG-CHK1",
        ratePerRai: 1,
        reason: "จองปุ๋ยคอกล่วงหน้าเพื่อเตรียมดินรอบถัดไป",
      },
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
