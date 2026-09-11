import { describe, it, expect } from "vitest";
import {
  stageProgress,
  plotNextAction,
  recommendRound,
  setItemQty,
  roundSubtotal,
  cultivationsByStage,
  findFollowUps,
  forecastDemand,
  stageNameFromId,
  stageIdFromName,
} from "@/lib/agronomy";
import type { Cultivation, Customer, Product } from "@/types";

// สินค้าตัวอย่างสำหรับทดสอบ
const products: Product[] = [
  {
    id: "p1",
    name: "สาหร่าย/อะมิโน",
    sku: "HRM-AMINO",
    barcode: "8850001000011",
    category: "ฮอร์โมน/อะมิโน",
    price: 350,
    cost: 250,
    stock: 50,
    minStock: 10,
    unit: "ขวด",
    status: "in_stock",
    imageUrl: null,
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
  },
  {
    id: "p2",
    name: "ปุ๋ยเกร็ด 30-10-10",
    sku: "FRT-301010",
    barcode: "8850001000028",
    category: "ปุ๋ยเกร็ด",
    price: 800,
    cost: 600,
    stock: 5,
    minStock: 10,
    unit: "ถุง",
    status: "low_stock",
    imageUrl: null,
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
  },
];

// แปลงตัวอย่าง
const makeCultivation = (overrides: Partial<Cultivation> = {}): Cultivation => ({
  id: "cul-test-1",
  customerId: "c1",
  crop: "ลำไย",
  stage: "แตกใบอ่อน ใบสอง",
  area: 5,
  location: "แปลงทดสอบ",
  plantedDate: null,
  expectedHarvest: null,
  note: null,
  stageId: "stage_03",
  currentSequence: 0,
  ...overrides,
});

const makeCustomer = (cultivations: Cultivation[] = []): Customer => ({
  id: "c1",
  name: "คุณสมชาย",
  phone: "0812345678",
  email: null,
  address: "ขอนแก่น",
  type: "เกษตรกร",
  note: null,
  createdAt: "2026-01-01",
  cultivations,
});

describe("stageProgress — วันไม่ทราบ", () => {
  it("คืน unknownDate: true เมื่อไม่มีวันเริ่มรอบ", () => {
    const cul = makeCultivation({ plantedDate: null });
    const prog = stageProgress(cul);
    expect(prog.unknownDate).toBe(true);
    expect(prog.daysSinceStart).toBeNull();
    expect(prog.progressPct).toBeNull();
    expect(prog.expectedStage).toBeNull();
    expect(prog.nextStage).toBeNull();
    expect(prog.daysToNextStage).toBeNull();
    expect(prog.isBehindSchedule).toBe(false);
  });

  it("คืน unknownDate: true เมื่อวันเสีย (invalid date)", () => {
    const cul = makeCultivation({ plantedDate: "not-a-date" });
    const prog = stageProgress(cul);
    expect(prog.unknownDate).toBe(true);
  });

  it("คืน unknownDate: true เมื่อวันเป็น string ว่าง", () => {
    const cul = makeCultivation({ plantedDate: "" });
    const prog = stageProgress(cul);
    expect(prog.unknownDate).toBe(true);
  });
});

describe("stageProgress — มีวันเริ่มรอบ", () => {
  it("คำนวณ daysSinceStart ได้", () => {
    const today = new Date("2026-06-01");
    const cul = makeCultivation({ plantedDate: "2026-05-01" });
    const prog = stageProgress(cul, today);
    expect(prog.unknownDate).toBe(false);
    expect(prog.daysSinceStart).toBe(31);
    expect(prog.progressPct).not.toBeNull();
  });

  it("วันในอนาคต → elapsed = 0 (ไม่ติดลบ)", () => {
    const today = new Date("2026-01-01");
    const cul = makeCultivation({ plantedDate: "2026-06-01" });
    const prog = stageProgress(cul, today);
    expect(prog.daysSinceStart).toBeLessThanOrEqual(0);
    expect(prog.progressPct).toBe(0);
  });

  it("ไม่มี NaN ในผลลัพธ์", () => {
    const cul = makeCultivation({ plantedDate: "2026-01-01" });
    const prog = stageProgress(cul);
    expect(prog.progressPct).not.toBeNaN();
    expect(prog.cycleDays).not.toBeNaN();
  });
});

