import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/current-user";
import { db } from "@/lib/db";
import { getLeadDetail } from "@/lib/leads/queries";
import { formatIstDateTime } from "@/lib/dates";
import { formatRupees } from "@/lib/money";
import { SOURCE_LABELS } from "@/lib/sources";
import { EditFieldsSheet } from "./edit-fields-sheet";
import { LeadHeader } from "./lead-header";
import { NoteForm } from "./note-form";
import { OpenFollowUps } from "./open-follow-ups";
import { QuickActions } from "./quick-actions";
import { Timeline } from "./timeline";

export const metadata: Metadata = { title: "Lead · Sales OS" };

function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex min-h-11 items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-fg">{title}</h2>
        {action}
      </div>
      <Card>{children}</Card>
    </section>
  );
}

export default async function LeadPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const lead = await getLeadDetail(id);
  if (!lead) notFound();

  const [owners, projects] = await Promise.all([
    db.user.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.project.findMany({
      where: { OR: [{ isActive: true }, ...(lead.projectId ? [{ id: lead.projectId }] : [])] },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const { name, email, budgetRupees, configuration, locality, projectId } = lead;
  const editable = { id: lead.id, name, email, budgetRupees, configuration, locality, projectId };

  const details: [string, ReactNode][] = [
    ["Phone", lead.phone],
    ["Email", lead.email],
    ["Budget", lead.budgetRupees != null ? formatRupees(lead.budgetRupees) : null],
    ["Configuration", lead.configuration],
    ["Locality", lead.locality],
    ["Project", lead.project?.name],
    ["Source", SOURCE_LABELS[lead.source]],
    ["Created", formatIstDateTime(lead.createdAt)],
    ["Last contacted", lead.lastContactedAt ? formatIstDateTime(lead.lastContactedAt) : null],
    ...(lead.lostReason ? [["Lost reason", lead.lostReason] as [string, ReactNode]] : []),
  ];

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <LeadHeader
        name={lead.name}
        score={lead.score}
        stage={lead.stage}
        ownerName={lead.owner?.name ?? null}
        projectName={lead.project?.name ?? null}
      />
      <QuickActions lead={{ id: lead.id, phone: lead.phone, stage: lead.stage, ownerId: lead.ownerId }} owners={owners} />
      <Section title="Details" action={<EditFieldsSheet lead={editable} projects={projects} />}>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
          {details.map(([label, value]) => (
            <div key={label} className="min-w-0">
              <dt className="text-xs text-fg-muted">{label}</dt>
              <dd className="truncate text-fg">{value ?? "—"}</dd>
            </div>
          ))}
        </dl>
      </Section>
      <Section title={`Open follow-ups (${lead.followUps.length})`}>
        <OpenFollowUps items={lead.followUps} />
      </Section>
      <Section title="Timeline">
        <div className="flex flex-col gap-2">
          <NoteForm leadId={lead.id} />
          <Timeline events={lead.events} userNames={lead.userNames} />
        </div>
      </Section>
    </div>
  );
}
