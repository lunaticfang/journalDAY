// app/layout.tsx
import "./globals.css";
import MainNav from "./components/MainNav";

export const metadata = {
  title: "JournalDAY",
  description: "Online journal platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily:
            "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          backgroundColor: "#f9fafb",
          color: "#111827",
        }}
      >
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Top navigation header */}
          <header
            style={{
              position: "sticky",
              top: 0,
              zIndex: 20,
              backdropFilter: "blur(10px)",
              backgroundColor: "rgba(255,255,255,0.9)",
              borderBottom: "1px solid #e5e7eb",
            }}
          >
            <div
              style={{
                maxWidth: 1120,
                margin: "0 auto",
                padding: "12px 20px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              {/* Brand */}
              <a
                href="/"
                style={{
                  fontSize: 20,
                  fontWeight: 700,
                  letterSpacing: "0.03em",
                  textDecoration: "none",
                  color: "#111827",
                }}
              >
                UpDAYtes
              </a>

              {/* Client-side navigation */}
              <MainNav />
            </div>
          </header>

          {/* Main content */}
          <main
            style={{
              flex: 1,
              padding: "32px 16px 40px",
            }}
          >
            <div style={{ maxWidth: 1120, margin: "0 auto" }}>{children}</div>
          </main>

          {/* Footer */}
          <footer
            style={{
              borderTop: "1px solid #e5e7eb",
              padding: "12px 20px",
              fontSize: 12,
              color: "#6b7280",
            }}
          >
            <div style={{ maxWidth: 1120, margin: "0 auto" }}>
              © {new Date().getFullYear()} UpDAYtes · All rights reserved.
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
