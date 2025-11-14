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
    if (!file) {
      setStatus("Select a PDF first");
      return;
    }
    setStatus("Uploading...");

    try {
      // --- SERVER-UPLOAD FLOW (use service-role on server) ---
      // Convert file to base64 and send to our server endpoint which uploads + inserts
      const base64 = await fileToBase64(file);
      setStatus("Uploading to server...");

      const resp = await fetch("/api/admin/upload-file", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          contentBase64: base64,
          contentType: file.type || "application/pdf",
          title,
          published_at: new Date().toISOString(),
        }),
      });

      const json = await resp.json();
      if (!resp.ok) {
        console.error("server upload error", json);
        throw new Error(json?.error || JSON.stringify(json));
      }

      // server returns publicUrl and DB row; use it (no client-side DB insert)
      const publicUrl = json.publicUrl;
      console.log("Server upload complete:", publicUrl);

      setStatus("Uploaded ✔ — redirecting...");
      setTimeout(() => router.push("/admin"), 900);
      return;
      // --- end SERVER-UPLOAD FLOW ---
    } catch (err: any) {
      console.error(err);
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
