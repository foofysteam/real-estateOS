"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatRupeesShort, parseRupees } from "@/lib/money";
import { createProjectAction, updateProjectAction, type FieldErrors } from "../actions";
import { Field, FormError } from "@/app/(app)/leads/[id]/field";
import { useAction } from "@/app/(app)/leads/[id]/use-action";

export type EditableProject = {
  id: string;
  name: string;
  slug: string;
  city: string;
  priceMinRupees: number;
  priceMaxRupees: number;
};

type Values = { name: string; slug: string; city: string; priceMin: string; priceMax: string };

const FIELDS: { key: keyof Values; label: string; hint?: string }[] = [
  { key: "name", label: "Name" },
  { key: "slug", label: "Slug", hint: "e.g. kingar-heights" },
  { key: "city", label: "City" },
  { key: "priceMin", label: "Min price", hint: "e.g. 80L" },
  { key: "priceMax", label: "Max price", hint: "e.g. 1.6Cr" },
];

/** "80L" when the short form is exact; otherwise plain digits so editing never rounds a price. */
function priceText(rupees: number): string {
  const short = formatRupeesShort(rupees).replace("₹", "");
  return parseRupees(short) === rupees ? short : String(rupees);
}

function initialValues(project?: EditableProject): Values {
  if (!project) return { name: "", slug: "", city: "", priceMin: "", priceMax: "" };
  return {
    name: project.name,
    slug: project.slug,
    city: project.city,
    priceMin: priceText(project.priceMinRupees),
    priceMax: priceText(project.priceMaxRupees),
  };
}

/** Creates a project, or edits `project` when given; shows the action's per-field errors under each input. */
export function ProjectForm({ project, onSaved }: { project?: EditableProject; onSaved: () => void }) {
  const [values, setValues] = useState(() => initialValues(project));
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const { pending, error, run } = useAction();

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    run(async () => {
      const result = project ? await updateProjectAction(project.id, values) : await createProjectAction(values);
      setFieldErrors(result.ok ? {} : (result.fieldErrors ?? {}));
      return result;
    }, onSaved);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      {FIELDS.map(({ key, label, hint }) => {
        const id = `project-${key}`;
        const fieldError = fieldErrors[key];
        return (
          <Field key={key} id={id} label={label} error={fieldError}>
            <Input
              id={id}
              value={values[key]}
              placeholder={hint}
              required
              inputMode={key.startsWith("price") ? "decimal" : undefined}
              autoCapitalize={key === "slug" ? "none" : undefined}
              aria-invalid={fieldError ? true : undefined}
              aria-describedby={fieldError ? `${id}-error` : undefined}
              onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
            />
          </Field>
        );
      })}
      <FormError error={error} />
      <Button type="submit" disabled={pending}>
        {project ? "Save" : "Create project"}
      </Button>
    </form>
  );
}
