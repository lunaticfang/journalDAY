import HomePageClient from "./HomePageClient";
import { getLatestIssueWithArticles, getSiteContentEntries } from "../lib/publicContent";
import { SITE_NAME, buildPageMetadata, toAbsoluteUrl } from "../lib/seo";

export const revalidate = 300;
const HOME_CONTENT_KEYS = [
  "home.editor_in_chief",
  "home.hero_title",
  "home.hero_subtitle",
];
const CURRENT_ISSUE_ARTICLES_KEY_PREFIX = "home.current_issue_articles";

type HomeIssue = {
  id: string;
  title: string | null;
  volume: string | null;
  issue_number: number | null;
  published_at: string | null;
  cover_url: string | null;
  pdf_path?: string | null;
};

type HomeArticle = {
  id: string;
  title: string | null;
  authors: string | null;
  manuscript_id?: string | null;
};

export const metadata = {
  ...buildPageMetadata({
    title: SITE_NAME,
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
  }),
  title: {
    absolute: SITE_NAME,
  },
};

export default async function HomePage() {
  let latestIssue: HomeIssue | null = null;
  let latestArticles: HomeArticle[] = [];
  let initialContent: Record<string, unknown> = {};
  let initialManualArticlesValue = null;

  try {
    const { issue, articles } = await getLatestIssueWithArticles();
    latestIssue = issue;
    latestArticles = articles || [];

    const contentKeys = latestIssue?.id
      ? [...HOME_CONTENT_KEYS, `${CURRENT_ISSUE_ARTICLES_KEY_PREFIX}.${latestIssue.id}`]
      : HOME_CONTENT_KEYS;

    initialContent = await getSiteContentEntries(contentKeys);
    if (latestIssue?.id) {
      initialManualArticlesValue =
        initialContent[`${CURRENT_ISSUE_ARTICLES_KEY_PREFIX}.${latestIssue.id}`] ?? null;
    }
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
      <HomePageClient
        initialLoaded
        initialIssue={latestIssue}
        initialArticles={latestArticles}
        initialManualArticlesValue={initialManualArticlesValue}
        initialContent={initialContent}
      />
    </>
  );
}
