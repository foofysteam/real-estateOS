import { describe, it, expect } from "vitest";
import { computeScore } from "@/lib/score";

const project = { priceMinRupees: 8000000, priceMaxRupees: 16000000 };

describe("computeScore", () => {
  it("scores a bare Meta lead at 40", () => expect(computeScore({ source: "META_LEAD_AD" })).toBe(40));

  it("adds budget-in-range, configuration, locality, email", () =>
    expect(
      computeScore({
        source: "REFERRAL",
        budgetRupees: 10000000,
        configuration: "3BHK",
        locality: "Whitefield",
        email: "a@b.c",
        project,
      }),
    ).toBe(100));

  it("ignores budget when out of range or no project", () => {
    expect(computeScore({ source: "WEBSITE", budgetRupees: 1, project })).toBe(45);
    expect(computeScore({ source: "WEBSITE", budgetRupees: 10000000 })).toBe(45);
  });

  it("clamps to 100", () =>
    expect(
      computeScore({ source: "REFERRAL", budgetRupees: 9000000, configuration: "x", locality: "y", email: "z", project }),
    ).toBeLessThanOrEqual(100));
});
