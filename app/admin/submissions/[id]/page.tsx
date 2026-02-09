"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../../lib/supabaseClient";

type Manuscript = {
  id: string;
  title: string | null;
  abstract: string | null;
  status: string | null;
  created_at: string | null;
  authors?: string | null;
  file_storage_path?: string | null;
  word_path?: string | null;
};

type Review = {
  id: string;
  reviewer_id: string;
  recommendation?: string | null;
  notes?: string | null;
  created_at?: string | null;
  decided_at?: string | null;
};

type ReviewerProfile = {
  id: string;
  email?: string | null;
  full_name?: string | null;
};

export default function AdminSubmissionDetail() {
  const params = useParams();
  const router = useRouter();
  const manuscriptId = params?.id as string;

  const [token, setToken] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [manuscript, setManuscript] = useState<Manuscript | null>(null);
  const [authors, setAuthors] = useState<any[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewerProfiles, setReviewerProfiles] = useState<ReviewerProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [assignEmail, setAssignEmail] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [decisionLoading, setDecisionLoading] = useState(false);
  const [recommendation, setRecommendation] = useState("accept");
  const [reviewNotes, setReviewNotes] = useState("");

  useEffect(() => {
    let mounted = true;

    async function load() {
      const { data } = await supabase.auth.getSession();
      const session = data.session;
      const user = session?.user ?? null;
      if (!user) {
        router.replace("/admin/login");
        return;
      }

      if (!mounted) return;
      const accessToken = session?.access_token ?? null;
      setToken(accessToken);

      try {
        setLoading(true);
        setError("");

        const resp = await fetch(`/api/admin/submissions/${manuscriptId}`, {
          headers: accessToken
            ? { Authorization: `Bearer ${accessToken}` }
            : undefined,
        });
        const json = await resp.json();
        if (!resp.ok) throw new Error(json?.error || "Failed to load submission");

        setManuscript(json.manuscript || null);
        setAuthors(json.authors || []);
        setReviews(json.reviews || []);
        setReviewerProfiles(json.reviewers || []);
        setRole(json.role || null);
      } catch (err: any) {
        console.error(err);
        setError(err.message || String(err));
      } finally {
        setLoading(false);
      }
    }

    if (manuscriptId) {
      load();
    }

    return () => {
      mounted = false;
    };
  }, [manuscriptId, router]);

  const reviewerLookup = useMemo(() => {
    const map = new Map<string, ReviewerProfile>();
    reviewerProfiles.forEach((r) => {
      map.set(r.id, r);
    });
    return map;
  }, [reviewerProfiles]);

  async function openSignedUrl(type: "pdf" | "word") {
    if (!manuscriptId) return;
    const query = type === "word" ? "?type=word" : "";
    const resp = await fetch(`/api/submissions/${manuscriptId}/signed-url${query}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    const json = await resp.json();
    if (!resp.ok) {
      setError(json?.error || "Failed to get signed URL");
      return;
    }
    if (json.signedUrl) {
      window.open(json.signedUrl, "_blank", "noopener,noreferrer");
    }
  }

  async function assignReviewer() {
    if (!assignEmail) {
      setError("Provide a reviewer email.");
      return;
    }
    try {
      setAssigning(true);
      setError("");
      const resp = await fetch("/api/admin/review/assign", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          manuscript_id: manuscriptId,
          reviewer_email: assignEmail,
        }),
      });
      const json = await resp.json();
      if (!resp.ok) throw new Error(json?.error || "Failed to assign reviewer");
      setAssignEmail("");
      await refresh();
    } catch (err: any) {
      console.error(err);
      setError(err.message || String(err));
    } finally {
      setAssigning(false);
    }
  }

  async function refresh() {
    if (!token) return;
    const resp = await fetch(`/api/admin/submissions/${manuscriptId}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    const json = await resp.json();
    if (!resp.ok) return;
    setManuscript(json.manuscript || null);
    setAuthors(json.authors || []);
    setReviews(json.reviews || []);
    setReviewerProfiles(json.reviewers || []);
  }

  async function updateStatus(status: string) {
    try {
      setDecisionLoading(true);
      setError("");
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
      await refresh();
    } catch (err: any) {
      console.error(err);
      setError(err.message || String(err));
    } finally {
      setDecisionLoading(false);
    }
  }

  async function submitReview() {
    try {
      setDecisionLoading(true);
      setError("");
      const resp = await fetch("/api/admin/review/decision", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          manuscript_id: manuscriptId,
          recommendation,
          notes: reviewNotes,
        }),
      });
      const json = await resp.json();
      if (!resp.ok) throw new Error(json?.error || "Failed to submit review");
      await refresh();
      setReviewNotes("");
    } catch (err: any) {
      console.error(err);
      setError(err.message || String(err));
    } finally {
      setDecisionLoading(false);
    }
  }

  if (loading) {
    return (
      <main className="admin-page">
        <div className="admin-shell">
          <p className="admin-muted">Loading submission...</p>
        </div>
      </main>
    );
  }

  if (!manuscript) {
    return (
      <main className="admin-page">
        <div className="admin-shell">
          <p className="admin-muted">Submission not found.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="admin-page">
      <div className="admin-shell">
        <header className="admin-detail__header">
          <div>
            <Link href="/admin" className="admin-link">
              Back to inbox
            </Link>
            <h1 className="admin-title">{manuscript.title || "(untitled)"}</h1>
            <p className="admin-subtitle">
              Submitted {manuscript.created_at ? new Date(manuscript.created_at).toLocaleString() : "Unknown date"}
            </p>
          </div>
          <span className={`admin-status admin-status--${manuscript.status || "submitted"}`}>
            {manuscript.status || "submitted"}
          </span>
        </header>

        {error && <div className="admin-alert admin-alert--error">{error}</div>}

        <div className="admin-detail__grid">
          <section className="admin-panel">
            <h3>Submission files</h3>
            <div className="admin-actions">
              <button
                className="admin-btn admin-btn--ghost"
                type="button"
                onClick={() => openSignedUrl("pdf")}
                disabled={!manuscript.file_storage_path}
              >
                View PDF
              </button>
              <button
                className="admin-btn admin-btn--ghost"
                type="button"
                onClick={() => openSignedUrl("word")}
                disabled={!manuscript.word_path}
              >
                View Word file
              </button>
            </div>
          </section>

          <section className="admin-panel">
            <h3>Abstract</h3>
            <p className="admin-muted">
              {manuscript.abstract || "No abstract provided."}
            </p>
          </section>

          <section className="admin-panel">
            <h3>Authors</h3>
            {authors.length === 0 && (
              <p className="admin-muted">No author data available.</p>
            )}
            <ul className="admin-list">
              {authors.map((a, idx) => (
                <li key={`${a.email}-${idx}`}>
                  <strong>{a.name || "Unnamed author"}</strong>
                  <span>{a.email}</span>
                  <span>{a.role || "author"}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="admin-panel admin-panel--wide">
            <h3>Reviewer activity</h3>
            {reviews.length === 0 && (
              <p className="admin-muted">No reviewers assigned yet.</p>
            )}
            {reviews.length > 0 && (
              <ul className="admin-list">
                {reviews.map((r) => {
                  const reviewer = reviewerLookup.get(r.reviewer_id);
                  return (
                    <li key={r.id}>
                      <strong>{reviewer?.full_name || reviewer?.email || r.reviewer_id}</strong>
                      <span>{r.recommendation || "Pending review"}</span>
                      <span>{r.decided_at ? "Decision received" : "Waiting"}</span>
                    </li>
                  );
                })}
              </ul>
            )}

            {role !== "reviewer" && (
              <div className="admin-inline-form">
                <input
                  className="admin-input"
                  placeholder="Assign reviewer email"
                  value={assignEmail}
                  onChange={(e) => setAssignEmail(e.target.value)}
                />
                <button
                  className="admin-btn admin-btn--primary"
                  type="button"
                  disabled={assigning}
                  onClick={assignReviewer}
                >
                  {assigning ? "Assigning..." : "Assign reviewer"}
                </button>
              </div>
            )}
          </section>

          {role !== "reviewer" && (
            <section className="admin-panel admin-panel--wide">
              <h3>Editor decisions</h3>
              <div className="admin-actions">
                <button
                  className="admin-btn admin-btn--ghost"
                  type="button"
                  onClick={() => updateStatus("revisions_requested")}
                  disabled={decisionLoading}
                >
                  Request revisions
                </button>
                <button
                  className="admin-btn admin-btn--ghost"
                  type="button"
                  onClick={() => updateStatus("accepted")}
                  disabled={decisionLoading}
                >
                  Accept
                </button>
                <button
                  className="admin-btn admin-btn--ghost"
                  type="button"
                  onClick={() => updateStatus("rejected")}
                  disabled={decisionLoading}
                >
                  Reject
                </button>
                {manuscript.status === "accepted" && (
                  <Link
                    href={`/admin/publish?select=${manuscript.id}`}
                    className="admin-btn admin-btn--primary"
                  >
                    Publish to issue
                  </Link>
                )}
              </div>
            </section>
          )}

          {role === "reviewer" && (
            <section className="admin-panel admin-panel--wide">
              <h3>Submit your review</h3>
              <div className="admin-inline-form">
                <select
                  className="admin-select"
                  value={recommendation}
                  onChange={(e) => setRecommendation(e.target.value)}
                >
                  <option value="accept">Accept</option>
                  <option value="minor_revisions">Minor revisions</option>
                  <option value="major_revisions">Major revisions</option>
                  <option value="reject">Reject</option>
                </select>
                <button
                  className="admin-btn admin-btn--primary"
                  type="button"
                  disabled={decisionLoading}
                  onClick={submitReview}
                >
                  Submit review
                </button>
              </div>
              <textarea
                className="admin-textarea"
                placeholder="Notes for the editor..."
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
              />
            </section>
          )}
        </div>
      </div>
    </main>
  );
}
