import type { Metadata } from "next";
import IssuePageClient from "./IssuePageClient";
import { getIssueWithArticles } from "../../../lib/publicContent";
import {
  SITE_NAME,
  buildPageMetadata,
  sanitizeSeoText,
  toAbsoluteUrl,
} from "../../../lib/seo";

export const revalidate = 300;

type PageProps = {
  params: Promise<{ id: string }>;
};

type IssueRecord = {
  id: string;
  title: string | null;
  volume: string | null;
  issue_number: number | null;
  published_at: string | null;
  cover_url: string | null;
  pdf_path: string | null;
};

type ArticleRecord = {
  id: string;
  issue_id: string | null;
  title: string | null;
  abstract: string | null;
  authors: string | null;
  pdf_path: string | null;
  manuscript_id?: string | null;
  created_at?: string | null;
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { id } = await params;

  try {
    const { issue, articles } = await getIssueWithArticles(id);
    if (!issue) {
      return buildPageMetadata({
        title: "Issue Not Found",
        description: "The requested publication issue could not be found.",
        path: `/issues/${id}`,
        noIndex: true,
      });
    }

    const description = [
      issue.title,
      issue.volume ? `Volume ${issue.volume}` : null,
      issue.issue_number != null ? `Issue ${issue.issue_number}` : null,
      `${articles.length} article${articles.length === 1 ? "" : "s"}`,
    ]
      .filter(Boolean)
      .join(" · ");

    return buildPageMetadata({
      title: issue.title || "Publication Issue",
      description:
        sanitizeSeoText(description, 155) ||
        "Browse the articles included in this UpDAYtes publication issue.",
      path: `/issues/${id}`,
      imagePath: issue.cover_url || "/journal cover.jpg",
      keywords: [
        "journal issue",
        "publication archive",
        "research issue",
        "academic journal issue",
      ],
    });
  } catch (err) {
    console.error("Issue metadata error:", err);
    return buildPageMetadata({
      title: "Publication Issue",
      description: "Browse journal issues published by UpDAYtes.",
      path: `/issues/${id}`,
    });
  }
}

export default async function IssuePage({ params }: PageProps) {
  const { id } = await params;

  let structuredData = null;
  let initialIssue: IssueRecord | null = null;
  let initialArticles: ArticleRecord[] = [];

  try {
    const { issue, articles } = await getIssueWithArticles(id);
    initialIssue = issue || null;
    initialArticles = articles || [];

    if (issue) {
      structuredData = {
        "@context": "https://schema.org",
        "@type": "PublicationIssue",
        name: issue.title || "Publication Issue",
        issueNumber:
          issue.issue_number != null ? String(issue.issue_number) : undefined,
        datePublished: issue.published_at || undefined,
        url: toAbsoluteUrl(`/issues/${id}`),
        image: issue.cover_url || undefined,
        isPartOf: {
          "@type": "Periodical",
          name: SITE_NAME,
          url: toAbsoluteUrl("/"),
        },
        hasPart: articles.map((article) => ({
          "@type": "ScholarlyArticle",
          headline: article.title || "Untitled article",
          url: toAbsoluteUrl(`/article/${article.id}`),
        })),
      };
    }
  } catch (err) {
    console.error("Issue structured data error:", err);
  }

  return (
    <>
      {structuredData && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
      )}
      <IssuePageClient initialIssue={initialIssue} initialArticles={initialArticles} />
    </>
  );
}
