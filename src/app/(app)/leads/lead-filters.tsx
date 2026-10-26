"use client";

import { useState, type FormEvent } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { UNASSIGNED, type LeadFilters as Filters } from "@/lib/leads/filters";
import { SOURCE_LABELS, SOURCE_ORDER } from "@/lib/sources";
import { STAGE_LABELS, STAGE_ORDER } from "@/lib/stages";

type Option = { id: string; name: string };
type SelectKey = "stage" | "source" | "ownerId" | "projectId";

// Radix Select forbids "" as an item value, so ALL stands for "no filter".
const ALL = "__all";

function FilterSelect({
  label,
  allLabel,
  value,
  options,
  onValueChange,
}: {
  label: string;
  allLabel?: string;
  value: string | undefined;
  options: { value: string; label: string }[];
  onValueChange: (value: string | undefined) => void;
}) {
  return (
    <Select value={value ?? ALL} onValueChange={(v) => onValueChange(v === ALL ? undefined : v)}>
      {/* w-auto! beats the trigger's base w-full (cn has no tailwind-merge). */}
      <SelectTrigger aria-label={label} className="w-auto! max-w-56 shrink-0 snap-start md:min-w-36" />
      <SelectContent>
        {allLabel && <SelectItem value={ALL}>{allLabel}</SelectItem>}
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function LeadFilters({
  filters,
  owners,
  projects,
  onChange,
}: {
  filters: Filters;
  owners: Option[];
  projects: Option[];
  onChange: (filters: Filters) => void;
}) {
  const [q, setQ] = useState(filters.q ?? "");
  // Re-seed the draft when the applied query changes from outside (e.g. "Clear filters").
  const [appliedQ, setAppliedQ] = useState(filters.q);
  if (appliedQ !== filters.q) {
    setAppliedQ(filters.q);
    setQ(filters.q ?? "");
  }

  function set<K extends SelectKey | "sort">(key: K, value: Filters[K] | undefined) {
    const next: Filters = { ...filters };
    if (value === undefined) delete next[key];
    else next[key] = value;
    onChange(next);
  }

  function submitSearch(e: FormEvent) {
    e.preventDefault();
    const trimmed = q.trim();
    const next: Filters = { ...filters };
    if (trimmed) next.q = trimmed;
    else delete next.q;
    onChange(next);
  }

  return (
    <div className="flex flex-col gap-2 md:flex-row md:flex-wrap md:items-center">
      <form role="search" onSubmit={submitSearch} className="relative md:w-64">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-muted" aria-hidden="true" />
        <Input
          type="search"
          aria-label="Search leads"
          placeholder="Name or phone"
          enterKeyHint="search"
          maxLength={100}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="pl-9"
        />
      </form>
      <div className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:overflow-visible md:px-0 md:pb-0">
        <FilterSelect
          label="Stage"
          allLabel="All stages"
          value={filters.stage}
          options={STAGE_ORDER.map((s) => ({ value: s, label: STAGE_LABELS[s] }))}
          onValueChange={(v) => set("stage", v as Filters["stage"])}
        />
        <FilterSelect
          label="Source"
          allLabel="All sources"
          value={filters.source}
          options={SOURCE_ORDER.map((s) => ({ value: s, label: SOURCE_LABELS[s] }))}
          onValueChange={(v) => set("source", v as Filters["source"])}
        />
        <FilterSelect
          label="Owner"
          allLabel="All owners"
          value={filters.ownerId}
          options={[{ value: UNASSIGNED, label: "Unassigned" }, ...owners.map((o) => ({ value: o.id, label: o.name }))]}
          onValueChange={(v) => set("ownerId", v)}
        />
        <FilterSelect
          label="Project"
          allLabel="All projects"
          value={filters.projectId}
          options={projects.map((p) => ({ value: p.id, label: p.name }))}
          onValueChange={(v) => set("projectId", v)}
        />
        <FilterSelect
          label="Sort"
          value={filters.sort ?? "created"}
          options={[
            { value: "created", label: "Newest first" },
            { value: "score", label: "Highest score" },
          ]}
          onValueChange={(v) => set("sort", v as Filters["sort"])}
        />
      </div>
    </div>
  );
}
