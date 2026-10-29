import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { Badge } from "@/components/ui/badge";

afterEach(cleanup);

describe("Badge", () => {
  it("success tone uses the AA tone tokens (class contract)", () => {
    render(<Badge tone="success">Paid</Badge>);
    const el = screen.getByText("Paid");
    expect(el.className).toMatch(/\bbg-tone-success-bg\b/);
    expect(el.className).toMatch(/\btext-tone-success-fg\b/);
  });
});
