import { Panel } from '@kitkat/ui';

/** "What is WebMCP?" primer — the educational section for newcomers. */
export function WhatIsWebMcp() {
  return (
    <section className="border-b border-border-subtle py-20">
      <div className="max-w-content mx-auto px-6">
        <div className="max-w-2xl mb-12">
          <div className="text-sm font-mono text-accent-glow mb-2">the standard</div>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
            Websites are becoming tools for AI agents.
          </h2>
          <p className="text-lg text-content-secondary leading-relaxed">
            <strong className="text-content-primary">WebMCP</strong> is a draft W3C standard, co-authored by Google
            and Microsoft, that lets a website publish a <em>tool contract</em> — named JavaScript functions and HTML
            forms with typed inputs — that AI agents can discover and invoke directly through the browser. KitKat is the
            developer tooling layer around it.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          <Card
            step="01"
            title="Two ways to expose tools"
            body={
              <>
                <p className="mb-2">
                  <strong>Imperative</strong> — register dynamic tools in JS:
                </p>
                <Code>{`navigator.modelContext.registerTool({
  name: 'shop.search',
  description: 'Search the catalog',
  inputSchema: { … },
  execute: async (input) => { … }
})`}</Code>
                <p className="mt-3 mb-2">
                  <strong>Declarative</strong> — pure HTML attributes, zero JS:
                </p>
                <Code>{`<form toolname="shop.subscribe"
      tooldescription="Join the newsletter">
  <input name="email" type="email" required />
</form>`}</Code>
              </>
            }
          />
          <Card
            step="02"
            title="Agents discover & invoke"
            body={
              <>
                <p className="mb-2">An agent queries the browser for available tools and calls them by name:</p>
                <Code>{`const tools = await navigator
  .modelContextTesting.getTools()

const result = await navigator
  .modelContextTesting.executeTool(
    'shop.search',
    { query: 'red dress' }
  )`}</Code>
                <p className="mt-3 text-sm">KitKat intercepts these calls so you can observe them live.</p>
              </>
            }
          />
          <Card
            step="03"
            title="Consent is built in"
            body={
              <>
                <p className="mb-2">Sensitive tools prompt the user before any side effect:</p>
                <Code>{`execute: async (input, client) => {
  const ok = await client
    .requestUserInteraction(
      'Add to cart?'
    )
  if (!ok) return
  // …perform the mutation
}`}</Code>
                <p className="mt-3 text-sm">KitKat's security check verifies you do this.</p>
              </>
            }
          />
        </div>
      </div>
    </section>
  );
}

function Card({ step, title, body }: { step: string; title: string; body: React.ReactNode }) {
  return (
    <Panel raised className="p-5 h-full">
      <div className="text-xs font-mono text-accent mb-2">{step}</div>
      <h3 className="text-base font-semibold mb-3">{title}</h3>
      <div className="text-sm text-content-secondary leading-relaxed">{body}</div>
    </Panel>
  );
}

function Code({ children }: { children: string }) {
  return (
    <pre className="bg-surface-2 border border-border-subtle rounded-lg p-3 text-[0.7rem] font-mono text-content-secondary leading-relaxed overflow-x-auto">
      {children}
    </pre>
  );
}
