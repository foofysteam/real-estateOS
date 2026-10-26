import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/auth/password";

describe("password", () => {
  it("hashes and verifies", async () => {
    const h = await hashPassword("pass1234");
    expect(h.startsWith("$argon2id$")).toBe(true);
    expect(await verifyPassword("pass1234", h)).toBe(true);
    expect(await verifyPassword("nope", h)).toBe(false);
  });

  it("returns false for a malformed hash instead of throwing", async () => {
    expect(await verifyPassword("pass1234", "not-a-hash")).toBe(false);
  });
});
