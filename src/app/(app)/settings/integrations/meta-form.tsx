"use client";

import { useState, type FormEvent } from "react";
import { PlugZap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FormError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { MetaEndpointInfo } from "@/lib/meta/connection";
import { useAction } from "@/lib/use-action";
import { saveMetaConnectionAction, testMetaConnectionAction, type FieldErrors } from "../actions";
import { CopyField } from "../show-once";

/** What the form may know about the stored connection: never the token itself. */
export type MetaFormConnection = {
  pageId: string;
  adAccountId: string;
  hasToken: boolean;
  mcpUrl: string | null;
  leadFormCount: number;
};

type Values = { pageId: string; adAccountId: string; accessToken: string; mcpUrl: string };

const FIELDS: { key: keyof Values; label: string; type?: string; placeholder?: string }[] = [
  { key: "pageId", label: "Page ID" },
  { key: "adAccountId", label: "Ad account ID", placeholder: "act_1234567890" },
  { key: "accessToken", label: "Access token", type: "password" },
  { key: "mcpUrl", label: "MCP URL", type: "url", placeholder: "https://mcp.facebook.com/ads" },
];

const GATEWAY_LABELS: Record<MetaEndpointInfo["gatewayMode"], string> = { mcp: "Meta Ads MCP", graph: "Graph API" };

export function MetaForm({ connection, endpoint }: { connection: MetaFormConnection | null; endpoint: MetaEndpointInfo }) {
  const [values, setValues] = useState<Values>({
    pageId: connection?.pageId ?? "",
    adAccountId: connection?.adAccountId ?? "",
    accessToken: "",
    mcpUrl: connection?.mcpUrl ?? "",
  });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [saved, setSaved] = useState(false);
  const save = useAction();

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaved(false);
    save.run(async () => {
      const result = await saveMetaConnectionAction(values);
      setFieldErrors(result.ok ? {} : (result.fieldErrors ?? {}));
      return result;
    }, () => {
      // The token never comes back; clear the field so a later save keeps it unless retyped.
      setValues((v) => ({ ...v, accessToken: "" }));
      setSaved(true);
    });
  }

  return (
    <section className="flex flex-col gap-3" aria-labelledby="meta-heading">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="meta-heading" className="text-base font-semibold text-fg">
          Meta
        </h2>
        <span className="flex items-center gap-2 text-sm text-fg-muted">
          Gateway <Badge tone="accent">{GATEWAY_LABELS[endpoint.gatewayMode]}</Badge>
        </span>
      </div>

      <div className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4">
        <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2" noValidate>
          {FIELDS.map(({ key, label, type, placeholder }) => {
            const id = `meta-${key}`;
            const error = fieldErrors[key];
            return (
              <Field key={key} id={id} label={label} error={error}>
                <Input
                  id={id}
                  type={type ?? "text"}
                  value={values[key]}
                  onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
                  placeholder={key === "accessToken" && connection?.hasToken ? "Leave blank to keep current" : placeholder}
                  autoComplete={key === "accessToken" ? "new-password" : "off"}
                  spellCheck={false}
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? `${id}-error` : undefined}
                />
              </Field>
            );
          })}
          <div className="flex flex-col gap-3 md:col-span-2">
            <FormError error={save.error} />
            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" disabled={save.pending}>
                Save
              </Button>
              {saved && (
                <span role="status" className="text-sm text-fg-muted">
                  Saved
                </span>
              )}
            </div>
          </div>
        </form>

        <TestConnection />

        <div className="grid gap-4 border-t border-border pt-4 md:grid-cols-2">
          <CopyField id="meta-webhook-url" label="Webhook URL" value={endpoint.webhookUrl} />
          {endpoint.verifyToken ? (
            <CopyField id="meta-verify-token" label="Verify token" value={endpoint.verifyToken} />
          ) : (
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-fg">Verify token</span>
              <p className="text-sm text-fg-muted">Not set. Add META_WEBHOOK_VERIFY_TOKEN to the server environment.</p>
            </div>
          )}
          {connection && (
            <p className="text-sm text-fg-muted md:col-span-2">
              {connection.leadFormCount} lead form{connection.leadFormCount === 1 ? "" : "s"} synced. Sync them from the Ads
              screen.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

function TestConnection() {
  const [count, setCount] = useState<number | null>(null);
  const { pending, error, run } = useAction();

  function test() {
    setCount(null);
    run(async () => {
      const result = await testMetaConnectionAction();
      if (result.ok) setCount(result.count);
      return result;
    });
  }

  return (
    <div className="flex flex-col gap-2 border-t border-border pt-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="secondary" onClick={test} disabled={pending}>
          <PlugZap aria-hidden="true" />
          {pending ? "Testing…" : "Test connection"}
        </Button>
        <span className="text-sm text-fg-muted">Uses the saved settings.</span>
        {count !== null && (
          <span role="status" className="text-sm text-tone-success-fg">
            Connected · {count} campaign{count === 1 ? "" : "s"}
          </span>
        )}
      </div>
      <FormError error={error} />
    </div>
  );
}
