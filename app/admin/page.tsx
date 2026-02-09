"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

type Manuscript = {
  id: string;
  title: string | null;
  status: string | null;
  created_at: string | null;
  authors?: string | null;
};

type ReviewAssignment = {
  id: string;
  manuscript_id: string;
  reviewer_id: string;
  recommendation?: string | null;
  created_at?: string | null;
};

type Reviewer = {
  id: string;
  email?: string | null;
  full_name?: string | null;
};

type Notification = {
  id: string;
  title: string | null;
  body: string | null;
  manuscript_id: string | null;
  created_at: string | null;
};

const STATUS_COLUMNS = [
  { key: "submitted", label: "New" },
  { key: "under_review", label: "In Review" },
  { key: "revisions_requested", label: "Revisions Requested" },
  { key: "accepted", label: "Accepted" },
  { key: "rejected", label: "Rejected" },
  { key: "published", label: "Published" },
];

const STATUS_OPTIONS = [
  "submitted",
  "under_review",
  "revisions_requested",
  "accepted",
  "rejected",
];

const FILTERS = [
  { key: "all", label: "All" },
  { key: "today", label: "Today" },
  { key: "unassigned", label: "Unassigned" },
  { key: "overdue", label: "Overdue" },
];

function parseAuthors(raw: string | null | undefined) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function leadAuthorName(raw: string | null | undefined) {
  const authors = parseAuthors(raw);
  return authors[0]?.name || authors[0]?.email || "Unknown author";
}

function daysAgo(dateString: string | null | undefined) {
  if (!dateString) return "-";
  const ms = Date.now() - new Date(dateString).getTime();
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  if (Number.isNaN(days)) return "-";
  if (days <= 0) return "Today";
  return `${days}d`;
}

