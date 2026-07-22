import { useEffect, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { McpEvent } from '@kitkat/core';
import { EmptyState, Panel, Spinner } from '@kitkat/ui';
import { useBackend } from '../backend/context.js';
import { useWebSession } from '../store.js';

const SERVER = 'http://localhost:7421';

interface Stats {
  totalEvents: number;
  totalRegistrations: number;
  invocations: number;
  successRate: number;
  errorRate: number;
  avgDurationMs: number;
  topTools: { name: string; count: number }[];
  errorBreakdown: { category: string; count: number }[];
  series: { bucket: string; invocations: number; errors: number }[];
}

/**
 * Redesigned Analytics dashboard. Reads from the local server with an
 * in-session fallback so it's never empty.
 */
export function AnalyticsPage() {
  const backend = useBackend();
  const events = useWebSession((s) => s.events);
  const [stats, setStats] = useState<Stats | null>(null);
  const [serverUp, setServerUp] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`${SERVER}/stats`);
        if (!res.ok) throw new Error(`status ${res.status}`);
        const data = (await res.json()) as Stats;
        if (!cancelled) {
          setStats(data);
          setServerUp(true);
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setServerUp(false);
          setStats(deriveFromSession(events));
          setLoading(false);
        }
      }
    };
    load();
    const t = setInterval(load, 4000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [events]);

  if (loading)
    return (
      <div className="h-full flex items-center justify-center text-content-tertiary">
        <Spinner /> <span className="ml-2 text-sm">Loading analytics…</span>
      </div>
    );

  void backend;

  return (
    <div className="h-full overflow-y-auto p-5 space-y-4 bg-surface-0">
      {!serverUp && (
        <Panel className="px-3.5 py-2.5 text-sm text-warn flex items-center gap-2 border-l-2">
          <span>⚠</span>
          <span>
            Analytics server not reachable at <code className="font-mono">{SERVER}</code>. Showing in-session data
            only. Start it with <code className="font-mono">npm run server</code> for full history.
          </span>
        </Panel>
      )}
      {stats && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Kpi label="Registrations" value={stats.totalRegistrations} />
            <Kpi label="Invocations" value={stats.invocations} />
            <Kpi label="Success rate" value={`${stats.successRate.toFixed(1)}%`} tone={stats.successRate > 90 ? 'ok' : 'warn'} />
            <Kpi label="Avg duration" value={`${stats.avgDurationMs.toFixed(0)}ms`} />
          </div>

          <div className="grid lg:grid-cols-2 gap-3">
            <Chart title="Invocations vs errors">
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={stats.series}>
                  <defs>
                    <linearGradient id="g-inv" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6366f1" stopOpacity={0.6} />
                      <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="bucket" tick={{ fill: '#71717a', fontSize: 10 }} />
                  <YAxis tick={{ fill: '#71717a', fontSize: 10 }} allowDecimals={false} />
                  <RTooltip contentStyle={tooltipStyle} />
                  <Area type="monotone" dataKey="invocations" stroke="#6366f1" fill="url(#g-inv)" strokeWidth={2} />
                  <Area type="monotone" dataKey="errors" stroke="#ef4444" fill="#ef444433" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </Chart>
            <Chart title="Error breakdown">
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={stats.errorBreakdown} dataKey="count" nameKey="category" cx="50%" cy="50%" outerRadius={75} innerRadius={45} paddingAngle={2}>
                    {stats.errorBreakdown.map((e) => (
                      <Cell key={e.category} fill={ERR_COLORS[e.category] ?? '#71717a'} />
                    ))}
                  </Pie>
                  <RTooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            </Chart>
          </div>

          <Chart title="Most-used tools">
            {stats.topTools.length === 0 ? (
              <EmptyState title="No tool usage yet">Invoke some tools to populate usage stats.</EmptyState>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={stats.topTools} layout="vertical">
                  <XAxis type="number" tick={{ fill: '#71717a', fontSize: 10 }} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" tick={{ fill: '#a1a1aa', fontSize: 11 }} width={150} />
                  <RTooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="count" fill="#6366f1" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Chart>
        </>
      )}
    </div>
  );
}

const tooltipStyle = { background: '#151a23', border: '1px solid #2a3340', borderRadius: 8, fontSize: 12, color: '#e4e4e7' } as const;
const ERR_COLORS: Record<string, string> = {
  schema: '#eab308',
  permission: '#3b82f6',
  timeout: '#a855f7',
  execution: '#ef4444',
  unknown: '#71717a',
};

function Kpi({ label, value, tone }: { label: string; value: string | number; tone?: 'ok' | 'warn' }) {
  const color = tone === 'ok' ? 'var(--ok)' : tone === 'warn' ? 'var(--warn)' : 'var(--text-primary)';
  return (
    <Panel className="p-3.5" raised>
      <div className="text-2xs uppercase tracking-wider text-content-muted font-semibold">{label}</div>
      <div className="text-2xl font-semibold mt-1.5" style={{ color }}>
        {value}
      </div>
    </Panel>
  );
}

function Chart({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Panel className="p-3.5">
      <h3 className="text-xs uppercase tracking-wider text-content-tertiary font-semibold mb-3">{title}</h3>
      {children}
    </Panel>
  );
}

function deriveFromSession(events: McpEvent[]): Stats {
  const registrations = events.filter((e) => e.type === 'tool:registered').length;
  const results = events.filter((e) => e.type === 'tool:result').map((e) => (e.type === 'tool:result' ? e.result : null)).filter(Boolean);
  const invocations = results.length;
  const successes = results.filter((r) => r!.status === 'success').length;
  const errors = invocations - successes;
  const avg = invocations ? results.reduce((s, r) => s + r!.durationMs, 0) / invocations : 0;
  const counts = new Map<string, number>();
  for (const r of results) counts.set(r!.toolName, (counts.get(r!.toolName) ?? 0) + 1);
  const topTools = [...counts.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 8);
  return {
    totalEvents: events.length,
    totalRegistrations: registrations,
    invocations,
    successRate: invocations ? (successes / invocations) * 100 : 100,
    errorRate: invocations ? (errors / invocations) * 100 : 0,
    avgDurationMs: avg,
    topTools,
    errorBreakdown: errors ? [{ category: 'execution', count: errors }] : [],
    series: [],
  };
}
