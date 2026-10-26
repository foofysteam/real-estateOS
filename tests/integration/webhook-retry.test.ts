import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";
import { db } from "@/lib/db";
import { resetEnvForTests } from "@/lib/env";
import { handleMetaWebhook } from "@/lib/meta/webhook";
import { listFailedWebhookEvents } from "@/lib/meta/webhook-admin";
import { resetDb } from "../helpers/db";

const currentUser = vi.hoisted(() => ({ role: "ADMIN" as "ADMIN" | "AGENT" }));
vi.mock("@/lib/auth/current-user", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth/current-user")>();
  return {
    ...actual,
    requireUser: vi.fn(async (role?: string) => {
      if (role && role !== currentUser.role) throw new actual.ForbiddenError();
      return { id: "u1", email: "admin@sc.studio", name: "Admin", role: currentUser.role };
    }),
  };
});
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const actions = await import("@/app/(app)/settings/actions");

const KEYS = ["META_APP_SECRET", "META_ACCESS_TOKEN"] as const;
const saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));

const graphLead = (id: string) => ({
  id,
  created_time: "2026-10-26T10:00:00+0000",
  field_data: [
    { name: "full_name", values: ["Rohan"] },
    { name: "phone_number", values: [id === "L1" ? "+919845012345" : "+919845000001"] },
  ],
});

async function deliverFailed(leadgenId: string) {
  const body = JSON.stringify({ entry: [{ changes: [{ field: "leadgen", value: { leadgen_id: leadgenId } }] }] });
  const sig = "sha256=" + createHmac("sha256", "secret").update(body).digest("hex");
  const scheduled: (() => Promise<void>)[] = [];
  await handleMetaWebhook(body, sig, { schedule: (fn) => scheduled.push(fn) });
  for (const fn of scheduled) await fn();
}

beforeEach(async () => {
  await resetDb();
  currentUser.role = "ADMIN";
  process.env.META_APP_SECRET = "secret";
  delete process.env.META_ACCESS_TOKEN;
  resetEnvForTests();
});

afterEach(() => vi.unstubAllGlobals());

afterAll(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
  resetEnvForTests();
});

describe("webhook retry", () => {
  it("retries a FAILED delivery once a token is configured", async () => {
    await deliverFailed("L1");
    const failed = await listFailedWebhookEvents();
    expect(failed).toEqual([
      expect.objectContaining({ externalId: "L1", status: "FAILED", error: "No Meta access token configured" }),
    ]);

    process.env.META_ACCESS_TOKEN = "tok";
    resetEnvForTests();
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(graphLead("L1"))));
    vi.stubGlobal("fetch", fetchMock);

    expect(await actions.retryWebhookEventAction(failed[0].id)).toEqual({ ok: true, status: "PROCESSED" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const ev = await db.webhookEvent.findUniqueOrThrow({ where: { id: failed[0].id } });
    expect(ev).toMatchObject({ status: "PROCESSED", error: null });
    expect(await db.lead.count()).toBe(1);
    expect(await listFailedWebhookEvents()).toEqual([]);

    // A processed row is not reprocessed by a second retry.
    expect(await actions.retryWebhookEventAction(failed[0].id)).toEqual({ ok: true, status: "PROCESSED" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("lists stale PROCESSING rows but not fresh ones, and retry-all handles both FAILED and stale", async () => {
    await deliverFailed("L1");
    const old = new Date(Date.now() - 20 * 60_000);
    await db.webhookEvent.create({ data: { provider: "meta", externalId: "L2", status: "PROCESSING", receivedAt: old, raw: {} } });
    await db.webhookEvent.create({ data: { provider: "meta", externalId: "L3", status: "PROCESSING", raw: {} } });
    expect((await listFailedWebhookEvents()).map((e) => e.externalId).sort()).toEqual(["L1", "L2"]);

    process.env.META_ACCESS_TOKEN = "tok";
    resetEnvForTests();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => new Response(JSON.stringify(graphLead(url.includes("/L1?") ? "L1" : "L2")))),
    );
    expect(await actions.retryAllFailedAction()).toEqual({ ok: true, retried: 2, processed: 2, failed: 0 });
    expect(await db.lead.count()).toBe(2);
    expect((await db.webhookEvent.findFirstOrThrow({ where: { externalId: "L3" } })).status).toBe("PROCESSING");
  });

  it("refuses AGENTs and reports an unknown event", async () => {
    expect(await actions.retryWebhookEventAction("missing")).toEqual({ ok: false, error: "Webhook event not found" });
    currentUser.role = "AGENT";
    expect(await actions.retryAllFailedAction()).toMatchObject({ ok: false, error: expect.stringMatching(/permission/) });
  });
});
