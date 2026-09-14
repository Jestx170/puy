// ============================================================
// Fieldstone ERP — Agronomy engine
//
// แปลงข้อมูลการเพาะปลูกของลูกค้า (พืช/ระยะ/ครั้ง/วันเริ่มรอบ)
// ให้เป็นคำแนะนำสูตรและการติดตามที่ใช้งานจริง
//
// หลักการ (ตามแผนที่อนุมัติ):
//   - โปรแกรมดูแลมาจาก careProgram (ต้นฉบับ Excel) ชุดเดียว
//   - แยก "ระยะหลัก" กับ "ครั้งที่กำลังจะดูแล"
//   - แยกสูตรทางเลือกออกจากสูตรหลัก ไม่รวมบังคับซื้อทุกสูตร
//   - พนักงานกรอกจำนวนเอง ไม่คำนวณจากไร่อัตโนมัติ
//   - วันที่ไม่บังคับ ไม่ทราบวันก็ใช้งานได้ แต่ไม่แสดง "ด่วนวันนี้"
//   - สินค้าที่ยังไม่มีในแคตตาล็อกแสดงเตือนชัดเจน ไม่สงวนเป็นรายการว่าง
// ============================================================

import type { Cultivation, Customer, Product } from "@/types";
import { cultivationStages } from "@/types";
import {
  getCareProgramByStageId,
  getCareProgramByStageName,
  getCareRound,
  longanCareProgram,
  nextMainStageId,
  nextRoundInStage,
  STAGE_ID_BY_NAME,
  STAGE_NAME_BY_ID,
  type CareFormulaGroup,
  type CareRound,
  type CareStageProgram,
  type LonganMainStage,
} from "@/lib/careProgram";

/* ------------------------- 1) ระยะหลัก 12 ระยะ ------------------------- */

/** ระยะหลักทั้งหมดของลำไย (12 ระยะ) — ใช้แสดง/กรอง/สรุปบน dashboard */
export const mainStages: readonly LonganMainStage[] = longanCareProgram.map((p) => p.name);

/** ชื่อระยะทั้งหมดที่ UI ใช้ (เพื่อรักษา compatibility กับโค้ดเดิมที่ import cultivationStages) */
export { cultivationStages };

/** ความยาวรอบการดูแลลำไยทั้งรอบ (วัน) — ผลรวมค่ากลางของแต่ละระยะ */
export const LONGAN_CYCLE_DAYS = longanCareProgram.reduce(
  (sum, stage) => sum + (stage.durationMax ?? stage.durationMin ?? 0),
  0,
);

/** ความยาวรอบการดูแลทุเรียนทั้งรอบ (วัน) — ผลรวมค่าสูงสุดของแต่ละระยะ */
export const DURIAN_CYCLE_DAYS =
  28 +
  30 +
  20 +
  30 +
  21 +
  30 +
  21 +
  28 +
  14 +
  14 +
  14 +
  10 +
  21 +
  21 +
  28 +
  56 +
  84 +
  105 +
  126 +
  14 +
  0;

/** ความยาวรอบตามพืช */
export const cycleDaysFor = (crop?: string) =>
  crop === "ทุเรียน" ? DURIAN_CYCLE_DAYS : LONGAN_CYCLE_DAYS;

