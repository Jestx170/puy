// ============================================================
// Fieldstone ERP — POS prefill payload
//
// รับ payload จาก CRM (NextRoundCard / คำแนะนำสูตร) แล้วเติมเข้าตะกร้า POS
// อย่างปลอดภัย:
//   - version + requestId สำหรับ idempotency (กัน double-submit)
//   - รักษาลูกค้า แปลง ระยะ ครั้ง สูตร และจำนวนที่พนักงานกรอก
//   - ตรวจสินค้าที่ถูกลบ/เลิกขาย/สต็อกไม่พอ ก่อนเติม
//   - ถ้ามีตะกร้าเดิม ต้องถามก่อนรวม/แทนที่ (UI เป็นผู้ตัดสินใจ)
// ============================================================

export interface PosPrefillLine {
  productId: string;
  qty: number;
  sku: string;
  label: string;
}

export interface PosPrefillPayload {
  v: 1;
  requestId: string;
  customerId: string;
  cultivationId: string;
  stageId: string | null;
  sequence: number | null;
  lines: PosPrefillLine[];
}

/** ผลการตรวจ payload เทียบกับแคตตาล็อก/ลูกค้าปัจจุบัน */
export interface PosPrefillCheck {
  payload: PosPrefillPayload | null;
  /** true = payload เสีย/เก่า/ไม่ถูกต้อง */
  invalid: boolean;
  invalidReason?: string;
  /** ลูกค้าต้นทาง (ถ้ายังมีอยู่) */
  customerValid: boolean;
  /** รายการที่ผ่านการตรวจ (สามารถเติมได้) */
  validLines: PosPrefillLine[];
  /** รายการที่มีปัญหา (สินค้าหาย/สต็อกไม่พอ) */
  problems: { line: PosPrefillLine; reason: string }[];
}

/** อ่านและตรวจ payload จาก sessionStorage */
export function readPosPrefill(): PosPrefillPayload | null {
  const raw = sessionStorage.getItem("pos_prefill");
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PosPrefillPayload;
    if (parsed.v !== 1 || !Array.isArray(parsed.lines) || !parsed.requestId) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/** ลบ payload หลังใช้ (หรือเมื่อเสีย) */
export function clearPosPrefill(): void {
  sessionStorage.removeItem("pos_prefill");
  // ลบ key เดิมด้วยเพื่อความเข้ากันได้
  sessionStorage.removeItem("pos_prefill_product_ids");
}

/**
 * ตรวจ payload เทียบกับแคตตาล็อก/ลูกค้าปัจจุบัน
 * ไม่เติมอัตโนมัติ — ส่งผลให้ UI ตัดสินใจ (รวม/แทนที่/ยกเลิก)
 */
export function checkPosPrefill(
  payload: PosPrefillPayload | null,
  products: { id: string; stock: number; deletedAt?: string | null }[],
  customers: { id: string }[],
): PosPrefillCheck {
  if (!payload) {
    return {
      payload: null,
      invalid: true,
      invalidReason: "ไม่มี payload",
      customerValid: false,
      validLines: [],
      problems: [],
    };
  }

  const customerValid = customers.some((c) => c.id === payload.customerId);
  const byId = new Map(products.map((p) => [p.id, p]));
  const validLines: PosPrefillLine[] = [];
  const problems: { line: PosPrefillLine; reason: string }[] = [];

  for (const line of payload.lines) {
    if (!Number.isFinite(line.qty) || line.qty <= 0) {
      problems.push({ line, reason: "จำนวนไม่ถูกต้อง" });
      continue;
    }
    const product = byId.get(line.productId);
    if (!product || product.deletedAt) {
      problems.push({ line, reason: "สินค้าถูกลบหรือไม่มีในแคตตาล็อก" });
      continue;
    }
    if (product.stock < line.qty) {
      problems.push({ line, reason: `สต็อกไม่พอ (เหลือ ${product.stock})` });
      // ยังคงรวมเป็น valid line แต่ UI ต้องแจ้ง
    }
    validLines.push(line);
  }

  return {
    payload,
    invalid: false,
    customerValid,
    validLines,
    problems,
  };
}
