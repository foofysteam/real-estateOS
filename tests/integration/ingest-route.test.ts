import { describe, it, expect, beforeEach, vi } from "vitest";
import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import { createIngestKey, resolveIngestKey, revokeIngestKey } from "@/lib/ingest-keys";
import { POST } from "@/app/api/ingest/route";
import { POST as CSV_POST } from "@/app/api/ingest/csv/route";
import type { CurrentUser } from "@/lib/auth/current-user";
import { resetDb } from "../helpers/db";

const auth = vi.hoisted(() => ({ user: null as CurrentUser | null }));
vi.mock("@/lib/auth/current-user", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth/current-user")>()),
  getCurrentUser: async () => auth.user,
}));

function req(body: unknown, key?: string) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (key) headers.authorization = `Bearer ${key}`;
  return new Request("http://x/api/ingest", { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body), headers });
}

describe("ingest keys", () => {
  beforeEach(resetDb);

  it("stores only the SHA-256 of an sk_live_ key and resolves it", async () => {
    const k = await createIngestKey("site", "WEBSITE");
    expect(k.plaintext).toMatch(/^sk_live_[0-9a-f]{32}$/);
    const row = await db.ingestKey.findUniqueOrThrow({ where: { id: k.id } });
    expect(row.keyHash).toBe(createHash("sha256").update(k.plaintext).digest("hex"));
    expect(row.lastUsedAt).toBeNull();
    const resolved = await resolveIngestKey(k.plaintext);
    expect(resolved?.id).toBe(k.id);
    expect((await db.ingestKey.findUniqueOrThrow({ where: { id: k.id } })).lastUsedAt).toBeInstanceOf(Date);
  });

  it("returns null for unknown and revoked keys", async () => {
    const k = await createIngestKey("site", "WEBSITE");
    expect(await resolveIngestKey("sk_live_" + "0".repeat(32))).toBeNull();
    await revokeIngestKey(k.id);
    expect((await db.ingestKey.findUniqueOrThrow({ where: { id: k.id } })).isActive).toBe(false);
    expect(await resolveIngestKey(k.plaintext)).toBeNull();
    expect((await db.ingestKey.findUniqueOrThrow({ where: { id: k.id } })).lastUsedAt).toBeNull();
  });
});

describe("POST /api/ingest", () => {
  beforeEach(resetDb);

  it("creates a lead with a valid key and stamps the key's source", async () => {
    const k = await createIngestKey("site", "WEBSITE");
    const res = await POST(req({ name: "R", phone: "9845012345", source: "META_LEAD_AD", budget: "45L" }, k.plaintext));
    expect(res.status).toBe(201);
    const lead = await db.lead.findFirstOrThrow();
    expect(await res.json()).toEqual({ leadId: lead.id, deduplicated: false });
    expect(lead.source).toBe("WEBSITE");
    expect(lead.phone).toBe("+919845012345");
    expect(lead.budgetRupees).toBe(4500000);
  });

  it("accepts a numeric budget", async () => {
    const k = await createIngestKey("site", "WEBSITE");
    const res = await POST(req({ name: "R", phone: "9845012345", budget: 7500000 }, k.plaintext));
    expect(res.status).toBe(201);
    expect((await db.lead.findFirstOrThrow()).budgetRupees).toBe(7500000);
  });

  it("returns 422 at budget when the budget exceeds MAX_RUPEES", async () => {
    const k = await createIngestKey("site", "WEBSITE");
    for (const budget of ["300Cr", 3_000_000_000]) {
      const res = await POST(req({ name: "R", phone: "9845012345", budget }, k.plaintext));
      expect(res.status).toBe(422);
      expect((await res.json()).issues).toEqual([expect.objectContaining({ path: ["budget"], message: "Budget too large" })]);
    }
    expect(await db.lead.count()).toBe(0);
  });

  it("treats blank optional strings as absent", async () => {
    const k = await createIngestKey("site", "WEBSITE");
    const res = await POST(
      req({ name: "R", phone: "9845012345", email: "", locality: "  ", configuration: "", notes: "", projectSlug: "", externalId: "" }, k.plaintext),
    );
    expect(res.status).toBe(201);
    expect(await db.lead.findFirstOrThrow()).toMatchObject({ email: null, locality: null, configuration: null });
  });

  it("returns 202 on duplicate", async () => {
    const k = await createIngestKey("site", "WEBSITE");
    const res1 = await POST(req({ name: "R", phone: "9845012345" }, k.plaintext));
    const res2 = await POST(req({ name: "R again", phone: "+91 98450 12345" }, k.plaintext));
    expect(res2.status).toBe(202);
    expect(await res2.json()).toEqual({ leadId: (await res1.json()).leadId, deduplicated: true });
    expect(await db.lead.count()).toBe(1);
  });

  it("returns 401 for missing, unknown or revoked key", async () => {
    const k = await createIngestKey("site", "WEBSITE");
    expect((await POST(req({ name: "R", phone: "9845012345" }))).status).toBe(401);
    expect((await POST(req({ name: "R", phone: "9845012345" }, "sk_live_" + "f".repeat(32)))).status).toBe(401);
    await revokeIngestKey(k.id);
    expect((await POST(req({ name: "R", phone: "9845012345" }, k.plaintext))).status).toBe(401);
    expect(await db.lead.count()).toBe(0);
  });

  it("returns 422 for junk phone and creates nothing", async () => {
    const k = await createIngestKey("site", "WEBSITE");
    const res = await POST(req({ name: "R", phone: "12" }, k.plaintext));
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ issues: [{ path: ["phone"], message: "Invalid phone number" }] });
    expect(await db.lead.count()).toBe(0);
  });

  it("returns 422 with Zod issues for a missing name, bad email or unparsable budget", async () => {
    const k = await createIngestKey("site", "WEBSITE");
    const res = await POST(req({ phone: "9845012345", email: "nope" }, k.plaintext));
    expect(res.status).toBe(422);
    const paths = (await res.json()).issues.map((i: { path: unknown[] }) => i.path);
    expect(paths).toEqual(expect.arrayContaining([["name"], ["email"]]));

    const res2 = await POST(req({ name: "R", phone: "9845012345", budget: "ask" }, k.plaintext));
    expect(res2.status).toBe(422);
    expect((await res2.json()).issues).toEqual([expect.objectContaining({ path: ["budget"] })]);

    const res3 = await POST(req("not json", k.plaintext));
    expect(res3.status).toBe(422);
    expect(await db.lead.count()).toBe(0);
  });
});

