// app/layout.tsx
import "./globals.css";

export const metadata = {
  title: "JournalDAY",
  description: "A simple journal site",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
          <header style={{ padding: 16, borderBottom: "1px solid #e5e7eb" }}>
            <a href="/" style={{ fontWeight: 700, fontSize: 18 }}>
              JournalDAY
            </a>
          </header>
          <main style={{ flex: 1, padding: 20 }}>{children}</main>
          <footer style={{ padding: 12, textAlign: "center", borderTop: "1px solid #e5e7eb" }}>
            © {new Date().getFullYear()} JournalDAY
          </footer>
        </div>
      </body>
    </html>
  );
}
