import { useMemo, useState } from 'react';
import {
  reportToMarkdown,
  validateAll,
  minimalValidInput,
  type ToolReport,
  type InvokeFn,
} from '@kitkat/core';
import { useSession } from '../../../store/session.js';
import { sendBg } from '../../../messaging/ports.js';
import { ResizablePanels } from '../../components/ResizablePanels.js';
import { StatusBadge } from '../../components/StatusBadge.js';
import { SchemaViewer } from '../../components/SchemaViewer.js';
import { ConceptTooltip } from '../../components/ConceptTooltip.js';
import { EmptyState } from './EmptyState.js';

/**
 * Validator module — KitKat's primary surface.
 *
 * Detects tools on the active tab, runs the five-category validation suite, and
 * renders a pass/fail report with fix suggestions + JSON/Markdown export.
 */
export function ValidatorModule() {
  const tools = useSession((s) => s.tools);
  const tabId = useSession((s) => s.activeTabId);
  const reports = useSession((s) => s.reports);
  const setReports = useSession((s) => s.setReports);
  const toast = useSession((s) => s.toast);
  const [selected, setSelected] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  const selectedTool = tools.find((t) => t.name === selected) ?? null;
  const selectedReport = reports.find((r) => r.tool.name === selected) ?? null;

  /** Build an invoker that runs the tool in the page via the content relay. */
  const makeInvoker = (): InvokeFn => async (name, input) => {
    if (tabId == null) throw new Error('No active tab');
    const res = await sendBg({ kind: 'ui:invoke', tabId, toolName: name, input });
    if (!res.ok) throw new Error(res.error ?? 'Invocation failed');
    return res.output as any;
  };

  /** Consent probe for the security category. */
  const consentProbe = async () => ({ requested: false });

  /** Run the full suite across every detected tool. */
  const runSuite = async () => {
    if (tools.length === 0) {
      toast('warning', 'No tools detected on this page.');
      return;
    }
    setRunning(true);
    const start = performance.now();
    try {
      const invoke = makeInvoker();
      const all = await validateAll(tools, { invoke, consentProbe });
      setReports(all);
      const fails = all.filter((r) => r.status === 'fail').length;
      toast(
        fails === 0 ? 'success' : 'warning',
        `Validated ${all.length} tool(s) in ${Math.round(performance.now() - start)}ms — ${fails} failing.`,
      );
    } catch (err) {
      toast('error', `Validation failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setRunning(false);
    }
  };

  const exportJson = () => {
    download('kitkat-validation.json', JSON.stringify(reports, null, 2));
    toast('success', 'Exported JSON report.');
  };
  const exportMd = () => {
    download('kitkat-validation.md', reportToMarkdown(reports));
    toast('success', 'Exported Markdown report.');
  };

  const stats = useMemo(() => {
    const total = reports.length;
    const pass = reports.filter((r) => r.status === 'pass').length;
    const fail = reports.filter((r) => r.status === 'fail').length;
    const warn = reports.filter((r) => r.status === 'warn').length;
    return { total, pass, fail, warn };
  }, [reports]);

  if (tools.length === 0) return <EmptyState />;

  return (
    <ResizablePanels
      left={
        <div className="h-full flex flex-col bg-base-900">
          <div className="p-3 border-b border-base-700 flex items-center gap-2">
            <button className="btn btn-primary" onClick={runSuite} disabled={running}>
              {running ? 'Running…' : '▶ Run validation'}
            </button>
            <div className="flex-1" />
            <button className="btn" onClick={exportJson} disabled={!reports.length} title="Export JSON">
              {'{ } JSON'}
            </button>
            <button className="btn" onClick={exportMd} disabled={!reports.length} title="Export Markdown">
              M↓
            </button>
          </div>

          {reports.length > 0 && (
            <div className="px-3 py-2 border-b border-base-700 flex items-center gap-3 text-xs text-zinc-400">
              <span>{stats.total} tools</span>
              <StatusBadge status="pass" label={`${stats.pass} pass`} />
              {stats.warn > 0 && <StatusBadge status="warn" label={`${stats.warn} warn`} />}
              {stats.fail > 0 && <StatusBadge status="fail" label={`${stats.fail} fail`} />}
            </div>
          )}

          <div className="flex-1 overflow-y-auto">
            {tools.map((t) => {
              const r = reports.find((x) => x.tool.name === t.name);
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
                    {r && <StatusBadge status={r.status} />}
                  </div>
                  <div className="text-xs text-zinc-500 truncate mt-0.5">{t.description || 'no description'}</div>
                  <div className="text-2xs text-base-500 mt-1 font-mono">
                    {t.source} · {Object.keys((t.inputSchema?.properties as object) ?? {}).length} params
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      }
      right={
        <div className="h-full overflow-y-auto bg-base-950">
          {!selectedTool && (
            <div className="h-full flex items-center justify-center text-zinc-500 text-sm">
              Select a tool to inspect its contract, or run the full validation suite.
            </div>
          )}
          {selectedTool && (
            <div className="p-5 space-y-5">
              <ContractView name={selectedTool.name} description={selectedTool.description} source={selectedTool.source} annotations={selectedTool.annotations} />
              <section>
                <h3 className="text-xs uppercase tracking-wider text-zinc-400 mb-2">
                  <ConceptTooltip term="inputSchema" explain="A JSON Schema describing the tool's input object. Agents validate calls against it before invoking." >
                    inputSchema
                  </ConceptTooltip>
                </h3>
                <div className="panel h-64">
                  <SchemaViewer value={selectedTool.inputSchema ?? {}} />
                </div>
              </section>
              {selectedReport ? (
                <ReportView report={selectedReport} invoke={makeInvoker()} />
              ) : (
                <div className="panel p-4 text-sm text-zinc-400">
                  No report yet. Click <span className="text-accent">Run validation</span> to test this tool.
                  <div className="mt-3 text-xs text-base-500">
                    Example valid input: <code className="font-mono text-zinc-300">{JSON.stringify(minimalValidInput(selectedTool.inputSchema))}</code>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      }
    />
  );
}

function ContractView(props: { name: string; description: string; source: string; annotations?: Record<string, unknown> }) {
  return (
    <section className="panel p-4">
      <div className="flex items-center gap-2 mb-1">
        <h2 className="font-mono text-lg text-white">{props.name}</h2>
        <StatusBadge status="info" label={props.source} />
        {props.annotations?.readOnlyHint === true && <StatusBadge status="pass" label="read-only" />}
      </div>
      <p className="text-sm text-zinc-300">{props.description || <span className="text-zinc-500 italic">No description.</span>}</p>
    </section>
  );
}

function ReportView({ report, invoke }: { report: ToolReport; invoke: InvokeFn }) {
  const [output, setOutput] = useState<unknown>(null);
  const [trying, setTrying] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const tryIt = async () => {
    setTrying(true);
    setErr(null);
    try {
      const input = minimalValidInput(report.tool.inputSchema);
      setOutput(await invoke(report.tool.name, input));
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setTrying(false);
    }
  };

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <h3 className="text-xs uppercase tracking-wider text-zinc-400">Validation report</h3>
        <StatusBadge status={report.status} label={`${report.status} · ${report.durationMs}ms`} />
      </div>

      {report.categories.map((cat) => (
        <div key={cat.id} className="panel overflow-hidden">
          <div className="px-3 py-2 flex items-center gap-2 border-b border-base-800 bg-base-850">
            <StatusBadge status={cat.status} />
            <span className="text-sm font-medium text-zinc-200">{cat.label}</span>
            <span className="text-2xs text-base-500 ml-auto">{cat.durationMs}ms</span>
          </div>
          <ul className="divide-y divide-base-850">
            {cat.checks.map((c) => (
              <li key={c.id} className="px-3 py-2 text-sm">
                <div className="flex items-start gap-2">
                  <span className="font-mono text-xs mt-0.5">
                    {c.status === 'pass' ? '✓' : c.status === 'warn' ? '⚠' : '✕'}
                  </span>
                  <div className="flex-1">
                    <div className="text-zinc-200">{c.label}</div>
                    {c.message && <div className="text-xs text-zinc-400 mt-0.5">{c.message}</div>}
                    {c.fix && (
                      <div className="text-xs text-warn/90 mt-1 flex items-start gap-1">
                        <span>→</span>
                        <span>{c.fix}</span>
                      </div>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}

      <div className="panel p-3">
        <div className="flex items-center gap-2 mb-2">
          <h4 className="text-sm font-medium text-zinc-200">Try it</h4>
          <button className="btn" onClick={tryIt} disabled={trying}>
            {trying ? '…' : 'Invoke with valid input'}
          </button>
        </div>
        {err && <div className="text-xs text-bad font-mono mb-2">{err}</div>}
        {output !== null && (
          <pre className="text-xs font-mono text-ok bg-base-950 rounded p-2 overflow-x-auto max-h-40">{JSON.stringify(output, null, 2)}</pre>
        )}
      </div>
    </section>
  );
}

/** Trigger a browser download of a text blob. */
function download(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
