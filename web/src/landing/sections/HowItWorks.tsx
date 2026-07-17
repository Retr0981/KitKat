import { Panel } from '@kitkat/ui';

/** How-it-works flow diagram — three steps from tool to validated. */
export function HowItWorks() {
  const steps = [
    {
      n: '1',
      title: 'Define or load tools',
      body: 'Write tools in the inline editor, pick a bundled demo, or point KitKat at a WebMCP-enabled URL. Tools register into a spec-accurate in-memory backend.',
    },
    {
      n: '2',
      title: 'Observe & validate',
      body: 'The Debugger streams every registration and invocation live. Run the Validator to exercise each tool across five categories and surface fix suggestions.',
    },
    {
      n: '3',
      title: 'Ship with confidence',
      body: 'Export a pass/fail report, simulate an agent end-to-end in the Sandbox, and watch usage in Analytics. Everything stays on your machine.',
    },
  ];
  return (
    <section id="how" className="border-b border-border-subtle py-20">
      <div className="max-w-content mx-auto px-6">
        <div className="max-w-2xl mb-12">
          <div className="text-sm font-mono text-accent-glow mb-2">how it works</div>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">From registration to a green report.</h2>
        </div>
        <div className="grid md:grid-cols-3 gap-4 relative">
          {steps.map((s, i) => (
            <Panel key={s.n} raised className="p-6 relative">
              <div
                className="absolute -top-3 left-6 w-7 h-7 rounded-full text-white text-sm font-bold flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, var(--accent), var(--teal))' }}
              >
                {s.n}
              </div>
              <h3 className="text-base font-semibold mt-2 mb-2">{s.title}</h3>
              <p className="text-sm text-content-secondary leading-relaxed">{s.body}</p>
              {i < steps.length - 1 && (
                <span className="hidden md:block absolute top-1/2 -right-3 text-content-muted text-xl">→</span>
              )}
            </Panel>
          ))}
        </div>
      </div>
    </section>
  );
}
