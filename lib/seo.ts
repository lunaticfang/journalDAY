import type { Metadata } from "next";

export const SITE_NAME = "UpDAYtes";
export const SITE_DESCRIPTION =
  "UpDAYtes is an online academic journal platform for peer-reviewed publications, issues, editorial content, and manuscript submissions.";

function normalizeBaseUrl(rawUrl?: string) {
  const fallback = "http://localhost:3000";
  const value = String(rawUrl || "").trim();
  if (!value) return fallback;
  if (value.startsWith("http://") || value.startsWith("https://")) {
    return value.replace(/\/$/, "");
  }
  return `https://${value}`.replace(/\/$/, "");
}

export function getSiteUrl() {
  return normalizeBaseUrl(process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL);
}

export function toAbsoluteUrl(path = "/") {
  return new URL(path, `${getSiteUrl()}/`).toString();
}

export function sanitizeSeoText(value: string | null | undefined, maxLength = 160) {
  const text = String(value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!text) return "";
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1).trimEnd()}…`;
}

type BuildPageMetadataInput = {
  title: string;
  description?: string;
  path?: string;
  keywords?: string[];
  imagePath?: string;
  type?: "website" | "article";
  noIndex?: boolean;
};

export function buildPageMetadata({
  title,
  description = SITE_DESCRIPTION,
  path = "/",
  keywords = [],
  imagePath = "/Website Banner.jpg",
  type = "website",
  noIndex = false,
}: BuildPageMetadataInput): Metadata {
  const canonical = toAbsoluteUrl(path);
  const image = toAbsoluteUrl(imagePath);

  return {
    title,
    description,
    alternates: {
      canonical,
    },
    keywords,
    robots: noIndex
      ? {
          index: false,
          follow: false,
        }
      : undefined,
    openGraph: {
      type,
      title,
      description,
      url: canonical,
      siteName: SITE_NAME,
      images: [
        {
          url: image,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}
