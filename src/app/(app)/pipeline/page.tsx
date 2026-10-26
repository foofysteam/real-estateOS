import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/current-user";
import { db } from "@/lib/db";
import { getPipeline, parsePipelineFilters } from "@/lib/leads/queries";
import { PipelineView } from "./pipeline-view";

export const metadata: Metadata = { title: "Pipeline · Sales OS" };

export default async function PipelinePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireUser();
  const filters = parsePipelineFilters(await searchParams);
  const [columns, owners, projects] = await Promise.all([
    getPipeline(filters),
    db.user.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.project.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="flex w-full min-w-0 flex-col gap-4">
      <h1 className="text-xl font-semibold text-fg">Pipeline</h1>
      <PipelineView filters={filters} owners={owners} projects={projects} columns={columns} />
    </div>
  );
}
