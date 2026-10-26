import type { ReactNode } from "react";

/** Label + control + optional error, shared by the lead detail sheets. */
export function Field({ id, label, error, children }: { id: string; label: string; error?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-fg">
        {label}
      </label>
      {children}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

/** Token-styled native select/textarea classes (native controls stay keyboard- and phone-friendly). */
export const nativeControl =
  "block min-h-11 w-full min-w-0 rounded-md border border-border bg-surface px-3 py-2 text-base text-fg md:text-sm " +
  "transition-[border-color] focus-visible:border-accent disabled:opacity-50 aria-invalid:border-danger";

export function FormError({ error }: { error?: string | null }) {
  if (!error) return null;
  return (
    <p role="alert" className="rounded-md bg-tone-danger-bg px-3 py-2 text-sm text-tone-danger-fg">
      {error}
    </p>
  );
}
