"use client";

import { useEffect, useState } from "react";
import { siteContentValueToHtml } from "../../lib/siteContent";

type Props = {
  contentKey: string;
  placeholder?: string;
  initialValue?: unknown;
};

export default function StaticContentBlock({
  contentKey,
  placeholder = "",
  initialValue = null,
}: Props) {
  const [html, setHtml] = useState(() =>
    siteContentValueToHtml(initialValue, placeholder)
  );

  useEffect(() => {
    setHtml(siteContentValueToHtml(initialValue, placeholder));
  }, [initialValue, placeholder]);

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
