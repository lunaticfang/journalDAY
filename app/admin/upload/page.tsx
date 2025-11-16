"use client";

import { useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function UploadPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState("");

  // helper: convert File -> base64 string (no external libs)
  const fileToBase64 = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(",")[1] ?? "";
        resolve(base64);
      };
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });

  async function handleUpload(e: React.FormEvent) {
  e.preventDefault();
  if (!file || !title) {
    setStatus("Provide a title and select a PDF file.");
    return;
  }

  setStatus("Checking authentication...");

  // get authenticated user
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData?.user?.id ?? null;

  if (!userId) {
    setStatus("You must be logged in to upload.");
    return;
  }

  setStatus("Uploading file to Supabase...");

  const cleanName = file.name.replace(/[^\w.\-]/g, "_");
  const storagePath = `manuscripts/${Date.now()}-${cleanName}`;

  // upload directly to Supabase Storage
  const { data: uploadData, error: uploadErr } = await supabase.storage
    .from(process.env.NEXT_PUBLIC_SUPABASE_BUCKET_MANUSCRIPTS || "manuscripts")
    .upload(storagePath, file, {
      cacheControl: "3600",
      upsert: false,
      metadata: { uploader_id: userId },
      contentType: file.type || "application/pdf",
    });

  if (uploadErr) {
    console.error(uploadErr);
    setStatus("Upload failed: " + uploadErr.message);
    return;
  }

  setStatus("Telling server to record manuscript...");

  // notify server to create manuscript + version
  const resp = await fetch("/api/submissions/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title,
      abstract: "",
      authors: [],
      file_storage_path: uploadData.path,
      contentType: file.type,
      uploader_id: userId,
    }),
  });

  const json = await resp.json();
  if (!resp.ok) {
    setStatus("Server error: " + json.error);
    return;
  }

  setStatus("Uploaded successfully!");
  setTimeout(() => router.push("/admin"), 800);
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
