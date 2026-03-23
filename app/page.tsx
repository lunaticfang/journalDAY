import HomePageClient from "./HomePageClient";
import { getLatestIssueWithArticles } from "../lib/publicContent";
import { SITE_NAME, buildPageMetadata, toAbsoluteUrl } from "../lib/seo";

export const revalidate = 300;

export const metadata = buildPageMetadata({
  title: "Peer-Reviewed Journal",
  description:
    "Explore the latest UpDAYtes issue, browse peer-reviewed articles, and submit your manuscript to the journal.",
  path: "/",
  keywords: [
    "peer-reviewed journal",
    "latest issue",
    "research articles",
    "journal archive",
    "manuscript submission",
  ],
});

export default async function HomePage() {
  let latestIssue = null;

  try {
    const { issue } = await getLatestIssueWithArticles();
    latestIssue = issue;
  } catch (err) {
    console.error("HomePage structured data load error:", err);
  }

  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        name: SITE_NAME,
        url: toAbsoluteUrl("/"),
        description:
          "UpDAYtes is an online academic journal platform for peer-reviewed publications and manuscript submissions.",
      },
      {
        "@type": "Periodical",
        name: SITE_NAME,
        url: toAbsoluteUrl("/"),
        publisher: {
          "@type": "Organization",
          name: SITE_NAME,
        },
      },
      latestIssue
        ? {
            "@type": "PublicationIssue",
            name: latestIssue.title || "Current Issue",
            issueNumber:
              latestIssue.issue_number != null
                ? String(latestIssue.issue_number)
                : undefined,
            datePublished: latestIssue.published_at || undefined,
            url: toAbsoluteUrl(`/issues/${latestIssue.id}`),
            isPartOf: {
              "@type": "Periodical",
              name: SITE_NAME,
              url: toAbsoluteUrl("/"),
            },
          }
        : null,
    ].filter(Boolean),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <HomePageClient />
    </>
  );
}
