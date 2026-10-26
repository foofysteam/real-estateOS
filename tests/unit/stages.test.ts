import { describe, it, expect } from "vitest";
import { STAGE_ORDER, canTransition, isTerminal } from "@/lib/stages";

describe("stages", () => {
  it("allows forward jumps of any size", () => expect(canTransition("NEW", "NEGOTIATION")).toBe(true));

  it("allows exactly one step back", () => {
    expect(canTransition("QUALIFIED", "CONTACTED")).toBe(true);
    expect(canTransition("QUALIFIED", "NEW")).toBe(false);
  });

  it("allows LOST from anywhere and only NEW from LOST", () => {
    expect(canTransition("BOOKED", "LOST")).toBe(true);
    expect(canTransition("LOST", "NEW")).toBe(true);
    expect(canTransition("LOST", "QUALIFIED")).toBe(false);
  });

  it("BOOKED is terminal except LOST", () => {
    expect(canTransition("BOOKED", "NEGOTIATION")).toBe(false);
    expect(isTerminal("BOOKED")).toBe(true);
    expect(isTerminal("LOST")).toBe(true);
    expect(isTerminal("NEW")).toBe(false);
  });

  it("STAGE_ORDER has 8 stages ending in BOOKED, LOST", () => {
    expect(STAGE_ORDER).toHaveLength(8);
    expect(STAGE_ORDER.slice(-2)).toEqual(["BOOKED", "LOST"]);
  });
});
