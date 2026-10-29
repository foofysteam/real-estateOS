"use client";

import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/cn";

/** Flips `.dark` on <html> and remembers the choice. Icons swap via CSS so SSR markup never mismatches. */
export function ThemeToggle({ className }: { className?: string }) {
  function toggle() {
    const dark = document.documentElement.classList.toggle("dark");
    try {
      localStorage.setItem("theme", dark ? "dark" : "light");
    } catch {
      // Storage blocked (private mode): the toggle still works for this page view.
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Toggle theme"
      className={cn(
        "grid size-11 place-items-center rounded-md text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg",
        className,
      )}
    >
      <Moon className="size-4 dark:hidden" aria-hidden="true" />
      <Sun className="hidden size-4 dark:block" aria-hidden="true" />
    </button>
  );
}
