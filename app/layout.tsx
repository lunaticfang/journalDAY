import "./globals.css";
import type { Metadata, Viewport } from "next";
import Link from "next/link";
import MainNav from "./components/MainNav";
import {
  SITE_DESCRIPTION,
  SITE_NAME,
  getSiteUrl,
  toAbsoluteUrl,
} from "../lib/seo";

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  applicationName: SITE_NAME,
  title: {
    default: SITE_NAME,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  icons: {
    icon: "/updaytes-favicon.svg",
    shortcut: "/updaytes-favicon.svg",
    apple: "/updaytes-favicon.svg",
  },
  keywords: [
    "journal",
    "peer-reviewed journal",
    "academic journal",
    "research publication",
    "scholarly article",
    "medical journal",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    url: getSiteUrl(),
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    images: [
      {
        url: toAbsoluteUrl("/Website Banner.jpg"),
        width: 1200,
        height: 630,
        alt: `${SITE_NAME} banner`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    images: [toAbsoluteUrl("/Website Banner.jpg")],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#6A3291",
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
              <Link
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
              </Link>

              <MainNav />
            </div>
          </header>

          <main
            style={{
              flex: 1,
              padding: "32px 16px 40px",
            }}
          >
            <div style={{ maxWidth: 1120, margin: "0 auto" }}>{children}</div>
          </main>

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

