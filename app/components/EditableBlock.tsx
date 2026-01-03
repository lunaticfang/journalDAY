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
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [editMode, setEditMode] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder,
      }),
    ],
    content: "",
    editable: false, // controlled manually
  });

  /* ---------------- Load content ---------------- */
  useEffect(() => {
    if (!editor) return;

    (async () => {
      const { data } = await supabase
        .from("site_content")
        .select("value")
        .eq("key", contentKey)
        .maybeSingle();

      if (data?.value?.html) {
        editor.commands.setContent(data.value.html);
      } else if (placeholder) {
        editor.commands.setContent(`<p>${placeholder}</p>`);
      }

      setLoaded(true);
    })();
  }, [editor, contentKey, placeholder]);

  /* ---------------- Toggle edit mode ---------------- */
  useEffect(() => {
    if (!editor) return;
    editor.setEditable(isEditor && editMode);
  }, [editor, isEditor, editMode]);

  /* ---------------- Save ---------------- */
  async function handleSave() {
    if (!editor) return;

    setSaving(true);

    const html = editor.getHTML();

    await supabase.from("site_content").upsert({
      key: contentKey,
      value: { html },
      updated_at: new Date().toISOString(),
    });

    setSaving(false);
    setEditMode(false);
  }

  if (!editor || !loaded) return null;

  return (
    <div style={{ position: "relative" }}>
      <div
        style={{
          border: isEditor ? "1px dashed #6A3291" : "none",
          padding: isEditor ? "6px" : 0,
          borderRadius: 4,
          minHeight: 24,
          cursor: isEditor ? "pointer" : "default",
        }}
        onClick={() => {
          if (isEditor && !editMode) setEditMode(true);
        }}
      >
        <EditorContent editor={editor} />
      </div>

      {isEditor && editMode && (
        <div style={{ marginTop: 6, display: "flex", gap: 8 }}>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: "6px 10px",
              fontSize: 12,
              background: "#6A3291",
              color: "white",
              border: "none",
              borderRadius: 4,
              cursor: saving ? "not-allowed" : "pointer",
            }}
          >
            {saving ? "Saving…" : "Save"}
          </button>

          <button
            onClick={() => setEditMode(false)}
            style={{
              padding: "6px 10px",
              fontSize: 12,
              background: "#e5e7eb",
              border: "none",
              borderRadius: 4,
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
