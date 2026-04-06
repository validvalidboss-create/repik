"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="uk">
      <body>
        <main style={{ padding: 24, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial" }}>
          <h1 style={{ fontSize: 22, fontWeight: 600, marginBottom: 12 }}>Сталася помилка</h1>
          <p style={{ marginBottom: 12, color: "#444" }}>Спробуйте перезавантажити сторінку.</p>
          <pre
            style={{
              fontSize: 12,
              whiteSpace: "pre-wrap",
              padding: 12,
              background: "#fef2f2",
              border: "1px solid #fecaca",
              color: "#991b1b",
              borderRadius: 8,
              marginBottom: 12,
            }}
          >
            {String(error?.message || error)}
          </pre>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              background: "#000",
              color: "#fff",
              border: 0,
              padding: "10px 14px",
              borderRadius: 10,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Спробувати ще раз
          </button>
        </main>
      </body>
    </html>
  );
}
