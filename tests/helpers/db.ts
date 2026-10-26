import { db } from "@/lib/db";
import { TRUNCATE_ALL_SQL } from "@/lib/db-tables";

export async function resetDb(): Promise<void> {
  await db.$executeRawUnsafe(TRUNCATE_ALL_SQL);
}
