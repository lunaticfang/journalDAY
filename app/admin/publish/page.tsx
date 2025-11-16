"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";

type Manuscript = {
  id: string;
  title: string | null;
  status: string | null;
  created_at: string | null;
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

        const resp = await fetch("/api/admin/list-manuscripts");
        const json = await resp.json();

        if (!resp.ok) {
          throw new Error(json?.error || "Failed to load manuscripts");
        }

        setManuscripts(json.manuscripts || []);
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

  function toggleManuscript(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
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

      // 2) Create issue + article rows on server
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

      setStatusMsg("Issue published successfully.");
      if (json.issue?.id) {
        setTimeout(() => router.push(`/issues/${json.issue.id}`), 800);
      }
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
          <label
            style={{ display: "block", fontSize: 14, marginBottom: 4 }}
          >
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
            <label
              style={{ display: "block", fontSize: 14, marginBottom: 4 }}
            >
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
            <label
              style={{ display: "block", fontSize: 14, marginBottom: 4 }}
            >
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
            <label
              style={{ display: "block", fontSize: 14, marginBottom: 4 }}
            >
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
          <label
            style={{ display: "block", fontSize: 14, marginBottom: 4 }}
          >
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
          <label
            style={{ display: "block", fontSize: 14, marginBottom: 4 }}
          >
            Full issue PDF (optional)
          </label>
          <input
            type="file"
            accept="application/pdf"
            onChange={(e) =>
              setIssuePdfFile(
                (e.target as HTMLInputElement).files?.[0] ?? null
              )
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