describe("plotNextAction — คำนวณครั้งถัดไป", () => {
  it("คืน nextSequence = 1 เมื่อยังไม่เคยทำ (completedSequence = 0)", () => {
    const cul = makeCultivation({ stageId: "stage_03", currentSequence: 0 });
    const action = plotNextAction(cul, 0, products);
    expect(action.nextSequence).toBe(1);
    expect(action.planComplete).toBe(false);
    expect(action.recommendation).not.toBeNull();
  });

  it("คืน nextSequence = 4 เมื่อทำไป 3 ครั้ง (stage_03 = 4 ครั้ง)", () => {
    const cul = makeCultivation({ stageId: "stage_03", currentSequence: 3 });
    const action = plotNextAction(cul, 3, products);
    expect(action.nextSequence).toBe(4);
    expect(action.planComplete).toBe(false);
  });

  it("คืน planComplete = true เมื่อครบ 4 ครั้ง (stage_03)", () => {
    const cul = makeCultivation({ stageId: "stage_03", currentSequence: 4 });
    const action = plotNextAction(cul, 4, products);
    expect(action.nextSequence).toBeNull();
    expect(action.planComplete).toBe(true);
    expect(action.nextStageId).toBe("stage_04");
  });

  it("รองรับ 4–6 ครั้ง: ครั้งที่ 5 และ 6 ยังได้ (stage_09)", () => {
    const cul = makeCultivation({ stageId: "stage_09", currentSequence: 4 });
    const action = plotNextAction(cul, 4, products);
    expect(action.nextSequence).toBe(5);
    expect(action.planComplete).toBe(false);
  });

  it("คืน recommendation = null เมื่อ stageId ไม่ถูกต้อง", () => {
    const cul = makeCultivation({ stageId: null, stage: "ไม่มีระยะนี้" });
    const action = plotNextAction(cul, 0, products);
    expect(action.recommendation).toBeNull();
  });
});

describe("recommendRound — สูตรและสินค้า", () => {
  it("คืน recommendation พร้อมกลุ่มสูตร", () => {
    const reco = recommendRound("stage_03", 1, products);
    expect(reco).not.toBeNull();
    expect(reco!.stageId).toBe("stage_03");
    expect(reco!.sequence).toBe(1);
    expect(reco!.groups.length).toBeGreaterThanOrEqual(1);
  });

  it("แยกสูตรทางเลือกออกจากสูตรหลัก (ไม่รวมกัน)", () => {
    const reco = recommendRound("stage_03", 1, products);
    if (!reco) return;
    // แต่ละกลุ่มมี alternatives flag ชัดเจน
    for (const group of reco.groups) {
      expect(typeof group.alternatives).toBe("boolean");
    }
  });

  it("qty เริ่มที่ 0 — พนักงานกรอกเอง", () => {
    const reco = recommendRound("stage_03", 1, products);
    if (!reco) return;
    for (const group of reco.groups) {
      for (const item of group.items) {
        expect(item.qty).toBe(0);
        expect(item.subtotal).toBe(0);
      }
    }
  });

  it("missingCatalog = true เมื่อ SKU ไม่มีในแคตตาล็อก", () => {
    const reco = recommendRound("stage_03", 1, []);
    if (!reco) return;
    expect(reco.allMissing).toBe(true);
    for (const group of reco.groups) {
      for (const item of group.items) {
        expect(item.missingCatalog).toBe(true);
        expect(item.product).toBeUndefined();
      }
    }
  });

  it("setItemQty คำนวณ subtotal และ shortStock", () => {
    let reco = recommendRound("stage_03", 1, products);
    if (!reco) return;
    const group = reco.groups[0]!;
    const item = group.items[0]!;
    if (!item.product) return;
    // กรอกจำนวน = 10 แต่สต็อกมีแค่ 50 (p1) — พอ
    reco = setItemQty(reco, group.id, item.sku, 10);
    const updated = reco.groups
      .find((g) => g.id === group.id)
      ?.items.find((i) => i.sku === item.sku);
    expect(updated?.qty).toBe(10);
    expect(updated?.subtotal).toBe(item.product.price * 10);
    expect(updated?.shortStock).toBe(false);
  });

  it("setItemQty ตรวจสต็อกไม่พอ (shortStock = true)", () => {
    let reco = recommendRound("stage_03", 1, products);
    if (!reco) return;
    // หา item ที่ product = p2 (stock = 5)
    for (const group of reco.groups) {
      for (const item of group.items) {
        if (item.product?.id === "p2") {
          reco = setItemQty(reco, group.id, item.sku, 10); // สต็อกมี 5
          const updated = reco.groups
            .find((g) => g.id === group.id)
            ?.items.find((i) => i.sku === item.sku);
          expect(updated?.qty).toBe(10);
          expect(updated?.shortStock).toBe(true);
          return;
        }
      }
    }
  });

  it("setItemQty ไม่อนุญาตจำนวนติดลบ/NaN/ทศนิยม", () => {
    let reco = recommendRound("stage_03", 1, products);
    if (!reco) return;
    const group = reco.groups[0]!;
    const item = group.items[0]!;
    reco = setItemQty(reco, group.id, item.sku, -5);
    expect(reco.groups[0]!.items[0]!.qty).toBe(0);
    reco = setItemQty(reco, group.id, item.sku, NaN);
    expect(reco.groups[0]!.items[0]!.qty).toBe(0);
    reco = setItemQty(reco, group.id, item.sku, 3.7);
    expect(reco.groups[0]!.items[0]!.qty).toBe(3);
  });
});

