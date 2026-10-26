import { describe, it, expect } from "vitest";
import { parseLeadsCsv } from "@/lib/csv";

const csv = `name,phone,email,project,budget,configuration,locality,notes
Rohan,9845012345,r@x.in,krishvi-111,45L,2BHK,Whitefield,
Priya,9845000000,,,ask,3BHK,,
Amit,9845099999,,,1.2Cr,,,vip`;

describe("parseLeadsCsv", () => {
  it("parses valid rows and reports the bad budget row by line", () => {
    const r = parseLeadsCsv(csv, "CSV_IMPORT");
    expect(r.rows).toHaveLength(2);
    expect(r.rows[0]).toMatchObject({
      source: "CSV_IMPORT",
      name: "Rohan",
      phone: "9845012345",
      email: "r@x.in",
      projectSlug: "krishvi-111",
      budgetRupees: 4500000,
      configuration: "2BHK",
      locality: "Whitefield",
    });
    expect(r.rows[0].notes).toBeUndefined();
    expect(r.rows[0].receivedAt).toBeInstanceOf(Date);
    expect(r.rows[1].name).toBe("Amit");
    expect(r.rows[1].budgetRupees).toBe(12000000);
    expect(r.rows[1].notes).toBe("vip");
    expect(r.errors).toEqual([{ line: 3, message: expect.stringMatching(/budget/i) }]);
  });

  it("rejects missing name or phone per row", () => {
    expect(parseLeadsCsv("name,phone\n,9845012345", "CSV_IMPORT").errors[0].line).toBe(2);
    const r = parseLeadsCsv("name,phone\nRohan,\nPriya,9845000000", "CSV_IMPORT");
    expect(r.errors).toEqual([{ line: 2, message: expect.stringMatching(/phone/i) }]);
    expect(r.rows.map((x) => x.name)).toEqual(["Priya"]);
  });

  it("handles quoted fields with commas, escaped quotes, CRLF and trailing blank lines", () => {
    const text = 'name,phone,notes\r\n"Mehta, Rohan",9845012345,"said ""call later"", busy"\r\nPriya,9845000000,"multi\nline"\r\n\r\n\n';
    const r = parseLeadsCsv(text, "WALK_IN");
    expect(r.errors).toEqual([]);
    expect(r.rows.map((x) => [x.name, x.notes, x.source])).toEqual([
      ["Mehta, Rohan", 'said "call later", busy', "WALK_IN"],
      ["Priya", "multi\nline", "WALK_IN"],
    ]);
  });

  it("matches headers case-insensitively and reports an invalid email", () => {
    const r = parseLeadsCsv(" Name ,PHONE,Email\nRohan,9845012345,not-an-email", "CSV_IMPORT");
    expect(r.rows).toEqual([]);
    expect(r.errors).toEqual([{ line: 2, message: expect.stringMatching(/email/i) }]);
  });

  it("reports a missing required header once", () => {
    const r = parseLeadsCsv("name,email\nRohan,r@x.in", "CSV_IMPORT");
    expect(r.rows).toEqual([]);
    expect(r.errors).toEqual([{ line: 1, message: expect.stringMatching(/phone/i) }]);
  });
});