export default function AdminPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [queue, setQueue] = useState<Record<string, Manuscript[]>>({});
  const [assignments, setAssignments] = useState<
    Record<string, ReviewAssignment[]>
  >({});
  const [reviewers, setReviewers] = useState<Reviewer[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [error, setError] = useState("");
  const [loadingQueue, setLoadingQueue] = useState(true);
  const [filter, setFilter] = useState("all");
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [assignInputs, setAssignInputs] = useState<Record<string, string>>({});
  const [statusBusyId, setStatusBusyId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function init() {
      const { data } = await supabase.auth.getSession();
      const session = data.session;
      const user = session?.user ?? null;

      if (!user) {
        router.replace("/admin/login");
        return;
      }

      if (!mounted) return;
      setToken(session?.access_token ?? null);
      setChecking(false);
    }

    init();

    return () => {
      mounted = false;
    };
  }, [router]);

  async function loadQueue(activeToken: string | null) {
    try {
      setError("");
      setLoadingQueue(true);
      const resp = await fetch("/api/admin/queue", {
        headers: activeToken
          ? { Authorization: `Bearer ${activeToken}` }
          : undefined,
      });
      const json = await resp.json();
      if (!resp.ok) throw new Error(json?.error || "Failed to load queue");

      setQueue(json.queue || {});
      setAssignments(json.assignments || {});
      setReviewers(json.reviewers || []);
      setRole(json.role || null);
    } catch (err: any) {
      console.error(err);
      setError(err.message || String(err));
    } finally {
      setLoadingQueue(false);
    }
  }

  async function loadNotifications(activeToken: string | null) {
    try {
      const resp = await fetch("/api/admin/notifications?limit=6", {
        headers: activeToken
          ? { Authorization: `Bearer ${activeToken}` }
          : undefined,
      });
      const json = await resp.json();
      if (!resp.ok) return;
      setNotifications(json.notifications || []);
    } catch (err) {
      console.warn("notifications load failed:", err);
    }
  }

  useEffect(() => {
    if (checking) return;
    loadQueue(token);
    loadNotifications(token);
  }, [checking, token]);

  async function handleAssign(manuscriptId: string) {
    const email = assignInputs[manuscriptId] || "";
    if (!email.trim()) {
      setError("Provide a reviewer email before assigning.");
      return;
    }

    try {
      setError("");
      setAssigningId(manuscriptId);

      const resp = await fetch("/api/admin/review/assign", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          manuscript_id: manuscriptId,
          reviewer_email: email.trim(),
        }),
      });

      const json = await resp.json();
      if (!resp.ok) throw new Error(json?.error || "Failed to assign reviewer");

      setAssignInputs((prev) => ({ ...prev, [manuscriptId]: "" }));
      setAssigningId(null);
      await loadQueue(token);
    } catch (err: any) {
      console.error(err);
      setError(err.message || String(err));
      setAssigningId(null);
    }
  }

  async function handleStatusChange(manuscriptId: string, status: string) {
    try {
      setError("");
      setStatusBusyId(manuscriptId);

      const resp = await fetch("/api/admin/update-manuscript-status", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ manuscriptId, status }),
      });

      const json = await resp.json();
      if (!resp.ok) throw new Error(json?.error || "Failed to update status");

      await loadQueue(token);
    } catch (err: any) {
      console.error(err);
      setError(err.message || String(err));
    } finally {
      setStatusBusyId(null);
    }
  }

  const filteredQueue = useMemo(() => {
    const result: Record<string, Manuscript[]> = {};
    const now = new Date();

    const isToday = (dateString: string | null | undefined) => {
      if (!dateString) return false;
      const d = new Date(dateString);
      return (
        d.getFullYear() === now.getFullYear() &&
        d.getMonth() === now.getMonth() &&
        d.getDate() === now.getDate()
      );
    };

    const isOverdue = (m: Manuscript) => {
      if (!m.created_at) return false;
      const ageDays =
        (Date.now() - new Date(m.created_at).getTime()) / (1000 * 60 * 60 * 24);
      return ageDays >= 14;
    };

    STATUS_COLUMNS.forEach((col) => {
      const list = queue[col.key] || [];
      result[col.key] = list.filter((m) => {
        if (filter === "today") return isToday(m.created_at);
        if (filter === "unassigned") {
          const assigned = assignments[m.id] || [];
          return assigned.length === 0;
        }
        if (filter === "overdue") {
          return (
            (m.status === "under_review" ||
              m.status === "revisions_requested") &&
            isOverdue(m)
          );
        }
        return true;
      });
    });

    return result;
  }, [queue, assignments, filter]);

  if (checking) {
    return (
      <main className="admin-page">
        <div className="admin-shell">
          <p className="admin-muted">Checking session...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="admin-page">
      <div className="admin-shell">
        <header className="admin-header">
          <div>
            <p className="admin-eyebrow">Submission Inbox</p>
            <h1 className="admin-title">Editorial Control Center</h1>
            <p className="admin-subtitle">
              Review, route, and publish submissions with fewer clicks.
            </p>
          </div>
          <div className="admin-header__actions">
            <Link href="/admin/publish" className="admin-btn admin-btn--ghost">
              Publish issue
            </Link>
            <Link href="/author/submit" className="admin-btn admin-btn--primary">
              New submission
            </Link>
          </div>
        </header>

        {error && <div className="admin-alert admin-alert--error">{error}</div>}
        {loadingQueue && !error && (
          <div className="admin-alert">Loading queue...</div>
        )}

        <div className="admin-toolbar">
          <div className="admin-filters">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                className={
                  filter === f.key
                    ? "admin-filter is-active"
                    : "admin-filter"
                }
                onClick={() => setFilter(f.key)}
                type="button"
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="admin-meta">
            {role ? <span className="admin-tag">{role}</span> : null}
            <button
              className="admin-btn admin-btn--ghost"
              type="button"
              onClick={() => {
                loadQueue(token);
                loadNotifications(token);
              }}
            >
              Refresh
            </button>
          </div>
        </div>

        <div className="admin-grid">
          <section className="admin-queue">
            <div className="admin-columns">
              {STATUS_COLUMNS.map((column) => {
                const list = filteredQueue[column.key] || [];
                return (
                  <div className="admin-column" key={column.key}>
                    <div className="admin-column__header">
                      <h2>{column.label}</h2>
                      <span>{list.length}</span>
                    </div>
                    <div className="admin-column__list">
                      {list.length === 0 && (
                        <p className="admin-muted">No items</p>
                      )}
                      {list.map((m) => {
                        const assigned = assignments[m.id] || [];
                        const isPublished = m.status === "published";
                        const statusValue = STATUS_OPTIONS.includes(
                          m.status || "submitted"
                        )
                          ? m.status || "submitted"
                          : "submitted";
                        return (
                          <article key={m.id} className="admin-card">
                            <div className="admin-card__top">
                              <div>
                                <p className="admin-card__title">
                                  {m.title || "(untitled)"}
                                </p>
                                <p className="admin-card__meta">
                                  {leadAuthorName(m.authors)} - {daysAgo(m.created_at)}
                                </p>
                              </div>
                              <span className={`admin-status admin-status--${m.status || "submitted"}`}>
                                {m.status || "submitted"}
                              </span>
                            </div>

                            <div className="admin-card__details">
                              <span>
                                Reviewer assignments: {assigned.length}
                              </span>
                              {assigned.length === 0 && (
                                <span className="admin-muted">Unassigned</span>
                              )}
                            </div>

                            <div className="admin-card__actions">
                              <Link
                                href={`/admin/submissions/${m.id}`}
                                className="admin-btn admin-btn--ghost"
                              >
                                Open
                              </Link>

                              {role !== "reviewer" && (
                                <>
                                  {!isPublished ? (
                                    <select
                                      className="admin-select"
                                      value={statusValue}
                                      disabled={statusBusyId === m.id}
                                      onChange={(e) =>
                                        handleStatusChange(m.id, e.target.value)
                                      }
                                    >
                                      {STATUS_OPTIONS.map((s) => (
                                        <option key={s} value={s}>
                                          {s}
                                        </option>
                                      ))}
                                    </select>
                                  ) : (
                                    <span className="admin-muted">Published</span>
                                  )}
                                </>
                              )}
                            </div>

                            {role !== "reviewer" && (
                              <div className="admin-card__assign">
                                <input
                                  className="admin-input"
                                  placeholder="Assign reviewer email"
                                  list={`reviewers-${m.id}`}
                                  value={assignInputs[m.id] || ""}
                                  onChange={(e) =>
                                    setAssignInputs((prev) => ({
                                      ...prev,
                                      [m.id]: e.target.value,
                                    }))
                                  }
                                />
                                <datalist id={`reviewers-${m.id}`}>
                                  {reviewers.map((r) => (
                                    <option key={r.id} value={r.email || ""}>
                                      {r.full_name || r.email}
                                    </option>
                                  ))}
                                </datalist>
                                <button
                                  className="admin-btn admin-btn--primary"
                                  type="button"
                                  onClick={() => handleAssign(m.id)}
                                  disabled={
                                    assigningId === m.id ||
                                    !(assignInputs[m.id] || "").trim()
                                  }
                                >
                                  {assigningId === m.id ? "Assigning..." : "Assign"}
                                </button>
                              </div>
                            )}
                          </article>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <aside className="admin-side">
            <div className="admin-panel">
              <h3>Notifications</h3>
              {notifications.length === 0 && (
                <p className="admin-muted">No updates yet.</p>
              )}
              <ul className="admin-notes">
                {notifications.map((n) => (
                  <li key={n.id}>
                    <strong>{n.title || "Update"}</strong>
                    <p>{n.body}</p>
                    {n.manuscript_id && (
                      <Link href={`/admin/submissions/${n.manuscript_id}`}>
                        View submission
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
