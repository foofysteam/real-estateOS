import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LoginForm } from "@/app/login/login-form";

afterEach(cleanup);

describe("LoginForm", () => {
  it("shows the server error and keeps the email", async () => {
    const action = vi.fn(async () => ({ error: "Invalid credentials" }));
    render(<LoginForm action={action} />);
    await userEvent.type(screen.getByLabelText(/email/i), "a@b.c");
    await userEvent.type(screen.getByLabelText(/password/i), "x");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid credentials");
    expect(screen.getByLabelText(/email/i)).toHaveValue("a@b.c");
  });
});
