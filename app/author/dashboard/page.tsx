"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";

type Manuscript = {
  id: string;
  title: string | null;
  status: string | null;
  created_at: string | null;
  author_id: string | null;
};

export default function AuthorDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [manuscripts, setManuscripts] = useState<Manuscript[]>([]);
  const [status, setStatus] = useState("");
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [uploadMsg, setUploadMsg] = useState("");

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

        const { data: rows, error } = await supabase
          .from("manuscripts")
          .select("id, title, status, created_at, author_id")
          .or(`author_id.eq.${user.id},author_id.is.null`) // TEMP: includes old rows without author_id
          .order("created_at", { ascending: false });

        if (error) throw error;

        if (!cancelled) setManuscripts(rows || []);
      } catch (err: any) {
        console.error(err);
        if (!cancelled) setStatus(err.message || String(err));
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
      let json: any = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        // non-JSON body
      }

      if (!resp.ok) {
        throw new Error(json?.error || text || "Failed to upload revision");
      }

      setUploadMsg("Revision uploaded successfully.");
    } catch (err: any) {
      console.error(err);
      setUploadMsg("Error: " + (err.message || String(err)));
    } finally {
      setUploadingId(null);
    }
  }

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
            <p className="portal-empty">You haven't submitted anything yet.</p>
          )}

          {!loading && manuscripts.length > 0 && (
            <>
              <table className="portal-table">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Status</th>
                    <th>Submitted</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {manuscripts.map((m) => {
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
                        <td>{m.title || "(untitled)"}</td>
                        <td>
                          <span className={statusClass}>{currentStatus}</span>
                        </td>
                        <td>
                          {m.created_at
                            ? new Date(m.created_at).toLocaleDateString()
                            : ""}
                        </td>
                        <td>
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
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

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



