import { z } from "zod";

const optional = z.string().optional();

const jsonString = z.string().refine((value) => {
  try {
    JSON.parse(value);
    return true;
  } catch {
    return false;
  }
}, "must be valid JSON");

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  DATABASE_URL_TEST: optional,
  SESSION_SECRET: z.string().min(32),
  ENCRYPTION_KEY: z.string().regex(/^[0-9a-fA-F]{64}$/, "must be 64 hex characters"),
  META_APP_SECRET: optional,
  META_WEBHOOK_VERIFY_TOKEN: optional,
  META_ACCESS_TOKEN: optional,
  META_MCP_URL: z.url().default("https://mcp.facebook.com/ads"),
  META_MCP_TOOL_MAP: jsonString.optional(),
  META_GATEWAY: z.enum(["mcp", "graph"]).default("mcp"),
  META_GRAPH_VERSION: z.string().min(1).default("v24.0"),
});

export type Env = z.infer<typeof envSchema>;

export class EnvError extends Error {
  constructor(issues: ReadonlyArray<{ path: PropertyKey[] }>) {
    super("Invalid environment: " + issues.map((i) => i.path.join(".")).join(", "));
    this.name = "EnvError";
  }
}

let cached: Env | undefined;

export function getEnv(): Env {
  if (cached) return cached;
  const result = envSchema.safeParse(process.env);
  if (!result.success) throw new EnvError(result.error.issues);
  cached = result.data;
  return cached;
}

export function resetEnvForTests(): void {
  cached = undefined;
}
