import type { Metadata } from "next";
import ArticlePageClient from "./ArticlePageClient";
import { formatAuthors, getArticleWithIssue } from "../../../lib/publicContent";
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
    const { article, issue } = await getArticleWithIssue(id);
    if (!article) {
      return buildPageMetadata({
        title: "Article Not Found",
        description: "The requested article could not be found.",
        path: `/article/${id}`,
        noIndex: true,
      });
    }

    const issueLabel = [issue?.title, issue?.volume ? `Vol. ${issue.volume}` : null]
      .filter(Boolean)
      .join(" · ");

    return buildPageMetadata({
      title: article.title || "Article",
      description:
        sanitizeSeoText(article.abstract, 155) ||
        sanitizeSeoText(issueLabel, 155) ||
        "Read this peer-reviewed article on UpDAYtes.",
      path: `/article/${id}`,
      type: "article",
      imagePath: issue?.cover_url || "/Website Banner.jpg",
      keywords: [
        "journal article",
        "peer-reviewed article",
        "academic publication",
        "research paper",
      ],
    });
  } catch (err) {
    console.error("Article metadata error:", err);
    return buildPageMetadata({
      title: "Article",
      description: "Read peer-reviewed publications on UpDAYtes.",
      path: `/article/${id}`,
    });
  }
}

export default async function ArticlePage({ params }: PageProps) {
  const { id } = await params;

  let structuredData = null;

  try {
    const { article, issue } = await getArticleWithIssue(id);

    if (article) {
      const authors = formatAuthors(article.authors)
        .split(",")
        .map((author) => author.trim())
        .filter(Boolean)
        .map((name) => ({
          "@type": "Person",
          name,
        }));

      structuredData = {
        "@context": "https://schema.org",
        "@type": "ScholarlyArticle",
        headline: article.title || "Untitled article",
        description:
          sanitizeSeoText(article.abstract, 280) ||
          "Peer-reviewed scholarly article published on UpDAYtes.",
        author: authors.length ? authors : undefined,
        datePublished: issue?.published_at || article.created_at || undefined,
        dateCreated: article.created_at || undefined,
        isPartOf: issue
          ? {
              "@type": "PublicationIssue",
              name: issue.title || "Issue",
              issueNumber:
                issue.issue_number != null ? String(issue.issue_number) : undefined,
              datePublished: issue.published_at || undefined,
              isPartOf: {
                "@type": "Periodical",
                name: SITE_NAME,
                url: toAbsoluteUrl("/"),
              },
            }
          : undefined,
        mainEntityOfPage: toAbsoluteUrl(`/article/${id}`),
        url: toAbsoluteUrl(`/article/${id}`),
        publisher: {
          "@type": "Organization",
          name: SITE_NAME,
        },
      };
    }
  } catch (err) {
    console.error("Article structured data error:", err);
  }

  return (
    <>
      {structuredData && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
      )}
      <ArticlePageClient />
    </>
  );
}
