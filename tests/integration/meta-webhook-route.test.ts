import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import { createHmac } from "node:crypto";
import { db } from "@/lib/db";
import { resetEnvForTests } from "@/lib/env";
import { encrypt } from "@/lib/crypto";
import { handleMetaWebhook } from "@/lib/meta/webhook";
import { getMetaAccessToken } from "@/lib/meta/token";
import { GET } from "@/app/api/webhooks/meta/route";
import { resetDb } from "../helpers/db";

const META_KEYS = ["META_APP_SECRET", "META_ACCESS_TOKEN", "META_WEBHOOK_VERIFY_TOKEN"] as const;
const savedEnv = Object.fromEntries(META_KEYS.map((k) => [k, process.env[k]]));

const graphLead = {
  id: "L1",
  created_time: "2026-10-26T10:00:00+0000",
  form_id: "f1",
  field_data: [
    { name: "full_name", values: ["Rohan"] },
    { name: "phone_number", values: ["+919845012345"] },
  ],
};

const fetchImpl = vi.fn<typeof fetch>(async () => new Response(JSON.stringify(graphLead)));

function payload(leadgenId = "L1") {
  return JSON.stringify({
    object: "page",
    entry: [{ id: "p1", time: 1, changes: [{ field: "leadgen", value: { leadgen_id: leadgenId, page_id: "p1", form_id: "f1", created_time: 1 } }] }],
  });
}

const sig = (body: string, secret = "secret") => "sha256=" + createHmac("sha256", secret).update(body).digest("hex");

async function deliver(body: string) {
  const scheduled: (() => Promise<void>)[] = [];
  const r = await handleMetaWebhook(body, sig(body), { schedule: (fn) => scheduled.push(fn), fetchImpl });
  return { r, scheduled };
}

beforeEach(async () => {
  await resetDb();
  process.env.META_APP_SECRET = "secret";
  process.env.META_ACCESS_TOKEN = "tok";
  process.env.META_WEBHOOK_VERIFY_TOKEN = "verify-me";
  resetEnvForTests();
  fetchImpl.mockClear();
});

