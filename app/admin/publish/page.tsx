"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";

type Manuscript = {
  id: string;
  title: string | null;
  status: string | null;
  created_at: string | null;
  // optional authors or pdf refs if you ever add them
  authors?: string | null;
  pdf_path?: string | null;
  file_storage_path?: string | null;
};

const ISSUE_BUCKET =
  process.env.NEXT_PUBLIC_SUPABASE_BUCKET_ISSUES || "issues-pdfs";

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

  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");

  // Ensure admin is signed in, then load manuscripts
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
        const json = await resp.json();

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
    // Avoid useSearchParams() here to keep this page prerender-safe
    const preselectId =
      typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("select")
        : null;
    if (!preselectId) return;
    setSelectedIds((prev) =>
      prev.includes(preselectId) ? prev : [...prev, preselectId]
    );
  }, []);

  function toggleManuscript(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  // Helper: fetch latest manuscript_version row for a manuscript id (if available)
  async function fetchLatestManuscriptVersion(
    manuscriptId: string
  ): Promise<any | null> {
    try {
      const { data, error } = await supabase
        .from("manuscript_versions")
        .select("*")
        .eq("manuscript_id", manuscriptId)
        .order("created_at", { ascending: false })
        .limit(1);

      if (error) {
        console.warn("manuscript_versions query failed:", error.message);
        return null;
      }

      return (data && data[0]) || null;
    } catch (err) {
      console.warn("Failed to query manuscript_versions:", err);
      return null;
    }
  }

  // Create article rows in `articles` for each selected manuscript
  async function createArticlesForManuscripts(issueId: string) {
    if (!issueId || selectedIds.length === 0) return;

    try {
      // 1) load manuscript titles/authors in bulk
      const { data: msData, error: msErr } = await supabase
        .from("manuscripts")
        .select("id, title, authors, pdf_path, file_storage_path")
        .in("id", selectedIds);

      if (msErr) {
        console.warn(
          "Failed to load manuscripts for article creation:",
          msErr.message
        );
        return;
      }

      const manuscriptsFound = (msData || []) as Manuscript[];
      const articleRows: any[] = [];

      for (const m of manuscriptsFound) {
        let pdfPath: string | null =
          m.pdf_path ?? m.file_storage_path ?? null;

        // If no direct pdfPath on manuscript, try latest version row
        if (!pdfPath) {
          const latestVersion = await fetchLatestManuscriptVersion(m.id);
          if (latestVersion) {
            pdfPath =
              latestVersion.file_storage_path ||
              latestVersion.storage_path ||
              latestVersion.pdf_path ||
              latestVersion.path ||
              latestVersion.s3_path ||
              latestVersion.url ||
              null;
          }
        }

        articleRows.push({
          issue_id: issueId,
          title: m.title ?? "(untitled)",
          abstract: null,
          authors: m.authors ?? null,
          pdf_path: pdfPath,
        });
      }

      if (articleRows.length === 0) return;

      // 3) Insert article rows (bulk insert)
      const { error: insertErr } = await supabase
        .from("articles")
        .insert(articleRows);

      if (insertErr) {
        console.warn("Failed to insert articles:", insertErr.message);
        setStatusMsg(
          `Issue published, but failed to create article entries: ${insertErr.message}`
        );
        return;
      }

      setStatusMsg("Issue published and articles created successfully.");
    } catch (err: any) {
      console.error("Error creating articles from manuscripts:", err);
      setStatusMsg(
        "Issue published, but error creating articles: " + err?.message
      );
    }
  }

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

    setPublishing(true);
    setStatusMsg("Publishing issue…");

    try {
      let pdfPublicUrl: string | null = null;

      // 1) Upload full-issue PDF if provided
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

      // 2) Create issue on server
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
          published_at: publishedAt
            ? new Date(publishedAt).toISOString()
            : null,
          cover_url: coverUrl || null,
          pdf_path: pdfPublicUrl,
          manuscript_ids: selectedIds,
        }),
      });

      const json = await resp.json();
      if (!resp.ok) {
        throw new Error(json?.error || "Failed to publish issue");
      }

      // 3) Determine issueId (prefer server response)
      let issueId =
        (json?.issue?.id as string | undefined) ??
        ""; // TS-safe initial value

      if (!issueId) {
        const { data: created, error: findErr } = await supabase
          .from("issues")
          .select("id")
          .eq("title", title)
          .order("created_at", { ascending: false })
          .limit(1);

        if (findErr || !created || created.length === 0) {
          throw new Error("Issue published but could not determine issue ID.");
        }

        issueId = created[0].id as string;
      }

      if (!issueId) {
        throw new Error("Issue ID is missing after publishing.");
      }

      // 4) Create article rows from selected manuscripts (best-effort)
      await createArticlesForManuscripts(issueId);

      // 5) Redirect to issue page
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
        Create an issue and include selected manuscripts as articles in the
        Table of Contents.
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

        <div style={{ display: "flex", gap: 10 }}>
          <div style={{ flex: 1 }}>
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
          <div style={{ flex: 1 }}>
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
          <div style={{ flex: 1 }}>
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
            Stored in bucket <code>{ISSUE_BUCKET}</code> and linked from the
            issue page.
          </p>
        </div>

        <hr style={{ margin: "16px 0" }} />

        <div>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>
            Select manuscripts
          </h2>
          {loading && <p>Loading manuscripts…</p>}
          {!loading && manuscripts.length === 0 && (
            <p>No manuscripts available.</p>
          )}
          {!loading && manuscripts.length > 0 && (
            <div
              style={{
                maxHeight: 260,
                overflowY: "auto",
                border: "1px solid #e5e7eb",
                borderRadius: 8,
                padding: 8,
                background: "white",
              }}
            >
              {manuscripts.map((m) => (
                <label
                  key={m.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "4px 0",
                    borderBottom: "1px solid #f3f4f6",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(m.id)}
                    onChange={() => toggleManuscript(m.id)}
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
                      Status: {m.status || "submitted"} ·{" "}
                      {m.created_at
                        ? new Date(m.created_at).toLocaleString()
                        : ""}
                    </div>
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
            {publishing ? "Publishing…" : "Publish issue"}
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
