"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

/**
 * FileAttachment component
 *
 * Props:
 *  - contentKey: string        // logical page/key this file is attached to (e.g. "home.hero.attachment")
 *  - isEditor: boolean         // true when owner/editor mode (shows upload/delete controls)
 *  - bucket?: string           // optional storage bucket name; default: "public"
 *
 * Behavior:
 *  - lists files from `site_files` table for the given contentKey
 *  - allows upload (images & pdf) by owner (uploads to storage, saves metadata to site_files)
 *  - shows thumbnails for images, and a PDF icon/link for PDFs
 *  - owner can delete files (storage + metadata)
 */

type Props = {
  contentKey: string;
  isEditor: boolean;
  bucket?: string;
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

const DEFAULT_BUCKET = "instructions-pdfs"; // change if you use a different bucket

export default function FileAttachment({
  contentKey,
  isEditor,
  bucket = DEFAULT_BUCKET,
}: Props) {
  const [files, setFiles] = useState<SiteFileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadFiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentKey]);

  async function loadFiles() {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from("site_files")
        .select("*")
        .eq("content_key", contentKey)
        .order("uploaded_at", { ascending: false });

      if (error) throw error;
      setFiles((data || []) as SiteFileRow[]);
    } catch (err: any) {
      console.error("loadFiles error", err);
      setError(err?.message || "Failed to load attachments");
    } finally {
      setLoading(false);
    }
  }

  function allowedFileTypes(name: string, type: string) {
    const lower = name.toLowerCase();
    // allow pdf and common image types (jpeg, png, webp, gif)
    return (
      type === "application/pdf" ||
      lower.endsWith(".pdf") ||
      type.startsWith("image/")
    );
  }

  async function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!allowedFileTypes(file.name, file.type)) {
      setError("Only PDF and image files are allowed.");
      return;
    }
    await uploadFile(file);
    // clear input
    e.currentTarget.value = "";
  }

  async function uploadFile(file: File) {
    setUploading(true);
    setProgress(0);
    setError(null);

    try {
      // build unique path: contentKey/<timestamp>_<clean_filename>
      const ts = Date.now();
      const safeName = file.name.replace(/\s+/g, "_");
      const path = `${contentKey}/${ts}_${safeName}`;

      // upload to storage
      const upload = await supabase.storage.from(bucket).upload(path, file, {
        cacheControl: "3600",
        upsert: false,
      });

      if (upload.error) throw upload.error;

      // get public url (works for PUBLIC buckets)
      const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path);
      const publicUrl = urlData.publicUrl || null;

      // store metadata in site_files
      const userResp = await supabase.auth.getUser();
      const uploaderId = userResp?.data?.user?.id ?? null;

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

      if (insertErr) {
        // attempt to cleanup storage if DB write fails
        await supabase.storage.from(bucket).remove([path]);
        throw insertErr;
      }

      // reload list
      await loadFiles();
    } catch (err: any) {
      console.error("uploadFile error", err);
      setError(err?.message || String(err));
    } finally {
      setUploading(false);
      setProgress(null);
    }
  }

  async function handleDelete(row: SiteFileRow) {
    if (!confirm(`Delete "${row.filename}" ?`)) return;
    setError(null);
    try {
      // remove storage object
      const { error: removeErr } = await supabase.storage
        .from(row.bucket)
        .remove([row.path]);
      if (removeErr && removeErr.message) {
        // continue to attempt metadata deletion anyway, but surface the error
        console.warn("storage remove warning:", removeErr);
      }

      // delete metadata
      const { error: delErr } = await supabase
        .from("site_files")
        .delete()
        .eq("id", row.id);

      if (delErr) throw delErr;

      await loadFiles();
    } catch (err: any) {
      console.error("delete error", err);
      setError(err?.message || String(err));
    }
  }

  return (
    <div>
      {loading && <div style={{ color: "#6b7280" }}>Loading attachments…</div>}

      {!loading && files.length === 0 && (
        <div style={{ color: "#6b7280" }}>No attachment added.</div>
      )}

      {/* Show files */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 8 }}>
        {files.map((f) => {
          const isImage = f.mime?.startsWith("image/") || /\.(jpg|jpeg|png|webp|gif)$/i.test(f.filename);
          const href = f.public_url || (f.path ? supabase.storage.from(f.bucket).getPublicUrl(f.path).data.publicUrl : "");
          return (
            <div
              key={f.id}
              style={{
                width: isImage ? 140 : 220,
                border: "1px solid #e5e7eb",
                borderRadius: 6,
                padding: 8,
                background: "white",
              }}
            >
              {isImage ? (
                <img
                  src={href}
                  alt={f.filename}
                  style={{ width: "100%", height: 100, objectFit: "cover", borderRadius: 4 }}
                />
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 6, background: "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>
                    PDF
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{f.filename}</div>
                    <a href={href} target="_blank" rel="noreferrer" style={{ color: "#2563eb", fontSize: 13 }}>
                      Open
                    </a>
                  </div>
                </div>
              )}

              <div style={{ marginTop: 8, display: "flex", justifyContent: "space-between", gap: 8 }}>
                <small style={{ color: "#6b7280" }}>{f.uploaded_at ? new Date(f.uploaded_at).toLocaleString() : ""}</small>
                {isEditor && (
                  <button
                    onClick={() => handleDelete(f)}
                    style={{ background: "transparent", border: "none", color: "#dc2626", cursor: "pointer" }}
                    title="Delete"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Upload control (owner/editor only) */}
      {isEditor && (
        <div style={{ marginTop: 12 }}>
          <label style={{ display: "inline-block", fontSize: 13, marginBottom: 6 }}>
            Upload image or PDF
          </label>
          <div>
            <input
              type="file"
              accept="application/pdf,image/*"
              onChange={handleFileInput}
              disabled={uploading}
            />
            {uploading && <div style={{ marginTop: 6, fontSize: 13 }}>Uploading…</div>}
            {error && <div style={{ marginTop: 8, color: "crimson" }}>{error}</div>}
          </div>
        </div>
      )}
    </div>
  );
}
