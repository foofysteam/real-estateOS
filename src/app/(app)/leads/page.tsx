import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/current-user";
import { db } from "@/lib/db";
import { toLeadListItemDTO } from "@/lib/leads/filters";
import { listLeads, parseLeadFilters } from "@/lib/leads/queries";
import { LeadsView } from "./leads-view";

export const metadata: Metadata = { title: "Leads · Sales OS" };

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireUser();
  const filters = parseLeadFilters(await searchParams);
  const [page, owners, projects] = await Promise.all([
    listLeads(filters),
    db.user.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.project.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
      <h1 className="text-xl font-semibold text-fg">Leads</h1>
      <LeadsView
        filters={filters}
        owners={owners}
        projects={projects}
        initialItems={page.items.map(toLeadListItemDTO)}
        initialCursor={page.nextCursor}
      />
    </div>
  );
}
