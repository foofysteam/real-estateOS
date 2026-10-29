"use client";

import { useState } from "react";
import { Building2, Pencil, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { formatRupeesShort } from "@/lib/money";
import { setProjectActiveAction } from "../actions";
import { ActiveToggle } from "../active-toggle";
import { ProjectForm, type EditableProject } from "./project-form";

export type ProjectRow = EditableProject & { isActive: boolean };

const TH = "h-10 border-b border-border px-3 text-left text-xs font-medium text-fg-muted";
const TD = "h-11 border-b border-border px-3 text-sm group-last:border-b-0";

function priceBand(p: ProjectRow): string {
  return `${formatRupeesShort(p.priceMinRupees)}–${formatRupeesShort(p.priceMaxRupees)}`;
}

function ActiveBadge({ active }: { active: boolean }) {
  return <Badge tone={active ? "success" : "neutral"}>{active ? "Active" : "Inactive"}</Badge>;
}

/** Projects as cards below md and a table from md up; one sheet serves both "New project" and Edit. */
export function ProjectList({ projects }: { projects: ProjectRow[] }) {
  // undefined = closed; null = new project.
  const [editing, setEditing] = useState<ProjectRow | null | undefined>(undefined);

  const toggle = (p: ProjectRow) => (
    <ActiveToggle label={`${p.name} active`} active={p.isActive} onToggle={(next) => setProjectActiveAction(p.id, next)} />
  );
  const editButton = (p: ProjectRow) => (
    <Button variant="ghost" size="sm" onClick={() => setEditing(p)} aria-label={`Edit ${p.name}`}>
      <Pencil aria-hidden="true" />
      Edit
    </Button>
  );

  return (
    <section className="flex flex-col gap-3" aria-labelledby="projects-heading">
      <div className="flex items-center justify-between gap-2">
        <h2 id="projects-heading" className="text-base font-semibold text-fg">
          Projects
        </h2>
        <Button size="sm" onClick={() => setEditing(null)}>
          <Plus aria-hidden="true" />
          New project
        </Button>
      </div>

      {projects.length === 0 ? (
        <EmptyState
          icon={Building2}
          message="Add your first project so leads can be tagged to it."
          className="rounded-lg border border-border bg-surface"
        />
      ) : (
        <>
          <ul className="divide-y divide-border rounded-lg border border-border bg-surface md:hidden">
            {projects.map((p) => (
              <li key={p.id} className="flex flex-col gap-1 px-4 py-3">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="truncate font-medium text-fg">{p.name}</span>
                  <ActiveBadge active={p.isActive} />
                </span>
                <span className="flex min-w-0 gap-1.5 text-sm text-fg-muted">
                  <span className="truncate">{p.city}</span>
                  <span aria-hidden="true">·</span>
                  <span className="shrink-0 tabular-nums">{priceBand(p)}</span>
                </span>
                <span className="truncate font-mono text-xs text-fg-muted">{p.slug}</span>
                <span className="-mb-1 flex items-center justify-between">
                  {toggle(p)}
                  {editButton(p)}
                </span>
              </li>
            ))}
          </ul>
          <table className="hidden w-full table-fixed border-separate border-spacing-0 rounded-lg border border-border bg-surface md:table">
            <thead>
              <tr>
                <th className={`${TH} w-[26%]`}>Name</th>
                <th className={TH}>Slug</th>
                <th className={TH}>City</th>
                <th className={TH}>Price band</th>
                <th className={TH}>Status</th>
                <th className={`${TH} w-32 text-right`}>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {projects.map((p) => (
                <tr key={p.id} className="group">
                  <td className={`${TD} truncate font-medium text-fg`}>{p.name}</td>
                  <td className={`${TD} truncate font-mono text-xs text-fg-muted`}>{p.slug}</td>
                  <td className={`${TD} truncate`}>{p.city}</td>
                  <td className={`${TD} tabular-nums`}>{priceBand(p)}</td>
                  <td className={TD}>
                    <ActiveBadge active={p.isActive} />
                  </td>
                  <td className={TD}>
                    <span className="flex items-center justify-end gap-1">
                      {toggle(p)}
                      {editButton(p)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <Sheet open={editing !== undefined} onOpenChange={(open) => !open && setEditing(undefined)}>
        <SheetContent title={editing ? "Edit project" : "New project"}>
          <ProjectForm key={editing?.id ?? "new"} project={editing ?? undefined} onSaved={() => setEditing(undefined)} />
        </SheetContent>
      </Sheet>
    </section>
  );
}
