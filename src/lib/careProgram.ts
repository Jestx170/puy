// ============================================================
// Fieldstone ERP — Care program (ต้นฉบับจาก Excel ชีต "ลำไย")
//
// ไฟล์นี้เป็นแหล่งข้อมูลชุดเดียวของโปรแกรมดูแลลำไย:
//   - จำนวนครั้ง / ช่วงเวลา / ความถี่ / สูตร
//   - แยกสูตรทางเลือกออกจากสูตรหลัก
//   - เก็บข้อความต้นฉบับจาก Excel เพื่อให้ตรวจสอบย้อนกลับได้
//
// ต้นฉบับ: /Users/jes/Downloads/ตารางการส่งข้อความบอร์ดแคสท์ (1).xlsx ชีต "ลำไย"
// กติกาที่ตกลงกับผู้ใช้:
//   - ระยะ 4–6 ครั้งเริ่มที่ 4 และอนุญาตให้เพิ่มได้ถึง 6
//   - พนักงานกรอกจำนวนซื้อเอง ไม่ใช้ ratePerRai เดิมเป็นอัตรารับรอง
//   - ไม่บังคับกรอกวันที่
//   - SKU ในไฟล์นี้เป็นการอ้างอิงเพื่อจับคู่กับแคตตาล็อกจริง
//     engine จะเตือนถ้า SKU ยังไม่มีในแคตตาล็อก ไม่สร้างราคา/สต็อกขึ้นเอง
// ============================================================

