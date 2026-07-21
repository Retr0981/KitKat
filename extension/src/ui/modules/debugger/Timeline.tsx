import { useMemo, useState } from 'react';
import { severityOf, type McpEvent } from '@kitkat/core';
import { useSession } from '../../../store/session.js';
import { StatusBadge } from '../../components/StatusBadge.js';

const FILTERS = ['all', 'tool:registered', 'tool:invoked', 'tool:result', 'consent:requested', 'error'] as const;
type Filter = (typeof FILTERS)[number];

/**
 * Chronological, filterable event log at the bottom of the Debugger. Color-coded
 * by severity; supports freeze-frame diffing (compare current timeline to a
 * captured snapshot).
 */
export function Timeline({
  events,
  snapshots,
  onDiff,
}: {
  events: McpEvent[];
  snapshots: Record<string, McpEvent[]>;
  onDiff: (name: string | null) => void;
}) {
  const [filter, setFilter] = useState<Filter>('all');
  const [diffBase, setDiffBase] = useState<string | null>(null);
  const toast = useSession((s) => s.toast);

  const filtered = useMemo(
    () => (filter === 'all' ? events : events.filter((e) => e.type === filter)),
    [events, filter],
  );

  const diff = useMemo(() => {
    if (!diffBase || !snapshots[diffBase]) return null;
    const baseIds = new Set(snapshots[diffBase].map((e) => e.id));
    return filtered.filter((e) => !baseIds.has(e.id));
  }, [diffBase, snapshots, filtered]);

  const shown = diff ?? filtered;

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-1 px-2 py-1.5 border-b border-base-800 shrink-0 overflow-x-auto">
        <span className="text-2xs uppercase tracking-wider text-zinc-500 mr-1">Timeline</span>
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-1.5 py-0.5 rounded text-2xs font-mono ${
              filter === f ? 'bg-accent/15 text-white' : 'text-base-500 hover:bg-base-800'
            }`}
          >
            {f}
          </button>
        ))}
        <div className="flex-1" />
        {Object.keys(snapshots).length > 0 && (
          <select
            className="input py-0.5 text-2xs w-32"
            value={diffBase ?? ''}
            onChange={(e) => {
              setDiffBase(e.target.value || null);
              onDiff(e.target.value || null);
            }}
          >
            <option value="">No diff</option>
            {Object.keys(snapshots).map((n) => (
              <option key={n} value={n}>
                diff vs {n}
              </option>
            ))}
          </select>
        )}
        <button
          className="btn py-0.5 px-1.5 text-2xs"
          onClick={() => toast('info', `${shown.length} event(s) shown.`)}
        >
          {shown.length}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto font-mono text-xs">
        {shown.length === 0 && (
          <div className="h-full flex items-center justify-center text-base-500">
            {diff ? 'No new events since the selected freeze-frame.' : 'No events yet.'}
          </div>
        )}
        {shown
          .slice()
          .reverse()
          .map((e) => {
            const sev = severityOf(e);
            const label = describe(e);
            return (
              <div
                key={e.id}
                className="px-2 py-1 flex items-start gap-2 border-b border-base-850/60 hover:bg-base-850"
              >
                <span className="text-base-500 shrink-0 w-20">
                  {new Date(e.at).toLocaleTimeString([], { hour12: false })}
                </span>
                <StatusBadge status={sev === 'success' ? 'pass' : sev === 'error' ? 'fail' : sev === 'warning' ? 'warn' : 'info'} />
                <span className="text-zinc-300 flex-1 break-all">{label}</span>
              </div>
            );
          })}
      </div>
    </div>
  );
}

/** Human-readable one-liner for an event. */
function describe(e: McpEvent): string {
  switch (e.type) {
    case 'tool:registered':
      return `+ ${e.tool.name} registered (${e.tool.source})`;
    case 'tool:unregistered':
      return `- ${e.toolName} unregistered`;
    case 'tool:invoked':
      return `→ ${e.toolName} invoked · ${JSON.stringify(e.input)}`;
    case 'tool:result':
      return `← ${e.result.toolName} ${e.result.status} (${e.result.durationMs}ms)${
        e.result.errorMessage ? ` · ${e.result.errorMessage}` : ''
      }`;
    case 'consent:requested':
      return `◌ ${e.toolName} requests consent: "${e.message}"`;
    case 'consent:resolved':
      return `◌ ${e.toolName} consent ${e.granted ? 'granted ✓' : 'denied ✕'}`;
    case 'error':
      return `✕ ${e.toolName ?? 'page'}: ${e.message} [${e.category}]`;
  }
}
