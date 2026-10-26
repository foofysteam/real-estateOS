import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GENERIC_ERROR, useAction } from "@/app/(app)/leads/[id]/use-action";
import type { ActionResult } from "@/app/(app)/leads/[id]/actions";

afterEach(cleanup);

function Harness({ action, onOk, onResult }: { action: () => Promise<ActionResult>; onOk: () => void; onResult: (r: ActionResult) => void }) {
  const { error, run } = useAction();
  return (
    <>
      <button onClick={() => run(action, onOk).then(onResult)}>Go</button>
      {error && <p role="alert">{error}</p>}
    </>
  );
}

describe("useAction", () => {
  it("turns a rejected action into a generic error without throwing", async () => {
    const onOk = vi.fn();
    const onResult = vi.fn();
    render(<Harness action={() => Promise.reject(new TypeError("Failed to fetch"))} onOk={onOk} onResult={onResult} />);
    await userEvent.click(screen.getByRole("button", { name: "Go" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(GENERIC_ERROR);
    await waitFor(() => expect(onResult).toHaveBeenCalledWith({ ok: false, error: GENERIC_ERROR }));
    expect(onOk).not.toHaveBeenCalled();
  });

  it("shows the action's own error and calls onOk on success", async () => {
    const onOk = vi.fn();
    const failing = render(<Harness action={async () => ({ ok: false, error: "Nope" })} onOk={onOk} onResult={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Go" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Nope");
    failing.unmount();
    render(<Harness action={async () => ({ ok: true })} onOk={onOk} onResult={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Go" }));
    await waitFor(() => expect(onOk).toHaveBeenCalledOnce());
  });
});
