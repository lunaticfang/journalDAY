"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  EditorContent,
  NodeViewWrapper,
  ReactNodeViewRenderer,
  useEditor,
} from "@tiptap/react";
import { BubbleMenu, FloatingMenu } from "@tiptap/react/menus";
import { Extension, Mark, Node, mergeAttributes } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import Placeholder from "@tiptap/extension-placeholder";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import {
  addColumnAfter,
  addColumnBefore,
  addRowAfter,
  addRowBefore,
  columnResizing,
  deleteColumn,
  deleteRow,
  deleteTable,
  mergeCells,
  splitCell,
  tableEditing,
  toggleHeaderCell,
  toggleHeaderColumn,
  toggleHeaderRow,
} from "@tiptap/pm/tables";
import { supabase } from "../../lib/supabaseClient";

type Props = {
  contentKey: string;
  isEditor: boolean;
  placeholder?: string;
};

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    superscript: {
      toggleSuperscript: () => ReturnType;
    };
    subscript: {
      toggleSubscript: () => ReturnType;
    };
    textAlign: {
      setTextAlign: (textAlign: "left" | "center" | "right" | "justify") => ReturnType;
      unsetTextAlign: () => ReturnType;
    };
    indent: {
      indent: () => ReturnType;
      outdent: () => ReturnType;
    };
  }
}

type UploadFn = (file: File) => Promise<string>;

function clampInt(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.trunc(value)));
}

function safePathPart(input: string) {
  return input
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9._-]/g, "")
    .slice(0, 80);
}

/* ---------------- Formatting extensions ---------------- */

const TextStyle = Mark.create({
  name: "textStyle",
  priority: 1000,

  addAttributes() {
    return {
      color: {
        default: null,
        parseHTML: (element) => element.style.color || null,
        renderHTML: (attrs) =>
          attrs.color ? { style: `color: ${attrs.color}` } : {},
      },
      backgroundColor: {
        default: null,
        parseHTML: (element) => element.style.backgroundColor || null,
        renderHTML: (attrs) =>
          attrs.backgroundColor
            ? { style: `background-color: ${attrs.backgroundColor}` }
            : {},
      },
      fontFamily: {
        default: null,
        parseHTML: (element) => element.style.fontFamily || null,
        renderHTML: (attrs) =>
          attrs.fontFamily ? { style: `font-family: ${attrs.fontFamily}` } : {},
      },
      fontSize: {
        default: null,
        parseHTML: (element) => element.style.fontSize || null,
        renderHTML: (attrs) =>
          attrs.fontSize ? { style: `font-size: ${attrs.fontSize}` } : {},
      },
    };
  },

  parseHTML() {
    return [{ tag: "span" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes), 0];
  },
});

