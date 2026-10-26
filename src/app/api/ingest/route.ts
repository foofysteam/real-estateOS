import { NextResponse } from "next/server";
import { z } from "zod";
import { resolveIngestKey } from "@/lib/ingest-keys";
import { ingestLead, InvalidPhoneError } from "@/lib/leads/ingest";
import { MAX_RUPEES, parseRupees } from "@/lib/money";

const bodySchema = z.object({
  name: z.string().trim().min(1).max(120),
  phone: z.string().min(1),
  email: z.email().optional(),
  projectSlug: z.string().optional(),
  budget: z
    .union([z.string(), z.number()])
    .transform((value, ctx) => {
      const rupees = parseRupees(value);
      if (rupees === null) {
        ctx.addIssue({ code: "custom", message: "Invalid budget" });
        return z.NEVER;
      }
      if (rupees > MAX_RUPEES) {
        ctx.addIssue({ code: "custom", message: "Budget too large" });
        return z.NEVER;
      }
      return rupees;
    })
    .optional(),
  configuration: z.string().optional(),
  locality: z.string().optional(),
  notes: z.string().optional(),
  externalId: z.string().optional(),
});

function unprocessable(issues: unknown[]) {
  return NextResponse.json({ issues }, { status: 422 });
}

/** Generic lead ingest for website forms and integrations, authenticated by an ingest bearer key. */
export async function POST(req: Request) {
  const token = /^Bearer\s+(\S+)$/i.exec(req.headers.get("authorization") ?? "")?.[1];
  const key = token ? await resolveIngestKey(token) : null;
  if (!key) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return unprocessable([{ path: [], message: "Invalid JSON body" }]);
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return unprocessable(parsed.error.issues);

  const { budget, ...fields } = parsed.data;
  try {
    const result = await ingestLead({ ...fields, budgetRupees: budget, source: key.source, receivedAt: new Date() });
    return NextResponse.json(result, { status: result.deduplicated ? 202 : 201 });
  } catch (err) {
    if (err instanceof InvalidPhoneError) return unprocessable([{ path: ["phone"], message: "Invalid phone number" }]);
    throw err;
  }
}
