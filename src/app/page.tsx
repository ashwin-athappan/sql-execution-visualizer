import SqlVisualizerApp from "@/components/SqlVisualizerApp";

/**
 * Home page — Server Component shell.
 *
 * The <noscript> block and visually-hidden <section> provide meaningful,
 * crawlable HTML for search engine bots that cannot execute JavaScript.
 * The interactive app loads on top via the client component.
 *
 * This is the SSG rendering strategy: the page is fully rendered at build
 * time and served as static HTML, giving the fastest TTFB for crawlers.
 */
export default function Home() {
  return (
    <>
      {/* ── Server-rendered, crawlable content ────────────────────────────
           Hidden from sighted users but fully readable by Googlebot.
           Provides semantic structure, headings, and keyword-rich text
           for pages where the visible UI is entirely client-rendered.
      ──────────────────────────────────────────────────────────────────── */}
      <section
        aria-label="Page description for search engines"
        style={{
          position: "absolute",
          width: "1px",
          height: "1px",
          padding: 0,
          margin: "-1px",
          overflow: "hidden",
          clip: "rect(0, 0, 0, 0)",
          whiteSpace: "nowrap",
          borderWidth: 0,
        }}
      >
        <h1>SQL Execution Visualizer — Interactive B+Tree &amp; Query Engine</h1>
        <p>
          Write SQL queries and watch every step execute under the hood. This
          free, browser-based tool provides an interactive mini-database with
          animated B+Tree visualization, step-by-step execution plans, and
          live schema browsing.
        </p>
        <h2>Features</h2>
        <ul>
          <li>Interactive SQL query execution with instant feedback</li>
          <li>Animated B+Tree index visualization showing inserts, splits, and deletions</li>
          <li>Step-by-step execution plan walkthrough — see exactly how your query runs</li>
          <li>Live schema browser with table and column inspection</li>
          <li>Full in-browser database engine — no server required</li>
          <li>Dark and light theme support</li>
        </ul>
        <h2>How It Works</h2>
        <p>
          Type any SQL statement — CREATE TABLE, INSERT, SELECT, UPDATE, or
          DELETE — into the editor. The visualizer breaks the query into
          discrete execution steps, animates the underlying B+Tree data
          structure changes, and displays results in real time.
        </p>
        <h2>Who Is This For?</h2>
        <p>
          Students learning database internals, developers debugging query
          performance, educators teaching B+Tree indexing, or anyone curious
          about what happens when a database processes SQL.
        </p>
      </section>

      {/* ── Fallback for users without JavaScript ────────────────────────── */}
      <noscript>
        <div style={{ padding: "40px", textAlign: "center", fontFamily: "system-ui" }}>
          <h1>SQL Execution Visualizer</h1>
          <p>
            This application requires JavaScript to run. Please enable
            JavaScript in your browser settings to use the interactive
            SQL visualizer.
          </p>
        </div>
      </noscript>

      {/* ── Interactive client application ────────────────────────────────── */}
      <SqlVisualizerApp />
    </>
  );
}
