import { describe, it, expect } from "vitest";
import { encrypt, decrypt } from "@/lib/crypto";

describe("crypto", () => {
  it("encrypts to a different string each time and decrypts", () => {
    const a = encrypt("EAAB...");
    const b = encrypt("EAAB...");
    expect(a).not.toBe(b);
    expect(a.split(".")).toHaveLength(3);
    expect(decrypt(a)).toBe("EAAB...");
  });

  it("throws on tampered ciphertext", () => {
    const [iv, ct, tag] = encrypt("x").split(".");
    // Flip one bit rather than swap a trailing char: the tag's last base64url char
    // carries only 2 bits, so a fixed replacement letter is a no-op 1 time in 4.
    const flip = (s: string) => { const b = Buffer.from(s, "base64url"); b[0] ^= 1; return b.toString("base64url"); };
    expect(() => decrypt([iv, flip(ct), tag].join("."))).toThrow();
    expect(() => decrypt([iv, ct, flip(tag)].join("."))).toThrow();
    expect(() => decrypt([flip(iv), ct, tag].join("."))).toThrow();
  });

  it("throws on a malformed token", () => {
    expect(() => decrypt("nope")).toThrow();
  });
});
