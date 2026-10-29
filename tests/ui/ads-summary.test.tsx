import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { AdsSummary } from "@/app/(app)/ads/ads-summary";

afterEach(cleanup);

describe("AdsSummary", () => {
  it("shows 7-day values large and 30-day values underneath, rounding spend and keeping cost per lead exact", () => {
    render(
      <AdsSummary
        last7={{ spendRupees: 12345.6, impressions: 1, clicks: 1200, leads: 50, costPerLeadRupees: 246.91 }}
        last30={{ spendRupees: 50000, impressions: 1, clicks: 4000, leads: 0 }}
      />,
    );
    expect(screen.getByText("₹12,346")).toBeInTheDocument();
    expect(screen.getByText("₹246.91")).toBeInTheDocument();
    expect(screen.getByText("₹50,000 · 30 days")).toBeInTheDocument();
    expect(screen.getByText("— · 30 days")).toBeInTheDocument();
    expect(screen.getByText("1,200")).toBeInTheDocument();
  });
});