/** จำนวนวันของแต่ละระยะ (ค่ากลางของช่วงใน Excel) — รักษา export เดิมไว้ */
export const stageDurationDays: Record<string, number> = {
  ...Object.fromEntries(
    longanCareProgram.map((p) => [p.name, p.durationMax ?? p.durationMin ?? 0]),
  ),
  // ทุเรียน (ค่าสูงสุดของช่วง)
  ฟื้นต้นหลังเก็บเกี่ยว: 28,
  "แตกใบอ่อน ชุดที่ 1": 30,
  "ใบเพสลาด / ใบเริ่มแก่": 20,
  "แตกใบอ่อน ชุดที่ 2": 30,
  "ใบแก่ ชุดที่ 2": 21,
  "แตกใบอ่อน ชุดที่ 3": 30,
  ใบแก่พร้อมออกดอก: 21,
  "พักต้น / ชักนำการออกดอก": 28,
  เริ่มเห็นตาดอก: 14,
  "ตาดอก / ช่อดอกพัฒนา": 14,
  ช่อดอกยืด: 14,
  ดอกบาน: 10,
  ติดผลอ่อน: 21,
  "ผลระยะปิ่น / ผลเล็ก": 21,
  "ผลอายุประมาณ 1 เดือน": 28,
  "ผลขยาย ระยะที่ 1": 56,
  "ผลขยาย ระยะที่ 2": 84,
  ผลเริ่มแก่: 105,
  ผลแก่ใกล้เก็บเกี่ยว: 126,
  ก่อนเก็บเกี่ยว: 14,
  เก็บเกี่ยว: 0,
};

/** ความถี่การพ่นของแต่ละระยะ (วัน/ครั้ง) — null = ทำครั้งเดียว/ตามสภาพต้น */
export const stageFrequencyDays: Record<string, number | null> = {
  ...Object.fromEntries(longanCareProgram.map((p) => [p.name, p.frequencyDays])),
  // ทุเรียน
  ฟื้นต้นหลังเก็บเกี่ยว: 10,
  "แตกใบอ่อน ชุดที่ 1": 7,
  "ใบเพสลาด / ใบเริ่มแก่": 7,
  "แตกใบอ่อน ชุดที่ 2": 7,
  "ใบแก่ ชุดที่ 2": 10,
  "แตกใบอ่อน ชุดที่ 3": 7,
  ใบแก่พร้อมออกดอก: 7,
  "พักต้น / ชักนำการออกดอก": 5,
  เริ่มเห็นตาดอก: 5,
  "ตาดอก / ช่อดอกพัฒนา": 5,
  ช่อดอกยืด: 5,
  ดอกบาน: null,
  ติดผลอ่อน: 7,
  "ผลระยะปิ่น / ผลเล็ก": 7,
  "ผลอายุประมาณ 1 เดือน": 7,
  "ผลขยาย ระยะที่ 1": 7,
  "ผลขยาย ระยะที่ 2": 10,
  ผลเริ่มแก่: 10,
  ผลแก่ใกล้เก็บเกี่ยว: null,
  ก่อนเก็บเกี่ยว: null,
  เก็บเกี่ยว: null,
};

/** จำนวนครั้งเริ่มต้นตามแผนของแต่ละระยะ */
export const stageRoundsDefault: Record<string, number> = Object.fromEntries(
  longanCareProgram.map((p) => [p.name, p.roundsDefault]),
);

/** จำนวนครั้งสูงสุดที่อนุญาตของแต่ละระยะ */
export const stageRoundsMax: Record<string, number> = Object.fromEntries(
  longanCareProgram.map((p) => [p.name, p.roundsMax]),
);

/* ------------------------ 2) สูตร/สินค้าที่แนะนำ ------------------------ */

/** สินค้าหนึ่งรายการที่จับคู่กับแคตตาล็อกได้แล้ว */
export interface RecommendedItem {
  /** สินค้าจริงในแคตตาล็อก (undefined = SKU ยังไม่มีในแคตตาล็อก) */
  product: Product | undefined;
  /** SKU อ้างอิงจากโปรแกรม */
  sku: string;
  /** ชื่อสูตร/ผลิตภัณฑ์ตามต้นฉบับ */
  label: string;
  /** จำนวนที่พนักงานกรอก (เริ่มที่ 0/ว่าง — ต้องกรอกก่อนเสนอราคา/ขาย) */
  qty: number;
  /** มูลค่ารวมของรายการนี้ (0 ถ้ายังไม่มีสินค้าหรือยังไม่กรอกจำนวน) */
  subtotal: number;
  /** true = สูตรนี้เป็นทางเลือก (เลือกหนึ่งหรือมากกว่า ไม่บังคับ) */
  alternative: boolean;
  /** true = SKU ยังไม่มีในแคตตาล็อก ต้องผูกสินค้าก่อน */
  missingCatalog: boolean;
  /** สต็อกไม่พอ (เฉพาะเมื่อมีสินค้าและกรอกจำนวนแล้ว) */
  shortStock: boolean;
}

