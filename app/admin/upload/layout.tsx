import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
//import "./globals.css";

// Font setup (Geist Sans + Mono)
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Metadata for the site
export const metadata: Metadata = {
  title: "JournalDAY",
  description: "A modern journal platform built with Next.js + Supabase",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen bg-white text-gray-900`}
      >
        {/* App wrapper */}
        <div className="flex flex-col min-h-screen">
          <header className="w-full border-b bg-gray-50 px-6 py-4">
            <h1 className="text-2xl font-bold tracking-tight text-gray-800">
              JournalDAY
            </h1>
          </header>

          <main className="flex-1 p-6">{children}</main>

          <footer className="border-t text-center text-sm text-gray-500 py-4">
            © {new Date().getFullYear()} JournalDAY
          </footer>
        </div>
      </body>
    </html>
  );
}
