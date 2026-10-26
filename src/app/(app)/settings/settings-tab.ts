// Server-safe: page.tsx parses ?tab= on the server, so this must not live in the "use client" module.
export const SETTINGS_TABS = [
  { id: "projects", label: "Projects" },
  { id: "team", label: "Team" },
  { id: "integrations", label: "Integrations" },
  { id: "import", label: "Import" },
] as const;

export type SettingsTab = (typeof SETTINGS_TABS)[number]["id"];

export function parseSettingsTab(value: unknown): SettingsTab {
  return SETTINGS_TABS.find((t) => t.id === value)?.id ?? "projects";
}
