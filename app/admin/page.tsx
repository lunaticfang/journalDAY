/*"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../lib/supabaseClient";

type Manuscript = {
  id: string;
  title: string | null;
  status: string | null;
  submitter_id: string | null;
  created_at: string | null;
};

export default function AdminPage() {
  const router = useRouter();
  const [checkingUser, setCheckingUser] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  const [loadingTable, setLoadingTable] = useState(true);
  const [manuscripts, setManuscripts] = useState<Manuscript[]>([]);
  const [errorMsg, setErrorMsg] = useState("");

  // 1) Guard: ensure user is signed in, otherwise go to /admin/login
  useEffect(() => {
    let mounted = true;

    (async () => {
      const { data } = await supabase.auth.getUser();

      if (!data?.user) {
        if (!mounted) return;
        router.replace("/admin/login");
        return;
      }

      if (!mounted) return;
      setUserEmail(data.user.email ?? null);
      setCheckingUser(false);
    })();

    return () => {
      mounted = false;
    };
  }, [router]);

  // 2) Load manuscripts from API once user is confirmed
  useEffect(() => {
    if (checkingUser) return;

    let cancelled = false;

    (async () => {
      try {
        setLoadingTable(true);
        setErrorMsg("");

        const resp = await fetch("/api/admin/list-manuscripts");
        const json = await resp.json();

        if (!resp.ok) {
          throw new Error(json?.error || "Failed to load submissions");
        }

        if (!cancelled) {
          setManuscripts(json.manuscripts || []);
        }
      } catch (err: any) {
        console.error(err);
        if (!cancelled) {
          setErrorMsg(err.message || String(err));
        }
      } finally {
        if (!cancelled) setLoadingTable(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [checkingUser]);

  async function handleViewPdf(manuscriptId: string) {
    try {
      setErrorMsg("");
      const resp = await fetch(`/api/submissions/${manuscriptId}/signed-url`);
      const json = await resp.json();
      if (!resp.ok) throw new Error(json?.error || "Could not get signed URL");
      if (!json.signedUrl) throw new Error("No signed URL returned");
      window.open(json.signedUrl, "_blank", "noopener,noreferrer");
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || String(err));
    }
  }

  if (checkingUser) {
    return (
      <main style={{ padding: 24 }}>
        <p>Checking your session…</p>
      </main>
    );
  }

  return (
    <main style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      <header style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 24, fontWeight: 600 }}>Admin dashboard</h1>
        <p style={{ marginTop: 4, color: "#666" }}>
          Signed in as <strong>{userEmail ?? "unknown user"}</strong>.
        </p>
        <div style={{ marginTop: 12 }}>
          <Link href="/admin/upload" style={{ marginRight: 16, textDecoration: "underline" }}>
            Upload new issue/manuscript
          </Link>
          <Link href="/author/submit" style={{ textDecoration: "underline" }}>
            Submit as author
          </Link>
        </div>
      </header>

      <section>
        <h2 style={{ fontSize: 18, marginBottom: 8 }}>Submissions</h2>

        {loadingTable && <p>Loading submissions…</p>}

        {errorMsg && (
          <p style={{ color: "crimson", marginBottom: 8 }}>Error: {errorMsg}</p>
        )}

        {!loadingTable && manuscripts.length === 0 && !errorMsg && (
          <p>No submissions yet.</p>
        )}

        {!loadingTable && manuscripts.length > 0 && (
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: 14,
              marginTop: 8,
            }}
          >
            <thead>
              <tr>
                <th style={{ borderBottom: "1px solid #ddd", textAlign: "left", padding: 8 }}>Title</th>
                <th style={{ borderBottom: "1px solid #ddd", textAlign: "left", padding: 8 }}>Status</th>
                <th style={{ borderBottom: "1px solid #ddd", textAlign: "left", padding: 8 }}>Submitted</th>
                <th style={{ borderBottom: "1px solid #ddd", textAlign: "left", padding: 8 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {manuscripts.map((m) => (
                <tr key={m.id}>
                  <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>
                    {m.title || "(untitled)"}
                  </td>
                  <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>
                    {m.status || "submitted"}
                  </td>
                  <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>
                    {m.created_at
                      ? new Date(m.created_at).toLocaleString()
                      : "-"}
                  </td>
                  <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>
                    <button
                      onClick={() => handleViewPdf(m.id)}
                      style={{
                        padding: "4px 8px",
                        borderRadius: 4,
                        border: "1px solid #ccc",
                        cursor: "pointer",
                      }}
                    >
                      View PDF
                    </button>
                    {// Later: add buttons like "Assign reviewers", "Advance stage", etc. //}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}*/

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../lib/supabaseClient";

type Manuscript = {
  id: string;
  title: string | null;
  status: string | null;
  submitter_id?: string | null;
  created_at: string | null;
};

const STATUS_OPTIONS = [
  "submitted",
  "under_review",
  "accepted",
  "rejected",
  "published",
];

