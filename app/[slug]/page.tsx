import { notFound } from "next/navigation";
import { getCmsPageBySlug } from "../../lib/publicContent";
import { buildPageMetadata, sanitizeSeoText } from "../../lib/seo";
import { plainTextToParagraphs, siteContentValueToHtml } from "../../lib/siteContent";

export const revalidate = 300;

type PageProps = {
  params: Promise<{ slug: string }>;
};

function escapeHtml(value: string) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function cmsPageContentToHtml(content: any) {
  if (Array.isArray(content?.blocks)) {
    return content.blocks
      .map((block: any) => {
        if (!block || typeof block !== "object") return "";

        if (block.type === "paragraph") {
          return plainTextToParagraphs(block.text || "");
        }

        if (block.type === "heading") {
          return `<h2>${escapeHtml(String(block.text || "").trim())}</h2>`;
        }

        return "";
      })
      .join("");
  }

  return siteContentValueToHtml(content);
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;

  try {
    const page = await getCmsPageBySlug(slug);
    if (!page) {
      return buildPageMetadata({
        title: "Page Not Found",
        description: "The requested page could not be found.",
        path: `/${slug}`,
        noIndex: true,
      });
    }

    return buildPageMetadata({
      title: page.title || "Page",
      description:
        sanitizeSeoText(cmsPageContentToHtml(page.content), 155) ||
        "Read more on UpDAYtes.",
      path: `/${slug}`,
    });
  } catch (err) {
    console.error("CMS page metadata error:", err);
    return buildPageMetadata({
      title: "Page",
      description: "Read more on UpDAYtes.",
      path: `/${slug}`,
    });
  }
}

export default async function CMSPage({ params }: PageProps) {
  const { slug } = await params;
  const page = await getCmsPageBySlug(slug);

  if (!page) {
    notFound();
  }

  const html = cmsPageContentToHtml(page.content);

  return (
    <main style={{ maxWidth: 900, margin: "60px auto", padding: "0 20px" }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 24 }}>
        {page.title}
      </h1>
      <div
        className="jd-editor"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </main>
  );
}
