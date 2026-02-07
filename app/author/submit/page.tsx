"use client";

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

  /* -------------------------------------------------- */
  /* Ensure user is logged in                            */
  /* -------------------------------------------------- */
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

  /* -------------------------------------------------- */
  /* Submit manuscript                                   */
  /* -------------------------------------------------- */
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

      async function createSignedUpload(fileToUpload: File, kind: "pdf" | "word") {
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
          throw new Error(json?.error || "Failed to prepare upload");
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

      /* ---------------------------------------------- */
      /* 2. Create manuscript record via API             */
      /* ---------------------------------------------- */
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
        throw new Error(json?.error || "Submission failed");
      }

      try {
        await fetch("/api/submissions/notify", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ manuscript_id: json?.manuscript?.id }),
        });
      } catch (err) {
        console.warn("Confirmation email failed:", err);
      }

      setStatus("Submission successful. Redirecting…");
      setTimeout(() => router.push("/author/dashboard"), 800);
    } catch (err: any) {
      console.error(err);
      setStatus("Error: " + (err.message || String(err)));
    } finally {
      setLoading(false);
    }
  }

  /* -------------------------------------------------- */
  /* Render                                             */
  /* -------------------------------------------------- */
  return (
    <main className="p-6 max-w-2xl mx-auto">
      <h1 className="text-xl font-semibold mb-4">Submit Manuscript</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Manuscript Title"
          className="w-full border p-2 rounded"
        />

        <textarea
          value={abstract}
          onChange={(e) => setAbstract(e.target.value)}
          placeholder="Abstract"
          className="w-full border p-2 rounded h-32"
        />

        <div className="space-y-2 rounded border border-gray-200 p-3">
          <div className="text-sm font-semibold">Lead Author</div>
          <input
            value={authorName}
            onChange={(e) => setAuthorName(e.target.value)}
            placeholder="Lead author full name"
            className="w-full border p-2 rounded"
          />
          <div className="text-sm text-gray-600">
            Email: {userEmail || "Loading…"}
          </div>
        </div>

        <div className="space-y-2 rounded border border-gray-200 p-3">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">Co-authors (optional)</div>
            <button
              type="button"
              onClick={() =>
                setCoAuthors((prev) => [...prev, { name: "", email: "" }])
              }
              className="text-xs font-semibold text-[#6A3291]"
            >
              + Add co-author
            </button>
          </div>

          {coAuthors.length === 0 && (
            <div className="text-xs text-gray-500">No co-authors added.</div>
          )}

          {coAuthors.map((author, index) => (
            <div key={index} className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
              <input
                value={author.name}
                onChange={(e) => {
                  const value = e.target.value;
                  setCoAuthors((prev) =>
                    prev.map((a, i) => (i === index ? { ...a, name: value } : a))
                  );
                }}
                placeholder="Co-author name"
                className="w-full border p-2 rounded"
              />
              <input
                value={author.email}
                onChange={(e) => {
                  const value = e.target.value;
                  setCoAuthors((prev) =>
                    prev.map((a, i) => (i === index ? { ...a, email: value } : a))
                  );
                }}
                placeholder="Co-author email"
                className="w-full border p-2 rounded"
              />
              <button
                type="button"
                onClick={() =>
                  setCoAuthors((prev) => prev.filter((_, i) => i !== index))
                }
                className="text-xs text-red-600"
              >
                Remove
              </button>
            </div>
          ))}
        </div>

        <input
          type="file"
          accept="application/pdf"
          onChange={(e) =>
            setFile((e.target as HTMLInputElement).files?.[0] ?? null)
          }
          className="w-full"
        />

        <input
          type="file"
          accept=".doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          onChange={(e) =>
            setWordFile((e.target as HTMLInputElement).files?.[0] ?? null)
          }
          className="w-full"
        />

        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 rounded bg-[#6A3291] text-white font-medium disabled:opacity-60"
        >
          {loading ? "Submitting…" : "Submit"}
        </button>
      </form>

      {status && (
        <p className="mt-4 text-sm text-gray-700">{status}</p>
      )}
    </main>
  );
}




/*"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";

export default function AuthorSubmitPage() {
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [abstract, setAbstract] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  // Ensure login 
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data?.user) {
        router.replace("/login");
        return;
      }
      setUserId(data.user.id);
    })();
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!title || !file) {
      setStatus("Title and PDF file are required.");
      return;
    }

    if (!userId) {
      setStatus("You must be logged in.");
      return;
    }

    setLoading(true);
    setStatus("Uploading PDF…");

    try {
      const cleanName = file.name.replace(/[^\w.\-]/g, "_");
      const storagePath = `manuscripts/${userId}/${Date.now()}-${cleanName}`;

      // 1️⃣ Upload to Supabase Storage 
      const { data: uploadData, error: uploadErr } = await supabase.storage
        .from("manuscripts")
        .upload(storagePath, file, {
          contentType: "application/pdf",
          upsert: false,
        });

      if (uploadErr) throw uploadErr;

      // 2️⃣ Create manuscript record 
      const resp = await fetch("/api/submissions/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          abstract,
          file_storage_path: uploadData.path,
          uploader_id: userId,
        }),
      });

      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error);

      setStatus("Submission successful. Redirecting…");
      setTimeout(() => router.push("/author/dashboard"), 800);
    } catch (err: any) {
      console.error(err);
      setStatus("Error: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="p-6 max-w-2xl mx-auto">
      <h1 className="text-xl font-semibold mb-4">Submit Manuscript</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Manuscript Title"
          className="w-full border p-2 rounded"
        />

        <textarea
          value={abstract}
          onChange={(e) => setAbstract(e.target.value)}
          placeholder="Abstract"
          className="w-full border p-2 rounded h-32"
        />

        <input
          type="file"
          accept="application/pdf"
          onChange={(e) =>
            setFile((e.target as HTMLInputElement).files?.[0] ?? null)
          }
        />

        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 rounded bg-[#6A3291] text-white"
        >
          {loading ? "Submitting…" : "Submit"}
        </button>
      </form>

      {status && <p className="mt-4 text-sm">{status}</p>}
    </main>
  );
}
*/
