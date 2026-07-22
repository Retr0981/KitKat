import { useMemo, useState } from 'react';
import { formatForPersona, severityOf, type McpEvent, type PersonaId } from '@kitkat/core';
import { Badge, EmptyState, Panel, SplitPane, Tabs, toneFor } from '@kitkat/ui';
import { useWebSession } from '../store.js';
import { SchemaViewer } from '../components/SchemaViewer.js';

/**
 * Redesigned Debugger — inspector + agent-view tabs, network-style activity log,
 * and a filterable timeline with freeze-frame diffing.
 */
export function DebuggerPage() {
  const tools = useWebSession((s) => s.tools);
  const events = useWebSession((s) => s.events);
  const snapshots = useWebSession((s) => s.snapshots);
  const captureSnapshot = useWebSession((s) => s.captureSnapshot);
  const toast = useWebSession((s) => s.toast);
  const [selected, setSelected] = useState<string | null>(null);
  const [persona, setPersona] = useState<PersonaId>('gemini');
  const [tab, setTab] = useState<'inspector' | 'persona'>('inspector');

  const selectedTool = tools.find((t) => t.name === selected) ?? null;
  const toolState = useMemo(() => deriveToolState(events), [events]);
  const selectedEvents = useMemo(
    () => (selected ? events.filter((e) => 'toolName' in e && e.toolName === selected) : []),
    [events, selected],
  );
  const personaText = useMemo(() => (tools.length ? formatForPersona(persona, tools) : ''), [persona, tools]);

  if (!tools.length) {
    return (
      <EmptyState icon="⛏" title="Nothing to inspect yet">
        Once tools are registered (inline, demo, or via URL), their live state, schemas, and every invocation stream
        into this inspector in real time.
      </EmptyState>
    );
  }

  return (
    <SplitPane
      left={
        <div className="h-full flex flex-col bg-surface-1">
          <div className="p-2">
            <Tabs
              tabs={[
                { id: 'inspector', label: 'Inspector' },
                { id: 'persona', label: 'Agent view' },
              ]}
              onChange={(id) => setTab(id as typeof tab)}
            />
          </div>
          {tab === 'inspector' ? (
            <div className="flex-1 overflow-y-auto">
              {tools.map((t) => {
                const on = selected === t.name;
                const state = toolState.get(t.name) ?? 'available';
                return (
                  <button
                    key={t.name}
                    onClick={() => setSelected(t.name)}
                    className={`w-full text-left px-3 py-2.5 border-b border-border-subtle transition-colors hover:bg-surface-2 ${on ? 'bg-accent-soft' : ''}`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm text-content-primary flex-1 truncate">{t.name}</span>
                      <Badge tone={toneFor(state)} dot>
                        {state}
                      </Badge>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="flex-1 flex flex-col min-h-0">
              <div className="px-2 pb-2 flex gap-1">
                {(['gemini', 'claude', 'gpt'] as PersonaId[]).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPersona(p)}
                    className={`px-2.5 py-1 rounded-sm text-xs font-medium transition-colors ${persona === p ? 'bg-accent-soft text-accent-glow' : 'text-content-tertiary hover:bg-surface-2'}`}
                  >
                    {p}
                  </button>
                ))}
              </div>
              <div className="flex-1 min-h-0">
                <SchemaViewer value={personaText} />
              </div>
            </div>
          )}
        </div>
      }
      right={
        <div className="h-full flex flex-col">
          <div className="flex-1 min-h-0 overflow-y-auto p-4 bg-surface-0">
            {selectedTool ? (
              <div className="space-y-4 max-w-content">
                <div className="flex items-center gap-2">
                  <h2 className="font-mono text-lg text-content-primary">{selectedTool.name}</h2>
                  <Badge tone="info">{selectedTool.source}</Badge>
                </div>
                <Panel className="overflow-hidden">
                  <div className="px-3.5 py-2 border-b border-border-subtle bg-surface-2 text-xs uppercase tracking-wider text-content-tertiary font-semibold">
                    inputSchema
                  </div>
                  <div className="h-48">
                    <SchemaViewer value={selectedTool.inputSchema ?? {}} />
                  </div>
                </Panel>
                <div>
                  <h3 className="text-xs uppercase tracking-wider text-content-tertiary font-semibold mb-2">
                    Activity ({selectedEvents.length})
                  </h3>
                  {selectedEvents.length === 0 ? (
                    <p className="text-sm text-content-muted">No activity yet for this tool.</p>
                  ) : (
                    <Waterfall events={selectedEvents} />
                  )}
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-content-tertiary">
                Select a tool to see what an agent would see.
              </div>
            )}
          </div>
          <Timeline events={events} snapshots={snapshots} onFreeze={() => {
            const name = `frame ${new Date().toLocaleTimeString()}`;
            captureSnapshot(name);
            toast('ok', `Captured ${name}`);
          }} />
        </div>
      }
    />
  );
}

/** Network-style request → execute → response log. */
function Waterfall({ events }: { events: McpEvent[] }) {
  return (
    <div className="space-y-1.5 font-mono text-xs">
      {events.slice(-12).reverse().map((e, i) => {
        const sev = severityOf(e);
        const label =
          e.type === 'tool:invoked'
            ? `→ invoke · ${JSON.stringify(e.input)}`
            : e.type === 'tool:result'
              ? `← ${e.result.status} · ${e.result.durationMs}ms`
              : e.type === 'consent:requested'
                ? `◌ consent: "${e.message}"`
                : e.type === 'consent:resolved'
                  ? `◌ consent ${e.granted ? 'granted' : 'denied'}`
                  : e.type;
        return (
          <div key={`${e.id}-${i}`} className="flex items-start gap-2 px-2 py-1.5 rounded bg-surface-1 border border-border-subtle">
            <Badge tone={sev === 'success' ? 'ok' : sev === 'error' ? 'bad' : sev === 'warning' ? 'warn' : 'info'}>
              {sev}
            </Badge>
            <span className="text-content-secondary flex-1 break-all">{label}</span>
            <span className="text-content-muted shrink-0">{new Date(e.at).toLocaleTimeString()}</span>
          </div>
        );
      })}
    </div>
  );
}

const FILTERS = ['all', 'tool:registered', 'tool:invoked', 'tool:result', 'consent:requested', 'error'] as const;

function Timeline({
  events,
  snapshots,
  onFreeze,
}: {
  events: McpEvent[];
  snapshots: Record<string, McpEvent[]>;
  onFreeze: () => void;
}) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('all');
  const [diff, setDiff] = useState<string | null>(null);
  const filtered = filter === 'all' ? events : events.filter((e) => e.type === filter);
  const diffBase = diff && snapshots[diff] ? new Set(snapshots[diff].map((e) => e.id)) : null;
  const shown = diffBase ? filtered.filter((e) => !diffBase.has(e.id)) : filtered;

  return (
    <div className="h-56 border-t border-border-subtle bg-surface-1 shrink-0 flex flex-col">
      <div className="flex items-center gap-1 px-2.5 py-1.5 border-b border-border-subtle shrink-0 overflow-x-auto">
        <span className="text-2xs uppercase tracking-wider text-content-muted mr-1 font-semibold">Timeline</span>
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-1.5 py-0.5 rounded text-2xs font-mono transition-colors ${filter === f ? 'bg-accent-soft text-accent-glow' : 'text-content-muted hover:bg-surface-2'}`}
          >
            {f}
          </button>
        ))}
        <div className="flex-1" />
        {Object.keys(snapshots).length > 0 && (
          <select
            value={diff ?? ''}
            onChange={(e) => setDiff(e.target.value || null)}
            className="h-6 text-2xs bg-surface-2 border border-border-default rounded px-1 font-mono"
          >
            <option value="">no diff</option>
            {Object.keys(snapshots).map((n) => (
              <option key={n} value={n}>
                diff: {n}
              </option>
            ))}
          </select>
        )}
        <button onClick={onFreeze} className="px-1.5 h-6 rounded text-2xs bg-surface-2 border border-border-default hover:bg-surface-3">
          ⏸ freeze
        </button>
        <span className="text-2xs text-content-muted font-mono w-8 text-right">{shown.length}</span>
      </div>
      <div className="flex-1 overflow-y-auto font-mono text-xs">
        {shown.length === 0 ? (
          <div className="h-full flex items-center justify-center text-content-muted">
            {diffBase ? 'No new events since the freeze-frame.' : 'No events yet.'}
          </div>
        ) : (
          shown.slice().reverse().map((e) => (
            <div key={e.id} className="px-2.5 py-1 flex items-start gap-2 border-b border-border-subtle/60 hover:bg-surface-2">
              <span className="text-content-muted shrink-0 w-16">{new Date(e.at).toLocaleTimeString([], { hour12: false })}</span>
              <Badge tone={severityOf(e) === 'success' ? 'ok' : severityOf(e) === 'error' ? 'bad' : severityOf(e) === 'warning' ? 'warn' : 'info'}>
                {e.type.split(':')[1] ?? e.type}
              </Badge>
              <span className="text-content-secondary flex-1 break-all truncate">{describe(e)}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function deriveToolState(events: McpEvent[]): Map<string, string> {
  const state = new Map<string, string>();
  for (const e of events) {
    if (e.type === 'tool:result') state.set(e.result.toolName, e.result.status === 'success' ? 'completed' : 'error');
    else if (e.type === 'tool:invoked' && state.get(e.toolName) !== 'completed' && state.get(e.toolName) !== 'error') {
      state.set(e.toolName, 'invoked');
    }
  }
  return state;
}

function describe(e: McpEvent): string {
  switch (e.type) {
    case 'tool:registered':
      return `+ ${e.tool.name} registered (${e.tool.source})`;
    case 'tool:unregistered':
      return `- ${e.toolName} unregistered`;
    case 'tool:invoked':
      return `→ ${e.toolName} invoked`;
    case 'tool:result':
      return `← ${e.result.toolName} ${e.result.status} (${e.result.durationMs}ms)`;
    case 'consent:requested':
      return `◌ ${e.toolName}: "${e.message}"`;
    case 'consent:resolved':
      return `◌ ${e.toolName} ${e.granted ? 'granted ✓' : 'denied ✕'}`;
    case 'error':
      return `✕ ${e.toolName ?? 'page'}: ${e.message} [${e.category}]`;
  }
}
