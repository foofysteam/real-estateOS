import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PipelineBoard } from "@/app/(app)/pipeline/pipeline-board";
import type { PipelineColumn } from "@/lib/leads/queries";

afterEach(cleanup);

const lead = (id: string, name: string, stage: PipelineColumn["stage"]) => ({
  id,
  name,
  stage,
  score: 72,
  budgetRupees: 4500000,
  nextFollowUpAt: null,
  owner: { name: "Asha Rao" },
  project: { name: "Krishvi Triple One" },
});

const cols: PipelineColumn[] = [
  { stage: "NEW", count: 2, totalBudgetRupees: 9000000, leads: [lead("l1", "Rohan Mehta", "NEW"), lead("l2", "Priya Shah", "NEW")] },
  { stage: "CONTACTED", count: 0, totalBudgetRupees: 0, leads: [] },
  { stage: "QUALIFIED", count: 3, totalBudgetRupees: 4500000, leads: [lead("l3", "Kiran Rao", "QUALIFIED")] },
];

describe("PipelineBoard", () => {
  it("renders a column per stage with count headers", () => {
    render(<PipelineBoard columns={cols} onMove={vi.fn()} />);
    expect(screen.getByRole("heading", { name: /new/i })).toHaveTextContent("2");
    expect(screen.getByRole("heading", { name: /new/i })).toHaveTextContent("₹90L");
    expect(screen.getByRole("heading", { name: /contacted/i })).toHaveTextContent("0");
    expect(screen.getByRole("link", { name: /rohan mehta/i })).toHaveAttribute("href", "/leads/l1");
    expect(screen.getByText("+2 more")).toBeInTheDocument();
  });

  it("Move sheet offers legal stages and calls onMove", async () => {
    const onMove = vi.fn();
    render(<PipelineBoard columns={cols} onMove={onMove} />);
    await userEvent.click(screen.getAllByRole("button", { name: /move/i })[0]);
    expect(screen.queryByRole("button", { name: "New" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Qualified" }));
    expect(onMove).toHaveBeenCalledWith(cols[0].leads[0].id, "QUALIFIED");
  });

  it("asks for a reason before moving to Lost", async () => {
    const onMove = vi.fn().mockResolvedValue({ ok: true });
    render(<PipelineBoard columns={cols} onMove={onMove} />);
    await userEvent.click(screen.getAllByRole("button", { name: /move/i })[0]);
    await userEvent.click(screen.getByRole("button", { name: "Lost" }));
    await userEvent.click(screen.getByRole("button", { name: /mark as lost/i }));
    expect(onMove).not.toHaveBeenCalled();
    await userEvent.type(screen.getByLabelText(/reason/i), "Budget");
    await userEvent.click(screen.getByRole("button", { name: /mark as lost/i }));
    expect(onMove).toHaveBeenCalledWith("l1", "LOST", "Budget");
  });

  it("moves the card at once and reverts with an alert when the server refuses", async () => {
    let resolve!: (r: { ok: false; error: string }) => void;
    const onMove = vi.fn(() => new Promise<{ ok: false; error: string }>((r) => (resolve = r)));
    render(<PipelineBoard columns={cols} onMove={onMove} />);
    await userEvent.click(screen.getAllByRole("button", { name: /move/i })[0]);
    await userEvent.click(screen.getByRole("button", { name: "Qualified" }));
    const qualified = () => screen.getByRole("region", { name: /qualified/i });
    expect(within(qualified()).getByText("Rohan Mehta")).toBeInTheDocument();
    resolve({ ok: false, error: "Cannot move from New to Qualified" });
    expect(await screen.findByRole("alert")).toHaveTextContent("Cannot move from New to Qualified");
    await waitFor(() => expect(within(qualified()).queryByText("Rohan Mehta")).not.toBeInTheDocument());
    expect(within(screen.getByRole("region", { name: /new/i })).getByText("Rohan Mehta")).toBeInTheDocument();
  });

  it("shows an empty state when there are no leads", () => {
    render(<PipelineBoard columns={cols.map((c) => ({ ...c, count: 0, totalBudgetRupees: 0, leads: [] }))} onMove={vi.fn()} />);
    expect(screen.getByText("No leads yet.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Add a lead" })).toHaveAttribute("href", "/leads");
  });
});
