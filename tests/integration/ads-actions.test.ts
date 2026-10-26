import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { ForbiddenError } from "@/lib/auth/current-user";
import { resetDb } from "../helpers/db";

const listLeadForms = vi.hoisted(() => vi.fn());
const requireUser = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/current-user", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth/current-user")>();
  return { ...actual, requireUser };
});
vi.mock("@/lib/meta", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/meta")>();
  return { ...actual, getMetaGateway: vi.fn(async () => ({ listLeadForms })) };
});
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), unstable_cache: (fn: unknown) => fn }));

const { revalidatePath } = await import("next/cache");
const { MetaToolUnavailableError } = await import("@/lib/meta");
const { syncLeadFormsAction } = await import("@/app/(app)/ads/actions");

const admin = { id: "u1", email: "a@x.in", name: "Admin", role: "ADMIN" as const };

describe("syncLeadFormsAction", () => {
  beforeEach(async () => {
    await resetDb();
    vi.mocked(revalidatePath).mockClear();
    listLeadForms.mockReset();
    requireUser.mockReset().mockResolvedValue(admin);
    await db.metaConnection.create({
      data: { id: 1, pageId: "page_1", adAccountId: "act_1", accessTokenEnc: "enc", leadFormIds: ["old"] },
    });
  });

  it("stores the page's lead form ids and leaves the other columns untouched", async () => {
    listLeadForms.mockResolvedValue([
      { id: "f1", name: "A", status: "ACTIVE", leadsCount: 1 },
      { id: "f2", name: "B", status: "PAUSED", leadsCount: 0 },
    ]);
    expect(await syncLeadFormsAction()).toEqual({ ok: true, count: 2 });
    expect(requireUser).toHaveBeenCalledWith("ADMIN");
    expect(listLeadForms).toHaveBeenCalledWith("page_1");
    expect(await db.metaConnection.findUniqueOrThrow({ where: { id: 1 } })).toMatchObject({
      leadFormIds: ["f1", "f2"],
      pageId: "page_1",
      adAccountId: "act_1",
      accessTokenEnc: "enc",
    });
    expect(revalidatePath).toHaveBeenCalledWith("/ads");
  });

  it("refuses non-admins", async () => {
    requireUser.mockRejectedValue(new ForbiddenError());
    expect(await syncLeadFormsAction()).toEqual({ ok: false, error: "Only admins can sync forms" });
    expect(listLeadForms).not.toHaveBeenCalled();
  });

  it("returns the Meta error message and keeps the stored ids", async () => {
    const error = new MetaToolUnavailableError("listLeadForms", ["ads_get_insights"]);
    listLeadForms.mockRejectedValue(error);
    expect(await syncLeadFormsAction()).toEqual({ ok: false, error: error.message });
    expect((await db.metaConnection.findUniqueOrThrow({ where: { id: 1 } })).leadFormIds).toEqual(["old"]);
  });

  it("returns a transport error's message", async () => {
    listLeadForms.mockRejectedValue(new Error('Meta MCP tool "ads_get_lead_forms" returned an error: rate limited'));
    expect(await syncLeadFormsAction()).toEqual({ ok: false, error: expect.stringMatching(/rate limited/) });
  });

  it("reports a missing connection", async () => {
    await db.metaConnection.deleteMany();
    expect(await syncLeadFormsAction()).toMatchObject({ ok: false, error: expect.stringMatching(/not connected/i) });
  });
});
