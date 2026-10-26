import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { StageBadge } from "@/components/leads/stage-badge";

afterEach(cleanup);

describe("StageBadge", () => {
  it("renders the human label and stage data attribute", () => {
    render(<StageBadge stage="SITE_VISIT_SCHEDULED" />);
    expect(screen.getByText("Site visit scheduled")).toHaveAttribute("data-stage", "SITE_VISIT_SCHEDULED");
  });
});
