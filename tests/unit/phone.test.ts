import { describe, it, expect } from "vitest";
import { normalizePhone, toWaLink, toTelLink } from "@/lib/phone";

describe("phone", () => {
  it.each([
    ["098450 12345", "+919845012345"],
    ["+91-98450-12345", "+919845012345"],
    ["9845012345", "+919845012345"],
    ["+1 (415) 555-2671", "+14155552671"],
  ])("normalizePhone(%s) -> %s", (raw, e164) => expect(normalizePhone(raw)).toBe(e164));

  it("returns null for junk", () => {
    expect(normalizePhone("12")).toBeNull();
    expect(normalizePhone("call me")).toBeNull();
  });

  it("builds wa.me and tel links", () => {
    expect(toWaLink("+919845012345")).toBe("https://wa.me/919845012345");
    expect(toTelLink("+919845012345")).toBe("tel:+919845012345");
  });
});
