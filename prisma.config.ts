import { loadEnvConfig } from "@next/env";
import { defineConfig } from "prisma/config";

loadEnvConfig(process.cwd());

// `pnpm db:test:prepare` sets PRISMA_TARGET_TEST_DB=1 so migrations go to the test database.
const useTestDb = process.env.PRISMA_TARGET_TEST_DB === "1";
const url = useTestDb ? process.env.DATABASE_URL_TEST : process.env.DATABASE_URL;
if (useTestDb && !url) throw new Error("DATABASE_URL_TEST must be set to prepare the test database");

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations", seed: "tsx prisma/seed.ts" },
  datasource: { url: url! },
});
