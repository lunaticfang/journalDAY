import type { MetadataRoute } from "next";
import { supabaseServer } from "../lib/supabaseServer";
import { getSiteUrl } from "../lib/seo";

const STATIC_ROUTES = [
  "/",
  "/about",
  "/aim-scope",
  "/archive",
  "/issues",
  "/contact",
  "/editorial-board",
  "/advisory-board",
  "/instructions",
  "/instructions/contributions",
  "/instructions/copyright",
  "/instructions/how-to-submit",
  "/author/submit",
  "/notices/call-for-papers",
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = getSiteUrl();

  const staticEntries: MetadataRoute.Sitemap = STATIC_ROUTES.map((route) => ({
    url: new URL(route, `${baseUrl}/`).toString(),
    lastModified: new Date(),
    changeFrequency: route === "/" ? "weekly" : "monthly",
    priority: route === "/" ? 1 : 0.7,
  }));

  const [{ data: issues, error: issueError }, { data: articles, error: articleError }] =
    await Promise.all([
      supabaseServer
        .from("issues")
        .select("id, published_at, created_at")
        .order("published_at", { ascending: false, nullsFirst: false }),
      supabaseServer
        .from("articles")
        .select("id, created_at"),
    ]);

  if (issueError) {
    throw issueError;
  }

  if (articleError) {
    throw articleError;
  }

  const issueEntries: MetadataRoute.Sitemap = (issues || []).map((issue) => ({
    url: new URL(`/issues/${issue.id}`, `${baseUrl}/`).toString(),
    lastModified: issue.published_at || issue.created_at || new Date().toISOString(),
    changeFrequency: "monthly",
    priority: 0.8,
  }));

  const articleEntries: MetadataRoute.Sitemap = (articles || []).map((article) => ({
    url: new URL(`/article/${article.id}`, `${baseUrl}/`).toString(),
    lastModified: article.created_at || new Date().toISOString(),
    changeFrequency: "monthly",
    priority: 0.7,
  }));

  return [...staticEntries, ...issueEntries, ...articleEntries];
}
