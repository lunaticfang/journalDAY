"use client";

import { useEffect, useMemo, useState } from "react";
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
  authors?: string | null;
  issue_links?: IssueLink[];
  issue_count?: number;
  is_in_any_issue?: boolean;
  is_in_current_issue?: boolean;
  is_in_other_issues?: boolean;
};

type ManuscriptFilter = "available" | "previous" | "all";

const ISSUE_BUCKET =
  process.env.NEXT_PUBLIC_SUPABASE_BUCKET_ISSUES || "issues-pdfs";

const MANUSCRIPT_FILTERS: { key: ManuscriptFilter; label: string }[] = [
  { key: "available", label: "Not In Any Issue Yet" },
  { key: "previous", label: "Already In Previous Issues" },
  { key: "all", label: "All Manuscripts" },
];

function normalizeSearch(value: string | null | undefined) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export default function PublishIssuePage() {
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [volume, setVolume] = useState("");
  const [issueNumber, setIssueNumber] = useState("");
  const [publishedAt, setPublishedAt] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [coverUrl, setCoverUrl] = useState("");
  const [issuePdfFile, setIssuePdfFile] = useState<File | null>(null);

  const [manuscripts, setManuscripts] = useState<Manuscript[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [manuscriptFilter, setManuscriptFilter] =
    useState<ManuscriptFilter>("available");

  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");

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
        await loadManuscripts();
      }
    })();

    async function loadManuscripts() {
      try {
        setLoading(true);
        setStatusMsg("");

        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token;

        const resp = await fetch("/api/admin/list-manuscripts", {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        const json = await resp.json().catch(() => ({}));

        if (!resp.ok) {
          throw new Error(json?.error || "Failed to load manuscripts");
        }

        setManuscripts((json.manuscripts || []) as Manuscript[]);
      } catch (err: any) {
        console.error(err);
        setStatusMsg(err.message || String(err));
      } finally {
        setLoading(false);
      }
    }

    return () => {
      mounted = false;
    };
  }, [router]);

  useEffect(() => {
    const preselectId =
      typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("select")
        : null;
    if (!preselectId) return;
    setManuscriptFilter("all");
    setSelectedIds((prev) =>
      prev.includes(preselectId) ? prev : [...prev, preselectId]
    );
  }, []);

  function toggleManuscript(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  const visibleManuscripts = useMemo(() => {
    const normalizedQuery = normalizeSearch(searchQuery);

    return manuscripts
      .filter((manuscript) => {
        if (manuscriptFilter === "available") {
          return !manuscript.is_in_any_issue;
        }

        if (manuscriptFilter === "previous") {
          return Boolean(manuscript.is_in_any_issue);
        }

        return true;
      })
      .filter((manuscript) => {
        if (!normalizedQuery) {
          return true;
        }

        const haystack = [
          manuscript.id,
          manuscript.title,
          manuscript.authors,
          manuscript.status,
          ...(manuscript.issue_links || []).map((issue) => issue.issue_label),
        ]
          .map((value) => normalizeSearch(value))
          .join(" ");

        return haystack.includes(normalizedQuery);
      });
  }, [manuscriptFilter, manuscripts, searchQuery]);

  const selectedPreviousIssueCount = useMemo(() => {
    return manuscripts.filter(
      (manuscript) =>
        selectedIds.includes(manuscript.id) && Boolean(manuscript.is_in_any_issue)
    ).length;
  }, [manuscripts, selectedIds]);

  async function handlePublish(e: React.FormEvent) {
    e.preventDefault();

    if (!title) {
      setStatusMsg("Issue title is required.");
      return;
    }
    if (selectedIds.length === 0) {
      setStatusMsg("Select at least one manuscript for this issue.");
      return;
    }

    if (selectedPreviousIssueCount > 0 && typeof window !== "undefined") {
      const confirmed = window.confirm(
        `${selectedPreviousIssueCount} selected manuscript${
          selectedPreviousIssueCount === 1 ? "" : "s"
        } already appear in a previous issue. Publish this issue anyway?`
      );

      if (!confirmed) {
        return;
      }
    }

    setPublishing(true);
    setStatusMsg("Publishing issue...");

    try {
      let pdfPublicUrl: string | null = null;

      if (issuePdfFile) {
        const cleanName = issuePdfFile.name.replace(/[^\w.\-]/g, "_");
        const path = `issues/${Date.now()}-${cleanName}`;

        const { data: uploadData, error: uploadErr } = await supabase.storage
          .from(ISSUE_BUCKET)
          .upload(path, issuePdfFile, {
            cacheControl: "3600",
            upsert: false,
            contentType: issuePdfFile.type || "application/pdf",
          });

        if (uploadErr) throw uploadErr;

        const { data: publicData } = supabase.storage
          .from(ISSUE_BUCKET)
          .getPublicUrl(uploadData.path);

        pdfPublicUrl = publicData?.publicUrl ?? null;
      }

      const issueNumberInt =
        issueNumber.trim() === "" ? null : Number(issueNumber);

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      const resp = await fetch("/api/admin/publish-issue", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          title,
          volume: volume || null,
          issue_number: Number.isNaN(issueNumberInt) ? null : issueNumberInt,
          published_at: publishedAt ? new Date(publishedAt).toISOString() : null,
          cover_url: coverUrl || null,
          pdf_path: pdfPublicUrl,
          manuscript_ids: selectedIds,
        }),
      });

      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        throw new Error(json?.error || "Failed to publish issue");
      }

      const issueId = (json?.issue?.id as string | undefined) || "";
      if (!issueId) {
        throw new Error("Issue ID is missing after publishing.");
      }

      setStatusMsg("Issue published successfully.");
      setTimeout(() => {
        router.push(`/issues/${issueId}`);
      }, 800);
    } catch (err: any) {
      console.error(err);
      setStatusMsg("Error: " + (err.message || String(err)));
    } finally {
      setPublishing(false);
    }
  }

  return (
    <main style={{ maxWidth: 960, margin: "0 auto" }}>
      <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 8 }}>
        Publish new issue
      </h1>
      <p style={{ color: "#4b5563", marginBottom: 18, fontSize: 14 }}>
        Create an issue and include selected manuscripts as articles in the Table
        of Contents. Manuscripts already used in older issues are hidden by default
        so the current issue stays clean.
      </p>

      <form
        onSubmit={handlePublish}
        style={{ display: "grid", gap: 14, marginBottom: 20 }}
      >
        <div>
          <label style={{ display: "block", fontSize: 14, marginBottom: 4 }}>
            Issue title *
          </label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Volume 1, Issue 1 (2025)"
            style={{
              width: "100%",
              padding: 8,
              borderRadius: 6,
              border: "1px solid #d1d5db",
              fontSize: 14,
            }}
          />
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 180 }}>
            <label style={{ display: "block", fontSize: 14, marginBottom: 4 }}>
              Volume
            </label>
            <input
              value={volume}
              onChange={(e) => setVolume(e.target.value)}
              placeholder="1"
              style={{
                width: "100%",
                padding: 8,
                borderRadius: 6,
                border: "1px solid #d1d5db",
                fontSize: 14,
              }}
            />
          </div>
          <div style={{ flex: 1, minWidth: 180 }}>
            <label style={{ display: "block", fontSize: 14, marginBottom: 4 }}>
              Issue number
            </label>
            <input
              value={issueNumber}
              onChange={(e) => setIssueNumber(e.target.value)}
              placeholder="1"
              style={{
                width: "100%",
                padding: 8,
                borderRadius: 6,
                border: "1px solid #d1d5db",
                fontSize: 14,
              }}
            />
          </div>
          <div style={{ flex: 1, minWidth: 180 }}>
            <label style={{ display: "block", fontSize: 14, marginBottom: 4 }}>
              Published date
            </label>
            <input
              type="date"
              value={publishedAt}
              onChange={(e) => setPublishedAt(e.target.value)}
              style={{
                width: "100%",
                padding: 8,
                borderRadius: 6,
                border: "1px solid #d1d5db",
                fontSize: 14,
              }}
            />
          </div>
        </div>

        <div>
          <label style={{ display: "block", fontSize: 14, marginBottom: 4 }}>
            Cover image URL
          </label>
          <input
            value={coverUrl}
            onChange={(e) => setCoverUrl(e.target.value)}
            placeholder="https://example.com/cover.jpg"
            style={{
              width: "100%",
              padding: 8,
              borderRadius: 6,
              border: "1px solid #d1d5db",
              fontSize: 14,
            }}
          />
        </div>

        <div>
          <label style={{ display: "block", fontSize: 14, marginBottom: 4 }}>
            Full issue PDF (optional)
          </label>
          <input
            type="file"
            accept="application/pdf"
            onChange={(e) =>
              setIssuePdfFile((e.target as HTMLInputElement).files?.[0] ?? null)
            }
          />
          <p style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
            Stored in bucket <code>{ISSUE_BUCKET}</code> and linked from the issue
            page.
          </p>
        </div>

        <hr style={{ margin: "16px 0" }} />

        <div>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>
            Select manuscripts
          </h2>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
              marginBottom: 12,
            }}
          >
            {MANUSCRIPT_FILTERS.map((filterOption) => (
              <button
                key={filterOption.key}
                type="button"
                onClick={() => setManuscriptFilter(filterOption.key)}
                style={{
                  borderRadius: 999,
                  border:
                    manuscriptFilter === filterOption.key
                      ? "1px solid rgba(106, 50, 145, 0.4)"
                      : "1px solid #d1d5db",
                  background:
                    manuscriptFilter === filterOption.key
                      ? "rgba(106, 50, 145, 0.12)"
                      : "#ffffff",
                  color:
                    manuscriptFilter === filterOption.key ? "#6A3291" : "#111827",
                  padding: "8px 12px",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {filterOption.label}
              </button>
            ))}
          </div>

          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by title, author, status, issue, or manuscript id"
            style={{
              width: "100%",
              padding: 10,
              borderRadius: 8,
              border: "1px solid #d1d5db",
              fontSize: 14,
              marginBottom: 12,
            }}
          />

          {loading && <p>Loading manuscripts...</p>}
          {!loading && manuscripts.length === 0 && <p>No manuscripts available.</p>}
          {!loading && manuscripts.length > 0 && (
            <div
              style={{
                maxHeight: 320,
                overflowY: "auto",
                border: "1px solid #e5e7eb",
                borderRadius: 8,
                padding: 8,
                background: "white",
              }}
            >
              {visibleManuscripts.length === 0 && (
                <p style={{ margin: 8, fontSize: 13, color: "#6b7280" }}>
                  {searchQuery.trim()
                    ? "No manuscripts match this search."
                    : manuscriptFilter === "previous"
                    ? "No manuscripts from previous issues are in view."
                    : manuscriptFilter === "all"
                    ? "No manuscripts available."
                    : "No manuscripts are waiting for their first issue yet."}
                </p>
              )}

              {visibleManuscripts.map((m) => (
                <label
                  key={m.id}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 8,
                    padding: "8px 4px",
                    borderBottom: "1px solid #f3f4f6",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(m.id)}
                    onChange={() => toggleManuscript(m.id)}
                    style={{ marginTop: 4 }}
                  />
                  <div>
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 500,
                        color: "#111827",
                      }}
                    >
                      {m.title || "(untitled)"}
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: "#6b7280",
                      }}
                    >
                      Status: {m.status || "submitted"} · {m.created_at
                        ? new Date(m.created_at).toLocaleString()
                        : ""}
                    </div>
                    {m.authors && (
                      <div
                        style={{
                          fontSize: 12,
                          color: "#6b7280",
                          marginTop: 4,
                        }}
                      >
                        {m.authors}
                      </div>
                    )}
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
                              background: "rgba(106, 50, 145, 0.08)",
                              color: "#6A3291",
                              fontSize: 11,
                              fontWeight: 700,
                              padding: "4px 8px",
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
                              padding: "4px 8px",
                            }}
                          >
                            +{m.issue_links.length - 2} more
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>

        <div>
          <button
            type="submit"
            disabled={publishing}
            style={{
              padding: "9px 16px",
              borderRadius: 999,
              border: "none",
              backgroundColor: publishing ? "#6b7280" : "#059669",
              color: "white",
              fontSize: 14,
              fontWeight: 500,
              cursor: publishing ? "default" : "pointer",
              marginTop: 6,
            }}
          >
            {publishing ? "Publishing..." : "Publish issue"}
          </button>
        </div>
      </form>

      {statusMsg && (
        <p
          style={{
            marginTop: 8,
            fontSize: 13,
            color: statusMsg.startsWith("Error") ? "crimson" : "#111827",
          }}
        >
          {statusMsg}
        </p>
      )}
    </main>
  );
}

