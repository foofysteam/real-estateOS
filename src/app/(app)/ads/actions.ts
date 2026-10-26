"use server";

import { revalidatePath } from "next/cache";
import { ForbiddenError, requireUser } from "@/lib/auth/current-user";
import { db } from "@/lib/db";
import { getMetaGateway, MetaNotConfiguredError, type LeadForm } from "@/lib/meta";

const MAX_ERROR = 300;

export type SyncFormsResult = { ok: true; count: number } | { ok: false; error: string };

/** Admin only: replaces MetaConnection.leadFormIds with the page's current lead forms. Meta failures become readable errors. */
export async function syncLeadFormsAction(): Promise<SyncFormsResult> {
  try {
    await requireUser("ADMIN");
  } catch (err) {
    if (err instanceof ForbiddenError) return { ok: false, error: "Only admins can sync forms" };
    throw err;
  }

  const conn = await db.metaConnection.findUnique({ where: { id: 1 }, select: { pageId: true } });
  if (!conn) return { ok: false, error: new MetaNotConfiguredError().message };

  let forms: LeadForm[];
  try {
    forms = await (await getMetaGateway()).listLeadForms(conn.pageId);
  } catch (err) {
    return { ok: false, error: (err instanceof Error ? err.message : String(err)).slice(0, MAX_ERROR) };
  }

  await db.metaConnection.update({ where: { id: 1 }, data: { leadFormIds: forms.map((f) => f.id) } });
  revalidatePath("/ads");
  return { ok: true, count: forms.length };
}
