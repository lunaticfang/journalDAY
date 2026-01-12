"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

type Props = {
  contentKey: string;
  isEditor: boolean;
};

type SiteFileRow = {
  id: string;
  content_key: string;
  bucket: string;
  path: string;
  filename: string;
  mime: string | null;
  public_url: string | null;
  uploader_id: string | null;
  uploaded_at: string | null;
};

const DEFAULT_BUCKET = "instructions-pdfs"; // change if needed

export default function FileAttachment({ contentKey, isEditor }: Props) {
  const [row, setRow] = useState<SiteFileRow | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [fileType, setFileType] = useState<"image" | "pdf" | null>(null);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /* ---------------- Load existing file ---------------- */
  useEffect(() => {
    let mounted = true;

    (async () => {
      setLoading(true);
      setError(null);

      try {
        const { data, error } = await supabase
          .from("site_files")
          .select("*")
          .eq("content_key", contentKey)
          .order("uploaded_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) throw error;
        if (!mounted) return;

        if (data) {
          const r = data as SiteFileRow;
          setRow(r);
          setFileUrl(r.public_url);
          const mt = (r.mime || "").toLowerCase();
          setFileType(mt.startsWith("image/") ? "image" : mt === "application/pdf" ? "pdf" : null);
        } else {
          setRow(null);
          setFileUrl(null);
          setFileType(null);
        }
      } catch (err: any) {
        console.error("FileAttachment load error:", err);
        setError(err?.message || "Failed to load attachment");
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [contentKey]);

  /* ---------------- Upload ---------------- */
  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);

    const isAllowed =
      file.type.startsWith("image/") ||
      file.type === "application/pdf" ||
      file.name.toLowerCase().endsWith(".pdf");

    if (!isAllowed) {
      setError("Only images and PDFs are allowed.");
      return;
    }

    setUploading(true);

    try {
      const bucket = DEFAULT_BUCKET;
      const safeName = file.name.replace(/\s+/g, "_");
      const path = `${contentKey}/${Date.now()}_${safeName}`;

      const upload = await supabase.storage.from(bucket).upload(path, file);
      if (upload.error) throw upload.error;

      const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path);
      const publicUrl = urlData?.publicUrl ?? null;

      const { data: userData } = await supabase.auth.getUser();
      const uploaderId = userData?.user?.id ?? null;

      const { error: insertErr } = await supabase.from("site_files").insert({
        content_key: contentKey,
        bucket,
        path,
        filename: file.name,
        mime: file.type || null,
        public_url: publicUrl,
        uploader_id: uploaderId,
        uploaded_at: new Date().toISOString(),
      });

      if (insertErr) throw insertErr;

      // Reload latest file
      const { data: newRow } = await supabase
        .from("site_files")
        .select("*")
        .eq("content_key", contentKey)
        .order("uploaded_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (newRow) {
        const r = newRow as SiteFileRow;
        setRow(r);
        setFileUrl(r.public_url);
        const mt = (r.mime || "").toLowerCase();
        setFileType(mt.startsWith("image/") ? "image" : mt === "application/pdf" ? "pdf" : null);
      }
    } catch (err: any) {
      console.error("Upload failed:", err);
      setError(err?.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  /* ---------------- Delete ---------------- */
  async function handleDelete() {
    if (!row) return;
    if (!confirm(`Delete "${row.filename}"?`)) return;

    setUploading(true);
    setError(null);

    try {
      await supabase.storage.from(row.bucket).remove([row.path]);
      const { error } = await supabase.from("site_files").delete().eq("id", row.id);
      if (error) throw error;

      setRow(null);
      setFileUrl(null);
      setFileType(null);
    } catch (err: any) {
      console.error("Delete failed:", err);
      setError(err?.message || "Delete failed");
    } finally {
      setUploading(false);
    }
  }

  /* ---------------- UI ---------------- */
  return (
    <div style={{ marginTop: 12 }}>
      {loading && <div style={{ color: "#6b7280" }}>Loading attachment…</div>}

      {!loading && fileUrl && fileType === "image" && (
        <img
          src={fileUrl}
          alt={row?.filename ?? "attachment"}
          style={{ maxWidth: "100%", borderRadius: 6, marginBottom: 8 }}
        />
      )}

      {!loading && fileUrl && fileType === "pdf" && (
        <a
          href={fileUrl}
          target="_blank"
          rel="noreferrer"
          style={{
            display: "inline-block",
            padding: "8px 12px",
            background: "#6A3291",
            color: "white",
            borderRadius: 6,
            textDecoration: "none",
            marginBottom: 8,
          }}
        >
          Download PDF
        </a>
      )}

      {!loading && !fileUrl && <div style={{ color: "#6b7280" }}>No attachment added.</div>}

      {error && <div style={{ marginTop: 6, color: "crimson", fontSize: 13 }}>{error}</div>}

      {isEditor && (
        <div style={{ marginTop: 8 }}>
          <input
            type="file"
            accept="image/*,application/pdf"
            onChange={handleUpload}
            disabled={uploading}
          />

          {row && (
            <div style={{ marginTop: 8 }}>
              <button
                onClick={handleDelete}
                disabled={uploading}
                style={{
                  padding: "6px 10px",
                  fontSize: 13,
                  background: "transparent",
                  color: "#dc2626",
                  border: "1px solid #fca5a5",
                  borderRadius: 6,
                  cursor: "pointer",
                }}
              >
                Delete attachment
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
