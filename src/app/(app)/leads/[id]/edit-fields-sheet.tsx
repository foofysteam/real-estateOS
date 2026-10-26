"use client";

import { useState, type FormEvent } from "react";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { formatRupees } from "@/lib/money";
import { updateFieldsAction, type FieldsPatch } from "./actions";
import { Field, FormError, nativeControl } from "./field";
import { useAction } from "./use-action";

export type EditableLead = {
  id: string;
  name: string;
  email: string | null;
  budgetRupees: number | null;
  configuration: string | null;
  locality: string | null;
  projectId: string | null;
};

type Values = Required<{ [K in keyof FieldsPatch]: string }>;

function initialValues(lead: EditableLead): Values {
  return {
    name: lead.name,
    email: lead.email ?? "",
    budget: lead.budgetRupees != null ? formatRupees(lead.budgetRupees).replace("₹", "") : "",
    configuration: lead.configuration ?? "",
    locality: lead.locality ?? "",
    projectId: lead.projectId ?? "",
  };
}

const TEXT_FIELDS: { key: Exclude<keyof Values, "projectId">; label: string; type?: string; hint?: string }[] = [
  { key: "name", label: "Name" },
  { key: "email", label: "Email", type: "email" },
  { key: "budget", label: "Budget", hint: "e.g. 45L or 1.2Cr" },
  { key: "configuration", label: "Configuration", hint: "e.g. 3BHK" },
  { key: "locality", label: "Locality" },
];

export function EditFieldsSheet({ lead, projects }: { lead: EditableLead; projects: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  const { pending, error, run, clearError } = useAction();

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        clearError();
        setOpen(o);
      }}
    >
      <SheetTrigger asChild>
        <Button variant="ghost" size="sm">
          <Pencil aria-hidden="true" />
          Edit
        </Button>
      </SheetTrigger>
      <SheetContent title="Edit details">
        <EditForm
          lead={lead}
          projects={projects}
          pending={pending}
          error={error}
          onSubmit={(patch) => run(() => updateFieldsAction(lead.id, patch), () => setOpen(false))}
        />
      </SheetContent>
    </Sheet>
  );
}

function EditForm({
  lead,
  projects,
  pending,
  error,
  onSubmit,
}: {
  lead: EditableLead;
  projects: { id: string; name: string }[];
  pending: boolean;
  error: string | null;
  onSubmit: (patch: FieldsPatch) => void;
}) {
  const initial = initialValues(lead);
  const [values, setValues] = useState(initial);
  const set = (key: keyof Values, value: string) => setValues((v) => ({ ...v, [key]: value }));

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    // Send only what changed; "" clears an optional field on the server.
    const patch = Object.fromEntries(
      (Object.keys(values) as (keyof Values)[]).filter((k) => values[k] !== initial[k]).map((k) => [k, values[k]]),
    ) as FieldsPatch;
    onSubmit(patch);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {TEXT_FIELDS.map(({ key, label, type, hint }) => (
        <Field key={key} id={`edit-${key}`} label={label}>
          <Input
            id={`edit-${key}`}
            type={type ?? "text"}
            placeholder={hint}
            value={values[key]}
            required={key === "name"}
            inputMode={key === "budget" ? "decimal" : undefined}
            onChange={(e) => set(key, e.target.value)}
          />
        </Field>
      ))}
      <Field id="edit-projectId" label="Project">
        <select
          id="edit-projectId"
          value={values.projectId}
          onChange={(e) => set("projectId", e.target.value)}
          className={nativeControl}
        >
          <option value="">No project</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </Field>
      <FormError error={error} />
      <Button type="submit" disabled={pending}>
        Save
      </Button>
    </form>
  );
}