const Superscript = Mark.create({
  name: "superscript",
  excludes: "subscript",

  parseHTML() {
    return [{ tag: "sup" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["sup", mergeAttributes(HTMLAttributes), 0];
  },

  addCommands() {
    return {
      toggleSuperscript:
        () =>
        ({ commands }) =>
          commands.toggleMark(this.name),
    };
  },
});

const Subscript = Mark.create({
  name: "subscript",
  excludes: "superscript",

  parseHTML() {
    return [{ tag: "sub" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["sub", mergeAttributes(HTMLAttributes), 0];
  },

  addCommands() {
    return {
      toggleSubscript:
        () =>
        ({ commands }) =>
          commands.toggleMark(this.name),
    };
  },
});

const TextAlign = Extension.create({
  name: "textAlign",

  addOptions() {
    return {
      types: ["heading", "paragraph"],
    };
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          textAlign: {
            default: null,
            parseHTML: (element) => element.style.textAlign || null,
            renderHTML: (attrs) =>
              attrs.textAlign ? { style: `text-align: ${attrs.textAlign}` } : {},
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      setTextAlign:
        (textAlign: "left" | "center" | "right" | "justify") =>
        ({ commands }) => {
          return this.options.types.every((type: string) =>
            commands.updateAttributes(type, { textAlign })
          );
        },
      unsetTextAlign:
        () =>
        ({ commands }) => {
          return this.options.types.every((type: string) =>
            commands.resetAttributes(type, "textAlign")
          );
        },
    };
  },
});

const Indent = Extension.create({
  name: "indent",

  addOptions() {
    return {
      types: ["heading", "paragraph"],
      min: 0,
      max: 6,
      stepEm: 2,
    };
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          indent: {
            default: 0,
            parseHTML: (element) => {
              const fromData = element.getAttribute("data-indent");
              if (fromData != null) return clampInt(Number(fromData), 0, 99);
              const margin = element.style.marginLeft;
              if (!margin) return 0;
              const em = margin.endsWith("em") ? parseFloat(margin) : NaN;
              if (Number.isFinite(em)) {
                return clampInt(Math.round(em / this.options.stepEm), 0, 99);
              }
              return 0;
            },
            renderHTML: (attrs) => {
              const level = clampInt(Number(attrs.indent ?? 0), 0, 99);
              if (!level) return {};
              return {
                "data-indent": String(level),
                style: `margin-left: ${level * this.options.stepEm}em`,
              };
            },
          },
        },
      },
    ];
  },

  addCommands() {
    const apply = (delta: number) => {
      return ({ state, dispatch }: any) => {
        const { doc, selection } = state;
        const { from, to } = selection;
        let tr = state.tr;
        let changed = false;

        doc.nodesBetween(from, to, (node: any, pos: number) => {
          if (!this.options.types.includes(node.type.name)) return;

          const current = clampInt(Number(node.attrs.indent ?? 0), 0, 99);
          const next = clampInt(
            current + delta,
            this.options.min,
            this.options.max
          );
          if (next === current) return;

          tr = tr.setNodeMarkup(pos, undefined, { ...node.attrs, indent: next });
          changed = true;
        });

        if (!changed) return false;
        dispatch?.(tr);
        return true;
      };
    };

    return {
      indent: () => apply(1),
      outdent: () => apply(-1),
    };
  },
});

/* ---------------- Tables ---------------- */

const Table = Node.create({
  name: "table",
  group: "block",
  content: "tableRow+",
  isolating: true,

  addOptions() {
    return {
      HTMLAttributes: {
        class: "jd-table",
      },
    };
  },

  parseHTML() {
    return [{ tag: "table" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "table",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes),
      ["tbody", 0],
    ];
  },

  extendNodeSchema() {
    return { tableRole: "table" };
  },
});

const TableRow = Node.create({
  name: "tableRow",
  content: "(tableCell|tableHeader)+",

  parseHTML() {
    return [{ tag: "tr" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["tr", mergeAttributes(HTMLAttributes), 0];
  },

  extendNodeSchema() {
    return { tableRole: "row" };
  },
});

const TableCell = Node.create({
  name: "tableCell",
  content: "block+",

  addAttributes() {
    return {
      colspan: {
        default: 1,
        parseHTML: (element) => Number(element.getAttribute("colspan") || 1),
      },
      rowspan: {
        default: 1,
        parseHTML: (element) => Number(element.getAttribute("rowspan") || 1),
      },
      colwidth: {
        default: null,
        parseHTML: (element) => {
          const value = element.getAttribute("data-colwidth");
          if (!value) return null;
          const widths = value
            .split(",")
            .map((w) => Number(w))
            .filter((n) => Number.isFinite(n) && n > 0);
          return widths.length ? widths : null;
        },
        renderHTML: (attrs) => {
          if (!attrs.colwidth) return {};
          return { "data-colwidth": String(attrs.colwidth) };
        },
      },
    };
  },

  parseHTML() {
    return [{ tag: "td" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["td", mergeAttributes(HTMLAttributes), 0];
  },

  extendNodeSchema() {
    return { tableRole: "cell" };
  },
});

const TableHeader = Node.create({
  name: "tableHeader",
  content: "block+",

  addAttributes() {
    return {
      colspan: {
        default: 1,
        parseHTML: (element) => Number(element.getAttribute("colspan") || 1),
      },
      rowspan: {
        default: 1,
        parseHTML: (element) => Number(element.getAttribute("rowspan") || 1),
      },
      colwidth: {
        default: null,
        parseHTML: (element) => {
          const value = element.getAttribute("data-colwidth");
          if (!value) return null;
          const widths = value
            .split(",")
            .map((w) => Number(w))
            .filter((n) => Number.isFinite(n) && n > 0);
          return widths.length ? widths : null;
        },
        renderHTML: (attrs) => {
          if (!attrs.colwidth) return {};
          return { "data-colwidth": String(attrs.colwidth) };
        },
      },
    };
  },

  parseHTML() {
    return [{ tag: "th" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["th", mergeAttributes(HTMLAttributes), 0];
  },

  extendNodeSchema() {
    return { tableRole: "header_cell" };
  },
});

const TablePlugins = Extension.create({
  name: "tablePlugins",

  addProseMirrorPlugins() {
    return [
      columnResizing({}),
      tableEditing(),
    ];
  },
});

/* ---------------- Media nodes ---------------- */

const AttachmentNode = Node.create({
  name: "attachment",
  group: "block",
  atom: true,
  draggable: true,
  selectable: true,

  addOptions() {
    return {
      upload: null as UploadFn | null,
      HTMLAttributes: {
        "data-attachment": "true",
      },
    };
  },

  addAttributes() {
    return {
      href: {
        default: null,
        parseHTML: (element) => element.getAttribute("href"),
      },
      name: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-name") || element.textContent,
        renderHTML: (attrs) => (attrs.name ? { "data-name": attrs.name } : {}),
      },
      mime: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-mime"),
        renderHTML: (attrs) => (attrs.mime ? { "data-mime": attrs.mime } : {}),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'a[data-attachment="true"]' }, { tag: "a[data-attachment]" }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const attrs = node.attrs as any;
    const label = attrs.name || "Download file";
    return [
      "a",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        href: attrs.href,
        target: "_blank",
        rel: "noopener noreferrer",
      }),
      label,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(AttachmentNodeView);
  },
});

const ImageNode = Node.create({
  name: "image",
  draggable: true,
  selectable: true,

  addOptions() {
    return {
      upload: null as UploadFn | null,
      inline: false,
      allowBase64: false,
      HTMLAttributes: {
        style: "max-width: 100%; height: auto;",
      },
    };
  },

  inline() {
    return this.options.inline;
  },

  group() {
    return this.options.inline ? "inline" : "block";
  },

  addAttributes() {
    return {
      src: { default: null },
      alt: { default: null },
      title: { default: null },
      align: {
        default: "center",
        parseHTML: (element) => element.getAttribute("data-align") || "center",
        renderHTML: (attrs) => (attrs.align ? { "data-align": attrs.align } : {}),
      },
      width: {
        default: null,
        parseHTML: (element) => {
          const fromData = element.getAttribute("data-width");
          if (fromData) return clampInt(Number(fromData), 10, 100);

          const w = element.style.width;
          if (!w) return null;
          if (w.endsWith("%")) return clampInt(parseFloat(w), 10, 100);
          return null;
        },
        renderHTML: (attrs) =>
          attrs.width
            ? {
                "data-width": String(attrs.width),
                style: `width: ${attrs.width}%`,
              }
            : {},
      },
    };
  },

  parseHTML() {
    const allowBase64 = this.options.allowBase64;

    return [
      {
        tag: allowBase64 ? "img[src]" : 'img[src]:not([src^="data:"])',
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    const attrs = node.attrs as any;
    const align = attrs.align as string | null;
    const alignStyle =
      align === "left"
        ? "display: block; margin-left: 0; margin-right: auto;"
        : align === "right"
          ? "display: block; margin-left: auto; margin-right: 0;"
          : "display: block; margin-left: auto; margin-right: auto;";

    return [
      "img",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        style: alignStyle,
      }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageNodeView);
  },
});

/* ---------------- Paste / drop upload handler ---------------- */

const FileHandler = Extension.create({
  name: "fileHandler",

  addOptions() {
    return {
      upload: null as UploadFn | null,
    };
  },

  addProseMirrorPlugins() {
    const key = new PluginKey("jd-file-handler");

    const uploadAndInsert = async (file: File, pos?: number) => {
      if (!this.options.upload) return;
      const url = await this.options.upload(file);

      const insertion =
        file.type.startsWith("image/")
          ? {
              type: "image",
              attrs: { src: url, alt: file.name || "Image" },
            }
          : {
              type: "attachment",
              attrs: { href: url, name: file.name, mime: file.type },
            };

      const chain = this.editor.chain().focus();
      if (typeof pos === "number") {
        chain.insertContentAt(pos, insertion).run();
      } else {
        chain.insertContent(insertion).run();
      }
    };

    return [
      new Plugin({
        key,
        props: {
          handlePaste: (_view, event) => {
            const e = event as ClipboardEvent;
            const files = Array.from(e.clipboardData?.files ?? []);
            if (!files.length) return false;

            const usable = files.filter(
              (f) =>
                f.type.startsWith("image/") || f.type === "application/pdf"
            );
            if (!usable.length) return false;

            e.preventDefault();
            void (async () => {
              for (const f of usable) await uploadAndInsert(f);
            })();

            return true;
          },
          handleDrop: (view, event) => {
            const e = event as DragEvent;
            const files = Array.from(e.dataTransfer?.files ?? []);
            if (!files.length) return false;

            const usable = files.filter(
              (f) =>
                f.type.startsWith("image/") || f.type === "application/pdf"
            );
            if (!usable.length) return false;

            const coords = view.posAtCoords({ left: e.clientX, top: e.clientY });
            if (!coords) return false;

            e.preventDefault();
            void (async () => {
              let insertPos = coords.pos;
              for (const f of usable) {
                await uploadAndInsert(f, insertPos);
                insertPos += 1;
              }
            })();

            return true;
          },
        },
      }),
    ];
  },
});

function ImageNodeView(props: any) {
  const { node, selected, updateAttributes, deleteNode, editor, extension } =
    props;
  const src = node.attrs.src as string | null;
  const alt = (node.attrs.alt as string | null) ?? "";
  const align = (node.attrs.align as string | null) ?? "center";
  const width = (node.attrs.width as number | null) ?? null;

  const replaceInputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [showAlt, setShowAlt] = useState(false);
  const [altDraft, setAltDraft] = useState(alt);

  useEffect(() => {
    setAltDraft(alt);
  }, [alt]);

  async function handleReplace(file: File) {
    const upload: UploadFn | null = (extension.options as any)?.upload ?? null;
    if (!upload) {
      alert("Upload is not configured for this editor.");
      return;
    }

    setBusy(true);
    try {
      const url = await upload(file);
      updateAttributes({
        src: url,
        alt: file.name || alt || "Image",
      });
    } catch (err: any) {
      console.error("Image replace failed:", err);
      alert("Replace failed: " + (err?.message || String(err)));
    } finally {
      setBusy(false);
    }
  }

  function setAlign(next: "left" | "center" | "right") {
    updateAttributes({ align: next });
  }

  function setWidth(next: number | null) {
    if (next == null) updateAttributes({ width: null });
    else updateAttributes({ width: clampInt(next, 10, 100) });
  }

  const canEdit = Boolean(editor?.isEditable);

  return (
    <NodeViewWrapper
      className={[
        "jd-image",
        selected ? "is-selected" : "",
        busy ? "is-busy" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      data-align={align}
    >
      <div className="jd-image__frame">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={alt}
            className="jd-image__img"
            style={width ? { width: `${width}%` } : undefined}
            draggable={false}
          />
        ) : (
          <div className="jd-image__missing">Missing image source</div>
        )}

        {canEdit && (selected || showAlt) && (
          <div className="jd-image__controls" contentEditable={false}>
            <div className="jd-image__row">
              <button
                type="button"
                className="jd-btn"
                onMouseDown={(e) => e.preventDefault()}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  replaceInputRef.current?.click();
                }}
                disabled={busy}
                title="Replace image"
              >
                Replace
              </button>
              <button
                type="button"
                className="jd-btn jd-btn--danger"
                onMouseDown={(e) => e.preventDefault()}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  deleteNode();
                }}
                disabled={busy}
                title="Remove image"
              >
                Remove
              </button>
              {src && (
                <a
                  className="jd-btn"
                  href={src}
                  target="_blank"
                  rel="noreferrer"
                  onMouseDown={(e) => e.preventDefault()}
                  contentEditable={false}
                  title="Open image in new tab"
                >
                  Open
                </a>
              )}

              <input
                ref={replaceInputRef}
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleReplace(file);
                  e.currentTarget.value = "";
                }}
              />
            </div>

            <div className="jd-image__row">
              <span className="jd-pill">Align</span>
              <button
                type="button"
                className={[
                  "jd-btn",
                  align === "left" ? "is-active" : "",
                ].join(" ")}
                onMouseDown={(e) => e.preventDefault()}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setAlign("left");
                }}
                title="Align left"
              >
                Left
              </button>
              <button
                type="button"
                className={[
                  "jd-btn",
                  align === "center" ? "is-active" : "",
                ].join(" ")}
                onMouseDown={(e) => e.preventDefault()}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setAlign("center");
                }}
                title="Align center"
              >
                Center
              </button>
              <button
                type="button"
                className={[
                  "jd-btn",
                  align === "right" ? "is-active" : "",
                ].join(" ")}
                onMouseDown={(e) => e.preventDefault()}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setAlign("right");
                }}
                title="Align right"
              >
                Right
              </button>

              <span className="jd-pill" style={{ marginLeft: 8 }}>
                Width
              </span>
              {[25, 50, 75, 100].map((w) => (
                <button
                  key={w}
                  type="button"
                  className={[
                    "jd-btn",
                    width === w ? "is-active" : "",
                  ].join(" ")}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setWidth(w);
                  }}
                  title={`Set width ${w}%`}
                >
                  {w}%
                </button>
              ))}
              <button
                type="button"
                className={["jd-btn", width == null ? "is-active" : ""].join(
                  " "
                )}
                onMouseDown={(e) => e.preventDefault()}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setWidth(null);
                }}
                title="Auto width"
              >
                Auto
              </button>
            </div>

            <div className="jd-image__row">
              <button
                type="button"
                className="jd-btn"
                onMouseDown={(e) => e.preventDefault()}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowAlt((v) => !v);
                }}
                title="Edit alt text"
              >
                Alt text
              </button>

              {showAlt && (
                <div className="jd-inline-form" contentEditable={false}>
                  <input
                    value={altDraft}
                    onChange={(e) => setAltDraft(e.target.value)}
                    placeholder="Describe this image..."
                    className="jd-input"
                  />
                  <button
                    type="button"
                    className="jd-btn"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      updateAttributes({ alt: altDraft || null });
                      setShowAlt(false);
                    }}
                    disabled={busy}
                  >
                    Apply
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </NodeViewWrapper>
  );
}

