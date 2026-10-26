import { describe, expect, it } from "vitest";
import { formatIstDateTime } from "@/lib/dates";

describe("formatIstDateTime", () => {
  it("formats day, short month and time in IST", () => {
    // 2026-10-23T10:00:00Z = 23 Oct 15:30 IST
    expect(formatIstDateTime(new Date("2026-10-23T10:00:00Z"))).toBe("23 Oct, 3:30 pm");
  });

  it("uses the IST date when the UTC date differs", () => {
    // 2026-10-22T19:00:00Z = 23 Oct 00:30 IST
    expect(formatIstDateTime(new Date("2026-10-22T19:00:00Z"))).toBe("23 Oct, 12:30 am");
  });
});
