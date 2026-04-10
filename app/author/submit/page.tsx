"use client";

import Link from "next/link";
import { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";

export default function AuthorSubmitPage() {
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [abstract, setAbstract] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [wordFile, setWordFile] = useState<File | null>(null);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [authorName, setAuthorName] = useState("");
  const [coAuthors, setCoAuthors] = useState<{ name: string; email: string }[]>(
    []
  );

  const maxFileSizeMb = 25;
  const maxFileSizeBytes = useMemo(
    () => maxFileSizeMb * 1024 * 1024,
    [maxFileSizeMb]
  );

  function getFriendlyEmailFailureMessage(rawError: string | null | undefined) {
    const text = String(rawError || "").toLowerCase();

    if (!text) {
      return "Submission saved, but we could not send the confirmation email right now.";
    }

    if (text.includes("missing email provider configuration")) {
      return "Submission saved, but confirmation email is not set up yet.";
    }

    if (text.includes("missing sender email configuration")) {
      return "Submission saved, but the journal sender email is not configured yet.";
    }

    if (text.includes("no recipient emails found")) {
      return "Submission saved, but no recipient email address was available for the receipt.";
    }

    if (
      text.includes("brevo") ||
      text.includes("resend") ||
      text.includes("smtp") ||
      text.includes("mail")
    ) {
      return "Submission saved, but the confirmation email service is unavailable right now.";
    }

    return "Submission saved, but we could not send the confirmation email right now.";
  }

  function appendErrorReference(message: string, errorId: string | null | undefined) {
    const normalizedMessage = String(message || "").trim();
    const normalizedErrorId = String(errorId || "").trim();
    if (!normalizedErrorId) {
      return normalizedMessage;
    }
    return `${normalizedMessage} Reference: ${normalizedErrorId}.`;
  }

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.auth.getUser();

      if (error || !data?.user) {
        router.replace("/login");
        return;
      }

      setUserId(data.user.id);
      setUserEmail(data.user.email ?? null);
    })();
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!title || !file || !wordFile) {
      setStatus("Title, PDF, and Word file are required.");
      return;
    }

    if (!userId) {
      setStatus("You must be logged in to submit.");
      return;
    }

    if (!authorName.trim()) {
      setStatus("Lead author name is required.");
      return;
    }

    if (file.size > maxFileSizeBytes || wordFile.size > maxFileSizeBytes) {
      setStatus(`Files must be under ${maxFileSizeMb} MB.`);
      return;
    }

    const invalidCoAuthor = coAuthors.find(
      (a) =>
        (a.name.trim() && !a.email.trim()) ||
        (!a.name.trim() && a.email.trim())
    );
    if (invalidCoAuthor) {
      setStatus("Co-author entries require both name and email.");
      return;
    }

    setLoading(true);
    setStatus("Preparing upload…");

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) {
        throw new Error("Missing session token");
      }

      async function createSignedUpload(
        fileToUpload: File,
        kind: "pdf" | "word"
      ) {
        const resp = await fetch("/api/submissions/create-upload", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            filename: fileToUpload.name,
            contentType: fileToUpload.type,
            size: fileToUpload.size,
            kind,
          }),
        });

        const json = await resp.json();
        if (!resp.ok) {
          throw new Error(
            appendErrorReference(
              json?.error || "Failed to prepare upload",
              json?.errorId
            )
          );
        }

        return json as { bucket: string; path: string; token: string };
      }

      setStatus("Uploading PDF…");
      const pdfUpload = await createSignedUpload(file, "pdf");
      const { error: pdfErr } = await supabase.storage
        .from(pdfUpload.bucket)
        .uploadToSignedUrl(pdfUpload.path, pdfUpload.token, file, {
          contentType: "application/pdf",
        });
      if (pdfErr) throw pdfErr;

      setStatus("Uploading Word file…");
      const wordUpload = await createSignedUpload(wordFile, "word");
      const { error: wordErr } = await supabase.storage
        .from(wordUpload.bucket)
        .uploadToSignedUrl(wordUpload.path, wordUpload.token, wordFile, {
          contentType: wordFile.type || "application/msword",
        });
      if (wordErr) throw wordErr;

      const authors = [
        {
          name: authorName.trim(),
          email: userEmail ?? "",
          role: "corresponding",
        },
        ...coAuthors
          .filter((a) => a.name.trim() && a.email.trim())
          .map((a) => ({
            name: a.name.trim(),
            email: a.email.trim(),
            role: "coauthor",
          })),
      ];

      const resp = await fetch("/api/submissions/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          title,
          abstract,
          file_storage_path: pdfUpload.path,
          word_storage_path: wordUpload.path,
          authors_json: JSON.stringify(authors),
        }),
      });

      const json = await resp.json();

      if (!resp.ok) {
        throw new Error(
          appendErrorReference(json?.error || "Submission failed", json?.errorId)
        );
      }

      const manuscriptId = String(json?.manuscript?.id || "").trim();
      const receiptCode = String(json?.notification?.receiptCode || "").trim();
      const emailStatusSuffix = json?.notification?.sent
        ? receiptCode
          ? ` Confirmation email sent. Receipt code: ${receiptCode}.`
          : " Confirmation email sent."
        : ` ${getFriendlyEmailFailureMessage(json?.notification?.error)}`;

      setStatus(
        [
          "Submission successful.",
          manuscriptId ? ` Submission ID: ${manuscriptId}.` : "",
          emailStatusSuffix,
          " Redirecting…",
        ].join("")
      );
      setTimeout(() => router.push("/author/dashboard"), 1200);
    } catch (err: any) {
      console.error(err);
      setStatus("Error: " + (err.message || String(err)));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="portal-page portal-page--author">
      <div className="portal-shell">
        <header className="portal-header">
          <div>
            <h1 className="portal-title">Submit Manuscript</h1>
            <p className="portal-subtitle">
              Upload one review-ready PDF and one editable Word version of the
              same manuscript.
            </p>
          </div>
        </header>

        <section className="portal-submit-guide">
          <div className="portal-submit-guide__copy">
            <p className="portal-submit-guide__eyebrow">Before You Submit</p>
            <h2>Keep the submission clear, complete, and easy to process</h2>
            <p>
              Add the manuscript title, abstract, lead author, and any co-authors,
              then upload both the PDF and Word versions in the correct place.
            </p>
          </div>

          <Link
            href="/instructions/how-to-submit"
            className="portal-btn portal-btn--ghost"
          >
            Read How To Submit
          </Link>
        </section>

        <form onSubmit={handleSubmit} className="portal-card portal-form">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Manuscript Title"
            className="portal-input"
          />

          <textarea
            value={abstract}
            onChange={(e) => setAbstract(e.target.value)}
            placeholder="Abstract"
            className="portal-textarea"
          />

          <div className="portal-section">
            <div className="portal-section__title">Lead Author</div>
            <input
              value={authorName}
              onChange={(e) => setAuthorName(e.target.value)}
              placeholder="Lead author full name"
              className="portal-input"
            />
            <div className="portal-meta">Email: {userEmail || "Loading…"}</div>
          </div>

          <div className="portal-section">
            <div className="portal-row">
              <div className="portal-section__title">Co-authors (optional)</div>
              <span />
              <button
                type="button"
                onClick={() =>
                  setCoAuthors((prev) => [...prev, { name: "", email: "" }])
                }
                className="portal-link"
              >
                + Add co-author
              </button>
            </div>

            {coAuthors.length === 0 && (
              <div className="portal-empty">No co-authors added.</div>
            )}

            {coAuthors.map((author, index) => (
              <div key={index} className="portal-row">
                <input
                  value={author.name}
                  onChange={(e) => {
                    const value = e.target.value;
                    setCoAuthors((prev) =>
                      prev.map((a, i) =>
                        i === index ? { ...a, name: value } : a
                      )
                    );
                  }}
                  placeholder="Co-author name"
                  className="portal-input"
                />
                <input
                  value={author.email}
                  onChange={(e) => {
                    const value = e.target.value;
                    setCoAuthors((prev) =>
                      prev.map((a, i) =>
                        i === index ? { ...a, email: value } : a
                      )
                    );
                  }}
                  placeholder="Co-author email"
                  className="portal-input"
                />
                <button
                  type="button"
                  onClick={() =>
                    setCoAuthors((prev) => prev.filter((_, i) => i !== index))
                  }
                  className="portal-link"
                  style={{ color: "#b91c1c" }}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>

          <div className="portal-upload-grid">
            <label className="portal-file portal-file--highlight">
              <span className="portal-file__eyebrow">Required file 1</span>
              <strong>Upload the review-ready PDF</strong>
              <p>
                Attach the final PDF snapshot of the manuscript exactly as you
                want reviewers and editors to read it.
              </p>
              <span className="portal-file__meta">Accepted format: PDF</span>
              <input
                type="file"
                accept="application/pdf"
                onChange={(e) =>
                  setFile((e.target as HTMLInputElement).files?.[0] ?? null)
                }
              />
              <span className="portal-file__selected">
                {file ? `Selected: ${file.name}` : "No PDF selected yet"}
              </span>
            </label>

            <label className="portal-file portal-file--highlight">
              <span className="portal-file__eyebrow">Required file 2</span>
              <strong>Upload the editable Word manuscript</strong>
              <p>
                Attach the editable .doc or .docx file here. This should match
                the PDF version above.
              </p>
              <span className="portal-file__meta">
                Accepted formats: DOC, DOCX
              </span>
              <input
                type="file"
                accept=".doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={(e) =>
                  setWordFile((e.target as HTMLInputElement).files?.[0] ?? null)
                }
              />
              <span className="portal-file__selected">
                {wordFile
                  ? `Selected: ${wordFile.name}`
                  : "No Word file selected yet"}
              </span>
            </label>
          </div>

          <div className="portal-actions">
            <button
              type="submit"
              disabled={loading}
              className="portal-btn portal-btn--primary"
            >
              {loading ? "Submitting…" : "Submit"}
            </button>
          </div>
        </form>

        {status && (
          <p
            className={
              status.startsWith("Error")
                ? "portal-status portal-status--error"
                : "portal-status"
            }
          >
            {status}
          </p>
        )}
      </div>
    </main>
  );
}
