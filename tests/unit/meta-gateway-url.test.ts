import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const findUnique = vi.hoisted(() => vi.fn());
vi.mock("@/lib/db", () => ({ db: { metaConnection: { findUnique } } }));
vi.mock("@/lib/meta/mcp-gateway", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/meta/mcp-gateway")>();
  return { ...actual, createMcpClientFactory: vi.fn(() => async () => ({}) as never) };
});

const { encrypt } = await import("@/lib/crypto");
const { getEnv, resetEnvForTests } = await import("@/lib/env");
const { createMcpClientFactory } = await import("@/lib/meta/mcp-gateway");
const { getMetaGateway, resetMetaGateway } = await import("@/lib/meta");

const row = (mcpUrl: string | null) => ({
  id: 1,
  pageId: "p",
  adAccountId: "act_1",
  accessTokenEnc: encrypt("EAAB"),
  leadFormIds: [],
  mcpUrl,
});

const originalGateway = process.env.META_GATEWAY;

describe("getMetaGateway MCP URL", () => {
  afterAll(() => {
    if (originalGateway === undefined) delete process.env.META_GATEWAY;
    else process.env.META_GATEWAY = originalGateway;
    resetEnvForTests();
  });

  beforeEach(() => {
    process.env.META_GATEWAY = "mcp";
    resetEnvForTests();
    resetMetaGateway();
    findUnique.mockReset();
    vi.mocked(createMcpClientFactory).mockClear();
  });

  it("uses the saved MCP URL when present", async () => {
    findUnique.mockResolvedValue(row(" https://mcp.example.com/ads "));
    await getMetaGateway();
    expect(createMcpClientFactory).toHaveBeenCalledWith("https://mcp.example.com/ads", "EAAB");
    expect(findUnique).toHaveBeenCalledTimes(1);
  });

  it("falls back to META_MCP_URL when none is saved", async () => {
    findUnique.mockResolvedValue(row(null));
    await getMetaGateway();
    expect(createMcpClientFactory).toHaveBeenCalledWith(getEnv().META_MCP_URL, "EAAB");
  });

  it("rebuilds the gateway when the saved URL changes", async () => {
    findUnique.mockResolvedValue(row("https://a.example.com/ads"));
    const first = await getMetaGateway();
    expect(await getMetaGateway()).toBe(first);
    findUnique.mockResolvedValue(row("https://b.example.com/ads"));
    expect(await getMetaGateway()).not.toBe(first);
    expect(createMcpClientFactory).toHaveBeenLastCalledWith("https://b.example.com/ads", "EAAB");
  });
});
