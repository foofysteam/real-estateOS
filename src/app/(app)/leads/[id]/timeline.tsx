import type { FollowUpChannel, LeadSource, LeadStage } from "@/generated/prisma/enums";
import type { LeadDetail } from "@/lib/leads/queries";
import { CHANNEL_LABELS } from "@/lib/channels";
import { formatIstDateTime } from "@/lib/dates";
import { SOURCE_LABELS } from "@/lib/sources";
import { STAGE_LABELS } from "@/lib/stages";

export type TimelineEvent = LeadDetail["events"][number];

const FIELD_LABELS: Record<string, string> = {
  name: "name",
  email: "email",
  budgetRupees: "budget",
  configuration: "configuration",
  locality: "locality",
  projectId: "project",
};

type Payload = Record<string, unknown>;

const stage = (v: unknown) => STAGE_LABELS[v as LeadStage] ?? String(v);
const channel = (v: unknown) => CHANNEL_LABELS[v as FollowUpChannel] ?? String(v);
const source = (v: unknown) => SOURCE_LABELS[v as LeadSource] ?? String(v);

function describe(event: TimelineEvent, userNames: Record<string, string>): string {
  const p = (event.payload ?? {}) as Payload;
  switch (event.type) {
    case "CREATED":
      return `Lead created from ${source(p.source)}`;
    case "STAGE_CHANGED":
      return `${stage(p.from)} → ${stage(p.to)}${p.lostReason ? ` · ${p.lostReason}` : ""}`;
    case "ASSIGNED":
      return typeof p.to === "string" ? `Assigned to ${userNames[p.to] ?? "a teammate"}` : "Unassigned";
    case "NOTE_ADDED":
      return String(p.text ?? "");
    case "FOLLOW_UP_SCHEDULED": {
      const due = typeof p.dueAt === "string" ? ` · ${formatIstDateTime(new Date(p.dueAt))}` : "";
      return `Follow-up scheduled · ${channel(p.channel)}${due}`;
    }
    case "FOLLOW_UP_COMPLETED":
      return "Follow-up completed";
    case "CONTACT_LOGGED":
      return `Contacted via ${channel(p.channel)}${p.note ? ` · ${p.note}` : ""}`;
    case "SCORE_CHANGED":
      return `Score ${p.from} → ${p.to}`;
    case "FIELD_UPDATED": {
      const fields = Array.isArray(p.fields) ? p.fields.map((f) => FIELD_LABELS[f] ?? f) : [];
      return fields.length ? `Updated ${fields.join(", ")}` : "Updated details";
    }
    case "DUPLICATE_INBOUND":
      return `Duplicate inbound from ${source(p.source)}`;
  }
}

/** Lead history, newest first, one sentence per event. */
export function Timeline({ events, userNames = {} }: { events: TimelineEvent[]; userNames?: Record<string, string> }) {
  const sorted = [...events].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return (
    <ol className="flex flex-col">
      {sorted.map((event) => (
        <li key={event.id} className="flex flex-col gap-0.5 border-b border-border py-3 last:border-b-0">
          <p className={event.type === "NOTE_ADDED" ? "whitespace-pre-wrap break-words text-fg" : "text-fg"}>
            {describe(event, userNames)}
          </p>
          <p className="text-sm text-fg-muted">
            {event.actor?.name ?? "System"} ·{" "}
            <time dateTime={event.createdAt.toISOString()}>{formatIstDateTime(event.createdAt)}</time>
          </p>
        </li>
      ))}
    </ol>
  );
}
