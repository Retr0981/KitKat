import { Badge, Button, Kbd } from '@kitkat/ui';

/** Hero — value prop, launch CTA, and the "no install" promise. */
export function Hero({ onLaunch }: { onLaunch: () => void }) {
  return (
    <section className="relative overflow-hidden border-b border-border-subtle">
      {/* Ambient gradient backdrop */}
      <div
        className="absolute inset-0 -z-10 opacity-60"
        style={{
          background:
            'radial-gradient(60% 50% at 50% 0%, rgba(99,102,241,0.25) 0%, transparent 60%), radial-gradient(40% 40% at 80% 20%, rgba(45,212,191,0.12) 0%, transparent 60%)',
        }}
      />
      <div
        className="absolute inset-0 -z-10 opacity-[0.15]"
        style={{
          backgroundImage:
            'linear-gradient(var(--border-subtle) 1px, transparent 1px), linear-gradient(90deg, var(--border-subtle) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
          maskImage: 'radial-gradient(ellipse 80% 60% at 50% 0%, black 40%, transparent 75%)',
        }}
      />

      <div className="max-w-content mx-auto px-6 pt-10 pb-20">
        {/* Nav */}
        <nav className="flex items-center justify-between mb-24">
          <div className="flex items-center gap-2.5">
            <span
              className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-white font-bold"
              style={{ background: 'linear-gradient(135deg, var(--accent), var(--teal))' }}
            >
              K
            </span>
            <span className="font-semibold text-lg tracking-tight">
              Kit<span className="text-accent">Kat</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="https://developer.chrome.com/docs/ai/webmcp"
              target="_blank"
              rel="noreferrer"
              className="text-sm text-content-tertiary hover:text-content-primary transition-colors px-3 py-2"
            >
              WebMCP docs ↗
            </a>
            <Button variant="primary" size="sm" onClick={onLaunch}>
              Launch the tool
            </Button>
          </div>
        </nav>

        {/* Headline */}
        <div className="max-w-3xl">
          <div
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-6 text-xs font-medium"
            style={{ background: 'var(--accent-soft)', border: '1px solid rgba(99,102,241,0.3)', color: 'var(--accent-glow)' }}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--accent)', animation: 'kitkat-pulse 2s infinite' }} />
            Postman for WebMCP · open source
          </div>
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight leading-[1.02] mb-6">
            The definitive toolkit for the{' '}
            <span
              className="bg-clip-text text-transparent inline-block"
              style={{ backgroundImage: 'linear-gradient(115deg, var(--accent-glow) 0%, var(--accent) 40%, var(--teal) 100%)' }}
            >
              Web Model Context Protocol
            </span>
          </h1>
          <p className="text-lg text-content-secondary leading-relaxed max-w-2xl mb-8">
            Validate, debug, simulate, and analyze WebMCP tools —{' '}
            <strong className="text-content-primary">entirely in your browser</strong>. No install, no account, no
            external API calls. Point it at a page or define tools inline and ship with confidence.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="primary" size="lg" onClick={onLaunch}>
              ▶ Launch the tool — no install
            </Button>
            <a
              href="#how"
              className="text-sm text-content-tertiary hover:text-content-primary transition-colors px-2"
            >
              How it works ↓
            </a>
          </div>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-10 text-sm text-content-muted">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-ok" /> 100% client-side
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-ok" /> zero data leaves your machine
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-ok" /> MIT licensed
            </span>
          </div>
        </div>

        {/* Preview window mockup */}
        <div className="mt-16 rounded-2xl border border-border-default overflow-hidden shadow-lg bg-surface-1">
          <div className="flex items-center gap-1.5 px-4 h-9 border-b border-border-subtle bg-surface-2">
            <span className="w-3 h-3 rounded-full bg-[#ef4444]/70" />
            <span className="w-3 h-3 rounded-full bg-[#eab308]/70" />
            <span className="w-3 h-3 rounded-full bg-[#22c55e]/70" />
            <span className="ml-3 text-xs text-content-muted font-mono">kitkat · Validator</span>
            <span className="ml-auto text-xs text-content-muted flex items-center gap-1">
              <Kbd>⌘</Kbd>
              <Kbd>K</Kbd>
            </span>
          </div>
          <PreviewMock />
        </div>
      </div>
    </section>
  );
}

/** A static, styled mock of the tool UI to convey the product at a glance. */
function PreviewMock() {
  const tools = [
    { name: 'shop.search', status: 'pass', tone: 'ok' as const },
    { name: 'shop.addToCart', status: 'warn', tone: 'warn' as const },
    { name: 'shop.checkout', status: 'fail', tone: 'bad' as const },
  ];
  return (
    <div className="grid grid-cols-12 h-72 text-xs">
      <div className="col-span-3 border-r border-border-subtle p-3 space-y-1.5">
        <div className="text-[0.65rem] uppercase tracking-wider text-content-muted mb-2 font-semibold">Tools</div>
        {tools.map((t) => (
          <div key={t.name} className="flex items-center gap-2 px-2 py-1.5 rounded bg-surface-2">
            <Badge tone={t.tone}>{t.status}</Badge>
            <span className="font-mono text-content-primary flex-1 truncate">{t.name}</span>
          </div>
        ))}
      </div>
      <div className="col-span-5 border-r border-border-subtle p-4 font-mono text-[0.7rem] text-content-secondary overflow-auto">
        <div className="text-content-muted mb-2">// inputSchema</div>
        <pre className="leading-relaxed">{`{
  "type": "object",
  "properties": {
    "query": {
      "type": "string",
      "description": "search text"
    },
    "color": {
      "type": "string",
      "enum": ["red","blue"]
    }
  },
  "required": ["query"]
}`}</pre>
      </div>
      <div className="col-span-4 p-4 space-y-2">
        <div className="text-[0.65rem] uppercase tracking-wider text-content-muted font-semibold">Security</div>
        <div className="flex items-start gap-2 px-2 py-1.5 rounded bg-bad-soft text-bad">
          <span>✕</span>
          <span className="text-content-secondary">Mutating tool did not call requestUserInteraction().</span>
        </div>
        <div className="flex items-start gap-2 px-2 py-1.5 rounded bg-warn-soft">
          <span className="text-warn">→ fix</span>
          <span className="text-content-secondary">
            Call <code className="font-mono">client.requestUserInteraction()</code> before side effects.
          </span>
        </div>
        <div className="flex items-start gap-2 px-2 py-1.5 rounded bg-ok-soft">
          <span className="text-ok">✓</span>
          <span className="text-content-secondary">Output is JSON-serializable.</span>
        </div>
      </div>
    </div>
  );
}