/** คำแนะนำสูตรของครั้งดูแลหนึ่ง — แยกตามกลุ่มสูตร */
export interface CareRecommendation {
  stageId: string;
  stageName: LonganMainStage;
  sequence: number;
  /** ข้อความสรุประยะจากต้นฉบับ */
  summary: string;
  /** วิธีดูแลของครั้งนี้ (ถ้ามี) */
  method: string | undefined;
  /** ข้อความระยะห่าง/ความถี่ของครั้งนี้ */
  spacingNote: string | undefined;
  /** กลุ่มสูตร — แต่ละกลุ่มมีตัวเลือกที่อาจเป็นทางเลือก */
  groups: CareRecommendationGroup[];
  /** true = ไม่มีสินค้าในแคตตาล็อกเลยสำหรับครั้งนี้ */
  allMissing: boolean;
}

export interface CareRecommendationGroup {
  id: string;
  label: string;
  /** true = ตัวเลือกเป็นทางเลือก (เลือกหนึ่งหรือมากกว่า) */
  alternatives: boolean;
  items: RecommendedItem[];
}

/** แปลงกลุ่มสูตรจากโปรแกรมเป็นกลุ่มคำแนะนำ จับคู่กับแคตตาล็อก */
function buildGroup(group: CareFormulaGroup, bySku: Map<string, Product>): CareRecommendationGroup {
  const items: RecommendedItem[] = group.options.map((opt) => {
    const product = bySku.get(opt.sku);
    return {
      product,
      sku: opt.sku,
      label: opt.label,
      qty: 0,
      subtotal: 0,
      alternative: group.alternatives,
      missingCatalog: !product,
      shortStock: false,
    };
  });
  return {
    id: group.id,
    label: group.label,
    alternatives: group.alternatives,
    items,
  };
}

/**
 * สร้างคำแนะนำสูตรของครั้งดูแลเฉพาะ (stage + sequence)
 * ใช้ข้อมูลจาก careProgram และจับคู่กับแคตตาล็อกจริง
 * ไม่คำนวณจำนวนอัตโนมัติ — พนักงานกรอกเองภายหลัง
 */
export function recommendRound(
  stageId: string | null | undefined,
  sequence: number,
  products: Product[],
): CareRecommendation | null {
  const program = getCareProgramByStageId(stageId);
  const round = getCareRound(stageId, sequence);
  if (!program || !round) return null;

  const bySku = new Map(products.map((p) => [p.sku, p]));
  const groups = round.groups.map((g) => buildGroup(g, bySku));
  const allMissing = groups.every((g) => g.items.every((i) => i.missingCatalog));

  return {
    stageId: program.stageId,
    stageName: program.name,
    sequence: round.sequence,
    summary: program.summary,
    method: round.method,
    spacingNote: round.spacingNote,
    groups,
    allMissing,
  };
}

/**
 * คำนวณมูลค่ารวมของคำแนะนำหนึ่งครั้ง จากจำนวนที่พนักงานกรอก
 * รายการที่ยังไม่กรอกจำนวนหรือไม่มีในแคตตาล็อกจะไม่นับ
 */
export function roundSubtotal(reco: CareRecommendation): number {
  return reco.groups.reduce((sum, g) => sum + g.items.reduce((s, i) => s + i.subtotal, 0), 0);
}

/**
 * อัปเดตจำนวนของรายการในคำแนะนำ พร้อมคำนวณ subtotal/shortStock ใหม่
 * ไม่อนุญาตจำนวนติดลบ/NaN/ทศนิยม
 */
