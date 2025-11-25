// app/components/Header.tsx
"use client";

import Link from "next/link";

export default function Header() {
  return (
    <header className="bg-white">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
        {/* Logo area */}
        <div className="flex items-center gap-4">
          <div className="flex items-center">
            <img src="/logo-japi.png" alt="JAPI" className="h-12 w-auto object-contain" />
          </div>
          <div className="hidden sm:block text-sm text-gray-600">
            <div className="font-medium">Journal of</div>
            <div className="text-xs">The Association of Physicians of India</div>
          </div>
        </div>

        {/* Center nav */}
        <nav className="hidden md:flex gap-8 text-sm">
          <Link href="/" className="text-gray-700 hover:text-gray-900">Home</Link>
          <Link href="/about" className="text-gray-700 hover:text-gray-900">About</Link>
          <Link href="/current" className="text-gray-700 hover:text-gray-900">Current</Link>
          <Link href="/archive" className="text-gray-700 hover:text-gray-900">Archive</Link>
          <Link href="/podcast" className="text-gray-700 hover:text-gray-900">Podcast</Link>
          <Link href="/instructions" className="text-gray-700 hover:text-gray-900">Instructions</Link>
        </nav>

        {/* CTA and seal */}
        <div className="flex items-center gap-4">
          <Link href="/submit" className="hidden md:inline-block bg-gray-700 text-white px-4 py-2 text-sm rounded hover:bg-gray-800">
            Submit an Article
          </Link>

          <div className="hidden md:flex items-center gap-2">
            <div className="h-10 w-10 rounded-full border overflow-hidden bg-white flex items-center justify-center">
              <img src="/seal.png" alt="Seal" className="h-9 w-9 object-contain"/>
            </div>
            <div className="text-xs text-gray-500">
              Vol 73 | Issue 11 | November 2025
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
