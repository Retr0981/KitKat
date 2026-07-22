import { Badge, Button, Panel } from '@kitkat/ui';

/** Get-started section: web app vs extension paths. */
export function GetStarted({ onLaunch }: { onLaunch: () => void }) {
  return (
    <section className="border-b border-border-subtle py-20">
      <div className="max-w-content mx-auto px-6">
        <div className="max-w-2xl mb-12">
          <div className="text-sm font-mono text-accent-glow mb-2">get started</div>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Two ways to run KitKat.</h2>
          <p className="text-lg text-content-secondary mt-3">
            Start in the browser (no install), then graduate to the extension when you need to inspect your real,
            cross-origin production pages.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <Panel raised className="p-6">
            <div className="flex items-center gap-2 mb-3">
              <Badge tone="ok">recommended</Badge>
              <Badge tone="accent">zero install</Badge>
            </div>
            <h3 className="text-xl font-semibold mb-2">The web app</h3>
            <p className="text-sm text-content-secondary mb-4 leading-relaxed">
              You're already here. Click launch and you're in the tool — define tools in the inline editor, run the
              Validator, watch the Debugger. Nothing else to install or run.
            </p>
            <Button variant="primary" onClick={onLaunch}>
              ▶ Launch now
            </Button>
          </Panel>

          <Panel raised className="p-6">
            <div className="flex items-center gap-2 mb-3">
              <Badge tone="info">power users</Badge>
            </div>
            <h3 className="text-xl font-semibold mb-2">The Chrome extension</h3>
            <p className="text-sm text-content-secondary mb-4 leading-relaxed">
              For inspecting your real WebMCP-enabled site in place — including cross-origin pages the web app can't
              frame. Load it unpacked from the repo and open the DevTools panel.
            </p>
            <pre className="bg-surface-2 border border-border-subtle rounded-lg p-3 text-[0.7rem] font-mono text-content-secondary overflow-x-auto">
{`git clone <repo> KitKat && cd KitKat
npm install
npm run build -w kitkat-extension
# chrome://extensions → Load unpacked
# → extension/dist`}
            </pre>
          </Panel>
        </div>
      </div>
    </section>
  );
}
