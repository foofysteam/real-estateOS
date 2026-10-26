import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const updateFieldsAction = vi.hoisted(() => vi.fn());
vi.mock("@/app/(app)/leads/[id]/actions", () => ({ updateFieldsAction }));

const { EditFieldsSheet } = await import("@/app/(app)/leads/[id]/edit-fields-sheet");

afterEach(cleanup);

const lead = { id: "l1", name: "Rohan", email: null, budgetRupees: null, configuration: null, locality: null, projectId: null };

describe("EditFieldsSheet", () => {
  it("shows a budget failure under the Budget field and keeps the sheet open", async () => {
    updateFieldsAction.mockResolvedValue({ ok: false, error: "Budget too large", field: "budget" });
    render(<EditFieldsSheet lead={lead} projects={[]} />);
    await userEvent.click(screen.getByRole("button", { name: /edit/i }));
    await userEvent.type(screen.getByLabelText("Budget"), "300Cr");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(updateFieldsAction).toHaveBeenCalledWith("l1", { budget: "300Cr" });
    const budget = screen.getByLabelText("Budget");
    expect(budget).toHaveAttribute("aria-invalid", "true");
    expect(document.getElementById("edit-budget-error")).toHaveTextContent("Budget too large");
    expect(screen.getAllByRole("alert")).toHaveLength(1);
  });
});
