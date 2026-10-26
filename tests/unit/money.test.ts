import { describe, it, expect } from "vitest";
import { parseRupees, formatRupees, formatRupeesShort } from "@/lib/money";

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
});
