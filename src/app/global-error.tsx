"use client";

/** Last-resort fallback when the root layout itself fails: no app styles are available, so styles are inline. */
export default function GlobalError({ error, retry, reset }: { error: unknown; retry?: () => void; reset?: () => void }) {
  const digest = error instanceof Error && "digest" in error && typeof error.digest === "string" ? error.digest : null;
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, sans-serif",
          background: "#f8fafc",
          color: "#0f172a",
          padding: "16px",
        }}
      >
        <title>Something went wrong · Sales OS</title>
        <main style={{ maxWidth: 420, textAlign: "center" }}>
          <h1 style={{ fontSize: 20, margin: "0 0 8px" }}>Something went wrong</h1>
          <p style={{ fontSize: 14, color: "#475569", margin: "0 0 16px" }}>Sales OS hit an unexpected error.</p>
          {digest && <p style={{ fontSize: 12, color: "#475569", margin: "0 0 16px" }}>Error reference: {digest}</p>}
          <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
            <button
              type="button"
              onClick={() => (retry ?? reset)?.()}
              style={{ minHeight: 44, padding: "0 16px", borderRadius: 6, border: 0, background: "#2563eb", color: "#fff", fontSize: 14 }}
            >
              Try again
            </button>
            <a
              href="/today"
              style={{ minHeight: 44, padding: "0 16px", borderRadius: 6, border: "1px solid #cbd5e1", color: "#0f172a", fontSize: 14, display: "inline-flex", alignItems: "center", textDecoration: "none" }}
            >
              Go to Today
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}
