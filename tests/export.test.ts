import { describe, it, expect } from "vitest";
import { toCSV } from "@/lib/export";

describe("toCSV", () => {
  it("formats simple rows with header from first row", () => {
    const csv = toCSV([{ name: "ปุ๋ย A", price: 100 }]);
    expect(csv).toBe("name,price\nปุ๋ย A,100");
  });

  it("escapes commas", () => {
    const csv = toCSV([{ name: "ปุ๋ย A, B, C" }]);
    expect(csv).toBe('name\n"ปุ๋ย A, B, C"');
  });

  it("escapes quotes", () => {
    const csv = toCSV([{ note: 'has "quote"' }]);
    expect(csv).toBe('note\n"has ""quote"""');
  });

  it("escapes newlines", () => {
    const csv = toCSV([{ desc: "line1\nline2" }]);
    expect(csv).toBe('desc\n"line1\nline2"');
  });

  it("prefixes formula-injection characters with single quote", () => {
    const csv = toCSV([{ eq: "=1+1", plus: "+123", minus: "-456", at: "@A1", tab: "\tfoo" }]);
    expect(csv).toBe("eq,plus,minus,at,tab\n'=1+1,'+123,'-456,'@A1,'\tfoo");
  });

  it("does not prefix normal values", () => {
    const csv = toCSV([{ a: "100", b: "ปุ๋ย", c: "hello" }]);
    expect(csv).toBe("a,b,c\n100,ปุ๋ย,hello");
  });

  it("uses custom columns and labels", () => {
    const csv = toCSV(
      [{ n: "x", p: 100 }],
      [
        { key: "n", label: "ชื่อ" },
        { key: "p", label: "ราคา" },
      ],
    );
    expect(csv).toBe("ชื่อ,ราคา\nx,100");
  });

  it("returns empty string for empty rows", () => {
    expect(toCSV([])).toBe("");
  });
});
