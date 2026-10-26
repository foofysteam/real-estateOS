import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { requireUser } from "@/lib/auth/current-user";
import { getTodayBoard } from "@/lib/leads/queries";
import { FollowUpList } from "./follow-up-list";
import { NewLeadRow } from "./new-lead-row";

export const metadata: Metadata = { title: "Today · Sales OS" };

function SectionHeading({ id, title, count }: { id: string; title: string; count: number }) {
  return (
    <h2 id={id} className="flex items-center gap-2 text-sm font-semibold text-fg">
      {title}
      <span className="text-fg-muted tabular-nums">({count})</span>
    </h2>
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
                <FollowUpList items={overdue} overdue />
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
              <SectionHeading id="today-new" title={user.role === "ADMIN" ? "New unassigned" : "New assigned to me"} count={newLeads.length} />
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
