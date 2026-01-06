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

  /* ---------------- Helper: convert plain text -> safe simple HTML ---------------- */
  function plainTextToParagraphs(text: string) {
    // preserve paragraphs, ignore empty lines
    return (
      text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => `<p>${line}</p>`)
        .join("") || `<p>${text}</p>`
    );
  }

  /* ---------------- Load from DB (backward-compatible) ----------------
     Accepts:
       - jsonb column returning object (e.g. { html: "<p>..." } )
       - text column containing JSON string (e.g. '{"html":"<p>...</p>"}')
       - plain text stored in text column
       - legacy { text: "..." } object
       - broken legacy string containing `"html": "..."` (handled below)
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
          // no row — leave placeholder
          setLoaded(true);
          return;
        }

        // We'll compute 'parsed' such that:
        // - if DB gave string that *is* JSON -> parsed is object
        // - if DB gave a string that's not JSON -> parsed remains the string
        // - if DB already gave object -> parsed is that object
        let parsed: any = val;

        if (typeof val === "string") {
          const trimmed = val.trim();

          // 1) Looks like JSON object/array -> try parse
          if (
            (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
            (trimmed.startsWith("[") && trimmed.endsWith("]"))
          ) {
            try {
              parsed = JSON.parse(val);
            } catch (e) {
              // fall back to plain string
              parsed = val;
            }
          }

          // 2) Catch broken legacy strings containing "html": somewhere
          else if (
            trimmed.includes(`"html":`) ||
            trimmed.includes(`'html':`) ||
            trimmed.toLowerCase().includes("html\":")
          ) {
            // attempt to extract text after "html":
            const matchDouble = trimmed.indexOf(`"html":`);
            const matchSingle = trimmed.indexOf(`'html':`);
            const idx = matchDouble >= 0 ? matchDouble : matchSingle >= 0 ? matchSingle : -1;

            if (idx >= 0) {
              // slice after the matched token
              const token = matchDouble >= 0 ? `"html":` : `'html':`;
              let extracted = trimmed.slice(idx + token.length).trim();

              // remove leading colon/quotes/braces if present
              extracted = extracted.replace(/^[:\s]*/, "");
              // remove enclosing braces/trailing commas
              // remove leading quote
              if (extracted.startsWith('"') || extracted.startsWith("'")) {
                // remove the first and last matching quote if present
                extracted = extracted.replace(/^["']/, "");
                // remove trailing quote then optional } or , or }
                extracted = extracted.replace(/["']\s*[\},]?\s*$/, "");
              } else {
                // also strip trailing } or , if present
                extracted = extracted.replace(/[\},]\s*$/, "");
              }

              // If extracted looks like HTML (contains <>), use as-is; otherwise convert to paragraphs
              if (extracted.includes("<")) {
                parsed = { html: extracted };
              } else {
                parsed = { html: plainTextToParagraphs(extracted) };
              }
            } else {
              // fallback
              parsed = val;
            }
          }

          // 3) Plain string -> keep as-is
          else {
            parsed = val;
          }
        }

        // Now set the editor content using the shapes we accept
        try {
          if (typeof parsed === "string") {
            // plain text: convert to simple paragraphs
            const safe = plainTextToParagraphs(parsed);
            editor.commands.setContent(safe);
          } else if (parsed && typeof parsed === "object") {
            if (parsed.html) {
              // preferred: object with html field
              editor.commands.setContent(parsed.html);
            } else if (parsed.text) {
              editor.commands.setContent(`<p>${parsed.text}</p>`);
            } else {
              // object of unknown shape — stringify reasonably
              editor.commands.setContent(String(parsed));
            }
          } else {
            // last-resort fallback
            editor.commands.setContent(String(parsed));
          }
        } catch (e) {
          // TipTap setContent can throw on malformed HTML — surface and fallback
          console.error("EditableBlock: failed to set editor content:", e);
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

  /* ---------------- Save to DB ----------------
     We continue to upsert { html } — the load path above will parse stringified JSON when necessary.
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
