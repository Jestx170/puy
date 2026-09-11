import { describe, it, expect } from "vitest";
import {
  longanCareProgram,
  getCareProgramByStageId,
  getCareProgramByStageName,
  getCareRound,
  nextRoundInStage,
  nextMainStageId,
  STAGE_ID_BY_NAME,
  STAGE_NAME_BY_ID,
} from "@/lib/careProgram";

describe("careProgram — โครงสร้าง 12 ระยะตาม Excel", () => {
  it("มีระยะหลัก 12 ระยะ", () => {
    expect(longanCareProgram).toHaveLength(12);
  });

  it("stageId เป็น stage_01..stage_12 ตามลำดับ", () => {
    longanCareProgram.forEach((stage, idx) => {
      expect(stage.stageId).toBe(`stage_${String(idx + 1).padStart(2, "0")}`);
    });
  });

  it("ระยะเรียงตาม stageId stage_01..stage_12 (ใช้ index ของ array)", () => {
    longanCareProgram.forEach((stage, idx) => {
      expect(stage.stageId).toBe(`stage_${String(idx + 1).padStart(2, "0")}`);
    });
  });

  it("ชื่อระยะไม่ซ้ำกัน", () => {
    const names = longanCareProgram.map((s) => s.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("stageId ไม่ซ้ำกัน", () => {
    const ids = longanCareProgram.map((s) => s.stageId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("ทุกระยะมี roundsDefault >= 1 และ roundsMax >= roundsDefault", () => {
    for (const stage of longanCareProgram) {
      expect(stage.roundsDefault).toBeGreaterThanOrEqual(1);
      expect(stage.roundsMax).toBeGreaterThanOrEqual(stage.roundsDefault);
    }
  });

  it("ระยะที่ Excel ระบุ 4–6 ครั้ง เริ่มที่ 4 และอนุญาตถึง 6", () => {
    // ลูกเล็ก (stage_09) และ ลูกมะเขือพวง (stage_10) = 4–6 ครั้ง
    const s09 = getCareProgramByStageId("stage_09");
    const s10 = getCareProgramByStageId("stage_10");
    expect(s09?.roundsDefault).toBe(4);
    expect(s09?.roundsMax).toBe(6);
    expect(s10?.roundsDefault).toBe(4);
    expect(s10?.roundsMax).toBe(6);
  });

  it("แตกใบอ่อน ใบสอง มี 4 ครั้ง (ครั้งที่ 1–4)", () => {
    const s03 = getCareProgramByStageId("stage_03");
    expect(s03?.roundsDefault).toBe(4);
    expect(s03?.roundsMax).toBe(4);
  });

  it("ราดสาร มีทางใบ 3 ครั้ง + ทางดิน 1 ครั้ง = 4 ครั้ง", () => {
    const s04 = getCareProgramByStageId("stage_04");
    expect(s04?.roundsDefault).toBe(4);
    expect(s04?.roundsMax).toBe(4);
  });
});

describe("careProgram — รอบ/ครั้ง (rounds)", () => {
  it("ทุกระยะมีจำนวน rounds ตรงกับ roundsDefault", () => {
    for (const stage of longanCareProgram) {
      expect(stage.rounds).toHaveLength(stage.roundsDefault);
    }
  });

  it("sequence ของ rounds เรียง 1, 2, 3, ...", () => {
    for (const stage of longanCareProgram) {
      stage.rounds.forEach((round, idx) => {
        expect(round.sequence).toBe(idx + 1);
      });
    }
  });

  it("ทุก round มีอย่างน้อย 1 กลุ่มสูตร", () => {
    for (const stage of longanCareProgram) {
      for (const round of stage.rounds) {
        expect(round.groups.length).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it("ทุกกลุ่มมีอย่างน้อย 1 ตัวเลือก", () => {
    for (const stage of longanCareProgram) {
      for (const round of stage.rounds) {
        for (const group of round.groups) {
          expect(group.options.length).toBeGreaterThanOrEqual(1);
        }
      }
    }
  });
});

describe("careProgram — map ชื่อ ↔ stageId", () => {
  it("STAGE_ID_BY_NAME มี 12 entry", () => {
    expect(Object.keys(STAGE_ID_BY_NAME)).toHaveLength(12);
  });

  it("STAGE_NAME_BY_ID มี 12 entry", () => {
    expect(Object.keys(STAGE_NAME_BY_ID)).toHaveLength(12);
  });

  it("แปลงไปกลับได้", () => {
    for (const stage of longanCareProgram) {
      const id = STAGE_ID_BY_NAME[stage.name];
      expect(id).toBe(stage.stageId);
      const name = STAGE_NAME_BY_ID[stage.stageId];
      expect(name).toBe(stage.name);
    }
  });
});

describe("careProgram — nextRoundInStage", () => {
  it("คืนครั้งถัดไปถ้ายังไม่ถึง roundsMax", () => {
    // stage_03 = 4 ครั้ง
    expect(nextRoundInStage("stage_03", 0)).toEqual({ stageId: "stage_03", sequence: 1 });
    expect(nextRoundInStage("stage_03", 1)).toEqual({ stageId: "stage_03", sequence: 2 });
    expect(nextRoundInStage("stage_03", 3)).toEqual({ stageId: "stage_03", sequence: 4 });
  });

  it("คืน null เมื่อครบ roundsMax", () => {
    expect(nextRoundInStage("stage_03", 4)).toBeNull();
  });

  it("รองรับระยะ 4–6 ครั้ง: ครั้งที่ 5 และ 6 ยังได้", () => {
    // stage_09 = 4–6 ครั้ง
    expect(nextRoundInStage("stage_09", 4)).toEqual({ stageId: "stage_09", sequence: 5 });
    expect(nextRoundInStage("stage_09", 5)).toEqual({ stageId: "stage_09", sequence: 6 });
    expect(nextRoundInStage("stage_09", 6)).toBeNull();
  });

  it("คืน null เมื่อ stageId ไม่ถูกต้อง", () => {
    expect(nextRoundInStage(null, 0)).toBeNull();
    expect(nextRoundInStage(undefined, 0)).toBeNull();
    expect(nextRoundInStage("invalid", 0)).toBeNull();
  });
});

describe("careProgram — nextMainStageId", () => {
  it("คืนระยะถัดไปตามชีววิทยา", () => {
    expect(nextMainStageId("stage_01")).toBe("stage_02");
    expect(nextMainStageId("stage_11")).toBe("stage_12");
  });

  it("คืน null เมื่ออยู่ระยะสุดท้าย", () => {
    expect(nextMainStageId("stage_12")).toBeNull();
  });

  it("คืน null เมื่อ stageId ไม่ถูกต้อง", () => {
    expect(nextMainStageId(null)).toBeNull();
    expect(nextMainStageId("invalid")).toBeNull();
  });
});