export default function AdminPage() {
  const router = useRouter();
  const [checkingUser, setCheckingUser] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  const [loadingTable, setLoadingTable] = useState(true);
  const [manuscripts, setManuscripts] = useState<Manuscript[]>([]);
  const [errorMsg, setErrorMsg] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // 1) Guard: ensure user is signed in, otherwise go to /admin/login
  useEffect(() => {
    let mounted = true;

    (async () => {
      const { data } = await supabase.auth.getSession();
      const user = data?.session?.user ?? null;

      if (!user) {
        if (mounted) router.replace("/admin/login");
        return;
      }

      if (mounted) {
        setUserEmail(user.email ?? null);
        setCheckingUser(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [router]);

  // 2) Load manuscripts from API once user is confirmed
  useEffect(() => {
    if (checkingUser) return;

    let cancelled = false;

    (async () => {
      try {
        setLoadingTable(true);
        setErrorMsg("");

        const resp = await fetch("/api/admin/list-manuscripts");
        const json = await resp.json();

        if (!resp.ok) {
          throw new Error(json?.error || "Failed to load submissions");
        }

        if (!cancelled) {
          setManuscripts(json.manuscripts || []);
        }
      } catch (err: any) {
        console.error(err);
        if (!cancelled) {
          setErrorMsg(err.message || String(err));
        }
      } finally {
        if (!cancelled) setLoadingTable(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [checkingUser]);

  async function handleViewPdf(manuscriptId: string) {
    try {
      setErrorMsg("");
      const resp = await fetch(`/api/submissions/${manuscriptId}/signed-url`);
      const json = await resp.json();
      if (!resp.ok) throw new Error(json?.error || "Could not get signed URL");
      if (!json.signedUrl) throw new Error("No signed URL returned");
      window.open(json.signedUrl, "_blank", "noopener,noreferrer");
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || String(err));
    }
  }

  async function handleStatusChange(manuscriptId: string, newStatus: string) {
    try {
      setUpdatingId(manuscriptId);
      setErrorMsg("");

      const resp = await fetch("/api/admin/update-manuscript-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ manuscriptId, status: newStatus }),
      });

      const json = await resp.json();
      if (!resp.ok) {
        throw new Error(json?.error || "Failed to update status");
      }

      const updated = json.manuscript as Manuscript;

      setManuscripts((prev) =>
        prev.map((m) => (m.id === manuscriptId ? { ...m, status: updated.status } : m))
      );
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || String(err));
    } finally {
      setUpdatingId(null);
    }
  }

  if (checkingUser) {
    return (
      <main style={{ padding: 24 }}>
        <p>Checking your session…</p>
      </main>
    );
  }

  return (
    <main style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      <header style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 24, fontWeight: 600 }}>Admin dashboard</h1>
        <p style={{ marginTop: 4, color: "#666" }}>
          Signed in as <strong>{userEmail ?? "unknown user"}</strong>.
        </p>
        <div style={{ marginTop: 12 }}>
          <Link href="/admin/upload" style={{ marginRight: 16, textDecoration: "underline" }}>
            Upload new issue/manuscript
          </Link>
          <Link href="/admin/publish" style={{ marginRight: 16, textDecoration: "underline" }}>
            Publish issue
          </Link>
          <Link href="/author/submit" style={{ textDecoration: "underline" }}>
            Submit as author
          </Link>
        </div>
      </header>

      <section>
        <h2 style={{ fontSize: 18, marginBottom: 8 }}>Submissions</h2>

        {loadingTable && <p>Loading submissions…</p>}

        {errorMsg && (
          <p style={{ color: "crimson", marginBottom: 8 }}>Error: {errorMsg}</p>
        )}

        {!loadingTable && manuscripts.length === 0 && !errorMsg && (
          <p>No submissions yet.</p>
        )}

        {!loadingTable && manuscripts.length > 0 && (
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: 14,
              marginTop: 8,
            }}
          >
            <thead>
              <tr>
                <th style={{ borderBottom: "1px solid #ddd", textAlign: "left", padding: 8 }}>
                  Title
                </th>
                <th style={{ borderBottom: "1px solid #ddd", textAlign: "left", padding: 8 }}>
                  Status
                </th>
                <th style={{ borderBottom: "1px solid #ddd", textAlign: "left", padding: 8 }}>
                  Submitted
                </th>
                <th style={{ borderBottom: "1px solid #ddd", textAlign: "left", padding: 8 }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {manuscripts.map((m) => {
                const statusValue = m.status || "submitted";
                const isUpdating = updatingId === m.id;

                return (
                  <tr key={m.id}>
                    <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>
                      {m.title || "(untitled)"}
                    </td>
                    <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>
                      <select
                        value={statusValue}
                        onChange={(e) => handleStatusChange(m.id, e.target.value)}
                        disabled={isUpdating}
                        style={{
                          padding: "4px 6px",
                          borderRadius: 4,
                          border: "1px solid #d1d5db",
                          fontSize: 13,
                          background: isUpdating ? "#f3f4f6" : "white",
                        }}
                      >
                        {STATUS_OPTIONS.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>
                      {m.created_at
                        ? new Date(m.created_at).toLocaleString()
                        : "-"}
                    </td>
                    <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>
                      <button
                        onClick={() => handleViewPdf(m.id)}
                        style={{
                          padding: "4px 8px",
                          borderRadius: 4,
                          border: "1px solid #ccc",
                          cursor: "pointer",
                          fontSize: 13,
                          marginRight: 8,
                        }}
                      >
                        View PDF
                      </button>
                      {isUpdating && (
                        <span style={{ fontSize: 12, color: "#6b7280" }}>
                          Updating…
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}