import type { ReactNode } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { Role } from "@/generated/prisma/enums";
import { MetaNotConfiguredError, MetaToolUnavailableError } from "@/lib/meta/gateway";

const MAX_DETAIL = 300;

/**
 * Explains why Meta data couldn't load: not connected, a missing MCP tool, or anything else.
 * Raw text from an unexpected error is shown to admins only, capped at 300 characters.
 */
export function ErrorPanel({ error, role }: { error: unknown; role: Role }) {
  if (error instanceof MetaNotConfiguredError) {
    return (
      <Panel title="Meta isn't connected">
        <p className="text-sm text-fg-muted">Connect Meta in Settings → Integrations to see spend, leads and campaigns.</p>
        <Button asChild variant="secondary" className="self-start">
          <Link href="/settings?tab=integrations">Open settings</Link>
        </Button>
      </Panel>
    );
  }

  if (error instanceof MetaToolUnavailableError) {
    return (
      <Panel title="Meta MCP tool unavailable">
        <p className="text-sm break-words text-fg-muted">{error.message}</p>
        {error.available.length > 0 && (
          <ul className="flex flex-wrap gap-1.5" aria-label="Available tools">
            {error.available.map((name) => (
              <li key={name}>
                <Badge className="font-mono">{name}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    );
  }

  return (
    <Panel title="Couldn't load Meta data">
      <p className="text-sm text-fg-muted">Meta didn&apos;t respond as expected. Try again in a few minutes.</p>
      {role === "ADMIN" && (
        <details className="text-sm">
          <summary className="flex min-h-11 cursor-pointer items-center text-fg-muted">Details</summary>
          <p className="font-mono text-xs break-words text-fg-muted">
            {(error instanceof Error ? error.message : String(error)).slice(0, MAX_DETAIL)}
          </p>
        </details>
      )}
    </Panel>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card className="flex flex-col gap-3">
      <h2 className="text-base font-semibold text-fg">{title}</h2>
      {children}
    </Card>
  );
}