describe("POST /api/ingest/csv", () => {
  const csv = `name,phone,email,project,budget,configuration,locality,notes
Rohan,9845012345,r@x.in,krishvi-111,45L,2BHK,Whitefield,
Priya,9845000000,,,ask,3BHK,,
Amit,9845099999,,,1.2Cr,,,vip`;

  function upload(text: string, source?: string) {
    const form = new FormData();
    form.append("file", new File([text], "leads.csv", { type: "text/csv" }));
    if (source) form.append("source", source);
    return CSV_POST(new Request("http://x/api/ingest/csv", { method: "POST", body: form }));
  }

  beforeEach(async () => {
    await resetDb();
    const admin = await db.user.create({ data: { email: "a@sc.studio", name: "Admin", role: "ADMIN", passwordHash: "x" } });
    auth.user = { id: admin.id, email: admin.email, name: admin.name, role: "ADMIN" };
  });

  it("csv route imports good rows and lists errors", async () => {
    const res = await upload(csv, "CSV_IMPORT");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.created).toBe(2);
    expect(body.deduplicated).toBe(0);
    expect(body.errors).toHaveLength(1);
    expect(body.errors[0]).toEqual({ line: 3, message: expect.stringMatching(/budget/i) });
    const leads = await db.lead.findMany({ orderBy: { name: "asc" } });
    expect(leads.map((l) => [l.name, l.source])).toEqual([["Amit", "CSV_IMPORT"], ["Rohan", "CSV_IMPORT"]]);
    const created = await db.leadEvent.findFirstOrThrow({ where: { type: "CREATED", leadId: leads[1].id } });
    expect(created.actorId).toBe(auth.user!.id);
  });

  it("counts duplicates and reports invalid phones with their line", async () => {
    await upload("name,phone\nRohan,9845012345", "WEBSITE");
    const res = await upload("name,phone\nRohan,98450 12345\nJunk,12\nNew,9845011111", "WEBSITE");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      created: 1,
      deduplicated: 1,
      errors: [{ line: 3, message: "Invalid phone number" }],
    });
    expect(await db.lead.count()).toBe(2);
  });

  it("defaults source to CSV_IMPORT and rejects an unknown source or missing file", async () => {
    expect((await upload("name,phone\nRohan,9845012345")).status).toBe(200);
    expect((await db.lead.findFirstOrThrow()).source).toBe("CSV_IMPORT");
    expect((await upload("name,phone\nRohan,9845012345", "NOPE")).status).toBe(422);
    const form = new FormData();
    expect((await CSV_POST(new Request("http://x/api/ingest/csv", { method: "POST", body: form }))).status).toBe(422);
  });

  it("csv route returns 403 for AGENT", async () => {
    auth.user = { ...auth.user!, role: "AGENT" };
    const res = await upload(csv, "CSV_IMPORT");
    expect(res.status).toBe(403);
    expect(await db.lead.count()).toBe(0);
  });

  it("csv route returns 401 without a session", async () => {
    auth.user = null;
    const res = await upload(csv, "CSV_IMPORT");
    expect(res.status).toBe(401);
    expect(await db.lead.count()).toBe(0);
  });
});
