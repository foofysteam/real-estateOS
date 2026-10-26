"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** Shows a freshly issued password once; it lives only in this component's props, never in storage. */
export function TemporaryPassword({ password }: { password: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
    } catch {
      // Clipboard unavailable (insecure context or denied): the field stays selectable for a manual copy.
      setCopied(false);
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor="temporary-password" className="text-sm font-medium text-fg">
        Temporary password
      </label>
      <div className="flex gap-2">
        <Input
          id="temporary-password"
          readOnly
          value={password}
          onFocus={(e) => e.currentTarget.select()}
          className="font-mono"
          autoComplete="off"
          spellCheck={false}
        />
        <Button variant="secondary" onClick={copy} aria-label={copied ? "Copied" : "Copy password"}>
          {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
          <span className="hidden sm:inline">{copied ? "Copied" : "Copy"}</span>
        </Button>
      </div>
      <p className="text-sm text-fg-muted">Shown once. Share it securely.</p>
    </div>
  );
}
