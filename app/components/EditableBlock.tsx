"use client";

import { useEffect, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { supabase } from "../../lib/supabaseClient";

type Props = {
  contentKey: string;
  isEditor: boolean;
  placeholder?: string;
};

export default function EditableBlock({
  contentKey,
  isEditor,
  placeholder = "",
}: Props) {
  const [html, setHtml] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  /* ---------------- Load from DB ---------------- */
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const { data, error } = await supabase
          .from("site_content")
          .select("value")
          .eq("key", contentKey)
          .maybeSingle();

        if (error) throw error;

        const val = data?.value;

        if (!val) {
          setHtml(placeholder ? `<p>${placeholder}</p>` : "");
        } else if (typeof val === "string") {
          setHtml(`<p>${val}</p>`);
        } else if (val?.html) {
          setHtml(val.html);
        } else if (val?.text) {
          setHtml(`<p>${val.text}</p>`);
        } else {
          setHtml(String(val));
        }
      } catch (err: any) {
        console.error("EditableBlock load error:", err);
        setLoadError(err.message || String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [contentKey, placeholder]);

  /* ---------------- TipTap editor (ALWAYS INITIALIZED) ---------------- */
  const editor = useEditor(
    {
      extensions: [
        StarterKit,
        Placeholder.configure({ placeholder }),
      ],
      content: html,
      editable: isEditor,
      immediatelyRender: false,
      onUpdate: ({ editor }) => {
        if (isEditor) {
          setHtml(editor.getHTML());
        }
      },
    },
    [isEditor]
  );

  /* ---------------- Save ---------------- */
  async function handleSave() {
    if (!editor) return;

    setSaving(true);
    try {
      const { error } = await supabase.from("site_content").upsert({
        key: contentKey,
        value: { html },
        updated_at: new Date().toISOString(),
      });

      if (error) throw error;
    } catch (err: any) {
      console.error("EditableBlock save error:", err);
      alert("Save failed: " + (err.message || String(err)));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return null;

  /* ---------------- VIEW MODE ---------------- */
  if (!isEditor) {
    return (
      <div
        style={{ lineHeight: 1.6 }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }

  /* ---------------- EDIT MODE ---------------- */
  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
        <button onClick={() => editor?.chain().focus().toggleBold().run()}>
          B
        </button>
        <button onClick={() => editor?.chain().focus().toggleItalic().run()}>
          I
        </button>
        <button
          onClick={() =>
            editor?.chain().focus().toggleHeading({ level: 2 }).run()
          }
        >
          H2
        </button>
        <button onClick={() => editor?.chain().focus().toggleBulletList().run()}>
          • List
        </button>
        <button onClick={() => editor?.chain().focus().undo().run()}>
          ↶
        </button>
        <button onClick={() => editor?.chain().focus().redo().run()}>
          ↷
        </button>
      </div>

      {/* Editor */}
      <div
        style={{
          border: "1px dashed #6A3291",
          padding: 8,
          borderRadius: 6,
          background: "#fffafc",
        }}
      >
        <EditorContent editor={editor} />
      </div>

      {/* Save */}
      <button
        onClick={handleSave}
        disabled={saving}
        style={{
          marginTop: 8,
          padding: "6px 10px",
          fontSize: 13,
          background: "#6A3291",
          color: "white",
          border: "none",
          borderRadius: 6,
          cursor: saving ? "not-allowed" : "pointer",
        }}
      >
        {saving ? "Saving…" : "Save"}
      </button>

      {loadError && (
        <div style={{ marginTop: 8, color: "crimson", fontSize: 13 }}>
          Error loading content: {loadError}
        </div>
      )}
    </div>
  );
}
