"use client";

import EditableBlock from "./EditableBlock";
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

const OWNER_EMAIL = "updaytesjournal@gmail.com";

export default function CmsPage({
  contentKey,
  title,
}: {
  contentKey: string;
  title: string;
}) {
  const [isOwner, setIsOwner] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user?.email === OWNER_EMAIL) {
        setIsOwner(true);
      }
    });
  }, []);

  return (
    <main style={{ maxWidth: 900, margin: "40px auto", padding: "0 20px" }}>
      <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 24 }}>
        {title}
      </h1>

      <EditableBlock contentKey={contentKey} isEditor={isOwner} />
    </main>
  );
}
