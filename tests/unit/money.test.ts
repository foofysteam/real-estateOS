import { describe, it, expect } from "vitest";
import { parseRupees, formatRupees, formatRupeesExact, formatRupeesShort } from "@/lib/money";

describe("money", () => {
  it.each<[string | number, number | null]>([
    ["45L", 4500000],
    ["45 lakh", 4500000],
    ["1.2Cr", 12000000],
    ["1.2 crore", 12000000],
    ["45,00,000", 4500000],
    [4500000, 4500000],
    ["ask", null],
    ["", null],
  ])("parseRupees(%s) -> %s", (i, o) => expect(parseRupees(i)).toBe(o));

  it("formats with Indian grouping", () => {
    expect(formatRupees(4500000)).toBe("₹45,00,000");
    expect(formatRupees(12000000)).toBe("₹1,20,00,000");
  });

  it("formats short", () => {
    expect(formatRupeesShort(4500000)).toBe("₹45L");
    expect(formatRupeesShort(12000000)).toBe("₹1.2Cr");
    expect(formatRupeesShort(50000)).toBe("₹50K");
  });

  it("formats exact amounts with at most two decimals", () => {
    expect(formatRupeesExact(246.9)).toBe("₹246.9");
    expect(formatRupeesExact(1234.567)).toBe("₹1,234.57");
    expect(formatRupeesExact(500)).toBe("₹500");
  });
});
