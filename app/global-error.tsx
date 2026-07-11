"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[global-error]", error);
  }, [error]);

  return (
    <html lang="en">
      <body className="antialiased">
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem", fontFamily: "system-ui, sans-serif" }}>
          <div style={{ maxWidth: "24rem", textAlign: "center" }}>
            <h1 style={{ fontSize: "1.25rem", fontWeight: 600, color: "#111827" }}>
              Something went wrong
            </h1>
            <p style={{ marginTop: "0.5rem", fontSize: "0.875rem", color: "#6b7280" }}>
              An unexpected error occurred. Please try again.
            </p>
            {error.digest && (
              <p style={{ marginTop: "0.75rem", fontFamily: "monospace", fontSize: "0.6875rem", color: "#6b7280" }}>
                Error ID: {error.digest}
              </p>
            )}
            <button
              onClick={reset}
              style={{ marginTop: "1.25rem", cursor: "pointer", borderRadius: "0.5rem", backgroundColor: "#111827", color: "#fff", padding: "0.625rem 1.25rem", fontSize: "0.875rem", fontWeight: 500, border: "none" }}
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
