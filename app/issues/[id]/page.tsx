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

  try {
    const { issue, articles } = await getIssueWithArticles(id);

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
      <IssuePageClient />
    </>
  );
}
