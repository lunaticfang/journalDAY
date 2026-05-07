"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";
import {
  formatReviewDueDate,
  isPastReviewDueDate,
  isPendingReview,
} from "../../lib/reviewerWorkflowShared";

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
  invited_at?: string | null;
  due_at?: string | null;
  last_reminder_at?: string | null;
  decided_at?: string | null;
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
  {
    key: "submitted",
    label: "New",
    description: "Fresh submissions waiting for the first editorial pass.",
  },
  {
    key: "under_review",
    label: "In Review",
    description: "Active manuscripts currently with reviewers or editors.",
  },
  {
    key: "revisions_requested",
    label: "Revisions Requested",
    description: "Work that is back with the author for improvement.",
  },
  {
    key: "accepted",
    label: "Accepted",
    description: "Approved work ready for issue planning and final checks.",
  },
  {
    key: "rejected",
    label: "Rejected",
    description: "Completed decisions that are now part of the record.",
  },
  {
    key: "published",
    label: "Published",
    description: "Articles already placed into an issue and out of the queue.",
  },
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

function formatFilterLabel(filterKey: string) {
  return FILTERS.find((item) => item.key === filterKey)?.label || "All";
}

function formatStatusLabel(status: string | null | undefined) {
  return String(status || "submitted").replace(/_/g, " ");
}

