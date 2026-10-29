import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { FollowUpWithLead } from "@/lib/leads/queries";

const completeFollowUpAction = vi.hoisted(() => vi.fn());
vi.mock("@/app/(app)/today/actions", () => ({ completeFollowUpAction }));

const { FollowUpList } = await import("@/app/(app)/today/follow-up-list");

afterEach(() => {
  cleanup();
  completeFollowUpAction.mockReset();
});

const item: FollowUpWithLead = {
  id: "fu_1",
  leadId: "lead_1",
  ownerId: "user_1",
  dueAt: new Date("2026-10-26T12:00:00Z"),
  channel: "CALL",
  note: null,
  completedAt: null,
  createdAt: new Date("2026-10-20T00:00:00Z"),
  lead: { id: "lead_1", name: "Rohan Mehta", phone: "+919845012345", stage: "QUALIFIED", project: null },
};

describe("FollowUpList", () => {
  it("shows a failed Done inline and re-enables the row", async () => {
    completeFollowUpAction.mockResolvedValue({ ok: false, error: "You don't have permission to do that" });
    render(<FollowUpList items={[item]} />);
    const done = screen.getByRole("button", { name: /done/i });
    await userEvent.click(done);
    expect(completeFollowUpAction).toHaveBeenCalledWith("fu_1");
    expect(await screen.findByRole("alert")).toHaveTextContent("You don't have permission to do that");
    expect(done).toBeEnabled();
  });

  it("shows a generic error when the action throws", async () => {
    completeFollowUpAction.mockRejectedValue(new Error("boom"));
    render(<FollowUpList items={[item]} />);
    await userEvent.click(screen.getByRole("button", { name: /done/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/something went wrong/i);
  });
});
