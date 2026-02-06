"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import FileAttachment from "../components/FileAttachment";

type Member = {
  id: string;
  section: string;
  name: string;
  degrees: string | null;
  department: string | null;
  institution: string | null;
  location: string | null;
  email: string | null;
  order_index: number | null;
  active: boolean | null;
};

const OWNER_EMAIL = "updaytesjournal@gmail.com";

const SECTION_LABELS: Record<string, string> = {
  editor_in_chief: "Editor-in-Chief",
  associate_editors: "Associate Editors",
  assistant_editors: "Assistant Editors",
  members: "Members",
};

export default function EditorialBoardPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creatingSection, setCreatingSection] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<Member>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: authData } = await supabase.auth.getUser();
      setIsOwner(authData?.user?.email === OWNER_EMAIL);

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

      setMembers((data as Member[]) ?? []);
      setLoading(false);
    })();
  }, []);

  const grouped = useMemo(() => {
    const grouped: Record<string, Member[]> = {};
    members.forEach((m) => {
      if (!grouped[m.section]) grouped[m.section] = [];
      grouped[m.section].push(m);
    });
    Object.values(grouped).forEach((list) => {
      list.sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
    });
    return grouped;
  }, [members]);

  const normalizeOptional = (value?: string | null) => {
    const trimmed = (value ?? "").trim();
    return trimmed ? trimmed : null;
  };

  const startEdit = (member: Member) => {
    setEditingId(member.id);
    setCreatingSection(null);
    setDraft({ ...member });
  };

  const startCreate = (section: string) => {
    setCreatingSection(section);
    setEditingId(null);
    setDraft({
      section,
      name: "",
      degrees: "",
      department: "",
      institution: "",
      location: "",
      email: "",
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setCreatingSection(null);
    setDraft({});
  };

  const getNextOrderIndex = (section: string) => {
    const max = members
      .filter((m) => m.section === section)
      .map((m) => m.order_index ?? 0)
      .reduce((acc, val) => Math.max(acc, val), 0);
    return max + 1;
  };

  const handleSave = async () => {
    if (saving) return;
    const name = (draft.name ?? "").trim();
    const section = (draft.section ?? "").trim();

    if (!section || !SECTION_LABELS[section]) {
      alert("Please select a valid section.");
      return;
    }

    if (!name) {
      alert("Name is required.");
      return;
    }

    setSaving(true);

    try {
      if (editingId) {
        const existing = members.find((m) => m.id === editingId);
        if (!existing) return;

        const payload: Partial<Member> & {
          section: string;
          name: string;
          degrees: string | null;
          department: string | null;
          institution: string | null;
          location: string | null;
          email: string | null;
          order_index?: number | null;
        } = {
          section,
          name,
          degrees: normalizeOptional(draft.degrees),
          department: normalizeOptional(draft.department),
          institution: normalizeOptional(draft.institution),
          location: normalizeOptional(draft.location),
          email: normalizeOptional(draft.email),
        };

        if (existing.section !== section) {
          payload.order_index = getNextOrderIndex(section);
        }

        const { data, error } = await supabase
          .from("editorial_board")
          .update(payload)
          .eq("id", editingId)
          .select()
          .single();

        if (error) throw error;

        const updated = data as Member;
        setMembers((prev) =>
          prev.map((m) => (m.id === editingId ? { ...m, ...updated } : m))
        );
      } else if (creatingSection) {
        const payload = {
          section,
          name,
          degrees: normalizeOptional(draft.degrees),
          department: normalizeOptional(draft.department),
          institution: normalizeOptional(draft.institution),
          location: normalizeOptional(draft.location),
          email: normalizeOptional(draft.email),
          active: true,
          order_index: getNextOrderIndex(section),
        };

        const { data, error } = await supabase
          .from("editorial_board")
          .insert(payload)
          .select()
          .single();

        if (error) throw error;

        const inserted = data as Member;
        setMembers((prev) => [...prev, inserted]);
      }
      cancelEdit();
    } catch (err: any) {
      console.error("Editorial board save error:", err);
      alert("Save failed: " + (err?.message || String(err)));
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (member: Member) => {
    if (!confirm(`Remove ${member.name} from the editorial board?`)) return;

    try {
      const { error } = await supabase
        .from("editorial_board")
        .update({ active: false })
        .eq("id", member.id);

      if (error) throw error;

      setMembers((prev) => prev.filter((m) => m.id !== member.id));
    } catch (err: any) {
      console.error("Editorial board remove error:", err);
      alert("Remove failed: " + (err?.message || String(err)));
    }
  };

  if (loading) {
    return <p style={{ padding: 40 }}>Loading editorial board…</p>;
  }

  return (
    <main style={{ maxWidth: 1100, margin: "40px auto", padding: "0 20px" }}>
      <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 24 }}>
        Editorial Board
      </h1>

      {Object.entries(SECTION_LABELS).map(([key, label]) => {
        const sectionMembers = grouped[key] ?? [];
        const showCreate = isOwner && creatingSection === key;
        if (!sectionMembers.length && !showCreate) return null;

        return (
          <section key={key} style={{ marginBottom: 32 }}>
            <div
              style={{
                background: "#eeeeee",
                padding: "8px 12px",
                fontWeight: 700,
                borderRadius: 4,
                marginBottom: 12,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <span>{label}</span>
              {isOwner && (
                <button
                  type="button"
                  onClick={() => startCreate(key)}
                  style={{
                    border: "1px solid #6A3291",
                    background: "white",
                    color: "#6A3291",
                    padding: "4px 10px",
                    borderRadius: 999,
                    fontSize: 12,
                    cursor: "pointer",
                  }}
                >
                  + Add member
                </button>
              )}
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
              {showCreate && (
                <div
                  style={{
                    fontSize: 13,
                    lineHeight: 1.4,
                    background: "white",
                    padding: 10,
                    borderRadius: 4,
                    border: "1px dashed #6A3291",
                  }}
                >
                  <div style={{ fontWeight: 700, marginBottom: 8 }}>
                    New member
                  </div>

                  <select
                    value={draft.section ?? key}
                    onChange={(e) =>
                      setDraft((prev) => ({ ...prev, section: e.target.value }))
                    }
                    style={{
                      width: "100%",
                      marginBottom: 6,
                      padding: "6px 8px",
                      borderRadius: 6,
                      border: "1px solid #e5e7eb",
                    }}
                  >
                    {Object.entries(SECTION_LABELS).map(([value, text]) => (
                      <option key={value} value={value}>
                        {text}
                      </option>
                    ))}
                  </select>

                  <input
                    placeholder="Name"
                    value={draft.name ?? ""}
                    onChange={(e) =>
                      setDraft((prev) => ({ ...prev, name: e.target.value }))
                    }
                    style={{
                      width: "100%",
                      marginBottom: 6,
                      padding: "6px 8px",
                      borderRadius: 6,
                      border: "1px solid #e5e7eb",
                    }}
                  />

                  <input
                    placeholder="Degrees"
                    value={draft.degrees ?? ""}
                    onChange={(e) =>
                      setDraft((prev) => ({ ...prev, degrees: e.target.value }))
                    }
                    style={{
                      width: "100%",
                      marginBottom: 6,
                      padding: "6px 8px",
                      borderRadius: 6,
                      border: "1px solid #e5e7eb",
                    }}
                  />

                  <input
                    placeholder="Department"
                    value={draft.department ?? ""}
                    onChange={(e) =>
                      setDraft((prev) => ({
                        ...prev,
                        department: e.target.value,
                      }))
                    }
                    style={{
                      width: "100%",
                      marginBottom: 6,
                      padding: "6px 8px",
                      borderRadius: 6,
                      border: "1px solid #e5e7eb",
                    }}
                  />

                  <input
                    placeholder="Institution"
                    value={draft.institution ?? ""}
                    onChange={(e) =>
                      setDraft((prev) => ({
                        ...prev,
                        institution: e.target.value,
                      }))
                    }
                    style={{
                      width: "100%",
                      marginBottom: 6,
                      padding: "6px 8px",
                      borderRadius: 6,
                      border: "1px solid #e5e7eb",
                    }}
                  />

                  <input
                    placeholder="Location"
                    value={draft.location ?? ""}
                    onChange={(e) =>
                      setDraft((prev) => ({
                        ...prev,
                        location: e.target.value,
                      }))
                    }
                    style={{
                      width: "100%",
                      marginBottom: 6,
                      padding: "6px 8px",
                      borderRadius: 6,
                      border: "1px solid #e5e7eb",
                    }}
                  />

                  <input
                    placeholder="Email"
                    type="email"
                    value={draft.email ?? ""}
                    onChange={(e) =>
                      setDraft((prev) => ({ ...prev, email: e.target.value }))
                    }
                    style={{
                      width: "100%",
                      marginBottom: 10,
                      padding: "6px 8px",
                      borderRadius: 6,
                      border: "1px solid #e5e7eb",
                    }}
                  />

                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      type="button"
                      onClick={handleSave}
                      disabled={saving}
                      style={{
                        flex: 1,
                        background: "#6A3291",
                        color: "white",
                        border: "none",
                        borderRadius: 6,
                        padding: "6px 10px",
                        cursor: "pointer",
                      }}
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={cancelEdit}
                      style={{
                        flex: 1,
                        background: "white",
                        color: "#374151",
                        border: "1px solid #e5e7eb",
                        borderRadius: 6,
                        padding: "6px 10px",
                        cursor: "pointer",
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {sectionMembers.map((m) => (
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
                  <div style={{ marginBottom: 10 }}>
                    <FileAttachment
                      contentKey={`editorial_board.${m.id}.photo`}
                      isEditor={isOwner}
                      bucketName="editorial-photos"
                      accept="image/*"
                    />
                  </div>
                  {editingId === m.id ? (
                    <>
                      <select
                        value={draft.section ?? m.section}
                        onChange={(e) =>
                          setDraft((prev) => ({
                            ...prev,
                            section: e.target.value,
                          }))
                        }
                        style={{
                          width: "100%",
                          marginBottom: 6,
                          padding: "6px 8px",
                          borderRadius: 6,
                          border: "1px solid #e5e7eb",
                        }}
                      >
                        {Object.entries(SECTION_LABELS).map(([value, text]) => (
                          <option key={value} value={value}>
                            {text}
                          </option>
                        ))}
                      </select>

                      <input
                        placeholder="Name"
                        value={draft.name ?? ""}
                        onChange={(e) =>
                          setDraft((prev) => ({
                            ...prev,
                            name: e.target.value,
                          }))
                        }
                        style={{
                          width: "100%",
                          marginBottom: 6,
                          padding: "6px 8px",
                          borderRadius: 6,
                          border: "1px solid #e5e7eb",
                        }}
                      />

                      <input
                        placeholder="Degrees"
                        value={draft.degrees ?? ""}
                        onChange={(e) =>
                          setDraft((prev) => ({
                            ...prev,
                            degrees: e.target.value,
                          }))
                        }
                        style={{
                          width: "100%",
                          marginBottom: 6,
                          padding: "6px 8px",
                          borderRadius: 6,
                          border: "1px solid #e5e7eb",
                        }}
                      />

                      <input
                        placeholder="Department"
                        value={draft.department ?? ""}
                        onChange={(e) =>
                          setDraft((prev) => ({
                            ...prev,
                            department: e.target.value,
                          }))
                        }
                        style={{
                          width: "100%",
                          marginBottom: 6,
                          padding: "6px 8px",
                          borderRadius: 6,
                          border: "1px solid #e5e7eb",
                        }}
                      />

                      <input
                        placeholder="Institution"
                        value={draft.institution ?? ""}
                        onChange={(e) =>
                          setDraft((prev) => ({
                            ...prev,
                            institution: e.target.value,
                          }))
                        }
                        style={{
                          width: "100%",
                          marginBottom: 6,
                          padding: "6px 8px",
                          borderRadius: 6,
                          border: "1px solid #e5e7eb",
                        }}
                      />

                      <input
                        placeholder="Location"
                        value={draft.location ?? ""}
                        onChange={(e) =>
                          setDraft((prev) => ({
                            ...prev,
                            location: e.target.value,
                          }))
                        }
                        style={{
                          width: "100%",
                          marginBottom: 6,
                          padding: "6px 8px",
                          borderRadius: 6,
                          border: "1px solid #e5e7eb",
                        }}
                      />

                      <input
                        placeholder="Email"
                        type="email"
                        value={draft.email ?? ""}
                        onChange={(e) =>
                          setDraft((prev) => ({
                            ...prev,
                            email: e.target.value,
                          }))
                        }
                        style={{
                          width: "100%",
                          marginBottom: 10,
                          padding: "6px 8px",
                          borderRadius: 6,
                          border: "1px solid #e5e7eb",
                        }}
                      />

                      <div style={{ display: "flex", gap: 8 }}>
                        <button
                          type="button"
                          onClick={handleSave}
                          disabled={saving}
                          style={{
                            flex: 1,
                            background: "#6A3291",
                            color: "white",
                            border: "none",
                            borderRadius: 6,
                            padding: "6px 10px",
                            cursor: "pointer",
                          }}
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={cancelEdit}
                          style={{
                            flex: 1,
                            background: "white",
                            color: "#374151",
                            border: "1px solid #e5e7eb",
                            borderRadius: 6,
                            padding: "6px 10px",
                            cursor: "pointer",
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
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
                          <a
                            href={`mailto:${m.email}`}
                            style={{ color: "#2563eb" }}
                          >
                            {m.email}
                          </a>
                        </div>
                      )}

                      {isOwner && (
                        <div
                          style={{
                            marginTop: 8,
                            display: "flex",
                            gap: 6,
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => startEdit(m)}
                            style={{
                              flex: 1,
                              background: "white",
                              border: "1px solid #e5e7eb",
                              borderRadius: 6,
                              padding: "4px 8px",
                              fontSize: 12,
                              cursor: "pointer",
                            }}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemove(m)}
                            style={{
                              flex: 1,
                              background: "#fee2e2",
                              border: "1px solid #fecaca",
                              borderRadius: 6,
                              padding: "4px 8px",
                              fontSize: 12,
                              cursor: "pointer",
                              color: "#991b1b",
                            }}
                          >
                            Remove
                          </button>
                        </div>
                      )}
                    </>
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
