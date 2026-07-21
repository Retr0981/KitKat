import { useMemo, useState } from 'react';
import { formatForPersona, severityOf, type PersonaId, type McpEvent } from '@kitkat/core';
import { useSession } from '../../../store/session.js';
import { sendBg } from '../../../messaging/ports.js';
import { ResizablePanels } from '../../components/ResizablePanels.js';
import { StatusBadge } from '../../components/StatusBadge.js';
import { SchemaViewer } from '../../components/SchemaViewer.js';
import { ConceptTooltip } from '../../components/ConceptTooltip.js';
import { Timeline } from './Timeline.js';

/**
 * Debugger module — see exactly what an AI agent sees.
 *
 * Live tool list with state badges, full schemas, the JSON payload/response of
 * each invocation, a chronological timeline, LLM persona views, freeze-frame
 * snapshots, and a DOM overlay toggle.
 */
export function DebuggerModule() {
  const tools = useSession((s) => s.tools);
  const events = useSession((s) => s.events);
  const tabId = useSession((s) => s.activeTabId);
  const overlay = useSession((s) => s.overlayEnabled);
  const setOverlay = useSession((s) => s.setOverlay);
  const toast = useSession((s) => s.toast);
  const captureSnapshot = useSession((s) => s.captureSnapshot);
  const snapshots = useSession((s) => s.snapshots);
  const [selected, setSelected] = useState<string | null>(null);
  const [persona, setPersona] = useState<PersonaId>('gemini');
  const [view, setView] = useState<'inspector' | 'persona'>('inspector');

  const selectedTool = tools.find((t) => t.name === selected) ?? null;

  /** Per-tool invocation state derived from the timeline. */
  const toolState = useMemo(() => deriveToolState(events), [events]);

  /** Events scoped to the selected tool. */
  const selectedEvents = useMemo(
    () => (selected ? events.filter((e) => 'toolName' in e && e.toolName === selected) : events),
    [events, selected],
  );

  const personaText = useMemo(() => (tools.length ? formatForPersona(persona, tools) : ''), [persona, tools]);

  const toggleOverlay = async () => {
    if (tabId == null) return;
    const next = !overlay;
    setOverlay(next);
    try {
      await sendBg({ kind: 'ui:inject-overlay', tabId, enabled: next });
      toast('info', next ? 'DOM overlay enabled — declarative tools are highlighted.' : 'Overlay hidden.');
    } catch (e) {
      toast('error', `Overlay failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const freeze = () => {
    const name = `frame_${new Date().toLocaleTimeString()}`;
    captureSnapshot(name);
    toast('success', `Captured freeze-frame "${name}".`);
  };

  if (tools.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-zinc-500 text-sm">
        No tools to inspect yet. Open a WebMCP page and registrations will stream in here.
      </div>
    );
  }

  return (
    <ResizablePanels
      left={
        <div className="h-full flex flex-col bg-base-900">
          <div className="p-2 border-b border-base-700 flex items-center gap-1">
            <button
              className={`btn ${view === 'inspector' ? 'btn-primary' : ''}`}
              onClick={() => setView('inspector')}
            >
              Inspector
            </button>
            <button
              className={`btn ${view === 'persona' ? 'btn-primary' : ''}`}
              onClick={() => setView('persona')}
            >
              Agent view
            </button>
            <div className="flex-1" />
            <button className="btn" onClick={toggleOverlay} title="Toggle DOM overlay">
              {overlay ? '◈ Overlay on' : '◈ Overlay'}
            </button>
            <button className="btn" onClick={freeze} title="Capture a freeze-frame of the current timeline">
              ⏸ Freeze
            </button>
          </div>

          {view === 'inspector' ? (
            <div className="flex-1 overflow-y-auto">
              {tools.map((t) => {
                const state = toolState.get(t.name) ?? 'available';
                const isSel = selected === t.name;
                return (
                  <button
                    key={t.name}
                    onClick={() => setSelected(t.name)}
                    className={`w-full text-left px-3 py-2.5 border-b border-base-850 hover:bg-base-850 transition-colors ${
                      isSel ? 'bg-accent/10 border-l-2 border-l-accent' : ''
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm text-zinc-100 flex-1 truncate">{t.name}</span>
                      <StatusBadge status={state} />
                    </div>
                    <div className="text-2xs text-base-500 mt-0.5 font-mono">{t.source}</div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="flex-1 flex flex-col min-h-0">
              <div className="px-2 py-2 border-b border-base-800 flex items-center gap-1 overflow-x-auto">
                {(['gemini', 'claude', 'gpt'] as PersonaId[]).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPersona(p)}
                    className={`px-2 py-1 rounded text-xs ${
                      persona === p ? 'bg-accent/15 text-white' : 'text-zinc-400 hover:bg-base-800'
                    }`}
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
          {/* Inspector pane */}
          <div className="flex-1 min-h-0 overflow-y-auto p-4 bg-base-950">
            {selectedTool ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <h2 className="font-mono text-lg text-white">{selectedTool.name}</h2>
                  <StatusBadge status="info" label={selectedTool.source} />
                </div>
                <p className="text-sm text-zinc-300">{selectedTool.description}</p>

                <section>
                  <h3 className="text-xs uppercase tracking-wider text-zinc-400 mb-2">
                    <ConceptTooltip
                      term="inputSchema"
                      explain="The JSON Schema agents see for this tool. This is exactly what gets serialized into a function declaration."
                    >
                      inputSchema
                    </ConceptTooltip>
                  </h3>
                  <div className="panel h-56">
                    <SchemaViewer value={selectedTool.inputSchema ?? {}} />
                  </div>
                </section>

                <section>
                  <h3 className="text-xs uppercase tracking-wider text-zinc-400 mb-2">Recent activity</h3>
                  {selectedEvents.length === 0 ? (
                    <p className="text-sm text-zinc-500">No activity for this tool yet. Invoke it to see the request/response.</p>
                  ) : (
                    <NetworkFlow events={selectedEvents} />
                  )}
                </section>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-zinc-500 text-sm">
                Select a tool to inspect what an agent would see.
              </div>
            )}
          </div>

          {/* Timeline pane */}
          <div className="h-56 border-t border-base-700 bg-base-900 shrink-0 flex flex-col">
            <Timeline events={events} snapshots={snapshots} onDiff={() => {}} />
          </div>
        </div>
      }
    />
  );
}

/** Network-style request → execute → response row for a tool's recent events. */
function NetworkFlow({ events }: { events: McpEvent[] }) {
  const rows: McpEvent[] = events.slice(-8).reverse();
  return (
    <div className="space-y-2">
      {rows.map((e, i) => {
        const sev = severityOf(e);
        const label =
          e.type === 'tool:invoked'
            ? `→ invoke · ${JSON.stringify(e.input)}`
            : e.type === 'tool:result'
              ? `← ${e.result.status} · ${e.result.durationMs}ms · ${JSON.stringify(e.result.output ?? e.result.errorMessage).slice(0, 120)}`
              : e.type === 'consent:requested'
                ? `◌ consent requested: "${e.message}"`
                : e.type === 'consent:resolved'
                  ? `◌ consent ${e.granted ? 'granted' : 'denied'}`
                  : e.type;
        return (
          <div key={`${e.id}-${i}`} className="flex items-start gap-2 text-xs font-mono">
            <StatusBadge status={sev === 'success' ? 'pass' : sev === 'error' ? 'fail' : sev === 'warning' ? 'warn' : 'info'} />
            <span className="text-zinc-300 flex-1 break-all">{label}</span>
            <span className="text-base-500 shrink-0">{new Date(e.at).toLocaleTimeString()}</span>
          </div>
        );
      })}
    </div>
  );
}

/** Derive a tool's current state from the event stream. */
function deriveToolState(events: McpEvent[]): Map<string, string> {
  const state = new Map<string, string>();
  for (const e of events) {
    if (e.type === 'tool:result') {
      state.set(e.result.toolName, e.result.status === 'success' ? 'completed' : 'error');
    } else if (e.type === 'tool:invoked') {
      if (state.get(e.toolName) !== 'completed' && state.get(e.toolName) !== 'error') {
        state.set(e.toolName, 'invoked');
      }
    }
  }
  return state;
}
