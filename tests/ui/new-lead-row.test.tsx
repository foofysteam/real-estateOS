import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { NewLeadRow } from "@/app/(app)/today/new-lead-row";

afterEach(cleanup);

describe("NewLeadRow", () => {
  it("links the lead and offers Call and WhatsApp", () => {
    render(
      <ul>
        <NewLeadRow
          lead={{ id: "lead_1", name: "Priya Shah", phone: "+919845012345", budgetRupees: 4_500_000, project: { id: "p", name: "Krishvi", slug: "k" } }}
        />
      </ul>,
    );
    const leadLink = screen.getByRole("link", { name: /priya shah/i });
    expect(leadLink).toHaveAttribute("href", "/leads/lead_1");
    expect(leadLink).toHaveTextContent("Krishvi · ₹45L");
    expect(screen.getByRole("link", { name: /call/i })).toHaveAttribute("href", "tel:+919845012345");
    expect(screen.getByRole("link", { name: /whatsapp/i })).toHaveAttribute("href", "https://wa.me/919845012345");
  });
});
