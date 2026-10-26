import Link from "next/link";
import type { LeadWithOwner } from "@/lib/leads/queries";
import { formatRupeesShort } from "@/lib/money";
import { CallLink, WhatsAppLink } from "./contact-links";

/** A new lead on Today: the text opens the lead; Call and WhatsApp are separate 44 px targets. */
export function NewLeadRow({ lead }: { lead: Pick<LeadWithOwner, "id" | "name" | "phone" | "budgetRupees" | "project"> }) {
  const detail = [lead.project?.name, lead.budgetRupees != null ? formatRupeesShort(lead.budgetRupees) : null]
    .filter(Boolean)
    .join(" · ");
  return (
    <li className="flex flex-col gap-3 border-b border-border px-4 py-3 last:border-b-0 lg:min-h-11 lg:flex-row lg:items-center lg:gap-4 lg:py-1.5">
      <Link
        href={`/leads/${lead.id}`}
        className="-mx-2 flex min-h-11 min-w-0 flex-1 flex-col justify-center rounded-md px-2 hover:bg-surface-2 lg:flex-row lg:items-center lg:justify-start"
      >
        <span className="block truncate font-medium text-fg">{lead.name}</span>
        {detail && <span className="block truncate text-sm text-fg-muted lg:ml-3">{detail}</span>}
      </Link>
      <div className="grid grid-cols-2 gap-2 lg:flex lg:shrink-0">
        <CallLink phone={lead.phone} />
        <WhatsAppLink phone={lead.phone} />
      </div>
    </li>
  );
}
