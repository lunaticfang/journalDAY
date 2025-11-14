// app/page.tsx

export default function HomePage() {
  return (
    <main
      style={{
        maxWidth: "900px",
        margin: "0 auto",
        padding: "48px 24px",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <h1
        style={{
          fontSize: "32px",
          fontWeight: 700,
          marginBottom: "16px",
          color: "#111827",
        }}
      >
        Welcome to JournalDAY
      </h1>

      <p
        style={{
          fontSize: "17px",
          lineHeight: 1.6,
          color: "#374151",
          maxWidth: "600px",
        }}
      >
        Dev mode is ready.&nbsp;
        <a
          href="/admin"
          style={{
            color: "#2563eb",
            textDecoration: "none",
            fontWeight: 500,
          }}
        >
          Go to Admin →
        </a>
      </p>
    </main>
  );
}
