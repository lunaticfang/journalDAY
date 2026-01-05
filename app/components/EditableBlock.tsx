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
  const [loadError, setLoadError] = useState<string | null>(null);

  const editor = useEditor({
    extensions: [StarterKit, Placeholder.configure({ placeholder })],
    content: "",
    editable: false, // start non-editable; toggled by effect below
    immediatelyRender: false, // required to avoid SSR hydration mismatch
  });

  /* ---------------- Enable / disable edit mode ---------------- */
  useEffect(() => {
    if (!editor) return;
    editor.setEditable(Boolean(isEditor));
  }, [editor, isEditor]);

  /* ---------------- Load from DB (backward-compatible) ----------------
     This supports both older rows where value is a plain string and new
     rows where value is an object containing { html: "<p>...</p>" }.
  -------------------------------------------------------------------*/
  useEffect(() => {
    if (!editor) return;

    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase
          .from("site_content")
          .select("value")
          .eq("key", contentKey)
          .maybeSingle();

        if (error) {
          console.error("EditableBlock load error:", error);
          setLoadError(error.message || "Failed to load content");
          setLoaded(true);
          return;
        }

        const val = data?.value;

        if (!val) {
          // no row — keep placeholder (TipTap Placeholder will show)
          setLoaded(true);
          return;
        }

        // If stored as string (legacy), render as plain paragraph
        if (typeof val === "string") {
          // Protect: convert newlines to <br> minimally; wrap in paragraph
          const safe = val
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean)
            .map((line) => `<p>${line}</p>`)
            .join("");
          editor.commands.setContent(safe || `<p>${val}</p>`);
        } else if (val?.html) {
          // new format: { html: "<p>...</p>" }
          editor.commands.setContent(val.html);
        } else if (val?.text) {
          // alternate form: { text: "..." }
          editor.commands.setContent(`<p>${val.text}</p>`);
        } else {
          // unknown shape: attempt stringification fallback
          editor.commands.setContent(String(val));
        }
      } catch (err: any) {
        console.error("EditableBlock unexpected load error:", err);
        setLoadError(err?.message || String(err));
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [editor, contentKey]);

  /* ---------------- Save to DB ----------------
     Save as object with `html` field so TipTap content persists as rich HTML.
  --------------------------------------------*/
  async function handleSave() {
    if (!editor) return;
    setSaving(true);
    try {
      const html = editor.getHTML();

      const { error } = await supabase.from("site_content").upsert({
        key: contentKey,
        value: { html },
        updated_at: new Date().toISOString(),
      });

      if (error) {
        throw error;
      }
    } catch (err: any) {
      console.error("EditableBlock save error:", err);
      // optional: surface to UI in a more elaborate implementation
      alert("Save failed: " + (err.message || String(err)));
    } finally {
      setSaving(false);
    }
  }

  if (!editor || !loaded) return null;

  return (
    <div style={{ position: "relative" }}>
      {/* small inline toolbar for basic formatting when editable */}
      {isEditor && (
        <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBold().run()}
            aria-label="Bold"
          >
            B
          </button>

          <button
            type="button"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            aria-label="Italic"
          >
            I
          </button>

          <button
            type="button"
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            aria-label="Heading 2"
          >
            H2
          </button>

          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            aria-label="Bullet list"
          >
            • List
          </button>

          <button
            type="button"
            onClick={() => editor.chain().focus().undo().run()}
            aria-label="Undo"
          >
            ↶
          </button>

          <button
            type="button"
            onClick={() => editor.chain().focus().redo().run()}
            aria-label="Redo"
          >
            ↷
          </button>
        </div>
      )}

      <div
        style={{
          border: isEditor ? "1px dashed #6A3291" : "none",
          padding: isEditor ? 8 : 0,
          borderRadius: 6,
          minHeight: 32,
          cursor: isEditor ? "text" : "default",
          background: isEditor ? "#fffafc" : "transparent",
        }}
      >
        <EditorContent editor={editor} />
      </div>

      {isEditor && (
        <div style={{ marginTop: 8 }}>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            style={{
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
        </div>
      )}

      {loadError && (
        <div style={{ marginTop: 8, color: "crimson", fontSize: 13 }}>
          Error loading content: {loadError}
        </div>
      )}
    </div>
  );
}
