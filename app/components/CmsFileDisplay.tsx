"use client";

import { useEffect, useState } from "react";

type Props = {
  contentKey: string;
};

type FileValue = {
  fileUrl?: string;
  fileName?: string;
};

export default function CmsFileDisplay({ contentKey }: Props) {
  const [file, setFile] = useState<FileValue | null>(null);

  useEffect(() => {
    (async () => {
      const resp = await fetch(
        `/api/site-content/get?keys=${encodeURIComponent(contentKey)}`
      );
      const json = await resp.json().catch(() => ({}));
      const value = json?.[contentKey];

      if (value) setFile(value as FileValue);
    })();
  }, [contentKey]);

  if (!file?.fileUrl) return null;

  const isImage = /\.(png|jpg|jpeg|webp|gif)$/i.test(file.fileUrl);

  if (isImage) {
    return (
      <img
        src={file.fileUrl}
        alt={file.fileName || "Uploaded image"}
        style={{ maxWidth: "100%", marginTop: 12, borderRadius: 6 }}
      />
    );
  }

  return (
    <div style={{ marginTop: 12 }}>
      <a
        href={file.fileUrl}
        target="_blank"
        rel="noopener noreferrer"
        style={{ color: "#2563eb", textDecoration: "underline" }}
      >
        📄 Download {file.fileName || "file"}
      </a>
    </div>
  );
}