export function setItemQty(
  reco: CareRecommendation,
  groupId: string,
  sku: string,
  qty: number,
): CareRecommendation {
  const safeQty = Number.isFinite(qty) && qty > 0 ? Math.floor(qty) : 0;
  const groups = reco.groups.map((g) => {
    if (g.id !== groupId) return g;
    return {
      ...g,
      items: g.items.map((i) => {
        if (i.sku !== sku) return i;
        const product = i.product;
        const subtotal = product ? product.price * safeQty : 0;
        const shortStock = product ? safeQty > product.stock : false;
        return { ...i, qty: safeQty, subtotal, shortStock };
      }),
    };
  });
  return { ...reco, groups };
}

/* -------------------- 3) ความคืบหน้าแปลง (ปฏิทิน) -------------------- */

export interface StageProgress {
  /** จำนวนวันตั้งแต่วันเริ่มรอบดูแล (null = ไม่ทราบวัน) */
  daysSinceStart: number | null;
  /** ความยาวรอบการดูแลของพืชนี้ (วัน) */
  cycleDays: number;
  /** ความคืบหน้า 0-100 (null = ไม่ทราบวัน จึงคำนวณไม่ได้) */
  progressPct: number | null;
  /** ระยะที่ควรอยู่ตามปฏิทิน (null = ไม่ทราบวัน) */
  expectedStage: LonganMainStage | null;
  /** ระยะถัดไปตามปฏิทิน (null = อยู่ระยะสุดท้ายหรือไม่ทราบวัน) */
  nextStage: LonganMainStage | null;
  /** อีกกี่วันจะเข้าระยะถัดไป (null = ไม่ทราบวันหรือไม่มีระยะถัดไป) */
  daysToNextStage: number | null;
  /** true = ปฏิทินเดินไปไกลกว่าระยะที่บันทึกไว้ (เฉพาะเมื่อทราบวัน) */
  isBehindSchedule: boolean;
  /** จำนวนระยะที่บันทึกไว้ตามหลังปฏิทิน */
  stagesBehind: number;
  /** true = ไม่ทราบวันเริ่มรอบ ทุกค่าปฏิทินเป็น unknown */
  unknownDate: boolean;
}

const MS_PER_DAY = 86_400_000;

/** ตัดเวลาออกให้เหลือแค่วันที่ ใช้เขตเวลาท้องถิ่น (ไทย) */
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/** ขอบเขตสะสมของแต่ละระยะ (สัดส่วน 0-1 ของรอบทั้งหมด) */
const stageBounds = (() => {
  let acc = 0;
  return longanCareProgram.map((stage) => {
    const days = stage.durationMax ?? stage.durationMin ?? 0;
    const start = acc;
    acc += days / LONGAN_CYCLE_DAYS;
    return { stage: stage.name, start, end: acc };
  });
})();

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

/**
 * คำนวณความคืบหน้าแปลงตามปฏิทิน
 *
 * กติกา:
 *   - วันเริ่มรอบไม่บังคับ ถ้าว่าง/เสีย → คืน unknownDate: true ทุกค่าปฏิทินเป็น null
 *   - ไม่มี NaN ไม่มี "ติดลบล้ำหน้า" จากวันในอนาคต (clamp ที่ 0)
 *   - วันเก่าหลายปีไม่ทำให้แปลงดูเหมือน "ติดอยู่ระยะสุดท้ายตลอด" เพราะ
 *     เราไม่ใช้ progressPct เป็นเกณฑ์ระยะเดียว — ระยะจริงมาจากข้อมูลแปลง
 */
