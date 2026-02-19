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

const SECTION_ORDER_KEY = "editorial_board.section_order";

function newTempId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `tmp-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export default function EditorialBoardPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creatingSection, setCreatingSection] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<Member>>({});
  const [saving, setSaving] = useState(false);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [newSectionName, setNewSectionName] = useState("");
  const [creatingMemberId, setCreatingMemberId] = useState<string | null>(null);
  const [sectionOrder, setSectionOrder] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      const { data: authData } = await supabase.auth.getUser();
      setIsOwner(authData?.user?.email === OWNER_EMAIL);

      const { data: sessionData } = await supabase.auth.getSession();
      setAuthToken(sessionData.session?.access_token ?? null);

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

      try {
        const orderResp = await fetch("/api/site-content/get");
        const orderJson = await orderResp.json().catch(() => ({}));
        const rawOrder = orderJson?.[SECTION_ORDER_KEY];
        if (typeof rawOrder === "string") {
          const parsed = JSON.parse(rawOrder);
          if (Array.isArray(parsed)) {
            setSectionOrder(
              parsed.filter((item): item is string => typeof item === "string")
            );
          }
        }
      } catch (err) {
        console.error("Load editorial board section order error:", err);
      }

      setLoading(false);
    })();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsOwner(session?.user?.email === OWNER_EMAIL);
      setAuthToken(session?.access_token ?? null);
    });

    return () => {
      subscription.unsubscribe();
    };
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

  const baseSections = useMemo(() => {
    const set = new Set<string>(Object.keys(SECTION_LABELS));
    members.forEach((m) => set.add(m.section));
    if (creatingSection) set.add(creatingSection);
    return Array.from(set).filter(Boolean);
  }, [members, creatingSection]);

  const allSections = useMemo(() => {
    if (!sectionOrder.length) return baseSections;

    const seen = new Set<string>();
    const ordered: string[] = [];

    sectionOrder.forEach((s) => {
      if (baseSections.includes(s) && !seen.has(s)) {
        ordered.push(s);
        seen.add(s);
      }
    });

    baseSections.forEach((s) => {
      if (!seen.has(s)) {
        ordered.push(s);
        seen.add(s);
      }
    });

    return ordered;
  }, [baseSections, sectionOrder]);

  const formatSectionLabel = (section: string) => {
    if (SECTION_LABELS[section]) return SECTION_LABELS[section];
    return section
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
  };

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
    const createdId = newTempId();
    setCreatingSection(section);
    setCreatingMemberId(createdId);
    setEditingId(null);
    setDraft({
      id: createdId,
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
    setCreatingMemberId(null);
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

    if (!section) {
      alert("Please select a valid section.");
      return;
    }

    if (!name) {
      alert("Name is required.");
      return;
    }

    setSaving(true);

    const token =
      authToken ||
      (await supabase.auth.getSession()).data.session?.access_token;
    if (!token) {
      alert("Please sign in again to save changes.");
      setSaving(false);
      return;
    }

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

        const resp = await fetch("/api/editorial-board", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ id: editingId, ...payload }),
        });

        const json = await resp.json().catch(() => ({}));
        if (!resp.ok) throw new Error(json?.error || "Save failed");

        const updated = json?.member as Member | undefined;
        setMembers((prev) =>
          prev.map((m) =>
            m.id === editingId ? { ...m, ...(updated ?? payload), id: m.id } : m
          )
        );
      } else if (creatingSection) {
        const newId =
          creatingMemberId ||
          (typeof draft.id === "string" ? draft.id : null) ||
          newTempId();
        const payload = {
          id: newId,
          create: true,
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

        const resp = await fetch("/api/editorial-board", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });

        const json = await resp.json().catch(() => ({}));
        if (!resp.ok) throw new Error(json?.error || "Save failed");

        const inserted = json?.member as Member | undefined;
        if (inserted) {
          setMembers((prev) => [...prev, inserted]);
          if (!sectionOrder.includes(section)) {
            const next = [...allSections, section].filter(
              (value, index, arr) => arr.indexOf(value) === index
            );
            setSectionOrder(next);
            try {
              await persistSectionOrder(next);
            } catch (persistErr) {
              console.error("Save editorial section order error:", persistErr);
            }
          }
        }
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

    const token =
      authToken ||
      (await supabase.auth.getSession()).data.session?.access_token;
    if (!token) {
      alert("Please sign in again to remove members.");
      return;
    }

    try {
      const resp = await fetch("/api/editorial-board", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ id: member.id }),
      });

      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(json?.error || "Remove failed");

      setMembers((prev) => prev.filter((m) => m.id !== member.id));
    } catch (err: any) {
      console.error("Editorial board remove error:", err);
      alert("Remove failed: " + (err?.message || String(err)));
    }
  };

  const getAuthToken = async () => {
    if (authToken) return authToken;
    const { data: sessionData } = await supabase.auth.getSession();
    return sessionData.session?.access_token ?? null;
  };

  const persistSectionOrder = async (nextOrder: string[]) => {
    const token = await getAuthToken();
    if (!token) {
      throw new Error("Please sign in again to reorder positions.");
    }

    const resp = await fetch("/api/site-content/update", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        key: SECTION_ORDER_KEY,
        value: JSON.stringify(nextOrder),
      }),
    });

    const json = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      throw new Error(json?.error || "Failed to save section order");
    }
  };

  const handleMoveSection = async (section: string, delta: -1 | 1) => {
    const current = [...allSections];
    const index = current.indexOf(section);
    const target = index + delta;
    if (index < 0 || target < 0 || target >= current.length) return;

    const next = [...current];
    [next[index], next[target]] = [next[target], next[index]];

    setSectionOrder(next);
    try {
      await persistSectionOrder(next);
    } catch (err: any) {
      setSectionOrder(current);
      alert(err?.message || "Failed to reorder positions");
    }
  };

  const handleRenameSection = async (section: string) => {
    const suggested = formatSectionLabel(section);
    const raw = prompt("Rename this position/section:", suggested);
    if (raw == null) return;

    const newSection = raw.trim();
    if (!newSection || newSection === section) return;

    const token = await getAuthToken();
    if (!token) {
      alert("Please sign in again to rename positions.");
      return;
    }

    try {
      const resp = await fetch("/api/editorial-board", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: "rename_section",
          section,
          newSection,
        }),
      });

      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(json?.error || "Rename failed");

      const nextOrder = allSections.map((value) =>
        value === section ? newSection : value
      );
      setSectionOrder(nextOrder);
      try {
        await persistSectionOrder(nextOrder);
      } catch (persistErr) {
        console.error("Rename editorial section order error:", persistErr);
      }

      setMembers((prev) =>
        prev.map((m) => (m.section === section ? { ...m, section: newSection } : m))
      );
      cancelEdit();
    } catch (err: any) {
      console.error("Editorial board section rename error:", err);
      alert("Rename failed: " + (err?.message || String(err)));
    }
  };

  const handleDeleteSection = async (section: string) => {
    if (!confirm(`Delete the "${formatSectionLabel(section)}" position?`)) return;

    const token = await getAuthToken();
    if (!token) {
      alert("Please sign in again to delete positions.");
      return;
    }

    try {
      const resp = await fetch("/api/editorial-board", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: "delete_section",
          section,
        }),
      });

      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(json?.error || "Delete failed");

      const nextOrder = allSections.filter((value) => value !== section);
      setSectionOrder(nextOrder);
      try {
        await persistSectionOrder(nextOrder);
      } catch (persistErr) {
        console.error("Delete editorial section order error:", persistErr);
      }

      setMembers((prev) => prev.filter((m) => m.section !== section));
      cancelEdit();
    } catch (err: any) {
      console.error("Editorial board section delete error:", err);
      alert("Delete failed: " + (err?.message || String(err)));
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

      <datalist id="section-options">
        {allSections.map((s) => (
          <option key={s} value={s}>
            {formatSectionLabel(s)}
          </option>
        ))}
      </datalist>

      {isOwner && (
        <div
          style={{
            display: "flex",
            gap: 8,
            marginBottom: 20,
            alignItems: "center",
            background: "#f8f7fb",
            border: "1px solid #e5e7eb",
            borderRadius: 8,
            padding: "10px 12px",
          }}
        >
          <input
            placeholder="New position / section (e.g., Guest Editors)"
            value={newSectionName}
            onChange={(e) => setNewSectionName(e.target.value)}
            style={{
              flex: 1,
              padding: "8px 10px",
              borderRadius: 6,
              border: "1px solid #d1d5db",
            }}
          />
          <button
            type="button"
            onClick={() => {
              const name = newSectionName.trim();
              if (!name) return;
              startCreate(name);
              setNewSectionName("");
            }}
            style={{
              background: "#6A3291",
              color: "white",
              border: "none",
              borderRadius: 6,
              padding: "8px 12px",
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            Add position
          </button>
        </div>
      )}

      {allSections.map((key) => {
        const label = formatSectionLabel(key);
        const sectionMembers = grouped[key] ?? [];
        const sectionIndex = allSections.indexOf(key);
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
                <div style={{ display: "flex", gap: 6 }}>
                  <button
                    type="button"
                    onClick={() => handleRenameSection(key)}
                    style={{
                      border: "1px solid #d1d5db",
                      background: "white",
                      color: "#374151",
                      padding: "4px 10px",
                      borderRadius: 999,
                      fontSize: 12,
                      cursor: "pointer",
                    }}
                  >
                    Rename
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMoveSection(key, -1)}
                    disabled={sectionIndex <= 0}
                    style={{
                      border: "1px solid #d1d5db",
                      background: "white",
                      color: "#374151",
                      padding: "4px 10px",
                      borderRadius: 999,
                      fontSize: 12,
                      cursor: sectionIndex <= 0 ? "not-allowed" : "pointer",
                      opacity: sectionIndex <= 0 ? 0.55 : 1,
                    }}
                  >
                    Up
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMoveSection(key, 1)}
                    disabled={sectionIndex >= allSections.length - 1}
                    style={{
                      border: "1px solid #d1d5db",
                      background: "white",
                      color: "#374151",
                      padding: "4px 10px",
                      borderRadius: 999,
                      fontSize: 12,
                      cursor:
                        sectionIndex >= allSections.length - 1
                          ? "not-allowed"
                          : "pointer",
                      opacity: sectionIndex >= allSections.length - 1 ? 0.55 : 1,
                    }}
                  >
                    Down
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteSection(key)}
                    style={{
                      border: "1px solid #fecaca",
                      background: "#fff5f5",
                      color: "#991b1b",
                      padding: "4px 10px",
                      borderRadius: 999,
                      fontSize: 12,
                      cursor: "pointer",
                    }}
                  >
                    Delete
                  </button>
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
                </div>
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

                  {creatingMemberId && (
                    <div style={{ marginBottom: 10 }}>
                      <FileAttachment
                        contentKey={`editorial_board.${creatingMemberId}.photo`}
                        isEditor={isOwner}
                        bucketName="editorial-photos"
                        accept="image/*"
                      />
                    </div>
                  )}

                  <input
                    list="section-options"
                    placeholder="Section / position"
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
                  />

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
                      <input
                        list="section-options"
                        placeholder="Section / position"
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
                      />

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
