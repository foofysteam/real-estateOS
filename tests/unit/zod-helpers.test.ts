import { describe, expect, it } from "vitest";
import { normalizedLeadSchema } from "@/lib/leads/types";
import { emptyToUndefined } from "@/lib/zod-helpers";

describe("emptyToUndefined", () => {
  it("turns blank strings into undefined and passes everything else through", () => {
    expect(emptyToUndefined("")).toBeUndefined();
    expect(emptyToUndefined("  \t")).toBeUndefined();
    expect(emptyToUndefined(" a ")).toBe(" a ");
    expect(emptyToUndefined(0)).toBe(0);
    expect(emptyToUndefined(null)).toBeNull();
  });

  it("lets normalizedLeadSchema accept a blank email", () => {
    const r = normalizedLeadSchema.parse({ source: "WEBSITE", name: "R", phone: "1", email: " ", receivedAt: new Date() });
    expect(r.email).toBeUndefined();
  });
});