export function stageProgress(cul: Cultivation, today = new Date()): StageProgress {
  const cycleDays = cycleDaysFor(cul.crop);
  const start = parseDate(cul.plantedDate);

  if (!start) {
    return {
      daysSinceStart: null,
      cycleDays,
      progressPct: null,
      expectedStage: null,
      nextStage: null,
      daysToNextStage: null,
      isBehindSchedule: false,
      stagesBehind: 0,
      unknownDate: true,
    };
  }

  const daysSinceStart = Math.floor(
    (startOfDay(today).getTime() - startOfDay(start).getTime()) / MS_PER_DAY,
  );

  // วันในอนาคต → ยังไม่เริ่ม ถือว่า 0 วัน
  const elapsed = Math.max(0, daysSinceStart);
  const fraction = Math.min(1, elapsed / cycleDays);
  const progressPct = Math.round(fraction * 100);

  // หาระยะตามปฏิทิน: ระยะแรกที่ fraction ยังไม่เกินขอบบน
  const hit = stageBounds.find((b) => fraction < b.end) ?? stageBounds[stageBounds.length - 1]!;
  const expectedStage = hit.stage;

  const idx = longanCareProgram.findIndex((p) => p.name === expectedStage);
  const nextStage =
    idx >= 0 && idx < longanCareProgram.length - 1 ? longanCareProgram[idx + 1]!.name : null;
  const daysToNextStage = nextStage ? Math.max(0, Math.ceil(hit.end * cycleDays) - elapsed) : null;

  // เปรียบเทียบกับระยะที่บันทึกไว้ในแปลง (ใช้ stageId เป็นหลัก)
  const recordedStageId = cul.stageId ?? STAGE_ID_BY_NAME[cul.stage as LonganMainStage] ?? null;
  const recordedIdx = recordedStageId
    ? longanCareProgram.findIndex((p) => p.stageId === recordedStageId)
    : -1;
  const stagesBehind = recordedIdx >= 0 ? Math.max(0, idx - recordedIdx) : 0;

  return {
    daysSinceStart,
    cycleDays,
    progressPct,
    expectedStage,
    nextStage,
    daysToNextStage,
    isBehindSchedule: stagesBehind > 0,
    stagesBehind,
    unknownDate: false,
  };
}

/* -------------------- 4) สรุปแปลงตามระยะ (dashboard) -------------------- */

export interface StageDistribution {
  stage: LonganMainStage;
  plots: number;
  /** พื้นที่รวมของแปลงในระยะนี้ (ไร่) */
  area: number;
}

/**
 * นับแปลงเพาะปลูกแยกตามระยะหลัก 12 ระยะ จากข้อมูลจริง
 * ระยะที่ไม่มีแปลงจะถูกแสดงด้วย (plots: 0) เพื่อให้เห็นทั้ง 12 ระยะ
 *
 * หมายเหตุ: นับตามระยะหลักของแปลง (จาก stageId/stage) ไม่นับครั้งดูแล
 * แยกจากกัน — ครั้งดูแลไม่ใช่ระยะทางชีววิทยา
 */
export function cultivationsByStage(cultivations: Cultivation[]): StageDistribution[] {
  const counts = new Map<LonganMainStage, { plots: number; area: number }>();
  for (const stage of longanCareProgram) counts.set(stage.name, { plots: 0, area: 0 });

  for (const cul of cultivations) {
    const stageId = cul.stageId ?? STAGE_ID_BY_NAME[cul.stage as LonganMainStage] ?? null;
    const name = stageId ? STAGE_NAME_BY_ID[stageId] : null;
    const entry = name ? counts.get(name) : null;
    if (entry) {
      entry.plots += 1;
      entry.area += cul.area;
    }
  }

  return longanCareProgram.map((stage) => ({
    stage: stage.name,
    plots: counts.get(stage.name)?.plots ?? 0,
    area: counts.get(stage.name)?.area ?? 0,
  }));
}

/* -------------------- 5) ลูกค้าที่ควรติดตาม -------------------- */

export type FollowUpKind = "upcoming" | "overdue" | "needs_confirmation";

export interface FollowUp {
  customer: Customer;
  cultivation: Cultivation;
  progress: StageProgress;
  kind: FollowUpKind;
  /** ระยะที่ควรเสนอสินค้าตอนนี้ (null = ไม่ทราบ/ต้องยืนยัน) */
  targetStage: LonganMainStage | null;
  /** เหตุผลที่ต้องติดต่อ — ใช้เป็นบทพูดให้พนักงานขาย */
  trigger: string;
}

