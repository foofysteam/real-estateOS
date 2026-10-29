import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { LeadCard } from "@/app/(app)/leads/lead-card";
import type { LeadListItemDTO } from "@/lib/leads/filters";

afterEach(cleanup);

const lead: LeadListItemDTO = {
  id: "lead_1",
  name: "Rohan Mehta",
  phone: "+919845012345",
  stage: "QUALIFIED",
  score: 72,
  source: "REFERRAL",
  budgetRupees: 4500000,
  createdAt: "2026-10-20T00:00:00.000Z",
  nextFollowUpAt: null,
  project: { id: "p_1", name: "Krishvi Triple One" },
  owner: { id: "u_1", name: "Asha" },
};

describe("LeadCard", () => {
  it("shows name, stage badge, short budget and score", () => {
    render(<LeadCard lead={lead} />);
    expect(screen.getByText("Rohan Mehta")).toBeInTheDocument();
    expect(screen.getByText("₹45L")).toBeInTheDocument();
    expect(screen.getByText("72")).toBeInTheDocument();
    expect(screen.getByText("Qualified")).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAttribute("href", "/leads/lead_1");
  });
});
