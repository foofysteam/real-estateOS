import { z } from "zod";
import { db } from "@/lib/db";
import { Prisma, type Project } from "@/generated/prisma/client";
import { MAX_RUPEES, parseRupees } from "@/lib/money";

export class DuplicateSlugError extends Error {
  constructor(slug: string) {
    super(`A project with the slug "${slug}" already exists`);
    this.name = "DuplicateSlugError";
  }
}

export class ProjectNotFoundError extends Error {
  constructor() {
    super("Project not found");
    this.name = "ProjectNotFoundError";
  }
}

/** A rupee string ("80L", "1.6Cr", "4500000") → whole rupees; an issue at this field's path otherwise. */
const rupees = z
  .string()
  .trim()
  .min(1, "Enter a price")
  .transform((s, ctx) => {
    const value = parseRupees(s);
    if (value === null) {
      ctx.addIssue({ code: "custom", message: "Enter a price like 80L, 1.6Cr or 4500000" });
      return z.NEVER;
    }
    if (value > MAX_RUPEES) {
      ctx.addIssue({ code: "custom", message: "That price is too large" });
      return z.NEVER;
    }
    return value;
  });

export const projectInputSchema = z
  .object({
    name: z.string().trim().min(1, "Enter a name").max(80, "Keep the name under 80 characters"),
    slug: z
      .string()
      .trim()
      .min(1, "Enter a slug")
      .max(60, "Keep the slug under 60 characters")
      .regex(/^[a-z0-9-]+$/, "Use lowercase letters, digits and hyphens only"),
    city: z.string().trim().min(1, "Enter a city").max(60, "Keep the city under 60 characters"),
    priceMin: rupees,
    priceMax: rupees,
  })
  .refine((p) => p.priceMin <= p.priceMax, { path: ["priceMax"], message: "Max must be at least Min" })
  .transform(({ priceMin, priceMax, ...rest }) => ({ ...rest, priceMinRupees: priceMin, priceMaxRupees: priceMax }));

export type ProjectInput = z.input<typeof projectInputSchema>;

function isPrismaError(err: unknown, code: string): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === code;
}

async function writeProject(slug: string, write: () => Promise<Project>): Promise<Project> {
  try {
    return await write();
  } catch (err) {
    if (isPrismaError(err, "P2002")) throw new DuplicateSlugError(slug);
    if (isPrismaError(err, "P2025")) throw new ProjectNotFoundError();
    throw err;
  }
}

export function createProject(input: ProjectInput): Promise<Project> {
  const data = projectInputSchema.parse(input);
  return writeProject(data.slug, () => db.project.create({ data }));
}

export function updateProject(id: string, input: ProjectInput): Promise<Project> {
  const data = projectInputSchema.parse(input);
  return writeProject(data.slug, () => db.project.update({ where: { id }, data }));
}

export function setProjectActive(id: string, active: boolean): Promise<Project> {
  return writeProject("", () => db.project.update({ where: { id }, data: { isActive: active } }));
}

export function listProjects(): Promise<Project[]> {
  return db.project.findMany({ orderBy: { name: "asc" } });
}
