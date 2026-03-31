"use client";

import ContentBlock from "./ContentBlock";
import { useEffect, useState } from "react";
import { getCurrentClientProfile } from "../../lib/clientPermissions";

export default function CmsPage({
  contentKey,
  title,
  initialValue,
}: {
  contentKey: string;
  title: string;
  initialValue?: unknown;
}) {
  const [isOwner, setIsOwner] = useState(false);

  useEffect(() => {
    getCurrentClientProfile().then((access) => {
      setIsOwner(access.isOwner);
    });
  }, []);

  return (
    <main className="cms-page">
      <div className="cms-page__shell">
        <h1 className="cms-page__title">{title}</h1>

        <ContentBlock
          contentKey={contentKey}
          isEditor={isOwner}
          initialValue={initialValue}
        />
      </div>
    </main>
  );
}
