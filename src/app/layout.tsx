import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/context/ThemeContext";
import { Analytics } from "@vercel/analytics/next";

const SITE_URL = "https://sql-execution-visualizer.vercel.app";
const SITE_TITLE = "SQL Execution Visualizer — Interactive B+Tree & Query Engine";
const SITE_DESCRIPTION =
  "Write SQL and watch every step execute under the hood. " +
  "Interactive mini-database with animated B+Tree visualization, " +
  "step-by-step execution plans, and live schema browsing — right in your browser.";

export const metadata: Metadata = {
  /* ── Core ──────────────────────────────────────────────────────────────── */
  title: {
    default: SITE_TITLE,
    template: "%s | SQL Execution Visualizer",
  },
  description: SITE_DESCRIPTION,
  icons: { icon: "/logo.svg" },

  /* ── Canonical & Base URL ──────────────────────────────────────────────── */
  metadataBase: new URL(SITE_URL),
  alternates: {
    canonical: "/",
  },

  /* ── Keywords ──────────────────────────────────────────────────────────── */
  keywords: [
    "SQL visualizer",
    "B+Tree visualization",
    "SQL execution plan",
    "interactive database",
    "learn SQL",
    "query engine",
    "database internals",
    "SQL playground",
    "B-tree animation",
    "SQL step by step",
  ],

  /* ── Open Graph (Facebook, LinkedIn, Discord, etc.) ────────────────────── */
  openGraph: {
    type: "website",
    url: SITE_URL,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    siteName: "SQL Execution Visualizer",
    locale: "en_US",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "SQL Execution Visualizer — Interactive B+Tree & Query Engine",
        type: "image/png",
      },
    ],
  },

  /* ── Twitter / X Card ──────────────────────────────────────────────────── */
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: ["/og-image.png"],
  },

  /* ── Robots ────────────────────────────────────────────────────────────── */
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },

  /* ── Google Search Console ─────────────────────────────────────────────── */
  verification: {
    google: "gZ2Me5bmjTwgd2BYWtQs48SlNzYpnOdXUvH-zM9aw8M",
  },

  /* ── App info ──────────────────────────────────────────────────────────── */
  applicationName: "SQL Execution Visualizer",
  category: "education",
  creator: "Ashwin Athappan",
};

/* ── JSON-LD Structured Data (WebApplication schema) ─────────────────────── */
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "SQL Execution Visualizer",
  url: SITE_URL,
  description: SITE_DESCRIPTION,
  applicationCategory: "EducationalApplication",
  operatingSystem: "All",
  browserRequirements: "Requires JavaScript. Requires HTML5.",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
  featureList: [
    "Interactive SQL query execution",
    "Animated B+Tree visualization",
    "Step-by-step execution plans",
    "Live schema browser",
    "In-browser mini database engine",
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        {/* JSON-LD structured data for rich search results */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body suppressHydrationWarning>
        <ThemeProvider>
          {children}
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  );
}
