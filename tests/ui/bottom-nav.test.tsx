import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { BottomNav } from "@/components/shell/bottom-nav";

afterEach(cleanup);

describe("BottomNav", () => {
  it("renders four tabs for an AGENT and five for an ADMIN", () => {
    render(<BottomNav role="AGENT" pathname="/today" />);
    expect(screen.getAllByRole("link")).toHaveLength(4);
    cleanup();
    render(<BottomNav role="ADMIN" pathname="/today" />);
    expect(screen.getAllByRole("link")).toHaveLength(5);
  });

  it("marks the current route with aria-current=page", () => {
    render(<BottomNav role="AGENT" pathname="/leads" />);
    expect(screen.getByRole("link", { name: /leads/i })).toHaveAttribute("aria-current", "page");
  });

  it("every tab is at least 44px tall (class contract)", () => {
    render(<BottomNav role="AGENT" pathname="/today" />);
    for (const l of screen.getAllByRole("link")) expect(l.className).toMatch(/min-h-11/);
  });
});
