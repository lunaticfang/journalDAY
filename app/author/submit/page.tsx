/*
"use client";


import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";

export default function AuthorSubmitPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [abstract, setAbstract] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState("");

  // get authenticated user id (if signed in)
  const [profileId, setProfileId] = useState<string | null>(null);
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (data?.user?.id) setProfileId(data.user.id);
    })();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !title) {
      setStatus("Please provide a title and a PDF file.");
      return;
    }
    setStatus("Uploading file to storage...");

    try {
      const cleanName = file.name.replace(/[^\w.\-]/g, "_");
      const path = `manuscripts/${Date.now()}-${cleanName}`;

      // Upload directly to Supabase storage
      const { data: uploadData, error: uploadErr } = await supabase.storage
        .from(process.env.NEXT_PUBLIC_SUPABASE_BUCKET_MANUSCRIPTS || "manuscripts")
        .upload(path, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type || "application/pdf",
        });

      if (uploadErr) throw uploadErr;
      if (!uploadData?.path) throw new Error("Upload succeeded but no path returned");

      setStatus("Notifying server to create manuscript record...");

      // Tell server to create manuscript + version using storage path
      const resp = await fetch("/api/submissions/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          abstract,
          authors: [], // extend as you need
          file_storage_path: uploadData.path, // pass storage path, not base64
          contentType: file.type || "application/pdf",
          uploader_id: profileId, // can be null if not signed in
        }),
      });

      const json = await resp.json();
      if (!resp.ok) throw new Error(json?.error || JSON.stringify(json));
      setStatus("Submission created. Redirecting...");
      setTimeout(() => router.push("/author/dashboard"), 800);
    } catch (err: any) {
      console.error(err);
      setStatus("Error: " + (err.message || String(err)));
    }
  }

  return (
    <main className="p-6 max-w-2xl mx-auto">
      <h1 className="text-xl font-semibold">Submit Manuscript</h1>
      <form onSubmit={handleSubmit} className="mt-4 space-y-3">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className="w-full border p-2 rounded" />
        <textarea value={abstract} onChange={(e) => setAbstract(e.target.value)} placeholder="Abstract" className="w-full border p-2 rounded h-32" />
        <input type="file" accept="application/pdf" onChange={(e) => setFile((e.target as HTMLInputElement).files?.[0] ?? null)} className="w-full" />
        <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded">Submit</button>
      </form>
      <p className="mt-3 text-sm text-gray-600">{status}</p>
    </main>
  );
}
*/

"use client";

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

  /* -------------------------------------------------- */
  /* Ensure user is logged in                            */
  /* -------------------------------------------------- */
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

  /* -------------------------------------------------- */
  /* Submit                                             */
  /* -------------------------------------------------- */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!title || !file) {
      setStatus("Title and PDF file are required.");
      return;
    }

    if (!userId) {
      setStatus("You must be logged in to submit.");
      return;
    }

    setLoading(true);
    setStatus("Uploading manuscript…");

    try {
      const formData = new FormData();
      formData.append("title", title);
      formData.append("abstract", abstract);
      formData.append("file", file);

      const resp = await fetch("/api/submissions/create", {
        method: "POST",
        body: formData,
      });

      const json = await resp.json();

      if (!resp.ok) {
        throw new Error(json?.error || "Submission failed");
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

        <input
          type="file"
          accept="application/pdf"
          onChange={(e) =>
            setFile((e.target as HTMLInputElement).files?.[0] ?? null)
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