/**
 * หาลูกค้าที่ควรติดตาม จากสัญญาณ:
 *   1. `overdue` — ปฏิทินเดินไปไกลกว่าระยะที่บันทึก (เฉพาะเมื่อทราบวัน)
 *   2. `upcoming` — ใกล้เข้าระยะถัดไปภายใน withinDays (เฉพาะเมื่อทราบวัน)
 *   3. `needs_confirmation` — ไม่ทราบวันเริ่มรอบ จึงต้องติดต่อเพื่อยืนยันระยะ/ครั้ง
 *
 * ไม่คำนวณมูลค่าโอกาสขายจาก ratePerRai เพราะยังไม่ยืนยันปริมาณใช้
 * พนักงานกรอกจำนวนเอง จึงไม่มี opportunity ที่เป็นตัวเลขยืนยันได้ในขั้นนี้
 */
export function findFollowUps(
  customers: Customer[],
  _products: Product[],
  withinDays = 21,
  today = new Date(),
): FollowUp[] {
  const out: FollowUp[] = [];

  for (const customer of customers) {
    for (const cultivation of customer.cultivations) {
      const progress = stageProgress(cultivation, today);

      let kind: FollowUpKind;
      let targetStage: LonganMainStage | null;
      let trigger: string;

      if (progress.unknownDate) {
        kind = "needs_confirmation";
        targetStage = null;
        trigger = "ไม่ทราบวันเริ่มรอบดูแล — ควรติดต่อเพื่อยืนยันระยะและครั้งที่กำลังจะดูแล";
      } else if (progress.isBehindSchedule) {
        kind = "overdue";
        targetStage = progress.expectedStage;
        trigger = `ตามปฏิทินควรอยู่ระยะ “${progress.expectedStage}” แล้ว แต่บันทึกไว้ว่า “${cultivation.stage}” — ควรโทรเช็กและยืนยันระยะ`;
      } else if (
        progress.nextStage !== null &&
        progress.daysToNextStage !== null &&
        progress.daysToNextStage <= withinDays
      ) {
        kind = "upcoming";
        targetStage = progress.nextStage;
        trigger = `อีก ${progress.daysToNextStage} วันจะเข้าระยะ “${progress.nextStage}” — เตรียมเสนอสูตรล่วงหน้าได้`;
      } else {
        continue;
      }

      out.push({ customer, cultivation, progress, kind, targetStage, trigger });
    }
  }

  const rank = (f: FollowUp) =>
    f.kind === "overdue" ? 0 : f.kind === "needs_confirmation" ? 1 : 2;
  return out.sort(
    (a, b) =>
      rank(a) - rank(b) ||
      (a.progress.daysToNextStage ?? Number.MAX_SAFE_INTEGER) -
        (b.progress.daysToNextStage ?? Number.MAX_SAFE_INTEGER),
  );
}

/* --------------- 6) รอบถัดไปของแปลง (จากโปรแกรม + ประวัติ) --------------- */

export interface PlotNextAction {
  cultivationId: string;
  /** ระยะหลักปัจจุบัน */
  currentStageId: string | null;
  currentStageName: LonganMainStage | null;
  /** ครั้งที่ทำเสร็จแล้วในระยะปัจจุบัน (0 = ยังไม่เคยทำ) */
  completedSequence: number;
  /** ครั้งถัดไปที่ควรดูแล (null = ครบแผนแล้ว ต้องยืนยันเปลี่ยนระยะ) */
  nextSequence: number | null;
  /** ระยะถัดไปตามชีววิทยา (เมื่อครบแผนแล้ว) */
  nextStageId: string | null;
  nextStageName: LonganMainStage | null;
  /** จำนวนครั้งตามแผนของระยะปัจจุบัน */
  roundsDefault: number;
  /** จำนวนครั้งสูงสุดที่อนุญาต */
  roundsMax: number;
  /** true = ทำครบแผนแล้ว รอยืนยันเปลี่ยนระยะหรือเพิ่มครั้ง */
  planComplete: boolean;
  /** คำแนะนำสูตรของครั้งถัดไป (null = ไม่มีครั้งถัดไป) */
  recommendation: CareRecommendation | null;
}

/**
 * คำนวณการดูแลถัดไปของแปลงจากโปรแกรม + จำนวนครั้งที่ทำเสร็จแล้ว
 * ไม่ใช้ max(stage_products.sequence) เป็นเกณฑ์จำนวนครั้ง
 */
