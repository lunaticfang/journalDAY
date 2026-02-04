"use client";

import { useState } from "react";
import { supabase } from "../../lib/supabaseClient";

type Props = {
  contentKey: string; // site_content key where file URL will be saved
};

export default function CmsFileUpload({ contentKey }: Props) {
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setStatus(null);

    try {
      const ext = file.name.split(".").pop();
      const path = `cms/${contentKey}/${Date.now()}.${ext}`;

      /* Upload to storage */
      const { error: uploadError } = await supabase.storage
        .from("CMS-MEDIA")
        .upload(path, file, { upsert: true });

      if (uploadError) throw uploadError;

      /* Get public URL */
      const { data } = supabase.storage
        .from("CMS-MEDIA")
        .getPublicUrl(path);

      const url = data.publicUrl;

      /* Save URL in site_content */
      const { error: dbError } = await supabase.from("site_content").upsert({
        key: contentKey,
        value: { fileUrl: url, fileName: file.name },
        updated_at: new Date().toISOString(),
      });

      if (dbError) throw dbError;

      setStatus("Upload successful.");
    } catch (err: any) {
      console.error("Upload error:", err);
      setStatus("Upload failed: " + (err.message || err));
    } finally {
      setUploading(false);
    }
  }

  return (
    <div style={{ marginTop: 10 }}>
      <input
        type="file"
        onChange={handleUpload}
        disabled={uploading}
        accept=".pdf,image/*"
      />

      {status && (
        <div style={{ fontSize: 12, marginTop: 6, color: "#374151" }}>
          {status}
        </div>
      )}
    </div>
  );
}
