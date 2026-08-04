"use client";

// Last-resort boundary: catches failures in the root layout itself, which
// app/error.tsx cannot because it renders *inside* that layout. It must supply
// its own <html>/<body>, so the theme attribute and palette have to be restated
// here rather than inherited.
//
// Styles are inline for the same reason Next's own fallback inlines them: if the
// root layout failed, we can't assume the stylesheet or font variables loaded.
// The one thing we don't copy from Next's fallback is its prefers-color-scheme
// body reset -- this app's theme is attribute-driven so the in-app toggle can
// override the OS, and keying off the OS here would contradict every other page.
// Defaulting to the dark palette matches the SSR default in app/layout.tsx.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en" data-theme="dark">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          background: "#100e0b",
          color: "#f3f1ea",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
        }}
      >
        <main style={{ maxWidth: "40rem", margin: "0 auto", padding: "6rem 1.5rem" }}>
          <p style={{ fontSize: "0.875rem", color: "#a1a1aa", margin: 0 }}>
            Something went wrong
          </p>
          <h1
            style={{
              fontSize: "1.875rem",
              fontWeight: 600,
              letterSpacing: "-0.01em",
              margin: "0.5rem 0 0",
            }}
          >
            Optimize failed to start
          </h1>
          <p style={{ color: "#c3c2b7", lineHeight: 1.6, marginTop: "0.75rem" }}>
            This is an application-level error rather than a problem with a
            particular scenario. Reloading usually clears it.
          </p>
          <div style={{ display: "flex", gap: "0.75rem", marginTop: "2rem" }}>
            <button
              type="button"
              onClick={reset}
              style={{
                minHeight: "2.75rem",
                borderRadius: "9999px",
                border: "none",
                background: "#ec7c3d",
                color: "#1a0f06",
                padding: "0.625rem 1.25rem",
                fontSize: "0.875rem",
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Try again
            </button>
            {/* A plain <a>, not next/link, on purpose: this boundary catches a
                failure in the root layout and renders its own <html>/<body>
                outside the router, so router-dependent navigation is the last
                thing to rely on here. A full document load is what we want. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a
              href="/"
              style={{
                minHeight: "2.75rem",
                display: "inline-flex",
                alignItems: "center",
                borderRadius: "9999px",
                border: "1px solid #3f3f46",
                color: "#f3f1ea",
                padding: "0.625rem 1.25rem",
                fontSize: "0.875rem",
                fontWeight: 500,
                textDecoration: "none",
              }}
            >
              Go to the home page
            </a>
          </div>
          {error.digest && (
            <p style={{ fontSize: "0.75rem", color: "#a1a1aa", marginTop: "2rem" }}>
              Reference: {error.digest}
            </p>
          )}
        </main>
      </body>
    </html>
  );
}