function AttachmentNodeView(props: any) {
  const { node, selected, updateAttributes, deleteNode, editor, extension } =
    props;

  const href = node.attrs.href as string | null;
  const name = node.attrs.name as string | null;
  const mime = node.attrs.mime as string | null;

  const replaceInputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);

  const canEdit = Boolean(editor?.isEditable);

  async function handleReplace(file: File) {
    const upload: UploadFn | null = (extension.options as any)?.upload ?? null;
    if (!upload) {
      alert("Upload is not configured for this editor.");
      return;
    }

    setBusy(true);
    try {
      const url = await upload(file);
      updateAttributes({
        href: url,
        name: file.name,
        mime: file.type,
      });
    } catch (err: any) {
      console.error("Attachment replace failed:", err);
      alert("Replace failed: " + (err?.message || String(err)));
    } finally {
      setBusy(false);
    }
  }

  const isPdf =
    mime === "application/pdf" ||
    Boolean(name?.toLowerCase().endsWith(".pdf")) ||
    Boolean(href?.toLowerCase().includes(".pdf"));

  return (
    <NodeViewWrapper
      className={[
        "jd-attachment",
        selected ? "is-selected" : "",
        busy ? "is-busy" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      data-mime={mime || undefined}
    >
      <div className="jd-attachment__card" contentEditable={false}>
        <div className="jd-attachment__left">
          <div className="jd-attachment__badge">{isPdf ? "PDF" : "FILE"}</div>
          <div className="jd-attachment__meta">
            <div className="jd-attachment__name">
              {name || href || "File"}
            </div>
            {href && (
              <div className="jd-attachment__url" title={href}>
                {href}
              </div>
            )}
          </div>
        </div>

        <div className="jd-attachment__actions">
          {href && (
            <a
              className="jd-btn"
              href={href}
              target="_blank"
              rel="noreferrer"
              onMouseDown={(e) => e.preventDefault()}
              title="Open in new tab"
            >
              Open
            </a>
          )}

          {canEdit && (
            <>
              <button
                type="button"
                className="jd-btn"
                onMouseDown={(e) => e.preventDefault()}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  replaceInputRef.current?.click();
                }}
                disabled={busy}
              >
                Replace
              </button>
              <button
                type="button"
                className="jd-btn jd-btn--danger"
                onMouseDown={(e) => e.preventDefault()}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  deleteNode();
                }}
                disabled={busy}
              >
                Remove
              </button>

              <input
                ref={replaceInputRef}
                type="file"
                accept="application/pdf"
                style={{ display: "none" }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleReplace(file);
                  e.currentTarget.value = "";
                }}
              />
            </>
          )}
        </div>
      </div>
    </NodeViewWrapper>
  );
}

