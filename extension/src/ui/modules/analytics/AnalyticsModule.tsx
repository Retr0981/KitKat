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
import { useSession } from '../../../store/session.js';

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
 * Analytics module — reads from the local server and renders usage/perf charts.
 * Skeleton scope: aggregate dashboard + per-tool breakdown; the per-page
 * drilldown and alerting are flagged enhancements. Falls back to the in-session
 * event stream when the server isn't running so the module is never empty.
 */
export function AnalyticsModule() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [serverUp, setServerUp] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const events = useSession((s) => s.events);

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

  if (loading) return <div className="h-full flex items-center justify-center text-zinc-500 text-sm">Loading analytics…</div>;

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4 bg-base-950">
      {!serverUp && (
        <div className="panel px-3 py-2 text-sm text-warn flex items-center gap-2">
          <span>⚠</span>
          <span>
            Analytics server not reachable at <code className="font-mono">{SERVER}</code>. Showing in-session
            data only. Start it with <code className="font-mono">npm run server</code>.
          </span>
        </div>
      )}
      {stats && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard label="Registrations" value={stats.totalRegistrations} />
            <KpiCard label="Invocations" value={stats.invocations} />
            <KpiCard label="Success rate" value={`${stats.successRate.toFixed(1)}%`} accent={stats.successRate > 90 ? 'ok' : 'warn'} />
            <KpiCard label="Avg duration" value={`${stats.avgDurationMs.toFixed(0)}ms`} />
          </div>

          <div className="grid md:grid-cols-2 gap-3">
            <ChartCard title="Invocations vs errors (bucketed)">
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={stats.series}>
                  <defs>
                    <linearGradient id="inv" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6366f1" stopOpacity={0.6} />
                      <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="bucket" tick={{ fill: '#71717a', fontSize: 10 }} />
                  <YAxis tick={{ fill: '#71717a', fontSize: 10 }} allowDecimals={false} />
                  <RTooltip contentStyle={tooltipStyle} />
                  <Area type="monotone" dataKey="invocations" stroke="#6366f1" fill="url(#inv)" />
                  <Area type="monotone" dataKey="errors" stroke="#ef4444" fill="#ef444433" />
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Error breakdown">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={stats.errorBreakdown} dataKey="count" nameKey="category" cx="50%" cy="50%" outerRadius={70}>
                    {stats.errorBreakdown.map((e) => (
                      <Cell key={e.category} fill={ERROR_COLORS[e.category] ?? '#71717a'} />
                    ))}
                  </Pie>
                  <RTooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          <ChartCard title="Most-used tools">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={stats.topTools} layout="vertical">
                <XAxis type="number" tick={{ fill: '#71717a', fontSize: 10 }} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={{ fill: '#a1a1aa', fontSize: 11 }} width={140} />
                <RTooltip contentStyle={tooltipStyle} />
                <Bar dataKey="count" fill="#6366f1" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </>
      )}
    </div>
  );
}

const tooltipStyle = {
  background: '#141821',
  border: '1px solid #323a4a',
  borderRadius: 6,
  fontSize: 12,
  color: '#e4e4e7',
} as const;

const ERROR_COLORS: Record<string, string> = {
  schema: '#eab308',
  permission: '#3b82f6',
  timeout: '#a855f7',
  execution: '#ef4444',
  unknown: '#71717a',
};

function KpiCard({ label, value, accent }: { label: string; value: string | number; accent?: 'ok' | 'warn' }) {
  const color = accent === 'ok' ? 'text-ok' : accent === 'warn' ? 'text-warn' : 'text-white';
  return (
    <div className="panel p-3">
      <div className="text-2xs uppercase tracking-wider text-zinc-500">{label}</div>
      <div className={`text-2xl font-semibold mt-1 ${color}`}>{value}</div>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="panel p-3">
      <h3 className="text-xs uppercase tracking-wider text-zinc-400 mb-2">{title}</h3>
      {children}
    </div>
  );
}

/** Fallback aggregator when the server is offline — uses the live event stream. */
function deriveFromSession(events: import('@kitkat/core').McpEvent[]): Stats {
  const registrations = events.filter((e) => e.type === 'tool:registered').length;
  const results = events.filter((e) => e.type === 'tool:result').map((e) => (e.type === 'tool:result' ? e.result : null)).filter(Boolean);
  const invocations = results.length;
  const successes = results.filter((r) => r!.status === 'success').length;
  const errors = results.filter((r) => r!.status !== 'success').length;
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
    errorBreakdown: [{ category: 'execution', count: errors }],
    series: [],
  };
}
