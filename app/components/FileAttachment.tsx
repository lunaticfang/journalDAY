/*
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

  /* ---------------- Load existing file ----------------/
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

  /* ---------------- Upload ---------------- 
  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);

    try {
      const ext = file.name.split(".").pop();
      const path = `${contentKey}/${Date.now()}.${ext}`;

      /* ✅ FIXED BUCKET NAME /
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

      /* ---- Save metadata in site_files table ---- /
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

  /* ---------------- UI ---------------- /
  return (
    <div style={{ marginTop: 12 }}>
      {/* DISPLAY /}
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

      {/* UPLOAD (EDITOR ONLY) /}
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
*/

"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

type Props = {
  contentKey: string;
  isEditor: boolean;
  // optional override if you want a single bucket (defaults tried below)
  bucketName?: string;
  // optional override for file input accept types
  accept?: string;
};

export default function FileAttachment({
  contentKey,
  isEditor,
  bucketName,
  accept,
}: Props) {
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [fileType, setFileType] = useState<"image" | "pdf" | null>(null);
  const [uploading, setUploading] = useState(false);

  /* ---------------- Load existing file ---------------- */
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
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
      } catch (e) {
        console.error("Unexpected load error:", e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [contentKey]);

  /* ---------------- Helper: try candidate buckets until one works ---------------- */
  const candidateBuckets = [
    // default order (adjust if you prefer another order)
    "site-files",
    "cms-media",
    "instructions-pdfs",
    "issues-pdfs",
    "editorial-photos",
    "manuscripts",
  ];

  async function tryGetPublicUrl(bucket: string, path: string) {
    // call getPublicUrl and try to extract the public URL in multiple shapes
    try {
      const resp = (supabase.storage.from(bucket).getPublicUrl(path) as any) || null;

      // v2 shape: { data: { publicUrl } }
      if (resp?.data?.publicUrl) return resp.data.publicUrl;
      // v1 shape: { publicURL }
      if (resp?.publicURL) return resp.publicURL;
      // resp might be { data: { publicURL } } (rare)
      if (resp?.data?.publicURL) return resp.data.publicURL;
      return null;
    } catch (err) {
      console.warn("getPublicUrl error for bucket", bucket, err);
      return null;
    }
  }

  /* ---------------- Upload ---------------- */
  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Ensure user is signed in (RLS / policies usually require authenticated)
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      alert(
        "You must be signed in to upload files. Please sign in (author/admin) and try again."
      );
      return;
    }

    setUploading(true);

    try {
      const ext = file.name.split(".").pop() ?? "bin";
      const filename = `${Date.now()}.${ext}`;
      const path = `${contentKey}/${filename}`;

      // decide buckets to try
      const bucketsToTry = bucketName ? [bucketName] : candidateBuckets;

      let uploadErr: any = null;
      let usedBucket: string | null = null;

      for (const b of bucketsToTry) {
        try {
          const { error } = await supabase.storage.from(b).upload(path, file, {
            upsert: true,
          });

          if (error) {
            // bucket not found or other error — remember and try next
            uploadErr = error;
            // if error message contains "Bucket not found" -> try next
            console.warn(`Upload to bucket "${b}" failed:`, error.message ?? error);
            continue;
          }

          // success
          usedBucket = b;
          uploadErr = null;
          break;
        } catch (err) {
          uploadErr = err;
          console.warn("Upload attempt error for bucket", b, err);
          continue;
        }
      }

      if (!usedBucket) {
        // all attempts failed
        throw uploadErr || new Error("Upload failed (no bucket succeeded)");
      }

      // extract public URL robustly
      const publicUrl = (await tryGetPublicUrl(usedBucket, path)) || null;

      // fallback: if we didn't get a public URL, attempt to build one conservatively
      const finalUrl =
        publicUrl ||
        // If the path already appears to be a public URL, keep it
        (path.startsWith("http") ? path : null);

      const type: "image" | "pdf" = file.type.startsWith("image") ? "image" : "pdf";

      // Save metadata in site_files table.
      // Use onConflict to update by content_key — this requires a UNIQUE constraint on content_key.
      const { error: dbErr } = await supabase
        .from("site_files")
        .upsert(
          {
            content_key: contentKey,
            file_url: finalUrl,
            file_type: type,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "content_key" }
        );

      if (dbErr) {
        console.error("DB upsert error:", dbErr);
        // RLS may still block this; surface helpful hint:
        if (dbErr.code === "42501" || dbErr.message?.includes("row-level")) {
          throw new Error(
            "Save blocked by row-level security. Ensure you're signed-in and site_files policies allow inserts/updates for authenticated users."
          );
        }
        throw dbErr;
      }

      setFileUrl(finalUrl);
      setFileType(type);
    } catch (err: any) {
      console.error("Upload failed:", err);
      alert("Upload failed: " + (err.message || String(err)));
    } finally {
      setUploading(false);
      // clear file input (so same file can be reselected)
      const input = document.querySelector<HTMLInputElement>(
        `input[type=file][data-content-key="${contentKey}"]`
      );
      if (input) input.value = "";
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
            data-content-key={contentKey}
            type="file"
            accept={accept ?? "image/*,application/pdf"}
            onChange={handleUpload}
            disabled={uploading}
          />
          {uploading && <div style={{ fontSize: 12 }}>Uploading…</div>}
        </div>
      )}
    </div>
  );
}
