import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { requireUser } from "@/lib/auth/current-user";
import { getTodayBoard, type LeadWithOwner } from "@/lib/leads/queries";
import { formatRupeesShort } from "@/lib/money";
import { FollowUpList } from "./follow-up-list";

export const metadata: Metadata = { title: "Today · Sales OS" };

function SectionHeading({ id, title, count }: { id: string; title: string; count: number }) {
  return (
    <h2 id={id} className="flex items-center gap-2 px-1 text-sm font-semibold text-fg">
      {title}
      <span className="text-fg-muted tabular-nums">({count})</span>
    </h2>
  );
}

function NewLeadRow({ lead }: { lead: LeadWithOwner }) {
  const detail = [lead.project?.name, lead.budgetRupees != null ? formatRupeesShort(lead.budgetRupees) : null]
    .filter(Boolean)
    .join(" · ");
  return (
    <li className="border-b border-border last:border-b-0">
      <Link
        href={`/leads/${lead.id}`}
        className="flex min-h-14 items-center gap-3 px-4 hover:bg-surface-2 lg:min-h-11"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium text-fg lg:inline">{lead.name}</span>
          {detail && <span className="block truncate text-sm text-fg-muted lg:ml-3 lg:inline">{detail}</span>}
        </span>
        <ChevronRight className="size-4 shrink-0 text-fg-muted" aria-hidden="true" />
      </Link>
    </li>
  );
}

export default async function TodayPage() {
  const user = await requireUser();
  const { overdue, dueToday, newLeads } = await getTodayBoard(user);
  const nothing = overdue.length === 0 && dueToday.length === 0 && newLeads.length === 0;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <h1 className="text-xl font-semibold text-fg">Today</h1>
      {nothing ? (
        <EmptyState
          message="Nothing due. Go find a lead."
          action={
            <Button asChild>
              <Link href="/leads">Browse leads</Link>
            </Button>
          }
        />
      ) : (
        <>
          {overdue.length > 0 && (
            <section aria-labelledby="today-overdue" className="flex flex-col gap-2">
              <SectionHeading id="today-overdue" title="Overdue" count={overdue.length} />
              <Card className="p-0">
                <FollowUpList items={overdue} />
              </Card>
            </section>
          )}
          {dueToday.length > 0 && (
            <section aria-labelledby="today-due" className="flex flex-col gap-2">
              <SectionHeading id="today-due" title="Due today" count={dueToday.length} />
              <Card className="p-0">
                <FollowUpList items={dueToday} />
              </Card>
            </section>
          )}
          {newLeads.length > 0 && (
            <section aria-labelledby="today-new" className="flex flex-col gap-2">
              <SectionHeading id="today-new" title="New leads" count={newLeads.length} />
              <Card className="p-0">
                <ul>
                  {newLeads.map((lead) => (
                    <NewLeadRow key={lead.id} lead={lead} />
                  ))}
                </ul>
              </Card>
            </section>
          )}
        </>
      )}
    </div>
  );
}
