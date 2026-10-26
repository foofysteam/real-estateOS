import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/lib/db";
import { resetDb } from "../helpers/db";

describe("db", () => {
  beforeEach(resetDb);
  it("connects to the test database and round-trips a Project", async () => {
    const p = await db.project.create({ data: { name: "Krishvi Triple One", slug: "krishvi-111", city: "Bengaluru", priceMinPaise: 850000000, priceMaxPaise: 1600000000 } });
    expect((await db.project.findUnique({ where: { id: p.id } }))?.slug).toBe("krishvi-111");
    expect(process.env.DATABASE_URL_TEST).toBeDefined();
  });
  it("starts every test empty", async () => {
    expect(await db.project.count()).toBe(0);
  });
});
