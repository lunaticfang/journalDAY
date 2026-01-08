"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient"; // path relative to app/owner/editorial-board
import Link from "next/link";

type MemberRow = {
  id: string;
  section: string;
  name: string;
  degrees?: string | null;
  department?: string | null;
  institution?: string | null;
  location?: string | null;
  email?: string | null;
  order_index?: number | null;
  active?: boolean | null;
};

const SECTIONS: { key: string; label: string }[] = [
  { key: "editor_in_chief", label: "Editor-in-Chief" },
  { key: "associate_editors", label: "Associate Editors" },
  { key: "assistant_editors", label: "Assistant Editors" },
  { key: "members", label: "Members" },
];

export default function OwnerEditorialBoardPage() {
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [rows, setRows] = useState<MemberRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  // UI state for add/edit
  const [editing, setEditing] = useState<MemberRow | null>(null);
  const [form, setForm] = useState<Partial<MemberRow>>({
    section: "members",
    name: "",
    degrees: "",
    department: "",
    institution: "",
    location: "",
    email: "",
    active: true,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        // verify user is an APPROVED admin in profiles table
        const { data: userData } = await supabase.auth.getUser();
        const user = userData?.user ?? null;
        if (!user) {
          setIsAdmin(false);
          setLoading(false);
          return;
        }

        const { data: profile } = await supabase
          .from("profiles")
          .select("role, approved")
          .eq("id", user.id)
          .maybeSingle();

        const allowed = profile?.role === "admin" && profile?.approved === true;
        setIsAdmin(Boolean(allowed));

        // fetch editorial board rows (all active and inactive so owner can toggle)
        const { data, error } = await supabase
          .from("editorial_board")
          .select("*")
          .order("section", { ascending: true })
          .order("order_index", { ascending: true });

        if (error) throw error;
        setRows(data || []);
      } catch (err: any) {
        console.error("load error:", err);
        setError(err?.message || String(err));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // helpers
  function resetForm() {
    setEditing(null);
    setForm({
      section: "members",
      name: "",
      degrees: "",
      department: "",
      institution: "",
      location: "",
      email: "",
      active: true,
    });
  }

  async function handleEdit(row: MemberRow) {
    setEditing(row);
    setForm({
      section: row.section,
      name: row.name,
      degrees: row.degrees || "",
      department: row.department || "",
      institution: row.institution || "",
      location: row.location || "",
      email: row.email || "",
      active: row.active ?? true,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this member? This cannot be undone.")) return;
    try {
      const { error } = await supabase
        .from("editorial_board")
        .delete()
        .eq("id", id);

      if (error) throw error;
      setRows((r) => r.filter((x) => x.id !== id));
    } catch (err: any) {
      alert("Delete failed: " + (err.message || String(err)));
    }
  }

  async function handleMove(id: string, direction: "up" | "down") {
    // simple swap algorithm: find neighbor in same section by order_index
    const current = rows.find((r) => r.id === id);
    if (!current) return;
    const same = rows
      .filter((r) => r.section === current.section)
      .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
    const idx = same.findIndex((r) => r.id === id);
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= same.length) return;

    const target = same[swapIdx];

    try {
      // swap their order_index values
      const updates = [
        supabase
          .from("editorial_board")
          .update({ order_index: target.order_index ?? 0 })
          .eq("id", current.id),
        supabase
          .from("editorial_board")
          .update({ order_index: current.order_index ?? 0 })
          .eq("id", target.id),
      ];
      const results = await Promise.all(updates);
      // check for errors
      for (const r of results) {
        // r will be { data, error }
        if ((r as any).error) throw (r as any).error;
      }

      // refresh local rows (optimistic: swap in memory)
      setRows((prev) => {
        const copy = prev.map((x) => ({ ...x }));
        const a = copy.find((x) => x.id === current.id)!;
        const b = copy.find((x) => x.id === target.id)!;
        const t = a.order_index;
        a.order_index = b.order_index;
        b.order_index = t;
        return copy.sort((x, y) => (x.section + (x.order_index ?? 0)) > (y.section + (y.order_index ?? 0)) ? 1 : -1);
      });
    } catch (err: any) {
      alert("Reorder failed: " + (err.message || String(err)));
    }
  }

  async function handleSave(e?: React.FormEvent) {
    e?.preventDefault();
    if (!form.name || !form.section) {
      alert("Please provide name and section.");
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        // update
        const { error } = await supabase
          .from("editorial_board")
          .update({
            section: form.section,
            name: form.name,
            degrees: form.degrees || null,
            department: form.department || null,
            institution: form.institution || null,
            location: form.location || null,
            email: form.email || null,
            active: form.active ?? true,
            updated_at: new Date().toISOString(),
          })
          .eq("id", editing.id);

        if (error) throw error;

        // update in local rows
        setRows((r) =>
          r.map((row) => (row.id === editing.id ? { ...row, ...(form as any) } as MemberRow : row))
        );
        resetForm();
      } else {
        // when inserting, set order_index to max+1 within that section
        const sectionRows = rows.filter((r) => r.section === form.section);
        const maxIndex = sectionRows.reduce((m, x) => Math.max(m, x.order_index ?? 0), 0);
        const payload = {
          section: form.section,
          name: form.name,
          degrees: form.degrees || null,
          department: form.department || null,
          institution: form.institution || null,
          location: form.location || null,
          email: form.email || null,
          active: form.active ?? true,
          order_index: maxIndex + 1,
        };

        const { data, error } = await supabase
          .from("editorial_board")
          .insert(payload)
          .select()
          .single();

        if (error) throw error;
        setRows((r) => [...r, data as MemberRow]);
        resetForm();
      }
    } catch (err: any) {
      alert("Save failed: " + (err.message || String(err)));
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main style={{ padding: 40 }}>
        <p>Loading…</p>
      </main>
    );
  }

  // show permission denied UI if not admin
  if (!isAdmin) {
    return (
      <main style={{ maxWidth: 900, margin: "40px auto", padding: "0 20px" }}>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>Owner: Editorial Board</h1>
        <p style={{ marginTop: 12 }}>
          You must be an approved admin to manage the editorial board.
        </p>
        <p style={{ marginTop: 12 }}>
          <Link href="/login" style={{ color: "#6A3291" }}>Sign in</Link> with an admin account.
        </p>
      </main>
    );
  }

  // group rows by section
  const grouped: Record<string, MemberRow[]> = {};
  for (const s of SECTIONS) grouped[s.key] = [];
  rows.forEach((r) => {
    grouped[r.section] = grouped[r.section] || [];
    grouped[r.section].push(r);
  });
  // sort each group by order_index
  for (const k of Object.keys(grouped)) {
    grouped[k].sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
  }

  return (
    <main style={{ maxWidth: 1100, margin: "40px auto", padding: "0 20px" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 18 }}>
        Owner: Editorial Board — Manage
      </h1>

      <section style={{ marginBottom: 18, background: "#fff", padding: 14, borderRadius: 8, border: "1px solid #e5e7eb" }}>
        <form onSubmit={handleSave} style={{ display: "grid", gap: 8 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <select
              value={form.section}
              onChange={(e) => setForm((f) => ({ ...f, section: e.target.value }))}
              style={{ padding: 8, borderRadius: 6 }}
            >
              {SECTIONS.map((s) => (
                <option key={s.key} value={s.key}>{s.label}</option>
              ))}
            </select>

            <input
              placeholder="Full name (required)"
              value={form.name || ""}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              style={{ flex: 1, padding: 8, borderRadius: 6 }}
              required
            />

            <input
              placeholder="Degrees"
              value={form.degrees || ""}
              onChange={(e) => setForm((f) => ({ ...f, degrees: e.target.value }))}
              style={{ width: 180, padding: 8, borderRadius: 6 }}
            />

            <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                type="checkbox"
                checked={form.active ?? true}
                onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
              /> Active
            </label>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input
              placeholder="Department"
              value={form.department || ""}
              onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))}
              style={{ flex: 1, padding: 8, borderRadius: 6 }}
            />
            <input
              placeholder="Institution"
              value={form.institution || ""}
              onChange={(e) => setForm((f) => ({ ...f, institution: e.target.value }))}
              style={{ flex: 1, padding: 8, borderRadius: 6 }}
            />
            <input
              placeholder="Location"
              value={form.location || ""}
              onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
              style={{ width: 240, padding: 8, borderRadius: 6 }}
            />
            <input
              placeholder="Email"
              value={form.email || ""}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              style={{ width: 240, padding: 8, borderRadius: 6 }}
            />
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="submit"
              disabled={saving}
              style={{
                background: "#6A3291",
                color: "white",
                padding: "8px 12px",
                borderRadius: 6,
                border: "none",
              }}
            >
              {saving ? "Saving…" : editing ? "Update member" : "Add member"}
            </button>

            <button
              type="button"
              onClick={resetForm}
              style={{
                padding: "8px 12px",
                borderRadius: 6,
                border: "1px solid #e5e7eb",
                background: "white",
              }}
            >
              Reset
            </button>
          </div>
        </form>
      </section>

      {SECTIONS.map((s) => (
        <section key={s.key} style={{ marginBottom: 22 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <h2 style={{ margin: 0, fontSize: 18 }}>{s.label}</h2>
            <div style={{ fontSize: 13, color: "#6b7280" }}>{grouped[s.key]?.length || 0} member(s)</div>
          </div>

          <div style={{ border: "1px solid #e5e7eb", borderRadius: 6, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead style={{ background: "#f8fafc" }}>
                <tr>
                  <th style={{ textAlign: "left", padding: 10 }}>Name & degrees</th>
                  <th style={{ textAlign: "left", padding: 10 }}>Department / Institution</th>
                  <th style={{ textAlign: "left", padding: 10 }}>Location</th>
                  <th style={{ textAlign: "left", padding: 10 }}>Email</th>
                  <th style={{ textAlign: "center", padding: 10, width: 220 }}>Actions</th>
                </tr>
              </thead>

              <tbody>
                {(grouped[s.key] || []).map((row, idx) => (
                  <tr key={row.id} style={{ borderTop: "1px solid #eef2f7" }}>
                    <td style={{ padding: 10 }}>
                      <div style={{ fontWeight: 700 }}>{row.name}{row.degrees ? `, ${row.degrees}` : ""}</div>
                    </td>
                    <td style={{ padding: 10 }}>
                      <div>{row.department}</div>
                      <div style={{ color: "#6b7280", marginTop: 4 }}>{row.institution}</div>
                    </td>
                    <td style={{ padding: 10 }}>{row.location}</td>
                    <td style={{ padding: 10 }}>
                      {row.email ? <a href={`mailto:${row.email}`}>{row.email}</a> : <span style={{ color: "#9ca3af" }}>—</span>}
                    </td>
                    <td style={{ padding: 10, textAlign: "center" }}>
                      <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                        <button type="button" onClick={() => handleEdit(row)} style={{ padding: "6px 8px", borderRadius: 6 }}>Edit</button>
                        <button type="button" onClick={() => handleDelete(row.id)} style={{ padding: "6px 8px", borderRadius: 6, background: "#fee2e2", border: "none" }}>Delete</button>
                        <button type="button" onClick={() => handleMove(row.id, "up")} disabled={idx === 0} title="Move up" style={{ padding: "6px 8px", borderRadius: 6 }}>↑</button>
                        <button type="button" onClick={() => handleMove(row.id, "down")} disabled={idx === (grouped[s.key].length - 1)} title="Move down" style={{ padding: "6px 8px", borderRadius: 6 }}>↓</button>
                      </div>
                    </td>
                  </tr>
                ))}

                {(!grouped[s.key] || grouped[s.key].length === 0) && (
                  <tr>
                    <td colSpan={5} style={{ padding: 12, color: "#6b7280" }}>
                      No members yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      ))}

      {error && <div style={{ color: "crimson" }}>{error}</div>}
    </main>
  );
}
