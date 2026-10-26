import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }) }));

import { UserMenu } from "@/components/shell/user-menu";

beforeAll(() => {
  // Radix Popper measures with ResizeObserver, which jsdom lacks.
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  push.mockClear();
  refresh.mockClear();
});

describe("UserMenu logout", () => {
  it("shows an error and stays put when the logout request fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    const user = userEvent.setup();
    render(<UserMenu name="Asha Rao" email="asha@example.com" role="AGENT" />);
    await user.click(screen.getByRole("button", { name: /account menu/i }));
    await user.click(await screen.findByRole("menuitem", { name: /log out/i }));
    expect(await screen.findByText("Couldn't sign out. Try again.")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
    expect(screen.getByRole("menuitem", { name: /log out/i })).not.toHaveAttribute("aria-disabled", "true");
  });

  it("navigates to /login when logout succeeds", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
    const user = userEvent.setup();
    render(<UserMenu name="Asha Rao" email="asha@example.com" role="AGENT" />);
    await user.click(screen.getByRole("button", { name: /account menu/i }));
    await user.click(await screen.findByRole("menuitem", { name: /log out/i }));
    await vi.waitFor(() => expect(push).toHaveBeenCalledWith("/login"));
  });
});
