import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LeadList } from "@/app/(app)/leads/lead-list";
import type { LeadListItemDTO } from "@/lib/leads/filters";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function lead(id: string, name: string): LeadListItemDTO {
  return {
    id,
    name,
    phone: "+919845012345",
    stage: "NEW",
    score: 10,
    source: "WEBSITE",
    budgetRupees: null,
    createdAt: "2026-10-20T00:00:00.000Z",
    nextFollowUpAt: null,
    project: null,
    owner: null,
  };
}

describe("LeadList", () => {
  it("loads the next page with the filters and cursor, then hides Load more", async () => {
    const fetchMock = vi.fn(async () => Response.json({ items: [lead("l2", "Priya")], nextCursor: null }));
    vi.stubGlobal("fetch", fetchMock);
    render(
      <LeadList
        initialItems={[lead("l1", "Rohan")]}
        initialCursor="l1"
        filters={{ stage: "NEW", sort: "score" }}
        onClearFilters={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Load more" }));

    expect(fetchMock).toHaveBeenCalledWith("/api/leads?stage=NEW&sort=score&cursor=l1");
    // Card list and table both render each lead.
    expect(await screen.findAllByText("Priya")).toHaveLength(2);
    expect(screen.getAllByText("Rohan")).toHaveLength(2);
    expect(screen.queryByRole("button", { name: "Load more" })).not.toBeInTheDocument();
  });

  it("shows the empty state with Clear filters", async () => {
    const onClear = vi.fn();
    render(<LeadList initialItems={[]} initialCursor={null} filters={{ stage: "LOST" }} onClearFilters={onClear} />);
    expect(screen.getByText("No leads match.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(onClear).toHaveBeenCalled();
  });
});
