import { describe, it, expect, beforeEach } from "vitest";
import {
  readPosPrefill,
  checkPosPrefill,
  clearPosPrefill,
  type PosPrefillPayload,
} from "@/lib/pos-prefill";

beforeEach(() => {
  sessionStorage.clear();
});

// จำลอง sessionStorage สำหรับ Node environment
const store: Record<string, string> = {};
const sessionStorageMock = {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => {
    store[key] = value;
  },
  removeItem: (key: string) => {
    delete store[key];
  },
  clear: () => {
    for (const key of Object.keys(store)) delete store[key];
  },
};
Object.defineProperty(globalThis, "sessionStorage", {
  value: sessionStorageMock,
  configurable: true,
});

const validPayload: PosPrefillPayload = {
  v: 1,
  requestId: "pf-1",
  customerId: "c1",
  cultivationId: "cul-1",
  stageId: "stage_03",
  sequence: 1,
  lines: [
    { productId: "p1", qty: 5, sku: "HRM-AMINO", label: "สาหร่าย/อะมิโน" },
    { productId: "p2", qty: 3, sku: "FRT-301010", label: "ปุ๋ย 30-10-10" },
  ],
};

const products = [
  { id: "p1", stock: 50, deletedAt: null },
  { id: "p2", stock: 5, deletedAt: null },
  { id: "p3", stock: 0, deletedAt: null },
];

const customers = [{ id: "c1" }, { id: "c2" }];

describe("readPosPrefill", () => {
  it("คืน null เมื่อไม่มี payload", () => {
    expect(readPosPrefill()).toBeNull();
  });

  it("คืน payload เมื่อมีข้อมูลถูกต้อง", () => {
    sessionStorage.setItem("pos_prefill", JSON.stringify(validPayload));
    const payload = readPosPrefill();
    expect(payload).toEqual(validPayload);
  });

  it("คืน null เมื่อ JSON เสีย", () => {
    sessionStorage.setItem("pos_prefill", "not-json");
    expect(readPosPrefill()).toBeNull();
  });

  it("คืน null เมื่อ version ไม่ถูกต้อง", () => {
    sessionStorage.setItem("pos_prefill", JSON.stringify({ ...validPayload, v: 2 }));
    expect(readPosPrefill()).toBeNull();
  });

  it("คืน null เมื่อไม่มี requestId", () => {
    sessionStorage.setItem("pos_prefill", JSON.stringify({ ...validPayload, requestId: "" }));
    expect(readPosPrefill()).toBeNull();
  });
});

describe("checkPosPrefill — ตรวจสินค้า", () => {
  it("คืน invalid เมื่อ payload = null", () => {
    const check = checkPosPrefill(null, products, customers);
    expect(check.invalid).toBe(true);
    expect(check.validLines).toHaveLength(0);
  });

  it("คืน validLines สำหรับสินค้าที่มีในแคตตาล็อก", () => {
    const check = checkPosPrefill(validPayload, products, customers);
    expect(check.invalid).toBe(false);
    expect(check.validLines).toHaveLength(2);
  });

  it("ตรวจสินค้าที่ถูกลบ (deletedAt)", () => {
    const deletedProducts = [
      { id: "p1", stock: 50, deletedAt: "2026-01-01" },
      { id: "p2", stock: 5, deletedAt: null },
    ];
    const check = checkPosPrefill(validPayload, deletedProducts, customers);
    expect(check.validLines).toHaveLength(1);
    expect(check.validLines[0]!.productId).toBe("p2");
    expect(check.problems.length).toBe(1);
    expect(check.problems[0]!.reason).toContain("ลบ");
  });

  it("ตรวจสินค้าที่ไม่มีในแคตตาล็อก", () => {
    const payload: PosPrefillPayload = {
      ...validPayload,
      lines: [
        { productId: "p1", qty: 5, sku: "HRM-AMINO", label: "สาหร่าย" },
        { productId: "p-missing", qty: 2, sku: "MISSING", label: "ไม่มี" },
      ],
    };
    const check = checkPosPrefill(payload, products, customers);
    expect(check.validLines).toHaveLength(1);
    expect(check.problems.length).toBe(1);
    expect(check.problems[0]!.reason).toContain("ไม่มี");
  });

  it("ตรวจจำนวนไม่ถูกต้อง (<= 0 หรือ NaN)", () => {
    const payload: PosPrefillPayload = {
      ...validPayload,
      lines: [
        { productId: "p1", qty: 0, sku: "HRM-AMINO", label: "สาหร่าย" },
        { productId: "p2", qty: -5, sku: "FRT-301010", label: "ปุ๋ย" },
        { productId: "p3", qty: NaN, sku: "BAD", label: "NaN" },
      ],
    };
    const check = checkPosPrefill(payload, products, customers);
    expect(check.validLines).toHaveLength(0);
    expect(check.problems).toHaveLength(3);
  });

  it("ตรวจสต็อกไม่พอ — ยังคงเป็น valid line (UI แจ้ง)", () => {
    const payload: PosPrefillPayload = {
      ...validPayload,
      lines: [{ productId: "p2", qty: 100, sku: "FRT-301010", label: "ปุ๋ย" }],
    };
    const check = checkPosPrefill(payload, products, customers);
    expect(check.validLines).toHaveLength(1);
    expect(check.problems).toHaveLength(1);
    expect(check.problems[0]!.reason).toContain("สต็อก");
  });

  it("ตรวจลูกค้า (customerValid)", () => {
    const check = checkPosPrefill(validPayload, products, customers);
    expect(check.customerValid).toBe(true);

    const payload: PosPrefillPayload = { ...validPayload, customerId: "c-missing" };
    const check2 = checkPosPrefill(payload, products, customers);
    expect(check2.customerValid).toBe(false);
  });
});

describe("clearPosPrefill", () => {
  it("ลบ payload หลังใช้", () => {
    sessionStorage.setItem("pos_prefill", JSON.stringify(validPayload));
    sessionStorage.setItem("pos_prefill_product_ids", JSON.stringify(["p1"]));
    clearPosPrefill();
    expect(sessionStorage.getItem("pos_prefill")).toBeNull();
    expect(sessionStorage.getItem("pos_prefill_product_ids")).toBeNull();
  });
});
