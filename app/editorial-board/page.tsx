"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

type Member = {
  id: string;
  section: string;
  name: string;
  degrees: string | null;
  department: string | null;
  institution: string | null;
  location: string | null;
  email: string | null;
};

const SECTION_LABELS: Record<string, string> = {
  editor_in_chief: "Editor-in-Chief",
  associate_editors: "Associate Editors",
  assistant_editors: "Assistant Editors",
  members: "Members",
};

export default function EditorialBoardPage() {
  const [data, setData] = useState<Record<string, Member[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("editorial_board")
        .select("*")
        .eq("active", true)
        .order("order_index", { ascending: true });

      if (error) {
        console.error("Load editorial board error:", error);
        setLoading(false);
        return;
      }

      const grouped: Record<string, Member[]> = {};
      data?.forEach((m) => {
        if (!grouped[m.section]) grouped[m.section] = [];
        grouped[m.section].push(m);
      });

      setData(grouped);
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return <p style={{ padding: 40 }}>Loading editorial board…</p>;
  }

  return (
    <main style={{ maxWidth: 1100, margin: "40px auto", padding: "0 20px" }}>
      <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 24 }}>
        Editorial Board
      </h1>

      {Object.entries(SECTION_LABELS).map(([key, label]) => {
        const members = data[key];
        if (!members || members.length === 0) return null;

        return (
          <section key={key} style={{ marginBottom: 32 }}>
            <div
              style={{
                background: "#eeeeee",
                padding: "8px 12px",
                fontWeight: 700,
                borderRadius: 4,
                marginBottom: 12,
              }}
            >
              {label}
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 16,
                background: "#fafafa",
                padding: 16,
                borderRadius: 6,
                border: "1px solid #e5e7eb",
              }}
            >
              {members.map((m) => (
                <div
                  key={m.id}
                  style={{
                    fontSize: 13,
                    lineHeight: 1.4,
                    background: "white",
                    padding: 10,
                    borderRadius: 4,
                    border: "1px solid #e5e7eb",
                  }}
                >
                  <div style={{ fontWeight: 700 }}>
                    {m.name}
                    {m.degrees ? `, ${m.degrees}` : ""}
                  </div>

                  {m.department && <div>{m.department}</div>}
                  {m.institution && <div>{m.institution}</div>}
                  {m.location && <div>{m.location}</div>}

                  {m.email && (
                    <div style={{ marginTop: 4 }}>
                      Email:{" "}
                      <a href={`mailto:${m.email}`} style={{ color: "#2563eb" }}>
                        {m.email}
                      </a>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </main>
  );
}
