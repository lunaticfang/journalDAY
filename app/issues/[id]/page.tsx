
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";

type Issue = {
  id: string;
  title: string;
  volume: string | null;
  issue_number: number | null;
  published_at: string | null;
  cover_url: string | null;
  pdf_path: string | null;
};

type Article = {
  id: string;               // now equals manuscript id for newly published issues
  issue_id: string | null;
  title: string;
  abstract: string | null;
  authors: string | null;
  pdf_path: string | null;  // unused for PDF, but fine to keep
};

export default function IssuePage() {
  const params = useParams<{ id: string }>();

  const rawId = params?.id;
  const id =
    typeof rawId === "string"
      ? rawId
      : Array.isArray(rawId)
      ? rawId[0]
      : undefined;

  const [issue, setIssue] = useState<Issue | null>(null);
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 🔹 same logic as admin's View PDF, but for articles
  async function handleViewPdf(articleId: string) {
    try {
      setErrorMsg("");
      const resp = await fetch(`/api/submissions/${articleId}/signed-url`);
      const json = await resp.json();

      if (!resp.ok) {
        throw new Error(json?.error || "Could not get signed URL");
      }
      const url = json?.signedUrl || json?.publicUrl;
      if (!url) {
        throw new Error("No signed URL returned for this article");
      }
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err: any) {
      console.error("IssuePage handleViewPdf error:", err);
      setErrorMsg(err.message || String(err));
    }
  }

  useEffect(() => {
    async function load() {
      setLoading(true);
      setErrorMsg(null);

      if (!id) {
        setErrorMsg("Invalid issue id in URL.");
        setLoading(false);
        return;
      }

      // 1) load issue
      const { data: issueData, error: issueError } = await supabase
        .from("issues")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (issueError) {
        setErrorMsg("Issue load error: " + issueError.message);
        setIssue(null);
        setArticles([]);
        setLoading(false);
        return;
      }

      if (!issueData) {
        setErrorMsg("Issue not found in database for id: " + id);
        setIssue(null);
        setArticles([]);
        setLoading(false);
        return;
      }

      setIssue(issueData as Issue);

      // 2) load articles
      const { data: articleData, error: articleError } = await supabase
        .from("articles")
        .select("*")
        .eq("issue_id", id)
        .order("created_at", { ascending: true });

      if (articleError) {
        setErrorMsg("Articles load error: " + articleError.message);
        setArticles([]);
      } else {
        setArticles((articleData || []) as Article[]);
      }

      setLoading(false);
    }

    load();
  }, [id]);

  if (loading) {
    return (
      <main className="min-h-screen bg-[#050816] text-gray-100">
        <div className="mx-auto max-w-6xl px-4 py-8">Loading…</div>
      </main>
    );
  }

  if (errorMsg || !issue) {
    return (
      <main className="min-h-screen bg-[#050816] text-gray-100">
        <div className="mx-auto max-w-6xl px-4 py-8">
          <div className="mb-4 text-sm">
            <Link href="/archive" className="text-emerald-400 hover:underline">
              ← Back to Archive
            </Link>
          </div>
          <p className="text-sm text-red-400 whitespace-pre-wrap">
            DEBUG: {errorMsg || "Issue missing"}
          </p>
        </div>
      </main>
    );
  }

  const pubDate = issue.published_at ? new Date(issue.published_at) : null;
  const monthYear = pubDate
    ? pubDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })
    : "";
  const volumeIssueText = [
    issue.volume ? `Volume ${issue.volume}` : null,
    issue.issue_number != null ? `Issue ${issue.issue_number}` : null,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <main className="min-h-screen bg-[#050816] text-gray-100">
      <div className="mx-auto max-w-6xl px-4 py-8">
        {/* Back link */}
        <div className="mb-4 text-sm text-gray-300">
          <Link href="/archive" className="text-emerald-400 hover:underline">
            ← Back to Archive
          </Link>
        </div>

        {/* Header */}
        <div className="mb-8 flex flex-col gap-6 md:flex-row md:items-start">
          <div className="flex-shrink-0">
            <div className="flex h-48 w-36 items-center justify-center overflow-hidden rounded-md border border-gray-700 bg-gray-900">
              {issue.cover_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={issue.cover_url}
                  alt={issue.title}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="text-xs text-gray-400">No Cover</span>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-wide">
              {issue.title}
            </h1>
            {monthYear && (
              <p className="text-sm text-gray-300">{monthYear}</p>
            )}
            {volumeIssueText && (
              <p className="text-sm text-gray-300">{volumeIssueText}</p>
            )}
            {issue.pdf_path && (
              <p className="pt-2 text-sm">
                <Link
                  href={issue.pdf_path}
                  className="text-emerald-400 hover:text-emerald-300"
                >
                  Download full issue PDF
                </Link>
              </p>
            )}
          </div>
        </div>

        {/* Section header */}
        <div className="mb-4 border-b border-gray-700">
          <button className="border-b-2 border-emerald-400 px-4 pb-2 text-sm font-semibold uppercase tracking-wide">
            Articles
          </button>
        </div>

        {/* Article list */}
        <div className="space-y-4">
          {articles.map((article, index) => (
            <div
              key={article.id}
              className="flex gap-4 border-b border-gray-800 pb-4 text-sm last:border-none"
            >
              <div className="w-10 pt-1 text-xs font-semibold text-gray-300">
                p{index + 1}
              </div>
              <div className="flex-1 space-y-1">
                <h2 className="text-sm font-semibold leading-snug text-gray-100">
                  {article.title}
                </h2>
                {article.authors && (
                  <p className="text-xs text-gray-300">{article.authors}</p>
                )}
                <div className="mt-1 flex gap-3">
                  {/* View article detail page */}
                  <Link
                    href={`/article/${article.id}`}
                    className="text-xs text-blue-300 hover:text-blue-200 underline"
                  >
                    View article
                  </Link>

                  {/* View PDF using same signed-url logic as admin */}
                  <button
                    onClick={() => handleViewPdf(article.id)}
                    className="text-xs font-semibold text-emerald-400 hover:text-emerald-300"
                    type="button"
                  >
                    View PDF
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {articles.length === 0 && (
          <p className="mt-6 text-sm text-gray-400">
            No articles found for this issue.
          </p>
        )}

        {errorMsg && (
          <p className="mt-4 text-xs text-red-400">PDF error: {errorMsg}</p>
        )}
      </div>
    </main>
  );
}
