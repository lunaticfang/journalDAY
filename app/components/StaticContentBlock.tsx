"use client";

import { useEffect, useState } from "react";
import { siteContentValueToHtml } from "../../lib/siteContent";

type Props = {
  contentKey: string;
  placeholder?: string;
};

export default function StaticContentBlock({
  contentKey,
  placeholder = "",
}: Props) {
  const [html, setHtml] = useState(() => siteContentValueToHtml(null, placeholder));

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const resp = await fetch(
          `/api/site-content/get?keys=${encodeURIComponent(contentKey)}`
        );
        const json = await resp.json().catch(() => ({}));

        if (!resp.ok) {
          throw new Error(json?.error || "Failed to load content");
        }

        if (!cancelled) {
          setHtml(siteContentValueToHtml(json?.[contentKey], placeholder));
        }
      } catch (err) {
        console.error("StaticContentBlock load error:", err);
        if (!cancelled) {
          setHtml(siteContentValueToHtml(null, placeholder));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [contentKey, placeholder]);

  return (
    <div className="jd-editable-block">
      <div className="jd-editor-shell">
        <div className="jd-editor" dangerouslySetInnerHTML={{ __html: html }} />
      </div>
    </div>
  );
}
