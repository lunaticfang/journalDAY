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
      <body className="site-body">
        <div className="site-root">
          <header className="site-header">
            <div className="site-shell site-header__inner">
              <Link href="/" className="site-brand">
                UpDAYtes
              </Link>

              <MainNav />
            </div>
          </header>

          <main className="site-main">
            <div className="site-shell">{children}</div>
          </main>

          <footer className="site-footer">
            <div className="site-shell">
              Copyright {new Date().getFullYear()} UpDAYtes. All rights reserved.
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
