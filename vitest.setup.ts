import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

if (!process.env.NODE_ENV) {
  (process.env as Record<string, string>).NODE_ENV = "test";
}

await import("@testing-library/jest-dom/vitest");
