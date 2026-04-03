import type { MetadataRoute } from "next";

/**
 * Dynamic sitemap generated at build time.
 *
 * For a single-page app this is straightforward; if you later add routes
 * (e.g. /docs, /tutorial, /blog/[slug]) just push additional entries to
 * the array — or fetch slugs from a CMS / database here.
 *
 * @see https://nextjs.org/docs/app/api-reference/file-conventions/metadata/sitemap
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://sql-execution-visualizer.vercel.app";

  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1.0,
    },
    // ── Future routes ────────────────────────────────────────────────────
    // {
    //   url: `${baseUrl}/docs`,
    //   lastModified: new Date(),
    //   changeFrequency: "monthly",
    //   priority: 0.8,
    // },
  ];
}
