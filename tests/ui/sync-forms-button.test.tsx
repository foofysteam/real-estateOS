import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const syncLeadFormsAction = vi.hoisted(() => vi.fn());
vi.mock("@/app/(app)/ads/actions", () => ({ syncLeadFormsAction }));

const { SyncFormsButton } = await import("@/app/(app)/ads/sync-forms-button");

afterEach(() => {
  cleanup();
  syncLeadFormsAction.mockReset();
});

describe("SyncFormsButton", () => {
  it("reports how many forms were synced", async () => {
    syncLeadFormsAction.mockResolvedValue({ ok: true, count: 3 });
    render(<SyncFormsButton />);
    await userEvent.click(screen.getByRole("button", { name: /sync forms/i }));
    expect(await screen.findByText("Synced 3 forms")).toBeInTheDocument();
  });

  it("shows the action's error inline", async () => {
    syncLeadFormsAction.mockResolvedValue({ ok: false, error: "Only admins can sync forms" });
    render(<SyncFormsButton />);
    await userEvent.click(screen.getByRole("button", { name: /sync forms/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Only admins can sync forms");
  });
});
