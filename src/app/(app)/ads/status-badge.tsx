import { Badge, type BadgeTone } from "@/components/ui/badge";

const TONES: Record<string, BadgeTone> = { ACTIVE: "success", PAUSED: "warning" };

/** A Meta campaign or lead-form status: ACTIVE green, PAUSED amber, anything else neutral. */
export function StatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <Badge tone={TONES[status] ?? "neutral"} className={className}>
      {status ? status.charAt(0) + status.slice(1).toLowerCase() : "Unknown"}
    </Badge>
  );
}
