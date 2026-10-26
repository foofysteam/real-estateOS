import { describe, it, expect, beforeEach } from "vitest";
import { getEnv, resetEnvForTests, EnvError } from "@/lib/env";

const good = {
  DATABASE_URL: "postgresql://salesos:salesos@localhost:5432/salesos",
  SESSION_SECRET: "x".repeat(32),
  ENCRYPTION_KEY: "a".repeat(64),
};

describe("getEnv", () => {
  beforeEach(() => { resetEnvForTests(); for (const k of Object.keys(process.env)) if (k.startsWith("META_") || k in good) delete process.env[k]; });

  it("applies defaults for META_MCP_URL, META_GATEWAY, META_GRAPH_VERSION", () => {
    Object.assign(process.env, good);
    const env = getEnv();
    expect(env.META_MCP_URL).toBe("https://mcp.facebook.com/ads");
    expect(env.META_GATEWAY).toBe("mcp");
    expect(env.META_GRAPH_VERSION).toBe("v24.0");
  });

  it("throws EnvError naming every missing required key", () => {
    process.env.DATABASE_URL = good.DATABASE_URL;
    expect(() => getEnv()).toThrow(EnvError);
    expect(() => getEnv()).toThrow(/SESSION_SECRET/);
    expect(() => getEnv()).toThrow(/ENCRYPTION_KEY/);
  });

  it("rejects a SESSION_SECRET shorter than 32 chars", () => {
    Object.assign(process.env, good, { SESSION_SECRET: "short" });
    expect(() => getEnv()).toThrow(EnvError);
  });
});