/** ระยะหลัก 12 ระยะของลำไย (ตรงกับ crop_stages.id stage_01..stage_12) */
export const LONGAN_MAIN_STAGES = [
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

export type LonganMainStage = (typeof LONGAN_MAIN_STAGES)[number];

export const STAGE_ID_BY_NAME: Record<LonganMainStage, string> = {
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

export const STAGE_NAME_BY_ID: Record<string, LonganMainStage> = Object.fromEntries(
  Object.entries(STAGE_ID_BY_NAME).map(([name, id]) => [id, name]),
) as Record<string, LonganMainStage>;

/** ตัวเลือกสูตร/ผลิตภัณฑ์หนึ่งชนิดในกลุ่มสูตร */
export interface CareFormulaOption {
  /** SKU อ้างอิงในแคตตาล็อก — engine จะเช็คว่ามีจริงก่อนแสดงราคา/สต็อก */
  sku: string;
  /** ชื่อสูตร/ผลิตภัณฑ์ตามต้นฉบับ Excel */
  label: string;
  /** หมายเหตุจากต้นฉบับ (ถ้ามี) */
  note?: string;
}

/** กลุ่มสูตรของครั้งดูแลหนึ่ง — อาจมีหลายตัวเลือก */
export interface CareFormulaGroup {
  /** รหัสกลุ่ม */
  id: string;
  /** คำอธิบายกลุ่ม เช่น "สาหร่ายอะมิโน + ตัวหน้าสูง" */
  label: string;
  /** ตัวเลือกในกลุ่ม */
  options: CareFormulaOption[];
  /**
   * true  = ตัวเลือกเป็นทางเลือก (เลือกหนึ่งหรือมากกว่า ไม่ต้องซื้อทุกตัว)
   * false = ตัวเลือกทั้งหมดเป็นสิ่งจำเป็น (ต้องมีทุกตัว)
   */
  alternatives: boolean;
}

/** รายละเอียดครั้งดูแลหนึ่งครั้งในระยะ */
export interface CareRound {
  /** ลำดับครั้งที่ 1-based */
  sequence: number;
  /** วิธีดูแล เช่น "ทางใบ" / "ทางดิน" (ถ้าระบุในต้นฉบับ) */
  method?: string;
  /** ข้อความระยะห่าง/ความถี่จากต้นฉบับ เช่น "1 เว้น 2" */
  spacingNote?: string;
  /** กลุ่มสูตรของครั้งนี้ */
  groups: CareFormulaGroup[];
}

/** โปรแกรมดูแลของระยะหลักหนึ่งระยะ */
export interface CareStageProgram {
  stageId: string;
  name: LonganMainStage;
  /** จำนวนวันน้อยสุดของระยะ (จาก Excel) — null = ไม่ระบุ */
  durationMin: number | null;
  /** จำนวนวันมากสุดของระยะ (จาก Excel) */
  durationMax: number | null;
  /** ความถี่ (วัน/ครั้ง) จาก Excel — null = ทำครั้งเดียว/ตามสภาพต้น */
  frequencyDays: number | null;
  /** จำนวนครั้งเริ่มต้นตามแผน (จาก Excel) */
  roundsDefault: number;
  /** จำนวนครั้งสูงสุดที่อนุญาตให้เพิ่มได้ (>= roundsDefault) */
  roundsMax: number;
  /** รายละเอียดแต่ละครั้ง (length = roundsDefault) */
  rounds: CareRound[];
  /** ข้อความสรุประยะจากต้นฉบับ Excel */
  summary: string;
}

/* ----------------------- ข้อมูลจากชีตลำไยใน Excel ----------------------- */

const stage01: CareStageProgram = {
  stageId: "stage_01",
  name: "เตรียมต้นหลังเก็บเกี่ยว",
  durationMin: 45,
  durationMax: 60,
  frequencyDays: 15,
  roundsDefault: 3,
  roundsMax: 3,
  summary: "45-60 วัน · ทุก 15 วัน (ประมาณ 3 ครั้ง)",
  rounds: [
    {
      sequence: 1,
      spacingNote: "ทุก 15 วัน",
      groups: [
        {
          id: "stage_01_r1_g1",
          label: "สาหร่าย/อะมิโน + ปุ๋ยตัวหน้าสูง",
          alternatives: false,
          options: [
            { sku: "HRM-AMINO", label: "สาหร่ายอะมิโน ฟื้นต้นหลังเก็บเกี่ยว" },
            {
              sku: "FRT-1500",
              label: "ปุ๋ยตัวหน้าสูง 15-0-0",
              note: "ใช้สลับสูตรกันดื้อได้กับ 30-10-10 / 30-20-10",
            },
            { sku: "FRT-301010", label: "ปุ๋ยตัวหน้าสูง 30-10-10" },
            { sku: "FRT-302010", label: "ปุ๋ยตัวหน้าสูง 30-20-10" },
          ],
        },
      ],
    },
    {
      sequence: 2,
      spacingNote: "ทุก 15 วัน",
      groups: [
        {
          id: "stage_01_r2_g1",
          label: "สาหร่าย/อะมิโน + ปุ๋ยตัวหน้าสูง",
          alternatives: false,
          options: [
            { sku: "HRM-AMINO", label: "สาหร่ายอะมิโน" },
            { sku: "FRT-1500", label: "ปุ๋ยตัวหน้าสูง 15-0-0" },
            { sku: "FRT-301010", label: "ปุ๋ยตัวหน้าสูง 30-10-10" },
            { sku: "FRT-302010", label: "ปุ๋ยตัวหน้าสูง 30-20-10" },
          ],
        },
      ],
    },
    {
      sequence: 3,
      spacingNote: "ทุก 15 วัน",
      groups: [
        {
          id: "stage_01_r3_g1",
          label: "สาหร่าย/อะมิโน + ปุ๋ยตัวหน้าสูง",
          alternatives: false,
          options: [
            { sku: "HRM-AMINO", label: "สาหร่ายอะมิโน" },
            { sku: "FRT-1500", label: "ปุ๋ยตัวหน้าสูง 15-0-0" },
            { sku: "FRT-301010", label: "ปุ๋ยตัวหน้าสูง 30-10-10" },
            { sku: "FRT-302010", label: "ปุ๋ยตัวหน้าสูง 30-20-10" },
          ],
        },
      ],
    },
  ],
};

const stage02: CareStageProgram = {
  stageId: "stage_02",
  name: "แตกใบอ่อน ใบแรก",
  durationMin: 10,
  durationMax: 15,
  frequencyDays: null,
  roundsDefault: 1,
  roundsMax: 1,
  summary: "10-15 วัน · 1 ครั้ง (เมื่อสภาพต้นพร้อม)",
  rounds: [
    {
      sequence: 1,
      spacingNote: "1 ครั้งเมื่อใบเพสลาด/ต้นพร้อม",
      groups: [
        {
          id: "stage_02_r1_g1",
          label: "ธาตุอาหารรองเสริม + ปุ๋ยสูตรเสมอ",
          alternatives: false,
          options: [
            { sku: "NUT-MICRO", label: "ธาตุอาหารรองเสริม ป้องกันใบขาดธาตุ" },
            { sku: "FRT-212121", label: "ปุ๋ยสูตรเสมอ 21-21-21" },
            { sku: "FRT-202020", label: "ปุ๋ยสูตรเสมอ 20-20-20 (ใช้สลับได้)" },
          ],
        },
      ],
    },
  ],
};

const stage03: CareStageProgram = {
  stageId: "stage_03",
  name: "แตกใบอ่อน ใบสอง",
  durationMin: 20,
  durationMax: 30,
  frequencyDays: 7,
  roundsDefault: 4,
  roundsMax: 4,
  summary: "20-30 วัน · ทุก 7 วัน (ประมาณ 4 ครั้ง) — แต่ละครั้งใช้สูตรต่างกัน",
  rounds: [
    {
      sequence: 1,
      spacingNote: "ทุก 7 วัน",
      groups: [
        {
          id: "stage_03_r1_g1",
          label: "ครั้งที่ 1: สาหร่าย/อะมิโน + ตัวหน้าสูง",
          alternatives: false,
          options: [
            { sku: "HRM-AMINO", label: "สาหร่ายอะมิโน" },
            { sku: "FRT-1500", label: "ปุ๋ยตัวหน้าสูง 15-0-0" },
            { sku: "FRT-301010", label: "ปุ๋ยตัวหน้าสูง 30-10-10" },
            { sku: "FRT-302010", label: "ปุ๋ยตัวหน้าสูง 30-20-10" },
          ],
        },
      ],
    },
    {
      sequence: 2,
      spacingNote: "ทุก 7 วัน",
      groups: [
        {
          id: "stage_03_r2_g1",
          label: "ครั้งที่ 2: สูตรเสมอ",
          alternatives: true,
          options: [
            { sku: "FRT-212121", label: "ปุ๋ยสูตรเสมอ 21-21-21" },
            { sku: "FRT-202020", label: "ปุ๋ยสูตรเสมอ 20-20-20" },
          ],
        },
      ],
    },
    {
      sequence: 3,
      spacingNote: "ทุก 7 วัน",
      groups: [
        {
          id: "stage_03_r3_g1",
          label: "ครั้งที่ 3: ตัวหน้าต่ำ คุมใบ",
          alternatives: true,
          options: [
            { sku: "FRT-42424", label: "ปุ๋ยตัวหน้าต่ำ 4-24-24" },
            { sku: "FRT-82424", label: "ปุ๋ยตัวหน้าต่ำ 8-24-24" },
          ],
        },
      ],
    },
    {
      sequence: 4,
      spacingNote: "ทุก 7 วัน",
      groups: [
        {
          id: "stage_03_r4_g1",
          label: "ครั้งที่ 4: แมกนีเซียม + ตัดไนโตรเจน สะสมอาหาร",
          alternatives: false,
          options: [
            { sku: "MIN-MG", label: "แมกนีเซียม เพิ่มความเขียวเข้ม" },
            { sku: "FRT-05234", label: "ปุ๋ย 0-52-34 ตัดไนโตรเจนสะสมอาหาร" },
          ],
        },
      ],
    },
  ],
};

const stage04: CareStageProgram = {
  stageId: "stage_04",
  name: "ราดสาร",
  durationMin: null,
  durationMax: 10,
  frequencyDays: null,
  roundsDefault: 4,
  roundsMax: 4,
  summary: "กรอบ 10 วัน · ทางใบ 3 ครั้ง (เว้น 1 เว้น 2) + ทางดิน 1 ครั้ง (ไม่เกิน 2 วันหลังทางใบ)",
  rounds: [
    {
      sequence: 1,
      method: "ทางใบ",
      spacingNote: "1 เว้น 2",
      groups: [
        {
          id: "stage_04_r1_g1",
          label: "ทางใบ ครั้งที่ 1: โพแทสเซียมคลอเรต / โซเดียมคลอเรต",
          alternatives: true,
          options: [
            { sku: "CHL-KCLO3", label: "โพแทสเซียมคลอเรต ทางใบ" },
            { sku: "CHL-NACLO3", label: "โซเดียมคลอเรต ทางใบ" },
          ],
        },
      ],
    },
    {
      sequence: 2,
      method: "ทางใบ",
      spacingNote: "1 เว้น 2",
      groups: [
        {
          id: "stage_04_r2_g1",
          label: "ทางใบ ครั้งที่ 2: โพแทสเซียมคลอเรต / โซเดียมคลอเรต",
          alternatives: true,
          options: [
            { sku: "CHL-KCLO3", label: "โพแทสเซียมคลอเรต ทางใบ" },
            { sku: "CHL-NACLO3", label: "โซเดียมคลอเรต ทางใบ" },
          ],
        },
      ],
    },
    {
      sequence: 3,
      method: "ทางใบ",
      spacingNote: "1 เว้น 2",
      groups: [
        {
          id: "stage_04_r3_g1",
          label: "ทางใบ ครั้งที่ 3: โพแทสเซียมคลอเรต / โซเดียมคลอเรต",
          alternatives: true,
          options: [
            { sku: "CHL-KCLO3", label: "โพแทสเซียมคลอเรต ทางใบ" },
            { sku: "CHL-NACLO3", label: "โซเดียมคลอเรต ทางใบ" },
          ],
        },
      ],
    },
    {
      sequence: 4,
      method: "ทางดิน",
      spacingNote: "ไม่เกิน 2 วันหลังจากราดสารทางใบ",
      groups: [
        {
          id: "stage_04_r4_g1",
          label: "ทางดิน: โซเดียมคลอเรต",
          alternatives: false,
          options: [{ sku: "CHL-NACLO3", label: "โซเดียมคลอเรต ราดทางดิน" }],
        },
      ],
    },
  ],
};

const stage05: CareStageProgram = {
  stageId: "stage_05",
  name: "เปิดตาดอก",
  durationMin: 10,
  durationMax: 14,
  frequencyDays: 6,
  roundsDefault: 2,
  roundsMax: 2,
  summary: "10-14 วัน · ทุก 5-7 วัน (ประมาณ 2 ครั้ง)",
  rounds: [
    {
      sequence: 1,
      spacingNote: "ทุก 5-7 วัน",
      groups: [
        {
          id: "stage_05_r1_g1",
          label: "เสือดอก/ยาเปิดตาดอก + ปุ๋ย 6-12-36",
          alternatives: false,
          options: [
            { sku: "BLOOM-TIGER", label: "เสือดอก กระตุ้นการเปิดตาดอก" },
            { sku: "BLOOM-OPEN", label: "ยาเปิดตาดอก ช่วยแทงช่อพร้อมกัน" },
            { sku: "FRT-61236", label: "ปุ๋ย 6-12-36 สะสมโพแทสเซียมช่วงเปิดตา" },
          ],
        },
      ],
    },
    {
      sequence: 2,
      spacingNote: "ทุก 5-7 วัน",
      groups: [
        {
          id: "stage_05_r2_g1",
          label: "เสือดอก/ยาเปิดตาดอก + ปุ๋ย 6-12-36",
          alternatives: false,
          options: [
            { sku: "BLOOM-TIGER", label: "เสือดอก" },
            { sku: "BLOOM-OPEN", label: "ยาเปิดตาดอก" },
            { sku: "FRT-61236", label: "ปุ๋ย 6-12-36" },
          ],
        },
      ],
    },
  ],
};

const stage06: CareStageProgram = {
  stageId: "stage_06",
  name: "ยืดช่อดอก",
  durationMin: 10,
  durationMax: 14,
  frequencyDays: 6,
  roundsDefault: 2,
  roundsMax: 2,
  summary: "10-14 วัน · ทุก 5-7 วัน (ประมาณ 2 ครั้ง)",
  rounds: [
    {
      sequence: 1,
      spacingNote: "ทุก 5-7 วัน",
      groups: [
        {
          id: "stage_06_r1_g1",
          label: "ปุ๋ย 10-52-17 ยืดช่อดอก",
          alternatives: false,
          options: [{ sku: "FRT-105217", label: "ปุ๋ย 10-52-17 ยืดช่อดอก เพิ่มความสมบูรณ์" }],
        },
      ],
    },
    {
      sequence: 2,
      spacingNote: "ทุก 5-7 วัน",
      groups: [
        {
          id: "stage_06_r2_g1",
          label: "ปุ๋ย 10-52-17 ยืดช่อดอก",
          alternatives: false,
          options: [{ sku: "FRT-105217", label: "ปุ๋ย 10-52-17" }],
        },
      ],
    },
  ],
};

const stage07: CareStageProgram = {
  stageId: "stage_07",
  name: "บำรุงช่อดอก",
  durationMin: 10,
  durationMax: 14,
  frequencyDays: 6,
  roundsDefault: 2,
  roundsMax: 2,
  summary: "10-14 วัน · ทุก 5-7 วัน (ประมาณ 2 ครั้ง) — ใช้สูตรเดียวกับยืดช่อดอก",
  rounds: [
    {
      sequence: 1,
      spacingNote: "ทุก 5-7 วัน",
      groups: [
        {
          id: "stage_07_r1_g1",
          label: "ปุ๋ย 10-52-17 บำรุงช่อดอก",
          alternatives: false,
          options: [{ sku: "FRT-105217", label: "ปุ๋ย 10-52-17 บำรุงช่อก่อนดอกบาน" }],
        },
      ],
    },
    {
      sequence: 2,
      spacingNote: "ทุก 5-7 วัน",
      groups: [
        {
          id: "stage_07_r2_g1",
          label: "ปุ๋ย 10-52-17 บำรุงช่อดอก",
          alternatives: false,
          options: [{ sku: "FRT-105217", label: "ปุ๋ย 10-52-17" }],
        },
      ],
    },
  ],
};

const stage08: CareStageProgram = {
  stageId: "stage_08",
  name: "ดอกบาน",
  durationMin: 10,
  durationMax: 14,
  frequencyDays: 6,
  roundsDefault: 2,
  roundsMax: 2,
  summary: "10-14 วัน · ทุก 5-7 วัน (ประมาณ 2 ครั้ง) — เน้นตัวผสมเกสร",
  rounds: [
    {
      sequence: 1,
      spacingNote: "ทุก 5-7 วัน",
      groups: [
        {
          id: "stage_08_r1_g1",
          label: "ตัวผสมเกสร (ไดมอนด์)",
          alternatives: false,
          options: [{ sku: "POL-DIAMOND", label: "ไดมอนด์ ช่วยผสมเกสร เพิ่มการติดผล" }],
        },
      ],
    },
    {
      sequence: 2,
      spacingNote: "ทุก 5-7 วัน",
      groups: [
        {
          id: "stage_08_r2_g1",
          label: "ตัวผสมเกสร (ไดมอนด์)",
          alternatives: false,
          options: [{ sku: "POL-DIAMOND", label: "ไดมอนด์" }],
        },
      ],
    },
  ],
};

const stage09: CareStageProgram = {
  stageId: "stage_09",
  name: "ลูกเล็ก",
  durationMin: 60,
  durationMax: 60,
  frequencyDays: 12,
  roundsDefault: 4,
  roundsMax: 6,
  summary: "60 วัน · ทุก 10-15 วัน (4-6 ครั้ง) — เริ่มที่ 4 และเพิ่มได้จนถึง 6",
  rounds: [
    {
      sequence: 1,
      spacingNote: "ทุก 10-15 วัน",
      groups: [
        {
          id: "stage_09_r1_g1",
          label: "ปุ๋ยตัวหน้าสูง เร่งขยายผล",
          alternatives: false,
          options: [
            { sku: "FRT-301010", label: "ปุ๋ยตัวหน้าสูง 30-10-10 เร่งการเจริญเติบโตของผล" },
            { sku: "FRT-1500", label: "ปุ๋ย 15-0-0 เสริมไนโตรเจนช่วงลูกเล็ก" },
          ],
        },
      ],
    },
    {
      sequence: 2,
      spacingNote: "ทุก 10-15 วัน",
      groups: [{ ...stage09Placeholder("stage_09_r2_g1") }],
    },
    {
      sequence: 3,
      spacingNote: "ทุก 10-15 วัน",
      groups: [{ ...stage09Placeholder("stage_09_r3_g1") }],
    },
    {
      sequence: 4,
      spacingNote: "ทุก 10-15 วัน",
      groups: [{ ...stage09Placeholder("stage_09_r4_g1") }],
    },
  ],
};

function stage09Placeholder(groupId: string): Omit<CareFormulaGroup, never> {
  return {
    id: groupId,
    label: "ปุ๋ยตัวหน้าสูง เร่งขยายผล",
    alternatives: false,
    options: [
      { sku: "FRT-301010", label: "ปุ๋ยตัวหน้าสูง 30-10-10" },
      { sku: "FRT-1500", label: "ปุ๋ย 15-0-0" },
    ],
  };
}

const stage10: CareStageProgram = {
  stageId: "stage_10",
  name: "ลูกมะเขือพวง",
  durationMin: 60,
  durationMax: 60,
  frequencyDays: 12,
  roundsDefault: 4,
  roundsMax: 6,
  summary: "60 วัน · ทุก 10-15 วัน (4-6 ครั้ง) — เริ่มที่ 4 และเพิ่มได้จนถึง 6",
  rounds: [
    {
      sequence: 1,
      spacingNote: "ทุก 10-15 วัน",
      groups: [
        {
          id: "stage_10_r1_g1",
          label: "ปุ๋ยสูตรเสมอ ขยายขนาดผล",
          alternatives: true,
          options: [
            { sku: "FRT-212121", label: "ปุ๋ยสูตรเสมอ 21-21-21 ขยายขนาดผล" },
            { sku: "FRT-202020", label: "ปุ๋ยสูตรเสมอ 20-20-20 ใช้สลับได้" },
          ],
        },
      ],
    },
    {
      sequence: 2,
      spacingNote: "ทุก 10-15 วัน",
      groups: [
        {
          id: "stage_10_r2_g1",
          label: "ปุ๋ยสูตรเสมอ ขยายขนาดผล",
          alternatives: true,
          options: [
            { sku: "FRT-212121", label: "ปุ๋ยสูตรเสมอ 21-21-21" },
            { sku: "FRT-202020", label: "ปุ๋ยสูตรเสมอ 20-20-20" },
          ],
        },
      ],
    },
    {
      sequence: 3,
      spacingNote: "ทุก 10-15 วัน",
      groups: [
        {
          id: "stage_10_r3_g1",
          label: "ปุ๋ยสูตรเสมอ ขยายขนาดผล",
          alternatives: true,
          options: [
            { sku: "FRT-212121", label: "ปุ๋ยสูตรเสมอ 21-21-21" },
            { sku: "FRT-202020", label: "ปุ๋ยสูตรเสมอ 20-20-20" },
          ],
        },
      ],
    },
    {
      sequence: 4,
      spacingNote: "ทุก 10-15 วัน",
      groups: [
        {
          id: "stage_10_r4_g1",
          label: "ปุ๋ยสูตรเสมอ ขยายขนาดผล",
          alternatives: true,
          options: [
            { sku: "FRT-212121", label: "ปุ๋ยสูตรเสมอ 21-21-21" },
            { sku: "FRT-202020", label: "ปุ๋ยสูตรเสมอ 20-20-20" },
          ],
        },
      ],
    },
  ],
};

const stage11: CareStageProgram = {
  stageId: "stage_11",
  name: "ลูกแก้ว",
  durationMin: 45,
  durationMax: 45,
  frequencyDays: 10,
  roundsDefault: 4,
  roundsMax: 4,
  summary: "45 วัน · ทุก 10 วัน (4 ครั้ง) — เน้นตัวท้ายสูงเร่งความหวาน/คุณภาพผล",
  rounds: [
    {
      sequence: 1,
      spacingNote: "ทุก 10 วัน",
      groups: [
        {
          id: "stage_11_r1_g1",
          label: "ปุ๋ยตัวท้ายสูง เร่งความหวาน/คุณภาพผล",
          alternatives: true,
          options: [
            { sku: "FRT-131321", label: "ปุ๋ยตัวท้ายสูง 13-13-21 เพิ่มความหวาน" },
            { sku: "FRT-82424", label: "ปุ๋ย 8-24-24 เสริมคุณภาพเนื้อผล" },
          ],
        },
      ],
    },
    {
      sequence: 2,
      spacingNote: "ทุก 10 วัน",
      groups: [
        {
          id: "stage_11_r2_g1",
          label: "ปุ๋ยตัวท้ายสูง",
          alternatives: true,
          options: [
            { sku: "FRT-131321", label: "ปุ๋ย 13-13-21" },
            { sku: "FRT-82424", label: "ปุ๋ย 8-24-24" },
          ],
        },
      ],
    },
    {
      sequence: 3,
      spacingNote: "ทุก 10 วัน",
      groups: [
        {
          id: "stage_11_r3_g1",
          label: "ปุ๋ยตัวท้ายสูง",
          alternatives: true,
          options: [
            { sku: "FRT-131321", label: "ปุ๋ย 13-13-21" },
            { sku: "FRT-82424", label: "ปุ๋ย 8-24-24" },
          ],
        },
      ],
    },
    {
      sequence: 4,
      spacingNote: "ทุก 10 วัน",
      groups: [
        {
          id: "stage_11_r4_g1",
          label: "ปุ๋ยตัวท้ายสูง",
          alternatives: true,
          options: [
            { sku: "FRT-131321", label: "ปุ๋ย 13-13-21" },
            { sku: "FRT-82424", label: "ปุ๋ย 8-24-24" },
          ],
        },
      ],
    },
  ],
};

const stage12: CareStageProgram = {
  stageId: "stage_12",
  name: "ก่อนเก็บ",
  durationMin: 20,
  durationMax: 20,
  frequencyDays: 9,
  roundsDefault: 2,
  roundsMax: 2,
  summary: "ประมาณ 20 วัน · ทุก 8-10 วัน (2 ครั้ง) — ป้องกันโรคและขัดผิวผล",
  rounds: [
    {
      sequence: 1,
      spacingNote: "ทุก 8-10 วัน",
      groups: [
        {
          id: "stage_12_r1_g1",
          label: "เชื้อราตัวขัดผิว ป้องกันโรคก่อนเก็บ",
          alternatives: false,
          options: [{ sku: "BIO-SKIN", label: "เชื้อราตัวขัดผิว ผิวผลสวย ลดโรคก่อนเก็บ" }],
        },
      ],
    },
    {
      sequence: 2,
      spacingNote: "ทุก 8-10 วัน",
      groups: [
        {
          id: "stage_12_r2_g1",
          label: "เชื้อราตัวขัดผิว ป้องกันโรคก่อนเก็บ",
          alternatives: false,
          options: [{ sku: "BIO-SKIN", label: "เชื้อราตัวขัดผิว" }],
        },
      ],
    },
  ],
};

/** โปรแกรมดูแลลำไยทั้ง 12 ระยะ — เรียงตาม stageId */
export const longanCareProgram: CareStageProgram[] = [
  stage01,
  stage02,
  stage03,
  stage04,
  stage05,
  stage06,
  stage07,
  stage08,
  stage09,
  stage10,
  stage11,
  stage12,
];

const programByStageId = new Map(longanCareProgram.map((p) => [p.stageId, p]));
const programByStageName = new Map(longanCareProgram.map((p) => [p.name, p]));

/** ดึงโปรแกรมดูแลของระยะตาม stageId (stage_01..stage_12) */
export function getCareProgramByStageId(
  stageId: string | null | undefined,
): CareStageProgram | null {
  if (!stageId) return null;
  return programByStageId.get(stageId) ?? null;
}

/** ดึงโปรแกรมดูแลของระยะตามชื่อระยะหลัก */
export function getCareProgramByStageName(
  name: string | null | undefined,
): CareStageProgram | null {
  if (!name) return null;
  return programByStageName.get(name as LonganMainStage) ?? null;
}

/** ดึงครั้งดูแลเฉพาะของระยะและลำดับครั้งที่กำลังจะทำ (1-based) */
export function getCareRound(
  stageId: string | null | undefined,
  sequence: number,
): CareRound | null {
  const program = getCareProgramByStageId(stageId);
  if (!program) return null;
  return program.rounds.find((r) => r.sequence === sequence) ?? null;
}

/**
 * คำนวณครั้งถัดไปที่ควรดูแล จากจำนวนครั้งที่ทำเสร็จแล้วในระยะปัจจุบัน
 * - ถ้ายังไม่ครบแผน → ครั้งถัดไปอยู่ระยะเดิม
 * - ถ้าครบแผนแล้ว → คืน null (ต้องยืนยันเปลี่ยนระยะ ไม่เปลี่ยนอัตโนมัติ)
 */
export function nextRoundInStage(
  stageId: string | null | undefined,
  completedSequence: number,
): { stageId: string; sequence: number } | null {
  const program = getCareProgramByStageId(stageId);
  if (!program || !stageId) return null;
  const next = completedSequence + 1;
  // อนุญาตให้เพิ่มครั้งได้จนถึง roundsMax (รองรับ 4–6 ครั้ง)
  if (next <= program.roundsMax) {
    return { stageId, sequence: next };
  }
  return null;
}

/** ระยะถัดไปตามลำดับชีววิทยา (stage_01 → stage_02 → ... → stage_12) — คืน null ถ้าอยู่ระยะสุดท้าย */
export function nextMainStageId(stageId: string | null | undefined): string | null {
  if (!stageId) return null;
  const idx = LONGAN_MAIN_STAGES.findIndex((name) => STAGE_ID_BY_NAME[name] === stageId);
  if (idx < 0 || idx >= LONGAN_MAIN_STAGES.length - 1) return null;
  return STAGE_ID_BY_NAME[LONGAN_MAIN_STAGES[idx + 1]!];
}

/** รวม SKU ทั้งหมดที่โปรแกรมอ้างอิง (เพื่อเช็คแคตตาล็อก) */
export function allReferencedSkus(): string[] {
  const set = new Set<string>();
  for (const stage of longanCareProgram) {
    for (const round of stage.rounds) {
      for (const group of round.groups) {
        for (const opt of group.options) set.add(opt.sku);
      }
    }
  }
  return Array.from(set).sort();
}
