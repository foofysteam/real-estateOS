import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  usePathname: () => "/today",
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

import { AppShell } from "@/components/shell/app-shell";

afterEach(cleanup);

describe("AppShell", () => {
  it("gives <main> a page gutter and keeps bottom-nav clearance below lg", () => {
    render(
      <AppShell user={{ id: "u1", email: "a@x.in", name: "Agent", role: "AGENT" }}>
        <p>content</p>
      </AppShell>,
    );
    const main = screen.getByRole("main");
    expect(main).toHaveClass("px-4", "py-4", "pb-20", "lg:px-6", "lg:py-6", "lg:pb-6");
    expect(main).toHaveTextContent("content");
  });
});
