// app/page.tsx
export default function HomePage() {
  return (
    <main style={{ maxWidth: 900, margin: "0 auto" }}>
      <h1 style={{ fontSize: 28, marginBottom: 12 }}>Welcome to JournalDAY</h1>
      <p style={{ color: "#374151" }}>
        Dev mode is ready. Visit <a href="/admin">/admin</a> to manage issues.
      </p>
    </main>
  );
}
