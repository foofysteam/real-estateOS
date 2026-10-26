import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { resetDb } from "../helpers/db";

const currentUser = vi.hoisted(() => ({ value: null as null | { id: string; email: string; name: string; role: "AGENT" | "ADMIN" } }));

vi.mock("@/lib/auth/current-user", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth/current-user")>();
  return { ...actual, getCurrentUser: vi.fn(async () => currentUser.value) };
});

const { GET } = await import("@/app/api/leads/route");

function get(qs: string) {
  return GET(new NextRequest(`http://localhost/api/leads${qs}`));
}

describe("GET /api/leads", () => {
  beforeEach(async () => {
    await resetDb();
    currentUser.value = { id: "u_1", email: "a@x.in", name: "Agent", role: "AGENT" };
  });

  it("returns 401 without a session", async () => {
    currentUser.value = null;
    expect((await get("")).status).toBe(401);
  });

  it("applies filters and the cursor, serialising dates as ISO strings", async () => {
    const base = Date.parse("2026-10-01T00:00:00Z");
    for (let i = 0; i < 3; i++) {
      await db.lead.create({
        data: { name: `Q${i}`, phone: `+91984501234${i}`, source: "WEBSITE", stage: "QUALIFIED", createdAt: new Date(base + i * 60_000) },
      });
    }
    await db.lead.create({ data: { name: "Other", phone: "+919845099999", source: "WEBSITE", stage: "NEW" } });

    const first = await get("?stage=QUALIFIED&cursor=");
    expect(first.status).toBe(200);
    const page1 = await first.json();
    expect(page1.items.map((i: { name: string }) => i.name)).toEqual(["Q2", "Q1", "Q0"]);
    expect(page1.items[0].createdAt).toBe("2026-10-01T00:02:00.000Z");
    expect(page1.nextCursor).toBeNull();

    const afterQ2 = await (await get(`?stage=QUALIFIED&cursor=${page1.items[0].id}`)).json();
    expect(afterQ2.items.map((i: { name: string }) => i.name)).toEqual(["Q1", "Q0"]);
  });

  it("ignores garbage filters instead of failing", async () => {
    await db.lead.create({ data: { name: "A", phone: "+919845012345", source: "WEBSITE" } });
    const res = await get("?stage=BOGUS&sort=sideways");
    expect(res.status).toBe(200);
    expect((await res.json()).items).toHaveLength(1);
  });
});
