import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { parseSettingsTab, SettingsTabs } from "@/app/(app)/settings/settings-tabs";

afterEach(cleanup);

describe("SettingsTabs", () => {
  it("renders each tab as a link to ?tab= and marks the active one", () => {
    render(
      <SettingsTabs active="team">
        <p>Team content</p>
      </SettingsTabs>,
    );
    const tabs = screen.getAllByRole("tab");
    expect(tabs.map((t) => t.textContent)).toEqual(["Projects", "Team", "Integrations", "Import"]);
    expect(screen.getByRole("tab", { name: "Team" })).toHaveAttribute("href", "/settings?tab=team");
    expect(screen.getByRole("tab", { name: "Team" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Projects" })).toHaveAttribute("aria-selected", "false");
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Team content");
  });

  it("defaults unknown tabs to projects", () => {
    expect(parseSettingsTab(undefined)).toBe("projects");
    expect(parseSettingsTab("nope")).toBe("projects");
    expect(parseSettingsTab(["team"])).toBe("projects");
    expect(parseSettingsTab("import")).toBe("import");
  });
});
