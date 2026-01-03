"use client";

import { useEffect, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
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

  const editor = useEditor({
    extensions: [StarterKit],
    content: "",
    editable: isEditor,
  });

  /* ---------------- Load from DB ---------------- */
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
        editor.commands.setContent(placeholder);
      }

      setLoaded(true);
    })();
  }, [editor, contentKey, placeholder]);

  /* ---------------- Save to DB ---------------- */
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
  }

  if (!editor || !loaded) return null;

  return (
    <div style={{ position: "relative" }}>
      <EditorContent editor={editor} />

      {isEditor && (
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            marginTop: 8,
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
      )}
    </div>
  );
}
