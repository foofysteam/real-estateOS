import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const createIngestKeyAction = vi.hoisted(() => vi.fn());
const revokeIngestKeyAction = vi.hoisted(() => vi.fn());
vi.mock("@/app/(app)/settings/actions", () => ({ createIngestKeyAction, revokeIngestKeyAction }));

const { IngestKeys } = await import("@/app/(app)/settings/integrations/ingest-keys");

afterEach(() => {
  cleanup();
  createIngestKeyAction.mockReset();
  revokeIngestKeyAction.mockReset();
});

const keys = [
  {
    id: "k1",
    name: "Website form",
    source: "WEBSITE" as const,
    isActive: true,
    lastUsedAt: null,
    createdAt: new Date("2026-10-01T10:00:00Z"),
  },
];

describe("IngestKeys", () => {
  it("shows a new key's plaintext once with a Copy button, then forgets it", async () => {
    createIngestKeyAction.mockResolvedValue({ ok: true, id: "k2", plaintext: "sk_live_abc123" });
    render(<IngestKeys keys={keys} />);

    await userEvent.click(screen.getByRole("button", { name: "New key" }));
    const dialog = screen.getByRole("dialog");
    await userEvent.type(within(dialog).getByLabelText("Name"), "Housing feed");
    await userEvent.selectOptions(within(dialog).getByLabelText("Source"), "PORTAL_HOUSING");
    await userEvent.click(within(dialog).getByRole("button", { name: "Create key" }));

    expect(createIngestKeyAction).toHaveBeenCalledWith("Housing feed", "PORTAL_HOUSING");
    expect(await screen.findByLabelText("Ingest key")).toHaveValue("sk_live_abc123");
    expect(screen.getByRole("button", { name: "Copy key" })).toBeInTheDocument();
    expect(screen.getByText("Shown once. Store it in your website/CRM integration.")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Done" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.queryByDisplayValue("sk_live_abc123")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "New key" }));
    expect(screen.queryByLabelText("Ingest key")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toHaveValue("");
  });

  it("keeps the form open with the error when creation fails", async () => {
    createIngestKeyAction.mockResolvedValue({ ok: false, error: "Check the highlighted fields", fieldErrors: { name: "Required" } });
    render(<IngestKeys keys={[]} />);
    await userEvent.click(screen.getByRole("button", { name: "New key" }));
    await userEvent.type(screen.getByLabelText("Name"), "X");
    await userEvent.click(screen.getByRole("button", { name: "Create key" }));
    expect(await screen.findByText("Required")).toBeInTheDocument();
    expect(screen.queryByLabelText("Ingest key")).not.toBeInTheDocument();
  });

  it("revokes a key after confirmation", async () => {
    revokeIngestKeyAction.mockResolvedValue({ ok: true });
    render(<IngestKeys keys={keys} />);
    await userEvent.click(screen.getAllByRole("button", { name: "Revoke Website form" })[0]);
    expect(revokeIngestKeyAction).not.toHaveBeenCalled();
    await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Revoke key" }));
    expect(revokeIngestKeyAction).toHaveBeenCalledWith("k1");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
});
