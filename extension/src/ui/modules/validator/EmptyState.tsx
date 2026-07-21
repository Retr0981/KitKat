import { useSession } from '../../../store/session.js';

/** Shown when no tools are detected on the active tab. */
export function EmptyState() {
  const toast = useSession((s) => s.toast);
  return (
    <div className="h-full flex items-center justify-center p-8">
      <div className="max-w-md text-center space-y-4">
        <div className="text-5xl">🔍</div>
        <h2 className="text-xl font-semibold text-zinc-100">No WebMCP tools detected</h2>
        <p className="text-sm text-zinc-400 leading-relaxed">
          KitKat looks for tools registered via{' '}
          <code className="font-mono text-accent">navigator.modelContext.registerTool()</code> or declared with{' '}
          <code className="font-mono text-accent">toolname</code> HTML attributes. Open a WebMCP-enabled page
          (or one of the bundled demos) and tools will appear here within ~2 seconds.
        </p>
        <div className="flex items-center justify-center gap-2 pt-2">
          <a
            className="btn btn-primary"
            href="https://developer.chrome.com/docs/ai/webmcp"
            target="_blank"
            rel="noreferrer"
          >
            WebMCP docs ↗
          </a>
          <button className="btn" onClick={() => toast('info', 'Tip: run the local server and open a demo page.')}>
            How to test
          </button>
        </div>
        <p className="text-2xs text-base-500 pt-4">
          No native WebMCP in this Chrome? KitKat's interceptor still detects declarative tools, and the
          Sandbox lets you simulate imperative tools entirely offline.
        </p>
      </div>
    </div>
  );
}
