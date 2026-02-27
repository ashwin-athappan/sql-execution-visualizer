import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SQL Execution Visualizer",
  description: "Interactive mini-database with animated B+Tree visualization. Write SQL and watch every step execute under the hood.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
