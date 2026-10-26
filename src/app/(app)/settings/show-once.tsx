"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** Copies `value`; when the clipboard is unavailable (insecure context or denied) the paired field stays selectable. */
export function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <Button variant="secondary" onClick={copy} aria-label={copied ? "Copied" : label} className="shrink-0">
      {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
      <span className="hidden sm:inline">{copied ? "Copied" : "Copy"}</span>
    </Button>
  );
}

/** A read-only, selectable value with a Copy button and an optional note underneath. */
export function CopyField({
  id,
  label,
  value,
  copyLabel = `Copy ${label.toLowerCase()}`,
  note,
}: {
  id: string;
  label: string;
  value: string;
  copyLabel?: string;
  note?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-fg">
        {label}
      </label>
      <div className="flex gap-2">
        <Input
          id={id}
          readOnly
          value={value}
          onFocus={(e) => e.currentTarget.select()}
          className="font-mono"
          autoComplete="off"
          spellCheck={false}
        />
        <CopyButton value={value} label={copyLabel} />
      </div>
      {note && <p className="text-sm text-fg-muted">{note}</p>}
    </div>
  );
}

/** Shows a freshly issued secret once; it lives only in the caller's state, never in storage. */
export function ShowOnce(props: { id: string; label: string; value: string; copyLabel: string; note: string }) {
  return <CopyField {...props} />;
}

export function TemporaryPassword({ password }: { password: string }) {
  return (
    <ShowOnce
      id="temporary-password"
      label="Temporary password"
      value={password}
      copyLabel="Copy password"
      note="Shown once. Share it securely."
    />
  );
}
