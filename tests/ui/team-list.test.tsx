import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const resetPasswordAction = vi.hoisted(() => vi.fn());
vi.mock("@/app/(app)/settings/actions", () => ({
  resetPasswordAction,
  setUserActiveAction: vi.fn(),
  inviteUserAction: vi.fn(),
}));

const { TeamList } = await import("@/app/(app)/settings/team/team-list");

afterEach(() => {
  cleanup();
  resetPasswordAction.mockReset();
});

const users = [
  { id: "u1", name: "Asha", email: "asha@sc.studio", role: "AGENT" as const, phone: null, isActive: true },
];

describe("TeamList reset password", () => {
  it("cannot be closed mid-reset, and never re-shows a password after closing", async () => {
    let resolve!: (r: unknown) => void;
    resetPasswordAction.mockReturnValue(new Promise((r) => (resolve = r)));
    render(<TeamList users={users} lastAdminId={null} />);

    await userEvent.click(screen.getByRole("button", { name: "Reset password for Asha" }));
    await userEvent.click(screen.getByRole("button", { name: "Reset password" }));
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();

    await userEvent.keyboard("{Escape}");
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.queryByLabelText("Temporary password")).not.toBeInTheDocument();

    resolve({ ok: true, temporaryPassword: "Abcdefgh2345" });
    expect(await screen.findByLabelText("Temporary password")).toHaveValue("Abcdefgh2345");

    await userEvent.click(screen.getByRole("button", { name: "Done" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    await userEvent.click(screen.getByRole("button", { name: "Reset password for Asha" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("Reset Asha's password?");
    expect(screen.queryByLabelText("Temporary password")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeEnabled();
  });
});
