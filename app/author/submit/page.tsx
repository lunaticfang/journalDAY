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
      const { data, error } = await supabase.auth.getUser();

      if (error || !data?.user) {
        router.replace("/login");
        return;
      }

      setUserId(data.user.id);
    })();
  }, [router]);

  /* -------------------------------------------------- */
  /* Submit manuscript                                   */
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
      /* ---------------------------------------------- */
      /* 1. Upload PDF to Supabase Storage               */
      /* ---------------------------------------------- */
      const cleanName = file.name.replace(/[^\w.\-]/g, "_");
      const storagePath = `manuscripts/${userId}/${Date.now()}-${cleanName}`;

      const { data: uploadData, error: uploadErr } =
        await supabase.storage
          .from(
            process.env.NEXT_PUBLIC_SUPABASE_BUCKET_MANUSCRIPTS ||
              "manuscripts"
          )
          .upload(storagePath, file, {
            contentType: "application/pdf",
            upsert: false,
          });

      if (uploadErr) throw uploadErr;

      /* ---------------------------------------------- */
      /* 2. Create manuscript record via API             */
      /* ---------------------------------------------- */
      const resp = await fetch("/api/submissions/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          abstract,
          file_storage_path: uploadData.path,
          user_id: userId, // ✅ MUST MATCH RLS (auth.uid())
        }),
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