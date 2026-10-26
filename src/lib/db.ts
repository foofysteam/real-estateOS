import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { getEnv } from "@/lib/env";

function connectionString(): string {
  const env = getEnv();
  if (process.env.NODE_ENV === "test") {
    if (!env.DATABASE_URL_TEST) {
      throw new Error("DATABASE_URL_TEST must be set when NODE_ENV is \"test\"");
    }
    return env.DATABASE_URL_TEST;
  }
  return env.DATABASE_URL;
}

function createClient(): PrismaClient {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: connectionString() }) });
}

const globalForDb = globalThis as unknown as { db?: PrismaClient };

export const db: PrismaClient = globalForDb.db ?? createClient();

if (process.env.NODE_ENV !== "production") globalForDb.db = db;