export default function EditableBlock({
  contentKey,
  isEditor,
  placeholder = "",
}: Props) {
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkDraft, setLinkDraft] = useState("");
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const settingContentRef = useRef(false);
  const saveRef = useRef<() => void>(() => {});

  const uploadToCmsMedia = useMemo<UploadFn>(() => {
    return async (file: File) => {
      const originalName = file.name || "upload";
      const dot = originalName.lastIndexOf(".");
      const base = dot > 0 ? originalName.slice(0, dot) : originalName;
      const ext = dot > 0 ? originalName.slice(dot + 1) : "";
      const safeBase = safePathPart(base) || "upload";
      const safeExt = safePathPart(ext);

      const path =
        `${safePathPart(contentKey)}/` +
        `${Date.now()}-${safeBase}` +
        (safeExt ? `.${safeExt}` : "");

      const { error } = await supabase.storage
        .from("cms-media")
        .upload(path, file, {
          upsert: true,
          contentType: file.type || undefined,
        });

      if (error) throw error;

      const { data } = supabase.storage.from("cms-media").getPublicUrl(path);
      if (!data?.publicUrl) throw new Error("Could not create a public URL");
      return data.publicUrl;
    };
  }, [contentKey]);

  const extensions = useMemo(() => {
    return [
      StarterKit,
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { rel: "noopener noreferrer" },
      }),
      TextStyle,
      Superscript,
      Subscript,
      TextAlign,
      Indent,
      Table,
      TableRow,
      TableHeader,
      TableCell,
      TablePlugins,
      AttachmentNode.configure({ upload: uploadToCmsMedia }),
      ImageNode.configure({ upload: uploadToCmsMedia }),
      FileHandler.configure({ upload: uploadToCmsMedia }),
      Placeholder.configure({ placeholder }),
    ];
  }, [placeholder, uploadToCmsMedia]);

  const editor = useEditor(
    {
      extensions,
      content: "",
      editable: false,
      immediatelyRender: false,
      editorProps: {
        attributes: {
          class: "jd-editor",
          spellcheck: "true",
        },
        handleKeyDown: (_view, event) => {
          if (
            (event.ctrlKey || event.metaKey) &&
            event.key.toLowerCase() === "s"
          ) {
            event.preventDefault();
            saveRef.current();
            return true;
          }

          return false;
        },
      },
      onUpdate: () => {
        if (settingContentRef.current) return;
        setDirty(true);
      },
      onFocus: () => setFocused(true),
      onBlur: () => setFocused(false),
    },
    [extensions]
  );

  /* enable / disable edit mode */
  useEffect(() => {
    if (!editor) return;
    editor.setEditable(Boolean(isEditor));
  }, [editor, isEditor]);

  /* helper: plain text -> paragraphs */
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
          settingContentRef.current = true;

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

          setDirty(false);
          setSavedAt(null);
        } catch (e) {
          console.error("EditableBlock setContent error:", e);
          setLoadError("Failed to render content");
        } finally {
          settingContentRef.current = false;
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

      setDirty(false);
      setSavedAt(new Date().toISOString());
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

    try {
      const url = await uploadToCmsMedia(file);

      if (file.type.startsWith("image/")) {
        editor
          .chain()
          .focus()
          .insertContent({
            type: "image",
            attrs: { src: url, alt: file.name || "Image" },
          })
          .run();
      } else {
        editor
          .chain()
          .focus()
          .insertContent({
            type: "attachment",
            attrs: { href: url, name: file.name, mime: file.type },
          })
          .run();
      }
    } catch (err: any) {
      console.error("Upload failed:", err);
      alert("Upload failed: " + (err?.message || String(err)));
    }
  }

  saveRef.current = () => {
    void handleSave();
  };

  if (!editor || !loaded) return null;

  const ed = editor;

  const showChrome = isEditor && (focused || linkOpen);

  const preventMouseDown = (e: any) => {
    e.preventDefault();
  };

  const textStyleAttrs = ed.getAttributes("textStyle") as any;
  const currentColor = (textStyleAttrs?.color as string | null) || "";
  const currentBg = (textStyleAttrs?.backgroundColor as string | null) || "";
  const currentFontFamily = (textStyleAttrs?.fontFamily as string | null) || "";
  const currentFontSize = (textStyleAttrs?.fontSize as string | null) || "";

  const currentBlock =
    ed.isActive("heading", { level: 1 })
      ? "h1"
      : ed.isActive("heading", { level: 2 })
        ? "h2"
        : ed.isActive("heading", { level: 3 })
          ? "h3"
          : ed.isActive("heading", { level: 4 })
            ? "h4"
            : "p";

  const activeBlockType = ed.isActive("heading") ? "heading" : "paragraph";
  const currentAlign =
    ((ed.getAttributes(activeBlockType) as any)?.textAlign as string | null) ||
    "left";

  function setBlock(next: string) {
    if (next === "p") {
      ed.chain().focus().setParagraph().run();
      return;
    }

    const level = Number(next.slice(1));
    if (!Number.isFinite(level)) return;
    ed.chain().focus().setNode("heading", { level }).run();
  }

  function setTextStyle(partial: Record<string, any>) {
    ed.chain().focus().setMark("textStyle", partial).run();
  }

  function clearTextStyle() {
    ed.chain().focus().unsetMark("textStyle").run();
  }

  function openLink() {
    const existing = (ed.getAttributes("link") as any)?.href ?? "";
    setLinkDraft(existing);
    setLinkOpen(true);
  }

  function applyLink() {
    const href = linkDraft.trim();

    if (!href) {
      ed.chain().focus().unsetLink().run();
      setLinkOpen(false);
      return;
    }

    ed
      .chain()
      .focus()
      .extendMarkRange("link")
      .setLink({ href })
      .run();
    setLinkOpen(false);
  }

  function insertTable(rows = 3, cols = 3, withHeaderRow = true) {
    const schemaNodes: any = ed.schema.nodes as any;
    const table = schemaNodes.table;
    const tableRow = schemaNodes.tableRow;
    const tableCell = schemaNodes.tableCell;
    const tableHeader = schemaNodes.tableHeader;

    if (!table || !tableRow || !tableCell) return;

    const rowsNodes: any[] = [];

    for (let r = 0; r < rows; r += 1) {
      const cellNodes: any[] = [];

      for (let c = 0; c < cols; c += 1) {
        const type =
          withHeaderRow && r === 0 && tableHeader ? tableHeader : tableCell;
        const cell = type.createAndFill();
        if (cell) cellNodes.push(cell);
      }

      rowsNodes.push(tableRow.createChecked(null, cellNodes));
    }

    const tableNode = table.createChecked(null, rowsNodes);
    const tr = ed.state.tr.replaceSelectionWith(tableNode).scrollIntoView();
    ed.view.dispatch(tr);
    ed.view.focus();
  }

  function runTableAction(action: (state: any, dispatch: any) => boolean) {
    const ok = action(ed.state, ed.view.dispatch);
    ed.view.focus();
    return ok;
  }

  return (
    <div className="jd-editable-block">
      {isEditor && !showChrome && (
        <div className="jd-edit-chip">
          <button
            type="button"
            className="jd-btn jd-btn--ghost"
            onMouseDown={preventMouseDown}
            onClick={() => ed.chain().focus().run()}
            title="Edit this block"
          >
            Edit
          </button>
          {dirty && <span className="jd-edit-chip__dot" />}
        </div>
      )}

      {isEditor && (
        <div className={["jd-toolbar", showChrome ? "is-visible" : ""].join(" ")}>
          <div className="jd-toolbar__left">
            <select
              className="jd-select"
              value={currentBlock}
              onChange={(e) => setBlock(e.target.value)}
              title="Block style"
            >
              <option value="p">Paragraph</option>
              <option value="h1">Heading 1</option>
              <option value="h2">Heading 2</option>
              <option value="h3">Heading 3</option>
              <option value="h4">Heading 4</option>
            </select>

            <div className="jd-divider" />

            <button
              type="button"
              className={["jd-btn", ed.isActive("bold") ? "is-active" : ""].join(" ")}
              onMouseDown={preventMouseDown}
              onClick={() => ed.chain().focus().toggleBold().run()}
              disabled={!ed.can().chain().focus().toggleBold().run()}
              title="Bold (Ctrl/Cmd+B)"
            >
              B
            </button>
            <button
              type="button"
              className={["jd-btn", ed.isActive("italic") ? "is-active" : ""].join(" ")}
              onMouseDown={preventMouseDown}
              onClick={() => ed.chain().focus().toggleItalic().run()}
              disabled={!ed.can().chain().focus().toggleItalic().run()}
              title="Italic (Ctrl/Cmd+I)"
            >
              I
            </button>
            <button
              type="button"
              className={["jd-btn", ed.isActive("underline") ? "is-active" : ""].join(" ")}
              onMouseDown={preventMouseDown}
              onClick={() => ed.chain().focus().toggleUnderline().run()}
              disabled={!ed.can().chain().focus().toggleUnderline().run()}
              title="Underline (Ctrl/Cmd+U)"
            >
              U
            </button>
            <button
              type="button"
              className={["jd-btn", ed.isActive("strike") ? "is-active" : ""].join(" ")}
              onMouseDown={preventMouseDown}
              onClick={() => ed.chain().focus().toggleStrike().run()}
              disabled={!ed.can().chain().focus().toggleStrike().run()}
              title="Strikethrough"
            >
              S
            </button>
            <button
              type="button"
              className={["jd-btn", ed.isActive("code") ? "is-active" : ""].join(" ")}
              onMouseDown={preventMouseDown}
              onClick={() => ed.chain().focus().toggleCode().run()}
              disabled={!ed.can().chain().focus().toggleCode().run()}
              title="Inline code"
            >
              {"</>"}
            </button>

            <button
              type="button"
              className={["jd-btn", ed.isActive("blockquote") ? "is-active" : ""].join(" ")}
              onMouseDown={preventMouseDown}
              onClick={() => ed.chain().focus().toggleBlockquote().run()}
              title="Block quote"
            >
              Quote
            </button>
            <button
              type="button"
              className={["jd-btn", ed.isActive("codeBlock") ? "is-active" : ""].join(" ")}
              onMouseDown={preventMouseDown}
              onClick={() => ed.chain().focus().toggleCodeBlock().run()}
              title="Code block"
            >
              Code block
            </button>
            <button
              type="button"
              className="jd-btn"
              onMouseDown={preventMouseDown}
              onClick={() => ed.chain().focus().setHorizontalRule().run()}
              title="Divider"
            >
              Divider
            </button>

            <button
              type="button"
              className={["jd-btn", ed.isActive("superscript") ? "is-active" : ""].join(" ")}
              onMouseDown={preventMouseDown}
              onClick={() => ed.chain().focus().toggleMark("superscript").run()}
              title="Superscript"
            >
              x^2
            </button>
            <button
              type="button"
              className={["jd-btn", ed.isActive("subscript") ? "is-active" : ""].join(" ")}
              onMouseDown={preventMouseDown}
              onClick={() => ed.chain().focus().toggleMark("subscript").run()}
              title="Subscript"
            >
              x_2
            </button>

            <div className="jd-divider" />

            <button
              type="button"
              className={["jd-btn", ed.isActive("bulletList") ? "is-active" : ""].join(" ")}
              onMouseDown={preventMouseDown}
              onClick={() => ed.chain().focus().toggleBulletList().run()}
              title="Bulleted list"
            >
              Bullets
            </button>
            <button
              type="button"
              className={["jd-btn", ed.isActive("orderedList") ? "is-active" : ""].join(" ")}
              onMouseDown={preventMouseDown}
              onClick={() => ed.chain().focus().toggleOrderedList().run()}
              title="Numbered list"
            >
              Numbers
            </button>

            <button
              type="button"
              className="jd-btn"
              onMouseDown={preventMouseDown}
              onClick={() => {
                if (ed.isActive("listItem")) {
                  ed.chain().focus().sinkListItem("listItem").run();
                } else {
                  ed.chain().focus().indent().run();
                }
              }}
              title="Indent"
            >
              Indent
            </button>
            <button
              type="button"
              className="jd-btn"
              onMouseDown={preventMouseDown}
              onClick={() => {
                if (ed.isActive("listItem")) {
                  ed.chain().focus().liftListItem("listItem").run();
                } else {
                  ed.chain().focus().outdent().run();
                }
              }}
              title="Outdent"
            >
              Outdent
            </button>

            <div className="jd-divider" />

            <button
              type="button"
              className={["jd-btn", currentAlign === "left" ? "is-active" : ""].join(" ")}
              onMouseDown={preventMouseDown}
              onClick={() => ed.chain().focus().setTextAlign("left").run()}
              title="Align left"
            >
              Left
            </button>
            <button
              type="button"
              className={["jd-btn", currentAlign === "center" ? "is-active" : ""].join(" ")}
              onMouseDown={preventMouseDown}
              onClick={() => ed.chain().focus().setTextAlign("center").run()}
              title="Align center"
            >
              Center
            </button>
            <button
              type="button"
              className={["jd-btn", currentAlign === "right" ? "is-active" : ""].join(" ")}
              onMouseDown={preventMouseDown}
              onClick={() => ed.chain().focus().setTextAlign("right").run()}
              title="Align right"
            >
              Right
            </button>
            <button
              type="button"
              className={["jd-btn", currentAlign === "justify" ? "is-active" : ""].join(" ")}
              onMouseDown={preventMouseDown}
              onClick={() => ed.chain().focus().setTextAlign("justify").run()}
              title="Justify"
            >
              Justify
            </button>

            <div className="jd-divider" />

            <label className="jd-color" title="Text color">
              <span className="jd-color__label">A</span>
              <input
                type="color"
                value={currentColor || "#111827"}
                onChange={(e) => setTextStyle({ color: e.target.value })}
              />
            </label>

            <label className="jd-color" title="Highlight">
              <span className="jd-color__label">Bg</span>
              <input
                type="color"
                value={currentBg || "#ffffff"}
                onChange={(e) => setTextStyle({ backgroundColor: e.target.value })}
              />
            </label>

            <select
              className="jd-select"
              value={currentFontFamily || ""}
              onChange={(e) => setTextStyle({ fontFamily: e.target.value || null })}
              title="Font"
            >
              <option value="">System</option>
              <option value="Georgia, serif">Serif</option>
              <option value="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace">
                Mono
              </option>
              <option value="'Times New Roman', Times, serif">Times</option>
            </select>

            <select
              className="jd-select"
              value={currentFontSize || ""}
              onChange={(e) => setTextStyle({ fontSize: e.target.value || null })}
              title="Font size"
            >
              <option value="">Size</option>
              <option value="12px">12</option>
              <option value="14px">14</option>
              <option value="16px">16</option>
              <option value="18px">18</option>
              <option value="24px">24</option>
              <option value="32px">32</option>
            </select>

            <button
              type="button"
              className="jd-btn"
              onMouseDown={preventMouseDown}
              onClick={() => clearTextStyle()}
              title="Clear text styles (color, highlight, font)"
            >
              Clear styles
            </button>

            <div className="jd-divider" />

            <button
              type="button"
              className={["jd-btn", ed.isActive("link") ? "is-active" : ""].join(" ")}
              onMouseDown={preventMouseDown}
              onClick={() => openLink()}
              title="Link"
            >
              Link
            </button>

            <button
              type="button"
              className="jd-btn"
              onMouseDown={preventMouseDown}
              onClick={() => {
                setLinkOpen(false);
                ed.chain().focus().unsetLink().run();
              }}
              disabled={!ed.isActive("link")}
              title="Remove link"
            >
              Unlink
            </button>

            <button
              type="button"
              className="jd-btn"
              onMouseDown={preventMouseDown}
              onClick={() => imageInputRef.current?.click()}
              title="Insert image"
            >
              + Image
            </button>
            <button
              type="button"
              className="jd-btn"
              onMouseDown={preventMouseDown}
              onClick={() => fileInputRef.current?.click()}
              title="Insert PDF"
            >
              + PDF
            </button>

            <button
              type="button"
              className="jd-btn"
              onMouseDown={preventMouseDown}
              onClick={() => insertTable(3, 3, true)}
              title="Insert table"
            >
              + Table
            </button>

            {ed.isActive("table") && (
              <div className="jd-table-tools">
                <button
                  type="button"
                  className="jd-btn"
                  onMouseDown={preventMouseDown}
                  onClick={() => runTableAction(addRowBefore)}
                  title="Add row above"
                >
                  + Row above
                </button>
                <button
                  type="button"
                  className="jd-btn"
                  onMouseDown={preventMouseDown}
                  onClick={() => runTableAction(addRowAfter)}
                  title="Add row below"
                >
                  + Row below
                </button>
                <button
                  type="button"
                  className="jd-btn"
                  onMouseDown={preventMouseDown}
                  onClick={() => runTableAction(addColumnBefore)}
                  title="Add column left"
                >
                  + Col left
                </button>
                <button
                  type="button"
                  className="jd-btn"
                  onMouseDown={preventMouseDown}
                  onClick={() => runTableAction(addColumnAfter)}
                  title="Add column right"
                >
                  + Col right
                </button>
                <button
                  type="button"
                  className="jd-btn"
                  onMouseDown={preventMouseDown}
                  onClick={() => runTableAction(deleteRow)}
                  title="Delete row"
                >
                  Delete row
                </button>
                <button
                  type="button"
                  className="jd-btn"
                  onMouseDown={preventMouseDown}
                  onClick={() => runTableAction(deleteColumn)}
                  title="Delete column"
                >
                  Delete col
                </button>
                <button
                  type="button"
                  className="jd-btn"
                  onMouseDown={preventMouseDown}
                  onClick={() => runTableAction(mergeCells)}
                  title="Merge cells"
                >
                  Merge
                </button>
                <button
                  type="button"
                  className="jd-btn"
                  onMouseDown={preventMouseDown}
                  onClick={() => runTableAction(splitCell)}
                  title="Split cell"
                >
                  Split
                </button>
                <button
                  type="button"
                  className="jd-btn"
                  onMouseDown={preventMouseDown}
                  onClick={() => runTableAction(toggleHeaderRow)}
                  title="Toggle header row"
                >
                  Header row
                </button>
                <button
                  type="button"
                  className="jd-btn"
                  onMouseDown={preventMouseDown}
                  onClick={() => runTableAction(toggleHeaderColumn)}
                  title="Toggle header column"
                >
                  Header col
                </button>
                <button
                  type="button"
                  className="jd-btn"
                  onMouseDown={preventMouseDown}
                  onClick={() => runTableAction(toggleHeaderCell)}
                  title="Toggle header cell"
                >
                  Header cell
                </button>
                <button
                  type="button"
                  className="jd-btn jd-btn--danger"
                  onMouseDown={preventMouseDown}
                  onClick={() => runTableAction(deleteTable)}
                  title="Delete table"
                >
                  Delete table
                </button>
              </div>
            )}

            <button
              type="button"
              className="jd-btn"
              onMouseDown={preventMouseDown}
              onClick={() => ed.chain().focus().unsetAllMarks().clearNodes().run()}
              title="Clear formatting"
            >
              Clear formatting
            </button>

            <div className="jd-divider" />

            <button
              type="button"
              className="jd-btn"
              onMouseDown={preventMouseDown}
              onClick={() => ed.chain().focus().undo().run()}
              disabled={!ed.can().chain().focus().undo().run()}
              title="Undo"
            >
              Undo
            </button>
            <button
              type="button"
              className="jd-btn"
              onMouseDown={preventMouseDown}
              onClick={() => ed.chain().focus().redo().run()}
              disabled={!ed.can().chain().focus().redo().run()}
              title="Redo"
            >
              Redo
            </button>
          </div>

          <div className="jd-toolbar__right">
            <div className="jd-status">
              {saving
                ? "Saving..."
                : dirty
                  ? "Unsaved changes"
                  : savedAt
                    ? `Saved ${new Date(savedAt).toLocaleTimeString()}`
                    : "Up to date"}
            </div>
            <button
              type="button"
              className="jd-btn jd-btn--primary"
              onMouseDown={preventMouseDown}
              onClick={handleSave}
              disabled={saving || !dirty}
              title="Save (Ctrl/Cmd+S)"
            >
              Save
            </button>
          </div>

          {linkOpen && (
            <div className="jd-popover">
              <div className="jd-popover__title">Link</div>
              <input
                className="jd-input"
                value={linkDraft}
                onChange={(e) => setLinkDraft(e.target.value)}
                placeholder="https://example.com"
              />
              <div className="jd-popover__actions">
                <button
                  type="button"
                  className="jd-btn"
                  onMouseDown={preventMouseDown}
                  onClick={() => applyLink()}
                >
                  Apply
                </button>
                <button
                  type="button"
                  className="jd-btn"
                  onMouseDown={preventMouseDown}
                  onClick={() => {
                    setLinkDraft("");
                    ed.chain().focus().unsetLink().run();
                    setLinkOpen(false);
                  }}
                >
                  Remove
                </button>
                <button
                  type="button"
                  className="jd-btn"
                  onMouseDown={preventMouseDown}
                  onClick={() => setLinkOpen(false)}
                >
                  Close
                </button>
              </div>
            </div>
          )}

          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFileUpload(file);
              e.currentTarget.value = "";
            }}
          />
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            style={{ display: "none" }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFileUpload(file);
              e.currentTarget.value = "";
            }}
          />
        </div>
      )}

      {isEditor && (
        <BubbleMenu
          editor={ed}
          className="jd-bubble"
          options={{ placement: "top", offset: 10 }}
        >
          <button
            type="button"
            className={["jd-btn", ed.isActive("bold") ? "is-active" : ""].join(" ")}
            onMouseDown={preventMouseDown}
            onClick={() => ed.chain().focus().toggleBold().run()}
            title="Bold"
          >
            B
          </button>
          <button
            type="button"
            className={["jd-btn", ed.isActive("italic") ? "is-active" : ""].join(" ")}
            onMouseDown={preventMouseDown}
            onClick={() => ed.chain().focus().toggleItalic().run()}
            title="Italic"
          >
            I
          </button>
          <button
            type="button"
            className={["jd-btn", ed.isActive("underline") ? "is-active" : ""].join(" ")}
            onMouseDown={preventMouseDown}
            onClick={() => ed.chain().focus().toggleUnderline().run()}
            title="Underline"
          >
            U
          </button>
          <button
            type="button"
            className={["jd-btn", ed.isActive("link") ? "is-active" : ""].join(" ")}
            onMouseDown={preventMouseDown}
            onClick={() => openLink()}
            title="Link"
          >
            Link
          </button>
        </BubbleMenu>
      )}

      {isEditor && (
        <FloatingMenu
          editor={ed}
          className="jd-floating"
          options={{ placement: "right", offset: 12 }}
          shouldShow={({ editor }) => {
            const { $from } = editor.state.selection as any;
            const isEmpty =
              $from.parent?.type?.name === "paragraph" &&
              $from.parent.content.size === 0;
            return editor.isEditable && isEmpty;
          }}
        >
          <div className="jd-floating__inner">
            <button
              type="button"
              className="jd-btn"
              onMouseDown={preventMouseDown}
              onClick={() => ed.chain().focus().toggleBulletList().run()}
              title="Start a list"
            >
              Bullets
            </button>
            <button
              type="button"
              className="jd-btn"
              onMouseDown={preventMouseDown}
              onClick={() => imageInputRef.current?.click()}
              title="Insert image"
            >
              + Image
            </button>
            <button
              type="button"
              className="jd-btn"
              onMouseDown={preventMouseDown}
              onClick={() => insertTable(3, 3, true)}
              title="Insert table"
            >
              + Table
            </button>
          </div>
        </FloatingMenu>
      )}

      <div className={["jd-editor-shell", isEditor ? "is-editable" : ""].join(" ")}>
        <EditorContent editor={ed} />
      </div>

      {loadError && <div className="jd-error">Error loading content: {loadError}</div>}
    </div>
  );
}
