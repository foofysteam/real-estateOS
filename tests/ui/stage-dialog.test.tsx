import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StageDialog } from "@/app/(app)/leads/[id]/stage-dialog";

afterEach(cleanup);

describe("StageDialog", () => {
  it("offers only legal transitions from QUALIFIED", async () => {
    render(<StageDialog current="QUALIFIED" open onSubmit={vi.fn()} />);
    const names = screen.getAllByRole("option").map((o) => o.textContent);
    expect(names).toContain("Contacted");
    expect(names).not.toContain("New");
    expect(names).not.toContain("Qualified");
    expect(names).toContain("Lost");
  });

  it("offers only New from LOST", () => {
    render(<StageDialog current="LOST" open onSubmit={vi.fn()} />);
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(["New"]);
  });

  it("requires a reason for LOST and submits it", async () => {
    const onSubmit = vi.fn();
    render(<StageDialog current="NEW" open onSubmit={onSubmit} />);
    await userEvent.selectOptions(screen.getByRole("listbox"), "LOST");
    await userEvent.click(screen.getByRole("button", { name: /move/i }));
    expect(onSubmit).not.toHaveBeenCalled();
    await userEvent.type(screen.getByLabelText(/reason/i), "Budget");
    await userEvent.click(screen.getByRole("button", { name: /move/i }));
    expect(onSubmit).toHaveBeenCalledWith("LOST", "Budget");
  });

  it("submits a non-LOST stage without a reason", async () => {
    const onSubmit = vi.fn();
    render(<StageDialog current="NEW" open onSubmit={onSubmit} />);
    await userEvent.selectOptions(screen.getByRole("listbox"), "QUALIFIED");
    expect(screen.queryByLabelText(/reason/i)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /move/i }));
    expect(onSubmit).toHaveBeenCalledWith("QUALIFIED", undefined);
  });
});
