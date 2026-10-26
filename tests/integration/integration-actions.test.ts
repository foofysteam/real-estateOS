import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { decrypt } from "@/lib/crypto";
import { resetDb } from "../helpers/db";

const currentUser = vi.hoisted(() => ({ id: "", role: "ADMIN" as "ADMIN" | "AGENT" }));
const listCampaigns = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/current-user", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth/current-user")>();
  return {
    ...actual,
    requireUser: vi.fn(async (role?: string) => {
      if (role && role !== currentUser.role) throw new actual.ForbiddenError();
      return { id: currentUser.id, email: "admin@sc.studio", name: "Admin", role: currentUser.role };
    }),
  };
});
vi.mock("@/lib/meta", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/meta")>();
  return { ...actual, getMetaGateway: vi.fn(async () => ({ listCampaigns })), resetMetaGateway: vi.fn() };
});
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { revalidatePath } = await import("next/cache");
const { resetMetaGateway } = await import("@/lib/meta");
const actions = await import("@/app/(app)/settings/actions");

const meta = { pageId: "page_1", adAccountId: "act_1", accessToken: "EAAB", mcpUrl: "" };

function csvForm(text: string, source = "CSV_IMPORT", name = "leads.csv"): FormData {
  const form = new FormData();
  form.set("file", new File([text], name, { type: "text/csv" }));
  form.set("source", source);
  return form;
}

