import type { MetadataRoute } from "next";

/**
 * Dynamic robots.txt generated via the App Router metadata API.
 *
 * This replaces the static `public/robots.txt` and automatically
 * links crawlers to the sitemap.
 *
 * @see https://nextjs.org/docs/app/api-reference/file-conventions/metadata/robots
 */
export default function robots(): MetadataRoute.Robots {
  const baseUrl = "https://sql-execution-visualizer.vercel.app";

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Block internal Next.js paths that add no SEO value
        disallow: ["/_next/", "/api/"],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
