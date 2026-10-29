import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AppError from "@/app/(app)/error";

afterEach(cleanup);

describe("app error boundary", () => {
  it("shows the digest, retries and links to Today", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const retry = vi.fn();
    render(<AppError error={Object.assign(new Error("x"), { digest: "abc123" })} retry={retry} />);
    expect(screen.getByRole("heading", { name: "Something went wrong" })).toBeInTheDocument();
    expect(screen.getByText("abc123")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(retry).toHaveBeenCalled();
    expect(screen.getByRole("link", { name: /today/i })).toHaveAttribute("href", "/today");
    vi.mocked(console.error).mockRestore();
  });

  it("falls back to reset when retry is absent", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const reset = vi.fn();
    render(<AppError error="boom" reset={reset} />);
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(reset).toHaveBeenCalled();
    vi.mocked(console.error).mockRestore();
  });
});
