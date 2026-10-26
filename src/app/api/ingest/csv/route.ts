import { NextResponse } from "next/server";
import { z } from "zod";
import { LeadSource } from "@/generated/prisma/client";
import { getCurrentUser } from "@/lib/auth/current-user";
import { importLeadsCsv } from "@/lib/csv";

const sourceSchema = z.enum(LeadSource);

/** Admin CSV upload: multipart form with `file` and optional `source` (defaults to CSV_IMPORT). */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ issues: [{ path: [], message: "Expected multipart form data" }] }, { status: 422 });
  }
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ issues: [{ path: ["file"], message: "CSV file is required" }] }, { status: 422 });
  }
  const source = sourceSchema.safeParse(form.get("source") ?? "CSV_IMPORT");
  if (!source.success) {
    return NextResponse.json({ issues: source.error.issues.map((i) => ({ ...i, path: ["source"] })) }, { status: 422 });
  }

  return NextResponse.json(await importLeadsCsv(await file.text(), source.data, user.id));
}
