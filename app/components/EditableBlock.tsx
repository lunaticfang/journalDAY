"use client";

import { useEffect, useRef, useState } from "react";
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
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const editor = useEditor({
    extensions: [StarterKit, Placeholder.configure({ placeholder })],
    content: "",
    editable: false,
    immediatelyRender: false,
  });

  /* enable / disable edit mode */
  useEffect(() => {
    if (!editor) return;
    editor.setEditable(Boolean(isEditor));
  }, [editor, isEditor]);

  /* helper: plain text → paragraphs */
  function plainTextToParagraphs(text: string) {
    return (
      text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => `<p>${line}</p>`)
        .join("") || `<p>${text}</p>`
    );
  }

  /* load from DB */
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
          setLoaded(true);
          return;
        }

        let parsed: any = val;

        if (typeof val === "string") {
          const trimmed = val.trim();

          if (
            (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
            (trimmed.startsWith("[") && trimmed.endsWith("]"))
          ) {
            try {
              parsed = JSON.parse(val);
            } catch {
              parsed = val;
            }
          } else if (trimmed.includes('html":"')) {
            const idx = trimmed.indexOf('html":"') + 7;
            const extracted = trimmed.slice(idx).replace(/"+$/, "");
            parsed = { html: extracted };
          } else {
            parsed = val;
          }
        }

        try {
          if (typeof parsed === "string") {
            editor.commands.setContent(plainTextToParagraphs(parsed));
          } else if (parsed && typeof parsed === "object") {
            if (parsed.html) {
              editor.commands.setContent(parsed.html);
            } else if (parsed.text) {
              editor.commands.setContent(`<p>${parsed.text}</p>`);
            } else {
              editor.commands.setContent(String(parsed));
            }
          } else {
            editor.commands.setContent(String(parsed));
          }
        } catch (e) {
          console.error("EditableBlock setContent error:", e);
          setLoadError("Failed to render content");
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

  /* save */
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

      if (error) throw error;
    } catch (err: any) {
      console.error("EditableBlock save error:", err);
      alert("Save failed: " + (err.message || String(err)));
    } finally {
      setSaving(false);
    }
  }

  /* upload image / pdf */
  async function handleFileUpload(file: File) {
    if (!editor) return;

    const ext = file.name.split(".").pop();
    const fileName = `${contentKey}/${Date.now()}.${ext}`;

    const { error } = await supabase.storage
      .from("public-files")
      .upload(fileName, file, { upsert: true });

    if (error) {
      alert("Upload failed: " + error.message);
      return;
    }

    const { data } = supabase.storage
      .from("public-files")
      .getPublicUrl(fileName);

    const url = data.publicUrl;

    if (file.type.startsWith("image/")) {
      editor.chain().focus().insertContent(`<img src="${url}" style="max-width:100%;" />`).run();
    } else {
      editor
        .chain()
        .focus()
        .insertContent(`<p><a href="${url}" target="_blank">Download file</a></p>`)
        .run();
    }
  }

  if (!editor || !loaded) return null;

  return (
    <div style={{ position: "relative" }}>
      {isEditor && (
        <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
          <button onClick={() => editor.chain().focus().toggleBold().run()}>B</button>
          <button onClick={() => editor.chain().focus().toggleItalic().run()}>I</button>
          <button onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
            H2
          </button>
          <button onClick={() => editor.chain().focus().toggleBulletList().run()}>
            • List
          </button>
          <button onClick={() => editor.chain().focus().undo().run()}>↶</button>
          <button onClick={() => editor.chain().focus().redo().run()}>↷</button>

          <button onClick={() => fileInputRef.current?.click()}>
            + Image / PDF
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,application/pdf"
            style={{ display: "none" }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileUpload(file);
              e.currentTarget.value = "";
            }}
          />
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
