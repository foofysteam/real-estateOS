import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LeadFilters } from "@/app/(app)/leads/lead-filters";

afterEach(cleanup);

// Radix Select needs pointer-capture and scrollIntoView, which jsdom lacks.
beforeAll(() => {
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.setPointerCapture ??= () => {};
  Element.prototype.releasePointerCapture ??= () => {};
  Element.prototype.scrollIntoView ??= () => {};
});

const owners = [{ id: "u_1", name: "Asha" }];
const projects = [{ id: "p_1", name: "Krishvi Triple One" }];

describe("LeadFilters", () => {
  it("calls onChange with the chosen stage", async () => {
    const onChange = vi.fn();
    render(<LeadFilters filters={{ sort: "created" }} owners={owners} projects={projects} onChange={onChange} />);
    await userEvent.click(screen.getByRole("combobox", { name: "Stage" }));
    await userEvent.click(await screen.findByRole("option", { name: "Qualified" }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ stage: "QUALIFIED" }));
  });

  it("clears a filter when All is chosen", async () => {
    const onChange = vi.fn();
    render(
      <LeadFilters filters={{ sort: "created", stage: "NEW" }} owners={owners} projects={projects} onChange={onChange} />,
    );
    await userEvent.click(screen.getByRole("combobox", { name: "Stage" }));
    await userEvent.click(await screen.findByRole("option", { name: "All stages" }));
    expect(onChange).toHaveBeenCalledWith({ sort: "created" });
  });

  it("submits the search query", async () => {
    const onChange = vi.fn();
    render(<LeadFilters filters={{ sort: "created" }} owners={owners} projects={projects} onChange={onChange} />);
    await userEvent.type(screen.getByRole("searchbox", { name: "Search leads" }), "roh{Enter}");
    expect(onChange).toHaveBeenLastCalledWith({ sort: "created", q: "roh" });
  });
});
