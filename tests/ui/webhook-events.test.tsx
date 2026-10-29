import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const retryWebhookEventAction = vi.hoisted(() => vi.fn());
const retryAllFailedAction = vi.hoisted(() => vi.fn());
vi.mock("@/app/(app)/settings/actions", () => ({ retryWebhookEventAction, retryAllFailedAction }));

const { WebhookEvents } = await import("@/app/(app)/settings/integrations/webhook-events");

afterEach(() => {
  cleanup();
  retryWebhookEventAction.mockReset();
  retryAllFailedAction.mockReset();
});

const events = [
  { id: "e1", externalId: "L1", status: "FAILED" as const, error: "No Meta access token configured", receivedAt: new Date("2026-10-26T05:00:00Z") },
];

describe("WebhookEvents", () => {
  it("shows the empty state when nothing failed", () => {
    render(<WebhookEvents events={[]} />);
    expect(screen.getByText("No failed deliveries.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Retry all" })).not.toBeInTheDocument();
  });

  it("retries one event and reports a still-failing retry inline", async () => {
    retryWebhookEventAction.mockResolvedValue({ ok: true, status: "FAILED" });
    render(<WebhookEvents events={events} />);
    expect(screen.getAllByText("No Meta access token configured").length).toBeGreaterThan(0);
    await userEvent.click(screen.getAllByRole("button", { name: "Retry lead L1" })[0]);
    expect(retryWebhookEventAction).toHaveBeenCalledWith("e1");
    expect(await screen.findByRole("alert")).toHaveTextContent(/still failing/i);
  });

  it("retries all and shows a summary", async () => {
    retryAllFailedAction.mockResolvedValue({ ok: true, retried: 1, processed: 1, failed: 0 });
    render(<WebhookEvents events={events} />);
    await userEvent.click(screen.getByRole("button", { name: "Retry all" }));
    expect(await screen.findByRole("status")).toHaveTextContent("1 of 1 imported");
  });

  it("shows stuck rows without a Retry button", () => {
    render(
      <WebhookEvents
        events={[{ id: "e2", externalId: "L2", status: "PROCESSING", error: null, receivedAt: new Date("2026-10-26T05:00:00Z") }]}
      />,
    );
    expect(screen.queryByRole("button", { name: /retry/i })).not.toBeInTheDocument();
    expect(screen.getAllByText("Waiting on a redelivery or a later sweep").length).toBeGreaterThan(0);
  });

  it("disables per-row Retry while Retry all is pending", async () => {
    let finish!: (v: unknown) => void;
    retryAllFailedAction.mockReturnValue(new Promise((r) => (finish = r)));
    render(<WebhookEvents events={events} />);
    await userEvent.click(screen.getByRole("button", { name: "Retry all" }));
    for (const b of screen.getAllByRole("button", { name: "Retry lead L1" })) expect(b).toBeDisabled();
    finish({ ok: true, retried: 1, processed: 1, failed: 0 });
    expect(await screen.findByRole("status")).toHaveTextContent("1 of 1 imported");
    for (const b of screen.getAllByRole("button", { name: "Retry lead L1" })) expect(b).toBeEnabled();
  });
});
