import { Badge, Button, Panel } from '@kitkat/ui';

/** The four modules as feature cards. */
export function Modules({ onLaunch }: { onLaunch: () => void }) {
  return (
    <section className="border-b border-border-subtle py-20">
      <div className="max-w-content mx-auto px-6">
        <div className="max-w-2xl mb-12">
          <div className="text-sm font-mono text-accent-glow mb-2">four modules, one toolkit</div>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
            Everything you need to ship WebMCP tools with confidence.
          </h2>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <ModuleCard
            icon="✓"
            tone="ok"
            name="Validator"
            tagline="Test before shipping."
            bullets={[
              'Five-category suite: schema, parameters, execution, errors, security',
              'Generated valid / edge-case / invalid inputs',
              'Pass/fail reports with concrete fix suggestions',
              'Export as JSON or Markdown',
            ]}
          />
          <ModuleCard
            icon="⛏"
            tone="info"
            name="Debugger"
            tagline="See what an agent sees."
            bullets={[
              'Live tool list with state badges + full schemas',
              'Network-style request → execute → response log',
              'Gemini / Claude / GPT function-calling persona views',
              'Filterable timeline with freeze-frame diffing',
            ]}
          />
          <ModuleCard
            icon="⬡"
            tone="warn"
            name="Sandbox"
            tagline="Simulate agents offline."
            bullets={[
              'Rule-based 5-step agent engine — no AI required',
              'Preset scenarios: shopping, travel, support',
              'Discover → select → fill → invoke → respond → decide',
              'Safe mode returns deterministic mocks',
            ]}
          />
          <ModuleCard
            icon="▦"
            tone="accent"
            name="Analytics"
            tagline="Track usage & performance."
            bullets={[
              'Local SQLite-backed dashboard, fully offline',
              'Registrations, invocations, success/error rates',
              'Trends, top tools, error breakdown',
              '10,000 events queried in 6ms',
            ]}
          />
        </div>

        <div className="mt-8 text-center">
          <Button variant="primary" size="lg" onClick={onLaunch}>
            Try them all — no install
          </Button>
        </div>
      </div>
    </section>
  );
}

function ModuleCard({
  icon,
  name,
  tagline,
  bullets,
  tone,
}: {
  icon: string;
  name: string;
  tagline: string;
  bullets: string[];
  tone: 'ok' | 'info' | 'warn' | 'accent';
}) {
  return (
    <Panel raised hover className="p-6 h-full">
      <div className="flex items-center gap-3 mb-4">
        <span
          className="inline-flex items-center justify-center w-10 h-10 rounded-lg text-lg"
          style={{ background: 'var(--accent-soft)' }}
        >
          {icon}
        </span>
        <div>
          <h3 className="text-lg font-semibold">{name}</h3>
          <p className="text-sm text-content-tertiary">{tagline}</p>
        </div>
        <Badge tone={tone} className="ml-auto">
          module
        </Badge>
      </div>
      <ul className="space-y-2">
        {bullets.map((b) => (
          <li key={b} className="flex items-start gap-2 text-sm text-content-secondary">
            <span className="text-accent mt-0.5">→</span>
            <span>{b}</span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
