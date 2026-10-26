import { describe, it, expect, beforeEach } from "vitest";
import {
  createProject,
  DuplicateSlugError,
  listProjects,
  projectInputSchema,
  setProjectActive,
  updateProject,
} from "@/lib/projects";
import { resetDb } from "../helpers/db";

const valid = { name: "Kingar Heights", slug: "kingar-heights", city: "Bengaluru", priceMin: "80L", priceMax: "1.6Cr" };

describe("projectInputSchema", () => {
  it("rejects priceMin > priceMax", () =>
    expect(
      projectInputSchema.safeParse({ name: "A", slug: "a", city: "B", priceMin: "1Cr", priceMax: "80L" }).success,
    ).toBe(false));

  it("puts the min > max issue on priceMax", () => {
    const r = projectInputSchema.safeParse({ ...valid, priceMin: "1Cr", priceMax: "80L" });
    expect(r.success).toBe(false);
    expect(r.error?.issues).toEqual([expect.objectContaining({ path: ["priceMax"], message: "Max must be at least Min" })]);
  });

  it("accepts plain rupee digits and transforms to whole rupees", () => {
    const r = projectInputSchema.parse({ ...valid, priceMin: "4500000", priceMax: "45L" });
    expect(r).toEqual({ name: "Kingar Heights", slug: "kingar-heights", city: "Bengaluru", priceMinRupees: 4500000, priceMaxRupees: 4500000 });
  });

  it("flags an unparseable price at its own path", () => {
    const r = projectInputSchema.safeParse({ ...valid, priceMin: "lots" });
    expect(r.error?.issues.map((i) => i.path)).toEqual([["priceMin"]]);
  });

  it("rejects a slug with uppercase or spaces, and an over-long name", () => {
    expect(projectInputSchema.safeParse({ ...valid, slug: "Kingar Heights" }).success).toBe(false);
    expect(projectInputSchema.safeParse({ ...valid, name: "x".repeat(81) }).success).toBe(false);
    expect(projectInputSchema.safeParse({ ...valid, slug: "x".repeat(61) }).success).toBe(false);
  });
});

describe("projects", () => {
  beforeEach(resetDb);

  it("creates a project converting rupee strings to whole rupees", async () => {
    const p = await createProject({ name: "K", slug: "k", city: "Bengaluru", priceMin: "80L", priceMax: "1.6Cr" });
    expect(p.priceMinRupees).toBe(8000000);
    expect(p.priceMaxRupees).toBe(16000000);
    expect(p.isActive).toBe(true);
  });

  it("rejects a duplicate slug with DuplicateSlugError", async () => {
    await createProject(valid);
    await expect(createProject({ ...valid, name: "Other" })).rejects.toBeInstanceOf(DuplicateSlugError);
  });

  it("updates a project and refuses to take another project's slug", async () => {
    const a = await createProject(valid);
    await createProject({ ...valid, slug: "other" });
    const updated = await updateProject(a.id, { ...valid, city: "Mysuru", priceMax: "2Cr" });
    expect(updated).toMatchObject({ city: "Mysuru", priceMaxRupees: 20000000 });
    await expect(updateProject(a.id, { ...valid, slug: "other" })).rejects.toBeInstanceOf(DuplicateSlugError);
  });

  it("toggles active and lists all projects by name", async () => {
    const b = await createProject({ ...valid, name: "Beta", slug: "beta" });
    await createProject({ ...valid, name: "Alpha", slug: "alpha" });
    await setProjectActive(b.id, false);
    const list = await listProjects();
    expect(list.map((p) => [p.name, p.isActive])).toEqual([
      ["Alpha", true],
      ["Beta", false],
    ]);
  });
});
