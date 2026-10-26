import { describe, it, expect, vi } from "vitest";
import { createHmac } from "node:crypto";
import { verifyMetaSignature, extractLeadgenIds } from "@/lib/meta/webhook";
import { mapFieldData, fetchLeadgen } from "@/lib/meta/graph";

describe("verifyMetaSignature", () => {
  it("verifies a correct sha256 signature and rejects a wrong one", () => {
    const body = '{"a":1}';
    const sig = "sha256=" + createHmac("sha256", "secret").update(body).digest("hex");
    expect(verifyMetaSignature(body, sig, "secret")).toBe(true);
    expect(verifyMetaSignature(body, "sha256=00", "secret")).toBe(false);
    expect(verifyMetaSignature(body, null, "secret")).toBe(false);
  });

  it("rejects a same-length signature made with another secret or over another body", () => {
    const body = '{"a":1}';
    const other = "sha256=" + createHmac("sha256", "other").update(body).digest("hex");
    expect(verifyMetaSignature(body, other, "secret")).toBe(false);
    const sig = "sha256=" + createHmac("sha256", "secret").update(body).digest("hex");
    expect(verifyMetaSignature('{"a":2}', sig, "secret")).toBe(false);
    expect(verifyMetaSignature(body, sig.replace("sha256=", ""), "secret")).toBe(false);
  });
});

describe("extractLeadgenIds", () => {
  it("extracts leadgen changes and ignores other fields", () => {
    const ids = extractLeadgenIds({
      object: "page",
      entry: [
        {
          id: "p1",
          changes: [
            { field: "leadgen", value: { leadgen_id: "L1", page_id: "p1", form_id: "f1", created_time: 1 } },
            { field: "feed", value: {} },
          ],
        },
      ],
    });
    expect(ids).toEqual([{ leadgenId: "L1", pageId: "p1", formId: "f1", createdTime: 1 }]);
  });

  it("returns an empty list for malformed bodies", () => {
    expect(extractLeadgenIds(null)).toEqual([]);
    expect(extractLeadgenIds({ entry: "x" })).toEqual([]);
    expect(extractLeadgenIds({ entry: [{ changes: [{ field: "leadgen", value: {} }] }] })).toEqual([]);
  });
});

describe("mapFieldData", () => {
  it("maps field_data into a NormalizedLead", () => {
    const n = mapFieldData({
      id: "L1",
      created_time: "2026-10-26T10:00:00+0000",
      form_id: "f1",
      field_data: [
        { name: "full_name", values: ["Rohan"] },
        { name: "phone_number", values: ["+919845012345"] },
        { name: "email", values: ["r@x.in"] },
        { name: "what_is_your_budget?", values: ["45L"] },
        { name: "preferred_bhk", values: ["2BHK"] },
        { name: "preferred_location", values: ["Whitefield"] },
        { name: "when_to_buy", values: ["3 months"] },
      ],
    });
    expect(n).toMatchObject({
      source: "META_LEAD_AD",
      name: "Rohan",
      phone: "+919845012345",
      email: "r@x.in",
      budgetRupees: 4500000,
      configuration: "2BHK",
      locality: "Whitefield",
      externalId: "L1",
    });
    expect(n.notes).toContain("when_to_buy: 3 months");
    expect(n.receivedAt).toEqual(new Date("2026-10-26T10:00:00+0000"));
  });

  it("joins first_name and last_name, matches keys case-insensitively and keeps an unparseable budget in notes", () => {
    const n = mapFieldData({
      id: "L2",
      created_time: "2026-10-26T10:00:00+0000",
      field_data: [
        { name: "First_Name", values: ["Asha"] },
        { name: "LAST_NAME", values: ["Rao"] },
        { name: "Phone_Number", values: ["9845012345"] },
        { name: "Configuration", values: ["3BHK"] },
        { name: "Locality", values: ["HSR"] },
        { name: "budget", values: ["flexible"] },
      ],
    });
    expect(n).toMatchObject({ name: "Asha Rao", phone: "9845012345", configuration: "3BHK", locality: "HSR" });
    expect(n.budgetRupees).toBeUndefined();
    expect(n.email).toBeUndefined();
    expect(n.notes).toBe("budget: flexible");
  });
});

describe("fetchLeadgen", () => {
  const graphLead = {
    id: "L1",
    created_time: "2026-10-26T10:00:00+0000",
    field_data: [
      { name: "full_name", values: ["Rohan"] },
      { name: "phone_number", values: ["+919845012345"] },
    ],
  };

  it("GETs the leadgen from the Graph API with a bearer token and maps it", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify(graphLead)));
    const n = await fetchLeadgen("L1", "tok", fetchImpl);
    expect(n).toMatchObject({ name: "Rohan", externalId: "L1", source: "META_LEAD_AD" });
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://graph.facebook.com/v24.0/L1?fields=field_data,created_time,ad_id,form_id",
      { headers: { Authorization: "Bearer tok" } },
    );
  });

  it("throws with the HTTP status when the Graph API fails", async () => {
    const fetchImpl = vi.fn(async () => new Response("{}", { status: 500 }));
    await expect(fetchLeadgen("L1", "tok", fetchImpl)).rejects.toThrow(/500/);
  });
});