export function plotNextAction(
  cultivation: Cultivation,
  completedSequence: number,
  products: Product[],
): PlotNextAction {
  const stageId =
    cultivation.stageId ?? STAGE_ID_BY_NAME[cultivation.stage as LonganMainStage] ?? null;
  const program = getCareProgramByStageId(stageId);
  const currentName = program?.name ?? null;

  const next = nextRoundInStage(stageId, completedSequence);
  const nextStageId = next ? null : nextMainStageId(stageId);
  const nextStageProgram = getCareProgramByStageId(nextStageId);
  const planComplete = !next && !nextStageId ? true : !next;

  const recommendation = next ? recommendRound(stageId, next.sequence, products) : null;

  return {
    cultivationId: cultivation.id,
    currentStageId: stageId,
    currentStageName: currentName,
    completedSequence,
    nextSequence: next?.sequence ?? null,
    nextStageId: next ? null : nextStageId,
    nextStageName: nextStageProgram?.name ?? null,
    roundsDefault: program?.roundsDefault ?? 0,
    roundsMax: program?.roundsMax ?? 0,
    planComplete,
    recommendation,
  };
}

/* --------------- 7) พยากรณ์ความต้องการ (กลุ่มสินค้าเท่านั้น) --------------- */

export interface DemandSummary {
  stage: LonganMainStage;
  /** จำนวนแปลงที่อยู่ระยะนี้ */
  plots: number;
  /** กลุ่มสูตรที่เกี่ยวข้องกับระยะนี้ */
  formulaGroups: string[];
}

/**
 * สรุปกลุ่มสินค้า/สูตรที่เกี่ยวข้องกับแปลงในอีก `days` วันข้างหน้า
 *
 * ไม่คำนวณจำนวนชิ้นหรือมูลค่า เพราะยังไม่ยืนยันปริมาณใช้/ขนาดบรรจุ
 * แสดงเฉพาะกลุ่มสูตรและจำนวนแปลง เพื่อให้ร้านเตรียมสต็อกได้
 */
export function forecastDemand(
  customers: Customer[],
  _products: Product[],
  days = 30,
  today = new Date(),
): DemandSummary[] {
  const future = new Date(startOfDay(today).getTime() + days * MS_PER_DAY);
  const byStage = new Map<LonganMainStage, { plots: number; groups: Set<string> }>();
  for (const stage of longanCareProgram) {
    byStage.set(stage.name, { plots: 0, groups: new Set() });
  }

  for (const customer of customers) {
    for (const cul of customer.cultivations) {
      const progress = stageProgress(cul, future);
      const target = progress.expectedStage ?? getCareProgramByStageName(cul.stage)?.name ?? null;
      if (!target) continue;
      const entry = byStage.get(target);
      if (!entry) continue;
      entry.plots += 1;
      const program = getCareProgramByStageName(target);
      if (program) {
        for (const round of program.rounds) {
          for (const group of round.groups) entry.groups.add(group.label);
        }
      }
    }
  }

  return longanCareProgram
    .map((stage) => ({
      stage: stage.name,
      plots: byStage.get(stage.name)?.plots ?? 0,
      formulaGroups: Array.from(byStage.get(stage.name)?.groups ?? []),
    }))
    .filter((s) => s.plots > 0);
}

/* --------------- 8) ตัวช่วยระยะ/ครั้ง (compatibility) --------------- */

/** ชื่อระยะจาก stageId */
export function stageNameFromId(stageId: string | null | undefined): LonganMainStage | null {
  if (!stageId) return null;
  return STAGE_NAME_BY_ID[stageId] ?? null;
}

/** stageId จากชื่อระยะ */
export function stageIdFromName(name: string | null | undefined): string | null {
  if (!name) return null;
  return STAGE_ID_BY_NAME[name as LonganMainStage] ?? null;
}

export { getCareProgramByStageId, getCareProgramByStageName, getCareRound };
export type { CareRound, CareStageProgram, LonganMainStage };
