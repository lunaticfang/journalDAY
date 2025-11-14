"use client";

import { useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function UploadPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState("");

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setStatus("Select a PDF first");
      return;
    }
    setStatus("Uploading...");

    try {
      // sanitize filename to avoid spaces/parentheses/unexpected characters
      const cleanName = (file.name || "file.pdf").replace(/[^\w.\-]/g, "_");
      const filePath = `issues/${Date.now()}-${cleanName}`;

      // log for debugging
      console.log("Uploading file:", { name: file.name, cleanName, size: file.size, type: file.type, filePath });

      // Upload to storage with safer options (upsert to avoid conflicts while debugging,
      // set contentType explicitly)
      const { data: uploadData, error: uploadErr } = await supabase.storage
        .from("issues-pdfs")
        .upload(filePath, file, { cacheControl: "3600", upsert: true, contentType: file.type || "application/pdf" });

      console.log("UPLOAD RESULT =>", { uploadData, uploadErr });
      if (uploadErr) throw uploadErr;

      // get public URL
      const { data: publicData } = supabase.storage.from("issues-pdfs").getPublicUrl(filePath);
      const publicUrl = publicData.publicUrl;

      // forward to server API to insert (server uses service_role)
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token ?? null;

      const res = await fetch("/api/admin/insert-issue", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ title, pdf_path: publicUrl, published_at: new Date().toISOString() }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Insert failed");

      setStatus("Uploaded ✔ — redirecting...");
      setTimeout(() => router.push("/admin"), 900);
    } catch (err: any) {
      console.error(err);
      // If uploadErr from supabase contains message details, prefer that
      const msg =
        err?.message ||
        (err?.error && (err.error.message || JSON.stringify(err.error))) ||
        String(err);
      setStatus("Error: " + msg);
    }
  }

  return (
    <main className="p-6 max-w-2xl mx-auto">
      <h1 className="text-xl font-semibold">Upload Issue</h1>
      <form onSubmit={handleUpload} className="mt-4 space-y-3">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Issue title"
          className="w-full border p-2 rounded"
        />
        <input
          type="file"
          accept="application/pdf"
          onChange={(e) => setFile((e.target as HTMLInputElement).files?.[0] ?? null)}
          className="w-full"
        />
        <button className="px-4 py-2 bg-green-600 text-white rounded">Upload</button>
      </form>
      <p className="mt-3 text-sm text-gray-600">{status}</p>
    </main>
  );
}
