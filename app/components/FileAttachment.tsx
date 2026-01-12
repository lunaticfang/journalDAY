"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

type Props = {
  contentKey: string;
  isEditor: boolean;
};

export default function FileAttachment({ contentKey, isEditor }: Props) {
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [fileType, setFileType] = useState<"image" | "pdf" | null>(null);
  const [uploading, setUploading] = useState(false);

  /* ---------------- Load existing file ---------------- */
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const { data, error } = await supabase
        .from("site_files")
        .select("file_url, file_type")
        .eq("content_key", contentKey)
        .maybeSingle();

      if (error) {
        console.error("Load attachment error:", error);
        return;
      }

      if (!cancelled && data) {
        setFileUrl(data.file_url);
        setFileType(data.file_type as "image" | "pdf");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [contentKey]);

  /* ---------------- Upload ---------------- */
  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);

    try {
      const ext = file.name.split(".").pop();
      const path = `${contentKey}/${Date.now()}.${ext}`;

      /* ✅ FIXED BUCKET NAME */
      const { error: uploadErr } = await supabase.storage
        .from("instructions-pdfs")
        .upload(path, file, { upsert: true });

      if (uploadErr) throw uploadErr;

      const { data: publicData } = supabase.storage
        .from("instructions-pdfs")
        .getPublicUrl(path);

      const publicUrl = publicData.publicUrl;

      const type: "image" | "pdf" =
        file.type.startsWith("image") ? "image" : "pdf";

      /* ---- Save metadata in site_files table ---- */
      const { error: dbErr } = await supabase.from("site_files").upsert({
        content_key: contentKey,
        file_url: publicUrl,
        file_type: type,
        updated_at: new Date().toISOString(),
      });

      if (dbErr) throw dbErr;

      setFileUrl(publicUrl);
      setFileType(type);
    } catch (err: any) {
      console.error("Upload failed:", err);
      alert("Upload failed: " + (err.message || "unknown error"));
    } finally {
      setUploading(false);
    }
  }

  /* ---------------- UI ---------------- */
  return (
    <div style={{ marginTop: 12 }}>
      {/* DISPLAY */}
      {fileUrl && fileType === "image" && (
        <img
          src={fileUrl}
          alt="attachment"
          style={{ maxWidth: "100%", borderRadius: 6, marginBottom: 8 }}
        />
      )}

      {fileUrl && fileType === "pdf" && (
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
          }}
        >
          View / Download PDF
        </a>
      )}

      {/* UPLOAD (EDITOR ONLY) */}
      {isEditor && (
        <div style={{ marginTop: 8 }}>
          <input
            type="file"
            accept="image/*,application/pdf"
            onChange={handleUpload}
            disabled={uploading}
          />
          {uploading && <div style={{ fontSize: 12 }}>Uploading…</div>}
        </div>
      )}
    </div>
  );
}
