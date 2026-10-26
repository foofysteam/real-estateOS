import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { Timeline, type TimelineEvent } from "@/app/(app)/leads/[id]/timeline";

afterEach(cleanup);

const t0 = new Date("2026-10-20T04:30:00Z");
const t1 = new Date("2026-10-21T04:30:00Z");
const t2 = new Date("2026-10-22T04:30:00Z");
const actor = { id: "u1", name: "Priya" };

function event(id: string, createdAt: Date, type: TimelineEvent["type"], payload: unknown, who = actor): TimelineEvent {
  return { id, leadId: "l1", actorId: who?.id ?? null, type, payload: payload as TimelineEvent["payload"], createdAt, actor: who };
}

const created = (t: Date) => event("e0", t, "CREATED", { source: "WEBSITE" }, null as never);
const stageChanged = (t: Date, from: string, to: string) => event("e1", t, "STAGE_CHANGED", { from, to });
const note = (t: Date, text: string) => event("e2", t, "NOTE_ADDED", { text });

describe("Timeline", () => {
  it("renders one sentence per event type, newest first", () => {
    render(<Timeline events={[created(t0), stageChanged(t1, "NEW", "QUALIFIED"), note(t2, "Likes 3BHK")]} />);
    const items = screen.getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("Likes 3BHK");
    expect(items[1]).toHaveTextContent("New → Qualified");
    expect(items[2]).toHaveTextContent(/created/i);
  });

  it("shows actor or System and the IST timestamp", () => {
    render(<Timeline events={[created(t0), note(t2, "Hi")]} />);
    const items = screen.getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("Priya");
    expect(items[0]).toHaveTextContent("22 Oct, 10:00 am");
    expect(items[1]).toHaveTextContent("Lead created from Website");
    expect(items[1]).toHaveTextContent("System");
  });

  it("describes the remaining event types", () => {
    render(
      <Timeline
        events={[
          event("a", t0, "ASSIGNED", { from: null, to: "u1" }),
          event("b", t0, "STAGE_CHANGED", { from: "NEW", to: "LOST", lostReason: "Budget" }),
          event("c", t0, "CONTACT_LOGGED", { channel: "WHATSAPP" }),
          event("d", t0, "SCORE_CHANGED", { from: 20, to: 45 }),
          event("e", t0, "FIELD_UPDATED", { fields: ["budgetRupees", "locality"] }),
          event("f", t0, "FOLLOW_UP_COMPLETED", { followUpId: "x" }),
          event("g", t0, "DUPLICATE_INBOUND", { source: "META_LEAD_AD" }),
          event("h", t0, "FOLLOW_UP_SCHEDULED", { dueAt: t1.toISOString(), channel: "CALL" }),
          event("i", t0, "ASSIGNED", { from: "u1", to: null }),
        ]}
        userNames={{ u1: "Priya" }}
      />,
    );
    const text = screen.getByRole("list").textContent;
    expect(text).toContain("New → Lost · Budget");
    expect(text).toContain("Contacted via WhatsApp");
    expect(text).toContain("Score 20 → 45");
    expect(text).toContain("Updated budget, locality");
    expect(text).toContain("Follow-up completed");
    expect(text).toContain("Duplicate inbound from Meta lead ad");
    expect(text).toContain("Follow-up scheduled · Call · 21 Oct, 10:00 am");
    expect(text).toContain("Unassigned");
    expect(text).toContain("Assigned to Priya");
  });
});
