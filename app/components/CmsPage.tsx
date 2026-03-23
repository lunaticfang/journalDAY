"use client";

import ContentBlock from "./ContentBlock";
import { useEffect, useState } from "react";
import { getCurrentClientProfile } from "../../lib/clientPermissions";

export default function CmsPage({
  contentKey,
  title,
}: {
  contentKey: string;
  title: string;
}) {
  const [isOwner, setIsOwner] = useState(false);

  useEffect(() => {
    getCurrentClientProfile().then((access) => {
      setIsOwner(access.isOwner);
    });
  }, []);

  return (
    <main style={{ maxWidth: 900, margin: "40px auto", padding: "0 20px" }}>
      <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 24 }}>
        {title}
      </h1>

      <ContentBlock contentKey={contentKey} isEditor={isOwner} />
    </main>
  );
}