afterAll(() => {
  for (const k of META_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
  resetEnvForTests();
});

describe("GET /api/webhooks/meta", () => {
  it("GET answers the challenge with the right verify token and 403 otherwise", async () => {
    const ok = await GET(new Request("http://x/api/webhooks/meta?hub.mode=subscribe&hub.verify_token=verify-me&hub.challenge=12345"));
    expect(ok.status).toBe(200);
    expect(ok.headers.get("content-type")).toMatch(/^text\/plain/);
    expect(await ok.text()).toBe("12345");

    const bad = await GET(new Request("http://x/api/webhooks/meta?hub.mode=subscribe&hub.verify_token=nope&hub.challenge=12345"));
    expect(bad.status).toBe(403);

    delete process.env.META_WEBHOOK_VERIFY_TOKEN;
    resetEnvForTests();
    const unset = await GET(new Request("http://x/api/webhooks/meta?hub.mode=subscribe&hub.challenge=12345"));
    expect(unset.status).toBe(403);
  });
});

describe("handleMetaWebhook", () => {
  it("POST stores WebhookEvent, returns 200 immediately, then ingests the lead", async () => {
    const body = payload();
    const scheduled: (() => Promise<void>)[] = [];
    const r = await handleMetaWebhook(body, sig(body), { schedule: (fn) => scheduled.push(fn), fetchImpl });
    expect(r).toEqual({ status: 200, accepted: 1 });
    expect(await db.lead.count()).toBe(0);
    expect(fetchImpl).not.toHaveBeenCalled();
    const received = await db.webhookEvent.findFirstOrThrow();
    expect(received).toMatchObject({ provider: "meta", externalId: "L1", status: "RECEIVED", processedAt: null });

    for (const fn of scheduled) await fn();
    expect(await db.lead.count()).toBe(1);
    const lead = await db.lead.findFirstOrThrow();
    expect(lead).toMatchObject({ name: "Rohan", phone: "+919845012345", source: "META_LEAD_AD" });
    const ev = await db.webhookEvent.findFirstOrThrow();
    expect(ev.status).toBe("PROCESSED");
    expect(ev.processedAt).toBeInstanceOf(Date);
    expect(fetchImpl).toHaveBeenCalledWith(expect.stringContaining("/v24.0/L1?fields=field_data,created_time,ad_id,form_id"), expect.anything());
  });

  it("is idempotent on redelivery of the same leadgen_id", async () => {
    const body = payload();
    const first = await deliver(body);
    for (const fn of first.scheduled) await fn();
    const second = await deliver(body);
    expect(second.r).toEqual({ status: 200, accepted: 1 });
    expect(second.scheduled).toHaveLength(0);
    for (const fn of second.scheduled) await fn();
    expect(await db.lead.count()).toBe(1);
    expect(await db.webhookEvent.count()).toBe(1);
    expect(await db.leadEvent.count({ where: { type: "CREATED" } })).toBe(1);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("processes once when a redelivery arrives before the first run finishes", async () => {
    const body = payload();
    const first = await deliver(body);
    const second = await deliver(body);
    for (const fn of [...first.scheduled, ...second.scheduled]) await fn();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(await db.lead.count()).toBe(1);
    expect(await db.webhookEvent.count()).toBe(1);
    expect((await db.webhookEvent.findFirstOrThrow()).status).toBe("PROCESSED");
    expect(await db.leadEvent.count({ where: { type: "DUPLICATE_INBOUND" } })).toBe(0);
    expect(await db.followUp.count()).toBe(0);
  });

  it("marks FAILED with error text when Graph API fails", async () => {
    fetchImpl.mockResolvedValueOnce(new Response("{}", { status: 500 }));
    const { scheduled } = await deliver(payload());
    for (const fn of scheduled) await fn();
    const ev = await db.webhookEvent.findFirstOrThrow();
    expect(ev.status).toBe("FAILED");
    expect(ev.error).toMatch(/500/);
    expect(ev.processedAt).toBeNull();
    expect(await db.lead.count()).toBe(0);
  });

  it("marks FAILED when the lead has an invalid phone", async () => {
    fetchImpl.mockResolvedValueOnce(
      new Response(JSON.stringify({ ...graphLead, field_data: [{ name: "full_name", values: ["Rohan"] }, { name: "phone_number", values: ["123"] }] })),
    );
    const { scheduled } = await deliver(payload());
    for (const fn of scheduled) await fn();
    const ev = await db.webhookEvent.findFirstOrThrow();
    expect(ev.status).toBe("FAILED");
    expect(ev.error).toMatch(/Invalid phone/);
    expect(await db.lead.count()).toBe(0);
  });

  it("marks FAILED when no Meta access token is configured", async () => {
    delete process.env.META_ACCESS_TOKEN;
    resetEnvForTests();
    const { scheduled } = await deliver(payload());
    for (const fn of scheduled) await fn();
    const ev = await db.webhookEvent.findFirstOrThrow();
    expect(ev.status).toBe("FAILED");
    expect(ev.error).toBe("No Meta access token configured");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("does not throw out of the scheduled run when marking FAILED itself fails", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    fetchImpl.mockImplementationOnce(async () => {
      await db.webhookEvent.deleteMany(); // the FAILED update now has no row to write
      return new Response("{}", { status: 500 });
    });
    const { scheduled } = await deliver(payload());
    for (const fn of scheduled) await expect(fn()).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalledWith(expect.stringMatching(/could not mark FAILED/));
    expect(String(errorSpy.mock.calls[0][0])).not.toContain("tok");
    errorSpy.mockRestore();
  });

  it("returns 401 on bad signature and stores nothing", async () => {
    const body = payload();
    const scheduled: (() => Promise<void>)[] = [];
    const schedule = (fn: () => Promise<void>) => void scheduled.push(fn);
    expect(await handleMetaWebhook(body, sig(body, "wrong"), { schedule, fetchImpl })).toEqual({ status: 401, accepted: 0 });
    expect(await handleMetaWebhook(body, null, { schedule, fetchImpl })).toEqual({ status: 401, accepted: 0 });
    expect(await handleMetaWebhook("not json", sig("not json", "wrong"), { schedule, fetchImpl })).toEqual({ status: 401, accepted: 0 });
    expect(scheduled).toHaveLength(0);
    expect(await db.webhookEvent.count()).toBe(0);
  });

  it("returns 401 for every request when META_APP_SECRET is unset", async () => {
    delete process.env.META_APP_SECRET;
    resetEnvForTests();
    const body = payload();
    const scheduled: (() => Promise<void>)[] = [];
    const r = await handleMetaWebhook(body, sig(body), { schedule: (fn) => scheduled.push(fn), fetchImpl });
    expect(r).toEqual({ status: 401, accepted: 0 });
    expect(await db.webhookEvent.count()).toBe(0);
  });
});

describe("getMetaAccessToken", () => {
  it("prefers the decrypted MetaConnection token and falls back to env", async () => {
    expect(await getMetaAccessToken()).toBe("tok");
    await db.metaConnection.create({ data: { id: 1, pageId: "p1", adAccountId: "act_1", accessTokenEnc: encrypt("page-token"), leadFormIds: [] } });
    expect(await getMetaAccessToken()).toBe("page-token");
    await db.metaConnection.update({ where: { id: 1 }, data: { accessTokenEnc: "" } });
    expect(await getMetaAccessToken()).toBe("tok");
    delete process.env.META_ACCESS_TOKEN;
    resetEnvForTests();
    expect(await getMetaAccessToken()).toBeNull();
  });
});