describe("cultivationsByStage — สรุปแปลงตามระยะ", () => {
  it("คืน 12 ระยะเสมอ (แม้ไม่มีแปลง)", () => {
    const dist = cultivationsByStage([]);
    expect(dist).toHaveLength(12);
    for (const d of dist) {
      expect(d.plots).toBe(0);
      expect(d.area).toBe(0);
    }
  });

  it("นับแปลงตาม stageId", () => {
    const culs = [
      makeCultivation({ id: "c1", stageId: "stage_03", area: 5 }),
      makeCultivation({ id: "c2", stageId: "stage_03", area: 3 }),
      makeCultivation({ id: "c3", stageId: "stage_09", area: 10 }),
    ];
    const dist = cultivationsByStage(culs);
    const s03 = dist.find((d) => d.stage === "แตกใบอ่อน ใบสอง");
    const s09 = dist.find((d) => d.stage === "ลูกเล็ก");
    expect(s03?.plots).toBe(2);
    expect(s03?.area).toBe(8);
    expect(s09?.plots).toBe(1);
    expect(s09?.area).toBe(10);
  });
});

describe("findFollowUps — ลูกค้าที่ควรติดต่อ", () => {
  it("คืน needs_confirmation เมื่อไม่ทราบวันเริ่มรอบ", () => {
    const cul = makeCultivation({ plantedDate: null });
    const customer = makeCustomer([cul]);
    const followUps = findFollowUps([customer], products);
    expect(followUps.length).toBeGreaterThan(0);
    expect(followUps[0]!.kind).toBe("needs_confirmation");
  });

  it("ไม่คืน opportunity (ไม่มีตัวเลขมูลค่าที่ไม่ยืนยัน)", () => {
    const cul = makeCultivation({ plantedDate: null });
    const customer = makeCustomer([cul]);
    const followUps = findFollowUps([customer], products);
    for (const f of followUps) {
      expect(f).not.toHaveProperty("opportunity");
    }
  });
});

describe("forecastDemand — พยากรณ์กลุ่มสินค้า", () => {
  it("ไม่คืน value/shortfall/qty (ไม่ยืนยันปริมาณ)", () => {
    const cul = makeCultivation({ plantedDate: "2026-01-01" });
    const customer = makeCustomer([cul]);
    const demand = forecastDemand([customer], products, 30);
    for (const d of demand) {
      expect(d).not.toHaveProperty("value");
      expect(d).not.toHaveProperty("shortfall");
      expect(d).not.toHaveProperty("qty");
      expect(d).toHaveProperty("plots");
      expect(d).toHaveProperty("formulaGroups");
    }
  });
});

describe("stageNameFromId / stageIdFromName", () => {
  it("แปลง stageId → name", () => {
    expect(stageNameFromId("stage_01")).toBe("เตรียมต้นหลังเก็บเกี่ยว");
    expect(stageNameFromId("stage_12")).toBe("ก่อนเก็บ");
  });

  it("แปลง name → stageId", () => {
    expect(stageIdFromName("เตรียมต้นหลังเก็บเกี่ยว")).toBe("stage_01");
    expect(stageIdFromName("ก่อนเก็บ")).toBe("stage_12");
  });

  it("คืน null เมื่อไม่ถูกต้อง", () => {
    expect(stageNameFromId(null)).toBeNull();
    expect(stageNameFromId("invalid")).toBeNull();
    expect(stageIdFromName(null)).toBeNull();
    expect(stageIdFromName("ไม่มีระยะนี้")).toBeNull();
  });
});
