import { describe, it, expect, vi } from "vitest";

const ingest = vi.hoisted(() => {
  class InvalidPhoneError extends Error {}
  return { InvalidPhoneError, ingestLead: vi.fn() };
});
vi.mock("@/lib/leads/ingest", () => ingest);

import { importLeadsCsv } from "@/lib/csv";

describe("importLeadsCsv", () => {
  it("reports an unexpected per-row failure and keeps importing the other rows", async () => {
    ingest.ingestLead.mockImplementation(async (lead: { name: string }) => {
      if (lead.name === "Priya") throw new Error("boom");
      return { leadId: lead.name, deduplicated: false };
    });
    const result = await importLeadsCsv("name,phone\nRohan,9845012345\nPriya,9845000000\nAmit,9845099999", "CSV_IMPORT", "u1");
    expect(result).toEqual({ created: 2, deduplicated: 0, errors: [{ line: 3, message: "Import failed: boom" }] });
    expect(ingest.ingestLead.mock.calls.map(([lead, actor]) => [lead.name, actor])).toEqual([
      ["Rohan", "u1"],
      ["Priya", "u1"],
      ["Amit", "u1"],
    ]);
  });
});
