import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }) }));

const changePasswordAction = vi.hoisted(() => vi.fn());
vi.mock("@/app/(app)/account/actions", () => ({ changePasswordAction }));

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

describe("UserMenu change password", () => {
  it("opens a sheet, shows a field error, then confirms the change", async () => {
    changePasswordAction
      .mockResolvedValueOnce({ ok: false, error: "Current password is incorrect", field: "currentPassword" })
      .mockResolvedValueOnce({ ok: true });
    const user = userEvent.setup();
    render(<UserMenu name="Asha Rao" email="asha@example.com" role="AGENT" />);
    await user.click(screen.getByRole("button", { name: /account menu/i }));
    await user.click(await screen.findByRole("menuitem", { name: /change password/i }));
    const dialog = await screen.findByRole("dialog", { name: "Change password" });
    await user.type(within(dialog).getByLabelText("Current password"), "wrong");
    await user.type(within(dialog).getByLabelText("New password"), "new-pass-123");
    await user.type(within(dialog).getByLabelText("Confirm new password"), "new-pass-123");
    await user.click(within(dialog).getByRole("button", { name: "Change password" }));
    expect(changePasswordAction).toHaveBeenCalledWith({
      currentPassword: "wrong",
      newPassword: "new-pass-123",
      confirmPassword: "new-pass-123",
    });
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Current password is incorrect");
    expect(within(dialog).getByLabelText("Current password")).toHaveAttribute("aria-invalid", "true");

    await user.click(within(dialog).getByRole("button", { name: "Change password" }));
    expect(await within(dialog).findByRole("status")).toHaveTextContent(/password changed/i);
  });
});
