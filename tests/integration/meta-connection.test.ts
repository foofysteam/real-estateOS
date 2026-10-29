import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { decrypt } from "@/lib/crypto";
import { getMetaConnection, saveMetaConnection } from "@/lib/meta/connection";
import { resetDb } from "../helpers/db";

const row = () => db.metaConnection.findUniqueOrThrow({ where: { id: 1 } });

describe("Meta connection settings", () => {
  beforeEach(resetDb);

  it("stores the token encrypted and keeps it when saving with a blank token", async () => {
    await saveMetaConnection({ pageId: "p", adAccountId: "act_1", accessToken: "EAAB" });
    const first = await row();
    expect(first.accessTokenEnc).not.toContain("EAAB");
    expect(decrypt(first.accessTokenEnc)).toBe("EAAB");

    await saveMetaConnection({ pageId: "p2", adAccountId: "act_1", accessToken: "" });
    const second = await row();
    expect(second.pageId).toBe("p2");
    expect(decrypt(second.accessTokenEnc)).toBe("EAAB");

    await saveMetaConnection({ pageId: "p2", adAccountId: "act_1" });
    expect(decrypt((await row()).accessTokenEnc)).toBe("EAAB");
  });

  it("replaces the token when a new one is given", async () => {
    await saveMetaConnection({ pageId: "p", adAccountId: "act_1", accessToken: "EAAB" });
    await saveMetaConnection({ pageId: "p", adAccountId: "act_1", accessToken: "EAAC" });
    expect(decrypt((await row()).accessTokenEnc)).toBe("EAAC");
  });

  it("creates without a token as an empty value and never writes leadFormIds on update", async () => {
    await saveMetaConnection({ pageId: "p", adAccountId: "act_1" });
    expect(await row()).toMatchObject({ accessTokenEnc: "", leadFormIds: [], mcpUrl: null });
    await db.metaConnection.update({ where: { id: 1 }, data: { leadFormIds: ["f1", "f2"] } });
    await saveMetaConnection({ pageId: "p3", adAccountId: "act_2", accessToken: "EAAB", mcpUrl: "https://mcp.example.com/ads" });
    expect(await row()).toMatchObject({ pageId: "p3", adAccountId: "act_2", leadFormIds: ["f1", "f2"], mcpUrl: "https://mcp.example.com/ads" });
  });

  it("getMetaConnection never exposes the token", async () => {
    expect(await getMetaConnection()).toBeNull();
    await saveMetaConnection({ pageId: "p", adAccountId: "act_1", accessToken: "EAAB" });
    const c = await getMetaConnection();
    expect(c).not.toBeNull();
    expect(JSON.stringify(c)).not.toContain("EAAB");
    expect(JSON.stringify(c)).not.toContain((await row()).accessTokenEnc);
    expect(c).toMatchObject({
      pageId: "p",
      adAccountId: "act_1",
      hasToken: true,
      mcpUrl: null,
      leadFormIds: [],
      webhookUrl: expect.stringMatching(/\/api\/webhooks\/meta$/),
      gatewayMode: expect.stringMatching(/^(mcp|graph)$/),
    });
    expect(c).not.toHaveProperty("accessTokenEnc");
  });

  it("reports hasToken false when no token was stored", async () => {
    await saveMetaConnection({ pageId: "p", adAccountId: "act_1" });
    expect((await getMetaConnection())?.hasToken).toBe(false);
  });
});
