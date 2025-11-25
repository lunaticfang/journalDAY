"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabaseClient";

// Shape of each issue row in the archive table
type ArchiveIssue = {
  id: string;
  year: number | null;
  volume: string | null;
  issue_number: number | null;
  month: string | null;
  supplement?: string | null;
  type: string;
  title: string | null;
  category: "Main Issue" | "Supplement Issue" | "Case Reports";
};

const FILTER_TABS = ["Main Issue", "Supplement Issue", "Case Reports"] as const;

export default function ArchivePage() {
  const [issues, setIssues] = useState<ArchiveIssue[]>([]);
  const [activeFilter, setActiveFilter] =
    useState<(typeof FILTER_TABS)[number] | "All">("All");
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Load issues from Supabase
  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setErrorMsg(null);

      const { data, error } = await supabase
        .from("issues")
        .select("*")
        .order("published_at", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) {
        console.error("ARCHIVE LOAD ERROR:", error);
        if (!cancelled) {
          setErrorMsg(error.message);
          setIssues([]);
          setLoading(false);
        }
        return;
      }

      const rows = (data || []).map((row: any): ArchiveIssue => {
        const published = row.published_at ? new Date(row.published_at) : null;

        return {
          id: row.id,
          year: published ? published.getFullYear() : null,
          volume: row.volume ?? null,
          issue_number: row.issue_number ?? null,
          month: published
            ? published.toLocaleDateString("en-US", { month: "long" })
            : null,
          supplement: null, // you can wire real supplement info later
          type: "-", // or "Issue" if you like
          title: row.title ?? null,
          category: "Main Issue",
        };
      });

      if (!cancelled) {
        setIssues(rows);
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const filteredIssues =
    activeFilter === "All"
      ? issues
      : issues.filter((i) => i.category === activeFilter);

  const visibleIssues = filteredIssues.slice(0, pageSize);

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900">
      <div className="mx-auto max-w-6xl px-4 py-8">
        {/* Page title */}
        <h1 className="mb-6 text-2xl font-semibold tracking-wide text-gray-900">
          Archive
        </h1>

        {/* Filter row */}
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <button
            className="flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-1 text-sm text-gray-700 shadow-sm hover:bg-gray-100"
          >
            <span className="inline-block h-4 w-4 rounded-sm border border-gray-400" />
            Filters
          </button>

          {FILTER_TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveFilter(tab)}
              className={`rounded-full px-4 py-1 text-sm transition ${
                activeFilter === tab
                  ? "bg-gray-900 text-white shadow-sm"
                  : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-100"
              }`}
            >
              {tab}
            </button>
          ))}

          <button
            onClick={() => setActiveFilter("All")}
            className={`rounded-full px-4 py-1 text-sm transition ${
              activeFilter === "All"
                ? "bg-gray-900 text-white shadow-sm"
                : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-100"
            }`}
          >
            All
          </button>
        </div>

        {/* Top right: page size + range text */}
        <div className="mb-3 flex items-center justify-between text-xs text-gray-600">
          <div />
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              <span>Show</span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 shadow-sm focus:outline-none"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
            </div>
            <span>
              {issues.length === 0
                ? "0 of 0"
                : `1 – ${Math.min(pageSize, filteredIssues.length)} of ${
                    filteredIssues.length
                  }`}
            </span>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          {/* Header */}
          <div className="grid grid-cols-8 border-b border-gray-200 bg-gray-100 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-600">
            <div>Year</div>
            <div>Volume</div>
            <div>Issue</div>
            <div>Month</div>
            <div>Supplement</div>
            <div>Type</div>
            <div>Title</div>
            <div className="text-right">View</div>
          </div>

          {loading && (
            <div className="px-4 py-4 text-sm text-gray-600">
              Loading issues…
            </div>
          )}

          {!loading && errorMsg && (
            <div className="px-4 py-4 text-sm text-red-600">
              Failed to load issues: {errorMsg}
            </div>
          )}

          {!loading &&
            !errorMsg &&
            visibleIssues.map((issue, idx) => (
              <div
                key={issue.id}
                className={`grid grid-cols-8 px-4 py-3 text-sm ${
                  idx % 2 === 0 ? "bg-white" : "bg-gray-50"
                }`}
              >
                <div className="text-gray-800">{issue.year ?? "-"}</div>
                <div className="text-gray-800">{issue.volume ?? "-"}</div>
                <div className="text-gray-800">
                  {issue.issue_number ?? "-"}
                </div>
                <div>
                  <span className="text-indigo-600 hover:underline">
                    {issue.month ?? "-"}
                  </span>
                </div>
                <div className="text-gray-700">
                  {issue.supplement ?? "-"}
                </div>
                <div className="text-gray-700">{issue.type}</div>
                <div className="text-gray-900">
                  {issue.title ?? "-"}
                </div>
                <div className="text-right">
                  <Link
                    href={`/issues/${issue.id}`}
                    className="text-sm font-semibold text-emerald-600 hover:text-emerald-500"
                  >
                    View →
                  </Link>
                </div>
              </div>
            ))}

          {!loading &&
            !errorMsg &&
            visibleIssues.length === 0 && (
              <div className="px-4 py-6 text-sm text-gray-500">
                No issues found.
              </div>
            )}
        </div>
      </div>
    </main>
  );
}
