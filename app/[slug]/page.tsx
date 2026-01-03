// app/[slug]/page.tsx
import { supabase } from "../../lib/supabaseClient";

export default async function CMSPage({
  params,
}: {
  params: { slug: string };
}) {
  const { data, error } = await supabase
    .from("cms_pages")
    .select("title, content")
    .eq("slug", params.slug)
    .single();

  if (error || !data) {
    return (
      <main style={{ maxWidth: 900, margin: "60px auto", padding: 20 }}>
        <h1>Page not found</h1>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 900, margin: "60px auto", padding: 20 }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 24 }}>
        {data.title}
      </h1>

      {Array.isArray(data.content?.blocks) &&
        data.content.blocks.map((block: any, i: number) => {
          if (block.type === "paragraph") {
            return (
              <p key={i} style={{ fontSize: 16, marginBottom: 14 }}>
                {block.text}
              </p>
            );
          }

          if (block.type === "heading") {
            return (
              <h2 key={i} style={{ fontSize: 22, margin: "24px 0 12px" }}>
                {block.text}
              </h2>
            );
          }

          return null;
        })}
    </main>
  );
}
