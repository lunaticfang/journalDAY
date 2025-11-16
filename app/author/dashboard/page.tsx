"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { useRouter } from "next/navigation";

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

      const base64 = await fileToBase64(file);

      const resp = await fetch(
        `/api/submissions/${manuscriptId}/upload-revision`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
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
        // non-JSON body (e.g. plain error text)
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
    <main style={{ maxWidth: 900, margin: "0 auto", padding: 24 }}>
      <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 8 }}>
        My Submissions
      </h1>

      <p style={{ color: "#555", marginBottom: 24 }}>
        Track your manuscript submissions and their current status.
      </p>

      <p style={{ marginBottom: 16 }}>
        <a
          href="/author/submit"
          style={{ textDecoration: "underline", fontSize: 14 }}
        >
          Submit a new manuscript →
        </a>
      </p>

      {loading && <p>Loading submissions…</p>}
      {status && <p style={{ color: "crimson" }}>{status}</p>}

      {!loading && manuscripts.length === 0 && (
        <p>You haven’t submitted anything yet.</p>
      )}

      {!loading && manuscripts.length > 0 && (
        <>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: 14,
            }}
          >
            <thead>
              <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
                <th style={{ textAlign: "left", padding: 8 }}>Title</th>
                <th style={{ padding: 8 }}>Status</th>
                <th style={{ padding: 8 }}>Submitted</th>
                <th style={{ padding: 8 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {manuscripts.map((m) => {
                const currentStatus = m.status || "submitted";

                // Authors can revise only before final decision
                const canRevise =
                  currentStatus === "submitted" ||
                  currentStatus === "under_review" ||
                  currentStatus === "revisions_requested"; // if you add this status later

                return (
                  <tr
                    key={m.id}
                    style={{ borderBottom: "1px solid #f3f4f6", color: "#444" }}
                  >
                    <td style={{ padding: 8 }}>{m.title || "(untitled)"}</td>
                    <td style={{ padding: 8, textAlign: "center" }}>
                      {currentStatus}
                    </td>
                    <td style={{ padding: 8, textAlign: "center" }}>
                      {m.created_at
                        ? new Date(m.created_at).toLocaleDateString()
                        : ""}
                    </td>
                    <td style={{ padding: 8, textAlign: "center" }}>
                      {canRevise ? (
                        <label
                          style={{
                            fontSize: 12,
                            textDecoration: "underline",
                            cursor: "pointer",
                          }}
                        >
                          {uploadingId === m.id ? "Uploading…" : "Upload revision"}
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
                        <span
                          style={{
                            fontSize: 12,
                            color: "#6b7280",
                          }}
                        >
                          No further revisions
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {uploadMsg && (
            <p
              style={{
                marginTop: 12,
                fontSize: 13,
                color: uploadMsg.startsWith("Error") ? "crimson" : "#111",
              }}
            >
              {uploadMsg}
            </p>
          )}
        </>
      )}
    </main>
  );
}
