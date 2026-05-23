"use client";

import Link from "next/link";

export default function LoginChooserPage() {
  return (
    <main className="auth-shell">
      <section className="auth-card auth-card--wide">
        <h1 className="auth-title">Sign in to UpDAYtes</h1>

        <p className="auth-subtitle">
          Choose your workspace to continue.
        </p>

        <div className="auth-choice-grid">
          <Link href="/login/author" className="auth-choice auth-choice--default">
            <strong>Continue as Author</strong>
            <span>Submit manuscripts and track your submissions.</span>
          </Link>

          <Link href="/admin/login" className="auth-choice auth-choice--accent">
            <strong>Continue as Admin</strong>
            <span>Editorial review, issue management, and publishing controls.</span>
          </Link>
        </div>

        <div className="auth-link-list">
          <Link href="/">Back to home</Link>
        </div>
      </section>
    </main>
  );
}
