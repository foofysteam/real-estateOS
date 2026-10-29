"use client";

import { useActionState, useState, type FormEvent } from "react";
import { Download, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FormError, nativeControl } from "@/components/ui/field";
import { CSV_IMPORT_SOURCES, SOURCE_LABELS } from "@/lib/sources";
import { GENERIC_ERROR } from "@/lib/use-action";
import { importCsvAction, type SettingsResult } from "../actions";
import type { CsvImportResult } from "@/lib/csv";

type State = SettingsResult<CsvImportResult> | null;

const MAX_BYTES = 2 * 1024 * 1024;
const MAX_ERRORS_SHOWN = 50;
const TEMPLATE_HEADER = "name,phone,email,project,budget,configuration,locality,notes";
const TEMPLATE_HREF = `data:text/csv;charset=utf-8,${encodeURIComponent(TEMPLATE_HEADER + "\n")}`;

async function submit(_prev: State, formData: FormData): Promise<State> {
  try {
    return await importCsvAction(formData);
  } catch {
    return { ok: false, error: GENERIC_ERROR };
  }
}

/** Upload a leads CSV; duplicates merge into existing leads and bad rows are reported by line. */
export function CsvImport() {
  const [state, formAction, pending] = useActionState(submit, null);
  const [clientError, setClientError] = useState<string | null>(null);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    // Catch an oversize file before uploading it; the server enforces the same cap.
    const file = new FormData(e.currentTarget).get("file");
    if (file instanceof File && file.size > MAX_BYTES) {
      e.preventDefault();
      setClientError("File too large (max 2 MB)");
      return;
    }
    setClientError(null);
  }

  const error = clientError ?? (state && !state.ok ? state.error : null);

  return (
    <section className="flex flex-col gap-3" aria-labelledby="import-heading">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 id="import-heading" className="text-base font-semibold text-fg">
            Import leads
          </h2>
          <p className="text-sm text-fg-muted">CSV with a header row. Name and phone are required; up to 2 MB.</p>
        </div>
        <Button variant="secondary" size="sm" asChild>
          <a href={TEMPLATE_HREF} download="leads-template.csv">
            <Download aria-hidden="true" />
            Template
          </a>
        </Button>
      </div>

      <form
        action={formAction}
        onSubmit={handleSubmit}
        className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4"
      >
        <Field id="csv-file" label="CSV file">
          <input
            id="csv-file"
            name="file"
            type="file"
            accept=".csv,text/csv"
            required
            className={`${nativeControl} file:mr-3 file:rounded-sm file:border-0 file:bg-surface-2 file:px-2 file:py-1 file:text-fg`}
          />
        </Field>
        <Field id="csv-source" label="Source" error={state && !state.ok ? state.fieldErrors?.source : undefined}>
          <select id="csv-source" name="source" defaultValue="CSV_IMPORT" className={nativeControl}>
            {CSV_IMPORT_SOURCES.map((s) => (
              <option key={s} value={s}>
                {SOURCE_LABELS[s]}
              </option>
            ))}
          </select>
        </Field>
        <FormError error={error} />
        <Button type="submit" disabled={pending} className="self-start">
          <Upload aria-hidden="true" />
          {pending ? "Importing…" : "Import"}
        </Button>
      </form>

      {state?.ok && !clientError && <ImportResults result={state} />}
    </section>
  );
}

function ImportResults({ result }: { result: CsvImportResult }) {
  const shown = result.errors.slice(0, MAX_ERRORS_SHOWN);
  const hidden = result.errors.length - shown.length;
  return (
    <div role="status" className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
      <dl className="grid grid-cols-3 gap-2">
        {[
          ["Created", result.created],
          ["Duplicates", result.deduplicated],
          ["Errors", result.errors.length],
        ].map(([label, n]) => (
          <div key={label} className="flex flex-col">
            <dt className="text-xs text-fg-muted">{label}</dt>
            <dd className="text-lg font-semibold text-fg tabular-nums">{n}</dd>
          </div>
        ))}
      </dl>
      {shown.length > 0 && (
        <ul className="flex flex-col gap-1 border-t border-border pt-3 text-sm">
          {shown.map((e, i) => (
            <li key={i} className="break-words text-fg">
              <span className="font-medium tabular-nums">line {e.line}:</span> {e.message}
            </li>
          ))}
          {hidden > 0 && <li className="text-fg-muted">+{hidden} more</li>}
        </ul>
      )}
    </div>
  );
}
