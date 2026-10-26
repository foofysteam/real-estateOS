import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FollowUpRow } from "@/app/(app)/today/follow-up-row";
import type { FollowUpWithLead } from "@/lib/leads/queries";

afterEach(cleanup);

const item: FollowUpWithLead = {
  id: "fu_1",
  leadId: "lead_1",
  ownerId: "user_1",
  dueAt: new Date("2026-10-26T12:00:00Z"),
  channel: "CALL",
  note: null,
  completedAt: null,
  createdAt: new Date("2026-10-20T00:00:00Z"),
  lead: {
    id: "lead_1",
    name: "Rohan Mehta",
    phone: "+919845012345",
    stage: "QUALIFIED",
    project: { id: "p_1", name: "Krishvi Triple One", slug: "krishvi-111" },
  },
};

describe("FollowUpRow", () => {
  it("renders tel and wa.me links and calls onDone", async () => {
    const onDone = vi.fn();
    render(<FollowUpRow item={item} onDone={onDone} />);
    expect(screen.getByText("Rohan Mehta")).toBeInTheDocument();
    expect(screen.getByText("Krishvi Triple One")).toBeInTheDocument();
    expect(screen.getByText("5:30 pm")).toBeInTheDocument();
    expect(screen.getByText("Qualified")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /call/i })).toHaveAttribute("href", "tel:+919845012345");
    expect(screen.getByRole("link", { name: /whatsapp/i })).toHaveAttribute("href", "https://wa.me/919845012345");
    await userEvent.click(screen.getByRole("button", { name: /done/i }));
    expect(onDone).toHaveBeenCalledWith(item.id);
  });
});
