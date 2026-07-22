/** Footer with links + the open-source pitch. */
export function Footer() {
  return (
    <footer className="py-12">
      <div className="max-w-content mx-auto px-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-center gap-2.5">
          <span
            className="inline-flex items-center justify-center w-7 h-7 rounded-md text-white text-sm font-bold"
            style={{ background: 'linear-gradient(135deg, var(--accent), var(--teal))' }}
          >
            K
          </span>
          <div>
            <div className="font-semibold tracking-tight">
              Kit<span className="text-accent">Kat</span>
            </div>
            <div className="text-xs text-content-muted">the definitive WebMCP toolkit · MIT licensed</div>
          </div>
        </div>

        <div className="flex items-center gap-6 text-sm text-content-tertiary">
          <a
            href="https://developer.chrome.com/docs/ai/webmcp"
            target="_blank"
            rel="noreferrer"
            className="hover:text-content-primary transition-colors"
          >
            WebMCP docs ↗
          </a>
          <a
            href="https://github.com/webmachinelearning/webmcp"
            target="_blank"
            rel="noreferrer"
            className="hover:text-content-primary transition-colors"
          >
            W3C spec ↗
          </a>
          <a
            href="https://github.com"
            target="_blank"
            rel="noreferrer"
            className="hover:text-content-primary transition-colors"
          >
            GitHub ↗
          </a>
        </div>
      </div>
      <div className="max-w-content mx-auto px-6 mt-8 pt-6 border-t border-border-subtle text-xs text-content-muted">
        Built for the WebMCP community. Runs entirely on your machine — your tools, schemas, and test results never
        leave your browser.
      </div>
    </footer>
  );
}