describe("integration and import actions", () => {
  beforeEach(async () => {
    await resetDb();
    const admin = await db.user.create({
      data: { email: "admin@sc.studio", name: "Admin", role: "ADMIN", passwordHash: "x" },
    });
    currentUser.id = admin.id;
    currentUser.role = "ADMIN";
    vi.mocked(revalidatePath).mockClear();
    vi.mocked(resetMetaGateway).mockClear();
    listCampaigns.mockReset();
  });

  it("refuses every action for a non-admin", async () => {
    currentUser.role = "AGENT";
    const forbidden = { ok: false, error: expect.stringMatching(/permission/i) };
    expect(await actions.saveMetaConnectionAction(meta)).toEqual(forbidden);
    expect(await actions.testMetaConnectionAction()).toEqual(forbidden);
    expect(await actions.createIngestKeyAction("Site", "WEBSITE")).toEqual(forbidden);
    expect(await actions.revokeIngestKeyAction("x")).toEqual(forbidden);
    expect(await actions.importCsvAction(csvForm("name,phone\nA,9876543210\n"))).toEqual(forbidden);
    expect(await db.metaConnection.count()).toBe(0);
    expect(await db.ingestKey.count()).toBe(0);
    expect(await db.lead.count()).toBe(0);
    expect(listCampaigns).not.toHaveBeenCalled();
  });

  it("saveMetaConnectionAction saves, leaves leadFormIds alone, resets the gateway and revalidates", async () => {
    await db.metaConnection.create({
      data: { id: 1, pageId: "old", adAccountId: "act_0", accessTokenEnc: "", leadFormIds: ["f1", "f2"] },
    });
    expect(await actions.saveMetaConnectionAction(meta)).toEqual({ ok: true });
    const row = await db.metaConnection.findUniqueOrThrow({ where: { id: 1 } });
    expect(row).toMatchObject({ pageId: "page_1", adAccountId: "act_1", leadFormIds: ["f1", "f2"], mcpUrl: null });
    expect(decrypt(row.accessTokenEnc)).toBe("EAAB");
    expect(resetMetaGateway).toHaveBeenCalledTimes(1);
    expect(revalidatePath).toHaveBeenCalledWith("/settings", undefined);
    expect(revalidatePath).toHaveBeenCalledWith("/ads", undefined);
  });

  it("saveMetaConnectionAction returns field errors for bad input", async () => {
    const r = await actions.saveMetaConnectionAction({ ...meta, pageId: " ", mcpUrl: "not a url" });
    expect(r).toMatchObject({ ok: false, fieldErrors: { pageId: expect.any(String), mcpUrl: expect.any(String) } });
    expect(await db.metaConnection.count()).toBe(0);
  });

  it("testMetaConnectionAction reports the campaign count or a capped error", async () => {
    expect(await actions.testMetaConnectionAction()).toEqual({ ok: false, error: expect.stringMatching(/save/i) });
    await actions.saveMetaConnectionAction(meta);
    listCampaigns.mockResolvedValue([{ id: "c1" }, { id: "c2" }]);
    expect(await actions.testMetaConnectionAction()).toEqual({ ok: true, count: 2 });
    expect(listCampaigns).toHaveBeenCalledWith("act_1");

    listCampaigns.mockRejectedValue(new Error("x".repeat(500)));
    const r = await actions.testMetaConnectionAction();
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error.length).toBeLessThanOrEqual(300);
  });

  it("createIngestKeyAction returns the plaintext once and revokeIngestKeyAction deactivates it", async () => {
    const r = await actions.createIngestKeyAction("Website form", "WEBSITE");
    expect(r).toEqual({ ok: true, id: expect.any(String), plaintext: expect.stringMatching(/^sk_live_/) });
    if (!r.ok) throw new Error("unreachable");
    const key = await db.ingestKey.findUniqueOrThrow({ where: { id: r.id } });
    expect(key).toMatchObject({ name: "Website form", source: "WEBSITE", isActive: true });
    expect(key.keyHash).not.toBe(r.plaintext);

    expect(await actions.revokeIngestKeyAction(r.id)).toEqual({ ok: true });
    expect((await db.ingestKey.findUniqueOrThrow({ where: { id: r.id } })).isActive).toBe(false);
    expect(revalidatePath).toHaveBeenCalledWith("/settings", undefined);
  });

  it("createIngestKeyAction validates name and source", async () => {
    expect(await actions.createIngestKeyAction("", "WEBSITE")).toMatchObject({ ok: false, fieldErrors: { name: expect.any(String) } });
    expect(await actions.createIngestKeyAction("X", "NOPE" as never)).toMatchObject({ ok: false, fieldErrors: { source: expect.any(String) } });
    expect(await db.ingestKey.count()).toBe(0);
  });

  it("importCsvAction rejects files over 2 MB", async () => {
    const big = "name,phone\n" + "x".repeat(2 * 1024 * 1024);
    expect(await actions.importCsvAction(csvForm(big))).toEqual({ ok: false, error: "File too large (max 2 MB)" });
    expect(await db.lead.count()).toBe(0);
  });

  it("importCsvAction requires a file and an allowed source", async () => {
    const noFile = new FormData();
    noFile.set("source", "CSV_IMPORT");
    expect(await actions.importCsvAction(noFile)).toMatchObject({ ok: false, error: expect.stringMatching(/choose/i) });
    expect(await actions.importCsvAction(csvForm("name,phone\nA,9876543210\n", "META_LEAD_AD"))).toMatchObject({
      ok: false,
      fieldErrors: { source: expect.any(String) },
    });
  });

  it("importCsvAction imports rows, counts duplicates, reports line errors and revalidates", async () => {
    const csv = "name,phone\nAsha,9876543210\nAsha again,+91 98765 43210\nNo phone,\n";
    const r = await actions.importCsvAction(csvForm(csv, "WALK_IN"));
    expect(r).toEqual({ ok: true, created: 1, deduplicated: 1, errors: [{ line: 4, message: expect.any(String) }] });
    const lead = await db.lead.findFirstOrThrow();
    expect(lead.source).toBe("WALK_IN");
    expect(revalidatePath).toHaveBeenCalledWith("/leads", undefined);
    expect(revalidatePath).toHaveBeenCalledWith("/pipeline", undefined);
    expect(revalidatePath).toHaveBeenCalledWith("/today", undefined);
  });
});
