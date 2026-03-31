"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export type ArchiveIssue = {
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

type ArchivePageClientProps = {
  initialIssues?: ArchiveIssue[];
};

const FILTER_TABS = ["Main Issue", "Supplement Issue", "Case Reports"] as const;

function mapIssueRows(data: any[]): ArchiveIssue[] {
  return (data || []).map((row: any): ArchiveIssue => {
    const published = row.published_at ? new Date(row.published_at) : null;

    return {
      id: row.id,
      year: published ? published.getFullYear() : null,
      volume: row.volume ?? null,
      issue_number: row.issue_number ?? null,
      month: published
        ? published.toLocaleDateString("en-US", { month: "long" })
        : null,
      supplement: null,
      type: "-",
      title: row.title ?? null,
      category: "Main Issue",
    };
  });
}

export default function ArchivePageClient({
  initialIssues = [],
}: ArchivePageClientProps) {
  const [issues, setIssues] = useState<ArchiveIssue[]>(initialIssues);
  const [activeFilter, setActiveFilter] =
    useState<(typeof FILTER_TABS)[number] | "All">("All");
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(initialIssues.length === 0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (initialIssues.length > 0) {
      return;
    }

    let cancelled = false;

    (async () => {
      setLoading(true);
      setErrorMsg(null);

      const resp = await fetch("/api/issues/list");
      const json = await resp.json().catch(() => ({}));

      if (!resp.ok) {
        console.error("ARCHIVE LOAD ERROR:", json?.error || resp.statusText);
        if (!cancelled) {
          setErrorMsg(json?.error || "Failed to load issues.");
          setIssues([]);
          setLoading(false);
        }
        return;
      }

      if (!cancelled) {
        setIssues(mapIssueRows(json?.issues || []));
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [initialIssues]);

  const filteredIssues =
    activeFilter === "All"
      ? issues
      : issues.filter((i) => i.category === activeFilter);

  const visibleIssues = filteredIssues.slice(0, pageSize);

  return (
    <main className="archive-page">
      <div className="archive-shell">
        <header className="archive-header">
          <h1>Archive</h1>
        </header>

        <div className="archive-filters">
          <button className="archive-filter archive-filter--ghost">
            <span className="archive-filter__icon" />
            Filters
          </button>

          {FILTER_TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveFilter(tab)}
              className={`archive-filter ${
                activeFilter === tab ? "is-active" : ""
              }`}
            >
              {tab}
            </button>
          ))}

          <button
            onClick={() => setActiveFilter("All")}
            className={`archive-filter ${
              activeFilter === "All" ? "is-active" : ""
            }`}
          >
            All
          </button>
        </div>

        <div className="archive-toolbar">
          <div />
          <div className="archive-toolbar__right">
            <div className="archive-page-size">
              <span>Show</span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
            </div>
            <span>
              {issues.length === 0
                ? "0 of 0"
                : `1 - ${Math.min(pageSize, filteredIssues.length)} of ${
                    filteredIssues.length
                  }`}
            </span>
          </div>
        </div>

        <div className="archive-table">
          <div className="archive-row archive-row--head">
            <div>Year</div>
            <div>Volume</div>
            <div>Issue</div>
            <div>Month</div>
            <div>Supplement</div>
            <div>Type</div>
            <div>Title</div>
            <div className="archive-row__right">View</div>
          </div>

          {loading && <div className="archive-state">Loading issues...</div>}

          {!loading && errorMsg && (
            <div className="archive-state archive-state--error">
              Failed to load issues: {errorMsg}
            </div>
          )}

          {!loading &&
            !errorMsg &&
            visibleIssues.map((issue) => (
              <div key={issue.id} className="archive-row">
                <div>{issue.year ?? "-"}</div>
                <div>{issue.volume ?? "-"}</div>
                <div>{issue.issue_number ?? "-"}</div>
                <div className="archive-row__month">{issue.month ?? "-"}</div>
                <div>{issue.supplement ?? "-"}</div>
                <div>{issue.type}</div>
                <div className="archive-row__title">{issue.title ?? "-"}</div>
                <div className="archive-row__right">
                  <Link href={`/issues/${issue.id}`} className="archive-link">
                    View {"->"}
                  </Link>
                </div>
              </div>
            ))}

          {!loading && !errorMsg && visibleIssues.length === 0 && (
            <div className="archive-state">No issues found.</div>
          )}
        </div>
      </div>
    </main>
  );
}
