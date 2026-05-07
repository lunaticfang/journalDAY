"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";

type IssueLink = {
  issue_id: string;
  issue_title: string | null;
  issue_label: string;
  published_at: string | null;
  is_current_issue: boolean;
};

type Manuscript = {
  id: string;
  title: string | null;
  status: string | null;
  created_at: string | null;
  author_id: string | null;
  submitter_id: string | null;
  issue_links?: IssueLink[];
  issue_count?: number;
  is_in_any_issue?: boolean;
  is_in_current_issue?: boolean;
  is_in_previous_issue?: boolean;
  latest_version?: {
    id: string;
    created_at: string | null;
  } | null;
  latest_feedback?: {
    recommendation: string | null;
    notes: string | null;
    decided_at: string | null;
    review_id: string | null;
  } | null;
};

type DashboardScope = "all" | "current_issue" | "unpublished" | "previous_issues";

const DASHBOARD_SCOPES: { key: DashboardScope; label: string }[] = [
  { key: "all", label: "All submissions" },
  { key: "current_issue", label: "In current issue" },
  { key: "unpublished", label: "Not in any issue" },
  { key: "previous_issues", label: "In previous issues" },
];

export default function AuthorDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [manuscripts, setManuscripts] = useState<Manuscript[]>([]);
  const [latestIssueId, setLatestIssueId] = useState<string | null>(null);
  const [scope, setScope] = useState<DashboardScope>("all");
  const [status, setStatus] = useState("");
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [uploadMsg, setUploadMsg] = useState("");

  function appendErrorReference(message: string, errorId: string | null | undefined) {
    const normalizedMessage = String(message || "").trim();
    const normalizedErrorId = String(errorId || "").trim();
    if (!normalizedErrorId) {
      return normalizedMessage;
    }
    return `${normalizedMessage} Reference: ${normalizedErrorId}.`;
  }

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const { data } = await supabase.auth.getSession();
      const user = data?.session?.user ?? null;

      if (!user) {
        router.replace("/author/submit");
        return;
      }

      try {
        setLoading(true);
        const accessToken = data?.session?.access_token;
        if (!accessToken) {
          router.replace("/author/submit");
          return;
        }

        const resp = await fetch("/api/author/dashboard", {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        const json = await resp.json().catch(() => ({}));
        if (!resp.ok) {
          throw new Error(
            appendErrorReference(
              json?.error || "Failed to load dashboard.",
              json?.errorId
            )
          );
        }

        if (!cancelled) {
          setManuscripts(json?.manuscripts || []);
          setLatestIssueId(
            typeof json?.latest_issue_id === "string" ? json.latest_issue_id : null
          );
        }
      } catch (err: unknown) {
        console.error(err);
        const message = err instanceof Error ? err.message : String(err);
        if (!cancelled) setStatus(message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  function fileToBase64(file: File) {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(",")[1] ?? "";
        resolve(base64);
      };
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });
  }

  async function openLatestPdf(manuscriptId: string) {
    try {
      setOpeningId(manuscriptId);
      setUploadMsg("");

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        router.replace("/author/submit");
        return;
      }

      const resp = await fetch(`/api/submissions/${manuscriptId}/signed-url`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        throw new Error(
          appendErrorReference(
            json?.error || "Failed to open latest manuscript file.",
            json?.errorId
          )
        );
      }

      if (json?.signedUrl) {
        window.open(json.signedUrl, "_blank", "noopener,noreferrer");
      }
    } catch (err: unknown) {
      console.error(err);
      const message = err instanceof Error ? err.message : String(err);
      setUploadMsg("Error: " + message);
    } finally {
      setOpeningId(null);
    }
  }

  async function handleRevisionUpload(manuscriptId: string, file: File) {
    try {
      setUploadingId(manuscriptId);
      setUploadMsg("");

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        router.replace("/author/submit");
        return;
      }

      const base64 = await fileToBase64(file);

      const resp = await fetch(
        `/api/submissions/${manuscriptId}/upload-revision`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            fileName: file.name,
            contentBase64: base64,
            contentType: file.type || "application/pdf",
          }),
        }
      );

      const text = await resp.text();
      let json: Record<string, unknown> | null = null;
      try {
        json = text ? (JSON.parse(text) as Record<string, unknown>) : null;
      } catch {
        // non-JSON body
      }

      if (!resp.ok) {
        throw new Error(
          appendErrorReference(
            String(json?.error || text || "Failed to upload revision"),
            typeof json?.errorId === "string" ? json.errorId : null
          )
        );
      }

      const revisionEmailSent = Boolean(
        (json?.notification as { sent?: boolean } | undefined)?.sent
      );
      setUploadMsg(
        revisionEmailSent
          ? "Revision uploaded successfully. Confirmation email sent."
          : "Revision uploaded successfully."
      );
    } catch (err: unknown) {
      console.error(err);
      const message = err instanceof Error ? err.message : String(err);
      setUploadMsg("Error: " + message);
    } finally {
      setUploadingId(null);
    }
  }

  const visibleManuscripts = useMemo(() => {
    return manuscripts.filter((manuscript) => {
      if (scope === "current_issue") {
        return Boolean(manuscript.is_in_current_issue);
      }

      if (scope === "unpublished") {
        return !manuscript.is_in_any_issue;
      }

      if (scope === "previous_issues") {
        return Boolean(manuscript.is_in_previous_issue);
      }

      return true;
    });
  }, [manuscripts, scope]);

  const scopeCounts = useMemo(() => {
    return {
      all: manuscripts.length,
      current_issue: manuscripts.filter((m) => m.is_in_current_issue).length,
      unpublished: manuscripts.filter((m) => !m.is_in_any_issue).length,
      previous_issues: manuscripts.filter((m) => m.is_in_previous_issue).length,
    };
  }, [manuscripts]);

  return (
    <main className="portal-page portal-page--author">
      <div className="portal-shell">
        <header className="portal-header">
          <div>
            <h1 className="portal-title">My Submissions</h1>
            <p className="portal-subtitle">
              Track your manuscript submissions and their current status.
            </p>
          </div>
          <Link href="/author/submit" className="portal-btn portal-btn--ghost">
            Submit a new manuscript &rarr;
          </Link>
        </header>

        <section className="portal-card">
          {loading && <p className="portal-empty">Loading submissions...</p>}
          {status && <p className="portal-status portal-status--error">{status}</p>}

          {!loading && manuscripts.length === 0 && (
            <p className="portal-empty">You have not submitted anything yet.</p>
          )}

          {!loading && manuscripts.length > 0 && (
            <>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 8,
                  marginBottom: 12,
                }}
              >
                {DASHBOARD_SCOPES.map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setScope(option.key)}
                    style={{
                      borderRadius: 999,
                      border:
                        scope === option.key
                          ? "1px solid rgba(106, 50, 145, 0.42)"
                          : "1px solid #d1d5db",
                      background:
                        scope === option.key
                          ? "rgba(106, 50, 145, 0.12)"
                          : "#ffffff",
                      color: scope === option.key ? "#6A3291" : "#111827",
                      padding: "8px 12px",
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    {option.label} ({scopeCounts[option.key]})
                  </button>
                ))}
              </div>

              {latestIssueId && scope === "current_issue" && (
                <p className="portal-meta" style={{ marginBottom: 12 }}>
                  Showing manuscripts already published in the latest issue.
                </p>
              )}

              {!latestIssueId && scope === "current_issue" && (
                <p className="portal-meta" style={{ marginBottom: 12 }}>
                  No published issue is available yet.
                </p>
              )}

              <table className="portal-table">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Status</th>
                    <th>Dates</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleManuscripts.map((m) => {
                    const currentStatus = m.status || "submitted";

                    const canRevise =
                      currentStatus === "submitted" ||
                      currentStatus === "under_review" ||
                      currentStatus === "revisions_requested";

                    const statusTone =
                      currentStatus === "accepted"
                        ? "success"
                        : currentStatus === "rejected"
                          ? "danger"
                          : currentStatus === "revisions_requested"
                            ? "warn"
                            : currentStatus === "under_review"
                              ? "review"
                              : "neutral";

                    const statusClass =
                      statusTone == "neutral"
                        ? "portal-status-pill"
                        : `portal-status-pill portal-status-pill--${statusTone}`;

                    return (
                      <tr key={m.id} className="portal-table__row">
                        <td>
                          <div style={{ fontWeight: 600 }}>
                            {m.title || "(untitled)"}
                          </div>
                          {m.issue_links && m.issue_links.length > 0 && (
                            <div
                              style={{
                                display: "flex",
                                flexWrap: "wrap",
                                gap: 6,
                                marginTop: 6,
                              }}
                            >
                              {m.issue_links.slice(0, 2).map((issueLink) => (
                                <span
                                  key={`${m.id}-${issueLink.issue_id}`}
                                  style={{
                                    borderRadius: 999,
                                    background: "rgba(106, 50, 145, 0.10)",
                                    color: "#6A3291",
                                    fontSize: 11,
                                    fontWeight: 700,
                                    padding: "3px 8px",
                                  }}
                                >
                                  {issueLink.issue_label}
                                </span>
                              ))}
                              {m.issue_links.length > 2 && (
                                <span
                                  style={{
                                    borderRadius: 999,
                                    background: "rgba(17, 24, 39, 0.06)",
                                    color: "#4b5563",
                                    fontSize: 11,
                                    fontWeight: 700,
                                    padding: "3px 8px",
                                  }}
                                >
                                  +{m.issue_links.length - 2} more
                                </span>
                              )}
                            </div>
                          )}
                          {m.latest_feedback?.recommendation && (
                            <div className="portal-meta" style={{ marginTop: 6 }}>
                              Latest review: {m.latest_feedback.recommendation}
                              {m.latest_feedback.decided_at
                                ? ` (${new Date(
                                    m.latest_feedback.decided_at
                                  ).toLocaleDateString()})`
                                : ""}
                            </div>
                          )}
                          {m.latest_feedback?.notes && (
                            <div
                              className="portal-meta"
                              style={{ marginTop: 4, whiteSpace: "pre-wrap" }}
                            >
                              Notes: {m.latest_feedback.notes}
                            </div>
                          )}
                        </td>
                        <td>
                          <span className={statusClass}>{currentStatus}</span>
                        </td>
                        <td>
                          <div>
                            Submitted:{" "}
                            {m.created_at
                              ? new Date(m.created_at).toLocaleDateString()
                              : "-"}
                          </div>
                          <div className="portal-meta" style={{ marginTop: 6 }}>
                            Latest version:{" "}
                            {m.latest_version?.created_at
                              ? new Date(m.latest_version.created_at).toLocaleDateString()
                              : "Initial version"}
                          </div>
                        </td>
                        <td>
                          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            <button
                              type="button"
                              className="portal-action"
                              onClick={() => {
                                void openLatestPdf(m.id);
                              }}
                              disabled={openingId === m.id}
                              style={{
                                border: "none",
                                background: "transparent",
                                padding: 0,
                                textAlign: "left",
                              }}
                            >
                              {openingId === m.id ? "Opening..." : "View latest PDF"}
                            </button>
                            {canRevise ? (
                              <label className="portal-action">
                                {uploadingId === m.id
                                  ? "Uploading..."
                                  : "Upload revision"}
                                <input
                                  type="file"
                                  accept="application/pdf"
                                  style={{ display: "none" }}
                                  onChange={(e) => {
                                    const f = (e.target as HTMLInputElement).files?.[0];
                                    if (f) handleRevisionUpload(m.id, f);
                                  }}
                                />
                              </label>
                            ) : (
                              <span className="portal-meta">No further revisions</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {visibleManuscripts.length === 0 && (
                <p className="portal-empty" style={{ marginTop: 12 }}>
                  No submissions found for this filter.
                </p>
              )}

              {uploadMsg && (
                <p
                  className={
                    uploadMsg.startsWith("Error")
                      ? "portal-status portal-status--error"
                      : "portal-status"
                  }
                >
                  {uploadMsg}
                </p>
              )}
            </>
          )}
        </section>
      </div>
    </main>
  );
}



