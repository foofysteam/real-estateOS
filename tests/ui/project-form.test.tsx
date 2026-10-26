import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const createProjectAction = vi.hoisted(() => vi.fn());
vi.mock("@/app/(app)/settings/actions", () => ({ createProjectAction, updateProjectAction: vi.fn() }));

const { ProjectForm } = await import("@/app/(app)/settings/projects/project-form");

afterEach(() => {
  cleanup();
  createProjectAction.mockReset();
});

async function fill(values: Record<string, string>) {
  for (const [label, value] of Object.entries(values)) {
    await userEvent.type(screen.getByLabelText(label), value);
  }
}

describe("ProjectForm", () => {
  it("shows a field error under price when min > max", async () => {
    createProjectAction.mockResolvedValue({
      ok: false,
      error: "Check the highlighted fields",
      fieldErrors: { priceMax: "Max must be at least Min" },
    });
    const onSaved = vi.fn();
    render(<ProjectForm onSaved={onSaved} />);
    await fill({ Name: "K", Slug: "k", City: "Bengaluru", "Min price": "1Cr", "Max price": "80L" });
    await userEvent.click(screen.getByRole("button", { name: /create project/i }));

    expect(createProjectAction).toHaveBeenCalledWith({ name: "K", slug: "k", city: "Bengaluru", priceMin: "1Cr", priceMax: "80L" });
    const max = screen.getByLabelText("Max price");
    expect(max).toHaveAttribute("aria-invalid", "true");
    expect(max).toHaveAccessibleDescription(expect.stringContaining("Max must be at least Min"));
    expect(screen.getByLabelText("Min price")).not.toHaveAttribute("aria-invalid", "true");
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("prefills an existing project and calls onSaved on success", async () => {
    const updateAction = vi.mocked((await import("@/app/(app)/settings/actions")).updateProjectAction);
    updateAction.mockResolvedValue({ ok: true });
    const onSaved = vi.fn();
    render(
      <ProjectForm
        project={{ id: "p1", name: "K", slug: "k", city: "Pune", priceMinRupees: 8000000, priceMaxRupees: 16000000 }}
        onSaved={onSaved}
      />,
    );
    expect(screen.getByLabelText("Min price")).toHaveValue("80L");
    expect(screen.getByLabelText("Max price")).toHaveValue("1.6Cr");
    await userEvent.click(screen.getByRole("button", { name: /save/i }));
    expect(updateAction).toHaveBeenCalledWith("p1", { name: "K", slug: "k", city: "Pune", priceMin: "80L", priceMax: "1.6Cr" });
    expect(onSaved).toHaveBeenCalled();
  });
});
