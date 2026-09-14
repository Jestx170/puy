import { describe, it, expect } from "vitest";
import { currency, compactCurrency, numberFmt } from "@/lib/format";

describe("format helpers", () => {
  it("currency formats THB without decimals", () => {
    expect(currency(9124)).toBe("฿9,124");
  });

  it("currency rounds decimals", () => {
    expect(currency(9124.9)).toBe("฿9,125");
  });

  it("compactCurrency formats large numbers", () => {
    expect(compactCurrency(1_200_000)).toBe("฿1.2M");
  });

  it("compactCurrency formats small numbers", () => {
    expect(compactCurrency(1_200)).toBe("฿1.2K");
  });

  it("numberFmt adds thousand separators", () => {
    expect(numberFmt(1284)).toBe("1,284");
  });
});
