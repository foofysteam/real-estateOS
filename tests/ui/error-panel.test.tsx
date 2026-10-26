import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { ErrorPanel } from "@/app/(app)/ads/error-panel";
import { MetaNotConfiguredError, MetaToolUnavailableError } from "@/lib/meta/gateway";

afterEach(cleanup);

describe("ErrorPanel", () => {
  it("shows the unavailable-tool message and available tools", () => {
    render(<ErrorPanel error={new MetaToolUnavailableError("listLeadForms", ["ads_get_insights", "ads_get_campaigns"])} />);
    expect(screen.getByRole("heading", { name: "Meta MCP tool unavailable" })).toBeInTheDocument();
    expect(screen.getByText(/listLeadForms/)).toBeInTheDocument();
    expect(screen.getByText("ads_get_insights")).toBeInTheDocument();
    expect(screen.getByText("ads_get_campaigns")).toBeInTheDocument();
  });

  it("links to settings when not configured", () => {
    render(<ErrorPanel error={new MetaNotConfiguredError()} />);
    expect(screen.getByRole("heading", { name: "Meta isn't connected" })).toBeInTheDocument();
    expect(screen.getByText(/Connect Meta in Settings → Integrations/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /settings/i })).toHaveAttribute("href", "/settings?tab=integrations");
  });

  it("shows a generic message with the error text in details for anything else", () => {
    render(<ErrorPanel error={new Error("socket hang up")} />);
    expect(screen.getByRole("heading", { name: "Couldn't load Meta data" })).toBeInTheDocument();
    expect(screen.getByText("Details")).toBeInTheDocument();
    expect(screen.getByText("socket hang up").closest("details")).not.toBeNull();
  });
});