function findNextPendingDue(assignments: ReviewAssignment[] = []) {
  return assignments
    .filter((assignment) => isPendingReview(assignment) && assignment.due_at)
    .map((assignment) => assignment.due_at as string)
    .sort((left, right) => new Date(left).getTime() - new Date(right).getTime())[0];
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
  const [notice, setNotice] = useState("");
  const [loadingQueue, setLoadingQueue] = useState(true);
  const [filter, setFilter] = useState("all");
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [assignInputs, setAssignInputs] = useState<Record<string, string>>({});
  const [assignDueInputs, setAssignDueInputs] = useState<Record<string, string>>({});
  const [statusBusyId, setStatusBusyId] = useState<string | null>(null);
  const [reviewWorkflowMetadataReady, setReviewWorkflowMetadataReady] =
    useState(true);
  const [reminding, setReminding] = useState(false);

  const availableFilters = useMemo(() => {
    if (role === "reviewer") {
      return FILTERS.filter((item) => item.key !== "unassigned");
    }

    return FILTERS;
  }, [role]);

  useEffect(() => {
    if (role === "reviewer" && filter === "unassigned") {
      setFilter("all");
    }
  }, [filter, role]);

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
      setReviewWorkflowMetadataReady(json.reviewWorkflowMetadataReady !== false);
    } catch (err: unknown) {
      console.error(err);
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
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
    const dueDate = assignDueInputs[manuscriptId] || "";
    if (!email.trim()) {
      setError("Provide a reviewer email before assigning.");
      return;
    }

    try {
      setError("");
      setNotice("");
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
          due_at: dueDate || undefined,
        }),
      });

      const json = await resp.json();
      if (!resp.ok) throw new Error(json?.error || "Failed to assign reviewer");

      setAssignInputs((prev) => ({ ...prev, [manuscriptId]: "" }));
      setAssignDueInputs((prev) => ({ ...prev, [manuscriptId]: "" }));
      setReviewWorkflowMetadataReady(json.reviewWorkflowMetadataReady !== false);
      setNotice(
        json?.alreadyAssigned
          ? "That reviewer is already attached to this manuscript."
          : `Reviewer assigned. Due ${formatReviewDueDate(
              json?.review?.due_at || dueDate || undefined
            )}.`
      );
      setAssigningId(null);
      await loadQueue(token);
    } catch (err: unknown) {
      console.error(err);
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      setAssigningId(null);
    }
  }

  async function handleStatusChange(manuscriptId: string, status: string) {
    try {
      setError("");
      setNotice("");
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
    } catch (err: unknown) {
      console.error(err);
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setStatusBusyId(null);
    }
  }

  async function handleSendReminders() {
    try {
      setError("");
      setNotice("");
      setReminding(true);

      const resp = await fetch("/api/admin/review/reminders", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      const json = await resp.json();
      if (!resp.ok) throw new Error(json?.error || "Failed to send reminders");

      setNotice(
        `Reminder sweep finished: ${json.sent || 0} sent, ${
          json.skipped || 0
        } skipped.`
      );
      await loadQueue(token);
    } catch (err: unknown) {
      console.error(err);
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setReminding(false);
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
      const reviewAssignments = assignments[m.id] || [];
      const hasPastDueReview = reviewAssignments.some(
        (assignment) =>
          isPendingReview(assignment) && isPastReviewDueDate(assignment.due_at)
      );

      if (hasPastDueReview) {
        return true;
      }

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

  const summaryCards = useMemo(() => {
    const allManuscripts = STATUS_COLUMNS.flatMap((column) => queue[column.key] || []);
    const activeManuscripts = allManuscripts.filter(
      (manuscript) => manuscript.status !== "published"
    );
    const needsAssignment = activeManuscripts.filter(
      (manuscript) => (assignments[manuscript.id] || []).length === 0
    );
    const inProcessCount =
      (queue.under_review || []).length + (queue.revisions_requested || []).length;

    if (role === "reviewer") {
      const pendingRecommendationCount = allManuscripts.filter((manuscript) => {
        const reviewAssignments = assignments[manuscript.id] || [];
        return reviewAssignments.some((assignment) => isPendingReview(assignment));
      }).length;

      const overdueCount = allManuscripts.filter((manuscript) => {
        const reviewAssignments = assignments[manuscript.id] || [];
        return reviewAssignments.some(
          (assignment) =>
            isPendingReview(assignment) && isPastReviewDueDate(assignment.due_at)
        );
      }).length;

      return [
        {
          label: "Assigned manuscripts",
          value: allManuscripts.length,
          note: "Manuscripts currently in your reviewer queue",
        },
        {
          label: "Pending recommendation",
          value: pendingRecommendationCount,
          note: "Assignments where a recommendation is still pending",
        },
        {
          label: "Completed reviews",
          value: Math.max(allManuscripts.length - pendingRecommendationCount, 0),
          note: "Assignments where your recommendation is already submitted",
        },
        {
          label: "Overdue",
          value: overdueCount,
          note: "Assignments past the due date",
        },
      ];
    }

    return [
      {
        label: "Open submissions",
        value: activeManuscripts.length,
        note: "Everything currently in editorial circulation",
      },
      {
        label: "Needs reviewer",
        value: needsAssignment.length,
        note: "Submissions still waiting for reviewer assignment",
      },
      {
        label: "In progress",
        value: inProcessCount,
        note: "Under review or currently in revision rounds",
      },
      {
        label: "Published",
        value: (queue.published || []).length,
        note: "Already placed in an issue",
      },
    ];
  }, [assignments, queue, role]);

  const visibleQueueCount = useMemo(() => {
    return STATUS_COLUMNS.reduce(
      (count, column) => count + (filteredQueue[column.key] || []).length,
      0
    );
  }, [filteredQueue]);

  const visibleUnassignedCount = useMemo(() => {
    return STATUS_COLUMNS.reduce((count, column) => {
      const columnCount = (filteredQueue[column.key] || []).filter(
        (manuscript) => (assignments[manuscript.id] || []).length === 0
      ).length;
      return count + columnCount;
    }, 0);
  }, [assignments, filteredQueue]);

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
          <div className="admin-header__intro">
            <p className="admin-eyebrow">Submission Inbox</p>
            <h1 className="admin-title">
              {role === "reviewer" ? "Reviewer Workspace" : "Editorial Control Center"}
            </h1>
            <p className="admin-subtitle">
              {role === "reviewer"
                ? "Review the manuscripts assigned to you, keep track of due dates, and submit recommendations in one place."
                : "A calmer view of the full editorial pipeline, from intake to issue publication."}
            </p>
          </div>
          <div className="admin-header__aside">
            <div className="admin-contextCard">
              <span className="admin-tag">{role || "staff"}</span>
              <strong>{visibleQueueCount} manuscripts in view</strong>
              <p>
                {role === "reviewer"
                  ? "Only assignments relevant to your reviewer account"
                  : `${visibleUnassignedCount} still need reviewer coverage`}
              </p>
            </div>
            {role !== "reviewer" && (
              <div className="admin-header__actions">
                <Link href="/admin/publish" className="admin-btn admin-btn--ghost">
                  Publish issue
                </Link>
                <Link href="/author/submit" className="admin-btn admin-btn--primary">
                  New submission
                </Link>
              </div>
            )}
          </div>
        </header>

        {error && <div className="admin-alert admin-alert--error">{error}</div>}
        {notice && <div className="admin-alert admin-alert--success">{notice}</div>}
        {!reviewWorkflowMetadataReady && (
          <div className="admin-alert">
            Reviewer due dates are running in compatibility mode. Run
            `db/reviewer_mail_phase1.sql` in Supabase to store deadlines and
            reminder history.
          </div>
        )}
        {loadingQueue && !error && (
          <div className="admin-alert">Loading queue...</div>
        )}

        <section className="admin-overview">
          {summaryCards.map((card) => (
            <article key={card.label} className="admin-stat">
              <p className="admin-stat__label">{card.label}</p>
              <strong className="admin-stat__value">{card.value}</strong>
              <p className="admin-stat__note">{card.note}</p>
            </article>
          ))}
        </section>

        <div className="admin-grid">
          <section className="admin-main">
            <section className="admin-surface">
              <div className="admin-sectionHead">
                <div>
                  <p className="admin-sectionKicker">Queue view</p>
                  <h2 className="admin-sectionTitle">Manuscript pipeline</h2>
                </div>
                <p className="admin-sectionNote">
                  Showing {visibleQueueCount} manuscripts in the{" "}
                  {formatFilterLabel(filter).toLowerCase()} view.
                </p>
              </div>

              <div className="admin-toolbar">
                <div className="admin-filters">
                  {availableFilters.map((f) => (
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
                  <button
                    className="admin-btn admin-btn--ghost"
                    type="button"
                    onClick={() => {
                      loadQueue(token);
                      loadNotifications(token);
                    }}
                  >
                    Refresh queue
                  </button>
                </div>
              </div>
            </section>

            <section className="admin-queue">
              <div className="admin-board">
                {STATUS_COLUMNS.map((column) => {
                  const list = filteredQueue[column.key] || [];
                  return (
                    <section
                      className={`admin-column admin-column--${column.key}`}
                      key={column.key}
                    >
                      <div className="admin-column__header">
                        <div className="admin-column__heading">
                          <h2>{column.label}</h2>
                          <p>{column.description}</p>
                        </div>
                        <span className="admin-column__count">{list.length}</span>
                      </div>
                      <div className="admin-column__list">
                        {list.length === 0 && (
                          <div className="admin-emptyState">
                            <p>No manuscripts in this stage right now.</p>
                          </div>
                        )}
                        {list.map((m) => {
                          const assigned = assignments[m.id] || [];
                          const isPublished = m.status === "published";
                          const nextDue = findNextPendingDue(assigned);
                          const pendingReviewCount = assigned.filter((assignment) =>
                            isPendingReview(assignment)
                          ).length;
                          const statusValue = STATUS_OPTIONS.includes(
                            m.status || "submitted"
                          )
                            ? m.status || "submitted"
                            : "submitted";
                          return (
                            <article key={m.id} className="admin-card">
                              <div className="admin-card__top">
                                <div className="admin-card__headline">
                                  <p className="admin-card__title">
                                    {m.title || "(untitled)"}
                                  </p>
                                  <p className="admin-card__byline">
                                    {leadAuthorName(m.authors)} - {daysAgo(m.created_at)}
                                  </p>
                                  <p className="admin-card__byline">
                                    {pendingReviewCount > 0
                                      ? `Pending reviews: ${pendingReviewCount}`
                                      : assigned.length > 0
                                      ? "Reviewer coverage complete"
                                      : "No reviewer assigned yet"}
                                    {nextDue ? ` - Due ${formatReviewDueDate(nextDue)}` : ""}
                                  </p>
                                </div>
                                <span
                                  className={`admin-status admin-status--${
                                    m.status || "submitted"
                                  }`}
                                >
                                  {formatStatusLabel(m.status)}
                                </span>
                              </div>

                              <div className="admin-card__facts">
                                <div className="admin-card__fact">
                                  <span>Reviewers</span>
                                  <strong>{assigned.length}</strong>
                                </div>
                                <div className="admin-card__fact">
                                  <span>Next due</span>
                                  <strong>
                                    {assigned.length === 0
                                      ? "Needed"
                                      : nextDue
                                      ? formatReviewDueDate(nextDue)
                                      : pendingReviewCount > 0
                                      ? "Pending"
                                      : "Complete"}
                                  </strong>
                                </div>
                              </div>

                              <div className="admin-card__actions">
                                <Link
                                  href={`/admin/submissions/${m.id}`}
                                  className="admin-btn admin-btn--ghost"
                                >
                                  Open case
                                </Link>

                                {role !== "reviewer" &&
                                  (!isPublished ? (
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
                                          {formatStatusLabel(s)}
                                        </option>
                                      ))}
                                    </select>
                                  ) : (
                                    <span className="admin-chip admin-chip--muted">
                                      Published
                                    </span>
                                  ))}
                              </div>

                              {role !== "reviewer" && (
                                <div className="admin-card__assign">
                                  <div className="admin-card__assignFields">
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
                                    <input
                                      className="admin-input"
                                      type="date"
                                      value={assignDueInputs[m.id] || ""}
                                      min={new Date().toISOString().slice(0, 10)}
                                      onChange={(e) =>
                                        setAssignDueInputs((prev) => ({
                                          ...prev,
                                          [m.id]: e.target.value,
                                        }))
                                      }
                                    />
                                    <p className="admin-muted">
                                      Leave the date blank to use the default 14-day
                                      review window.
                                    </p>
                                  </div>
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
                    </section>
                  );
                })}
              </div>
            </section>
          </section>

          <aside className="admin-side">
            <div className="admin-panel">
              <h3>Editorial snapshot</h3>
              <ul className="admin-list">
                <li>
                  <strong>Signed-in role</strong>
                  <span>{role || "Loading..."}</span>
                </li>
                <li>
                  <strong>Active filter</strong>
                  <span>{formatFilterLabel(filter)}</span>
                </li>
                <li>
                  <strong>
                    {role === "reviewer" ? "My pending recommendations" : "Reviewers available"}
                  </strong>
                  <span>
                    {role === "reviewer"
                      ? Object.values(assignments).flat().filter((assignment) =>
                          isPendingReview(assignment)
                        ).length
                      : reviewers.length}
                  </span>
                </li>
                <li>
                  <strong>Notifications</strong>
                  <span>{notifications.length} recent updates</span>
                </li>
              </ul>
              <div className="admin-actions">
                {role !== "reviewer" && (
                  <button
                    type="button"
                    className="admin-btn admin-btn--ghost"
                    disabled={reminding || !reviewWorkflowMetadataReady}
                    onClick={handleSendReminders}
                  >
                    {reminding ? "Sending reminders..." : "Send due reminders"}
                  </button>
                )}
                {role !== "reviewer" && (
                  <Link href="/admin/publish" className="admin-btn admin-btn--ghost">
                    Publish issue
                  </Link>
                )}
                {role !== "reviewer" && (
                  <Link href="/author/submit" className="admin-btn admin-btn--primary">
                    New submission
                  </Link>
                )}
                {(role === "owner" || role === "admin") && (
                  <Link href="/admin/users" className="admin-btn admin-btn--ghost">
                    Manage access
                  </Link>
                )}
              </div>
            </div>

            <div className="admin-panel">
              <h3>Recent notifications</h3>
              {!reviewWorkflowMetadataReady && (
                <p className="admin-muted">
                  Reviewer reminder history appears after the reviewer mail SQL
                  migration is applied.
                </p>
              )}
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
