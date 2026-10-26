"use client";

import { useState, type FormEvent } from "react";
import { KeyRound, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, FormError, nativeControl } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { LeadSource } from "@/generated/prisma/enums";
import { formatIstDateTime } from "@/lib/dates";
import { INGEST_KEY_SOURCES, SOURCE_LABELS } from "@/lib/sources";
import { useAction } from "@/lib/use-action";
import { createIngestKeyAction, revokeIngestKeyAction, type FieldErrors } from "../actions";
import { ShowOnce } from "../show-once";

export type IngestKeyRow = {
  id: string;
  name: string;
  source: LeadSource;
  isActive: boolean;
  lastUsedAt: Date | null;
  createdAt: Date;
};

type KeySource = (typeof INGEST_KEY_SOURCES)[number];

const TH = "h-10 border-b border-border px-3 text-left text-xs font-medium text-fg-muted";
const TD = "h-11 border-b border-border px-3 text-sm group-last:border-b-0";

const lastUsed = (k: IngestKeyRow) => (k.lastUsedAt ? formatIstDateTime(k.lastUsedAt) : "Never");

function StatusBadge({ active }: { active: boolean }) {
  return <Badge tone={active ? "success" : "neutral"}>{active ? "Active" : "Revoked"}</Badge>;
}

/** Bearer keys for website/portal lead feeds: cards below md, a table from md up. */
export function IngestKeys({ keys }: { keys: IngestKeyRow[] }) {
  return (
    <section className="flex flex-col gap-3" aria-labelledby="ingest-keys-heading">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 id="ingest-keys-heading" className="text-base font-semibold text-fg">
            Ingest keys
          </h2>
          <p className="text-sm text-fg-muted">Let your website or a portal post leads to /api/ingest.</p>
        </div>
        <NewKeyButton />
      </div>

      {keys.length === 0 ? (
        <EmptyState icon={KeyRound} message="No keys yet." className="rounded-lg border border-border bg-surface" />
      ) : (
        <>
          <ul className="divide-y divide-border rounded-lg border border-border bg-surface md:hidden">
            {keys.map((k) => (
              <li key={k.id} className="flex flex-col gap-1 px-4 py-3">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="truncate font-medium text-fg">{k.name}</span>
                  <StatusBadge active={k.isActive} />
                </span>
                <span className="text-sm text-fg-muted">{SOURCE_LABELS[k.source]}</span>
                <span className="text-sm text-fg-muted">
                  Created {formatIstDateTime(k.createdAt)} · Last used {lastUsed(k)}
                </span>
                {k.isActive && (
                  <span className="-mb-1 flex justify-end">
                    <RevokeButton keyRow={k} />
                  </span>
                )}
              </li>
            ))}
          </ul>
          <table className="hidden w-full table-fixed border-separate border-spacing-0 rounded-lg border border-border bg-surface md:table">
            <thead>
              <tr>
                <th className={`${TH} w-[28%]`}>Name</th>
                <th className={TH}>Source</th>
                <th className={TH}>Created</th>
                <th className={TH}>Last used</th>
                <th className={TH}>Status</th>
                <th className={`${TH} w-32 text-right`}>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {keys.map((k) => (
                <tr key={k.id} className="group">
                  <td className={`${TD} truncate font-medium text-fg`}>{k.name}</td>
                  <td className={`${TD} text-fg-muted`}>{SOURCE_LABELS[k.source]}</td>
                  <td className={`${TD} text-fg-muted tabular-nums`}>{formatIstDateTime(k.createdAt)}</td>
                  <td className={`${TD} text-fg-muted tabular-nums`}>{lastUsed(k)}</td>
                  <td className={TD}>
                    <StatusBadge active={k.isActive} />
                  </td>
                  <td className={`${TD} text-right`}>{k.isActive && <RevokeButton keyRow={k} />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </section>
  );
}

function RevokeButton({ keyRow }: { keyRow: IngestKeyRow }) {
  const [open, setOpen] = useState(false);
  const { pending, error, run, clearError } = useAction();

  function handleOpenChange(next: boolean) {
    if (!next && pending) return;
    clearError();
    setOpen(next);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <Button variant="ghost" size="sm" onClick={() => handleOpenChange(true)} aria-label={`Revoke ${keyRow.name}`}>
        Revoke
      </Button>
      <DialogContent title={`Revoke "${keyRow.name}"?`}>
        <div className="flex flex-col gap-4">
          <p className="text-sm text-fg-muted">Anything still using this key will be refused right away.</p>
          <FormError error={error} />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => handleOpenChange(false)} disabled={pending}>
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={pending}
              onClick={() => run(() => revokeIngestKeyAction(keyRow.id), () => setOpen(false))}
            >
              Revoke key
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function NewKeyButton() {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  // Remount on every open so an earlier key or draft never reappears.
  const [round, setRound] = useState(0);

  function handleOpenChange(next: boolean) {
    // Stay open while creating so the new key is shown to whoever asked for it.
    if (!next && pending) return;
    if (next) setRound((r) => r + 1);
    setOpen(next);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <Button size="sm" onClick={() => handleOpenChange(true)}>
        <Plus aria-hidden="true" />
        New key
      </Button>
      <DialogContent title="New ingest key">
        <NewKeyForm key={round} onPendingChange={setPending} onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

function NewKeyForm({ onDone, onPendingChange }: { onDone: () => void; onPendingChange: (p: boolean) => void }) {
  const [name, setName] = useState("");
  const [source, setSource] = useState<KeySource>("WEBSITE");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [plaintext, setPlaintext] = useState<string | null>(null);
  const { pending, error, run } = useAction();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onPendingChange(true);
    await run(async () => {
      const result = await createIngestKeyAction(name, source);
      setFieldErrors(result.ok ? {} : (result.fieldErrors ?? {}));
      if (result.ok) setPlaintext(result.plaintext);
      return result;
    });
    onPendingChange(false);
  }

  if (plaintext) {
    return (
      <div className="flex flex-col gap-4">
        <ShowOnce
          id="ingest-key"
          label="Ingest key"
          value={plaintext}
          copyLabel="Copy key"
          note="Shown once. Store it in your website/CRM integration."
        />
        <Button onClick={onDone}>Done</Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      <Field id="key-name" label="Name" error={fieldErrors.name}>
        <Input
          id="key-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Website enquiry form"
          maxLength={80}
          aria-invalid={Boolean(fieldErrors.name)}
          aria-describedby={fieldErrors.name ? "key-name-error" : undefined}
        />
      </Field>
      <Field id="key-source" label="Source" error={fieldErrors.source}>
        <select
          id="key-source"
          className={nativeControl}
          value={source}
          onChange={(e) => setSource(e.target.value as KeySource)}
          aria-invalid={Boolean(fieldErrors.source)}
        >
          {INGEST_KEY_SOURCES.map((s) => (
            <option key={s} value={s}>
              {SOURCE_LABELS[s]}
            </option>
          ))}
        </select>
      </Field>
      <FormError error={error} />
      <Button type="submit" disabled={pending}>
        Create key
      </Button>
    </form>
  );
}
