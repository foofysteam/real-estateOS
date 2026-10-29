import { EmptyState } from "@/components/ui/empty-state";
import type { LeadForm } from "@/lib/meta/gateway";
import { StatusBadge } from "./status-badge";
import { SyncFormsButton } from "./sync-forms-button";

const TH = "h-10 border-b border-border px-3 text-left text-xs font-medium text-fg-muted";
const TD = "h-11 border-b border-border px-3 text-sm group-last:border-b-0";

const count = new Intl.NumberFormat("en-IN");

/** The page's lead forms as a table from md up and stacked cards below, with a Sync forms action. */
export function LeadFormsTable({ forms }: { forms: LeadForm[] }) {
  return (
    <section className="flex flex-col gap-3" aria-labelledby="lead-forms-heading">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="lead-forms-heading" className="text-base font-semibold text-fg">
          Lead forms
        </h2>
        <SyncFormsButton />
      </div>
      {forms.length === 0 ? (
        <EmptyState message="This page has no lead forms yet." className="rounded-lg border border-border bg-surface" />
      ) : (
        <>
          <ul className="divide-y divide-border rounded-lg border border-border bg-surface md:hidden">
            {forms.map((f) => (
              <li key={f.id} className="flex min-h-14 items-center gap-2 px-4 py-2">
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate font-medium text-fg">{f.name}</span>
                  <span className="text-sm text-fg-muted tabular-nums">{count.format(f.leadsCount)} leads</span>
                </span>
                <StatusBadge status={f.status} className="shrink-0" />
              </li>
            ))}
          </ul>
          <table className="hidden w-full table-fixed border-separate border-spacing-0 rounded-lg border border-border bg-surface md:table">
            <thead>
              <tr>
                <th className={`${TH} w-[50%]`}>Name</th>
                <th className={TH}>Status</th>
                <th className={`${TH} text-right`}>Leads</th>
              </tr>
            </thead>
            <tbody>
              {forms.map((f) => (
                <tr key={f.id} className="group">
                  <td className={`${TD} truncate font-medium text-fg`}>{f.name}</td>
                  <td className={TD}>
                    <StatusBadge status={f.status} />
                  </td>
                  <td className={`${TD} text-right tabular-nums`}>{count.format(f.leadsCount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </section>
  );
}
