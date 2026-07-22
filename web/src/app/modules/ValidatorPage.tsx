import { useMemo, useState } from 'react';
import { reportToMarkdown, minimalValidInput, type ToolReport } from '@kitkat/core';
import { Badge, Button, EmptyState, Panel, SplitPane, TitledPanel, toneFor, ConceptTooltip } from '@kitkat/ui';
import { useBackend } from '../backend/context.js';
import { useWebSession } from '../store.js';
import { SchemaViewer } from '../components/SchemaViewer.js';

/**
 * Redesigned Validator — three-pane: tools → contract → report.
 * Reads tools from the active backend and runs the @kitkat/core suite.
 */
export function ValidatorPage() {
  const backend = useBackend();
  const tools = useWebSession((s) => s.tools);
  const reports = useWebSession((s) => s.reports);
  const setReports = useWebSession((s) => s.setReports);
  const toast = useWebSession((s) => s.toast);
  const [selected, setSelected] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);

  const selectedTool = tools.find((t) => t.name === selected) ?? null;
  const selectedReport = reports.find((r) => r.tool.name === selected) ?? null;

  const runSuite = async () => {
    if (!tools.length) {
      toast('warn', 'No tools loaded — define or load some first.');
      return;
    }
    setRunning(true);
    setProgress(0);
    const start = performance.now();
    try {
      // Run progressively so the progress bar reflects reality.
      const out: ToolReport[] = [];
      for (let i = 0; i < tools.length; i++) {
        // backend.validate() runs all; for a live progress feel we slice.
        const slice = await backend.validate();
        out.push(...slice);
        setProgress(Math.round(((i + 1) / tools.length) * 100));
      }
      // Deduplicate by tool name (validate returns all each call).
      const seen = new Map<string, ToolReport>();
      for (const r of out) seen.set(r.tool.name, r);
      const all = [...seen.values()];
      setReports(all);
      const fails = all.filter((r) => r.status === 'fail').length;
      toast(
        fails === 0 ? 'ok' : 'warn',
        `Validated ${all.length} tool${all.length === 1 ? '' : 's'} in ${Math.round(performance.now() - start)}ms — ${fails} failing.`,
      );
    } catch (err) {
      toast('bad', `Validation failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setRunning(false);
    }
  };

  const stats = useMemo(() => {
    const total = reports.length;
    return {
      total,
      pass: reports.filter((r) => r.status === 'pass').length,
      warn: reports.filter((r) => r.status === 'warn').length,
      fail: reports.filter((r) => r.status === 'fail').length,
    };
  }, [reports]);

  if (!tools.length) {
    return (
      <EmptyState
        icon="✓"
        title="No tools to validate yet"
        action={<Button variant="primary" onClick={runSuite}>Run validation</Button>}
      >
        Load a demo, paste a URL, or define tools in the inline editor. Detected tools appear here, ready for the
        five-category suite.
      </EmptyState>
    );
  }

  return (
    <SplitPane
      left={
        <div className="h-full flex flex-col bg-surface-1">
          <div className="p-3 flex items-center gap-2 border-b border-border-subtle">
            <Button variant="primary" size="sm" onClick={runSuite} loading={running}>
              {!running && '▶'} Run validation
            </Button>
            <div className="flex-1" />
            <Button
              size="sm"
              variant="ghost"
              disabled={!reports.length}
              onClick={() => download('kitkat-report.json', JSON.stringify(reports, null, 2))}
            >
              JSON
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={!reports.length}
              onClick={() => download('kitkat-report.md', reportToMarkdown(reports))}
            >
              Markdown
            </Button>
          </div>

          {running && (
            <div className="h-1 bg-surface-2 overflow-hidden">
              <div
                className="h-full transition-all duration-300"
                style={{ width: `${progress}%`, background: 'linear-gradient(90deg, var(--accent), var(--teal))' }}
              />
            </div>
          )}

          {reports.length > 0 && (
            <div className="px-3 py-2 flex items-center gap-2 border-b border-border-subtle">
              <span className="text-xs text-content-tertiary">{stats.total} tools</span>
              <Badge tone="ok">{stats.pass} pass</Badge>
              {stats.warn > 0 && <Badge tone="warn">{stats.warn} warn</Badge>}
              {stats.fail > 0 && <Badge tone="bad">{stats.fail} fail</Badge>}
            </div>
          )}

          <div className="flex-1 overflow-y-auto">
            {tools.map((t) => {
              const r = reports.find((x) => x.tool.name === t.name);
              const on = selected === t.name;
              return (
                <button
                  key={t.name}
                  onClick={() => setSelected(t.name)}
                  className={`w-full text-left px-3 py-2.5 border-b border-border-subtle transition-colors hover:bg-surface-2 ${on ? 'bg-accent-soft' : ''}`}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm text-content-primary flex-1 truncate">{t.name}</span>
                    {r ? (
                      <Badge tone={toneFor(r.status)}>{r.status}</Badge>
                    ) : (
                      <Badge tone="neutral">pending</Badge>
                    )}
                  </div>
                  <div className="text-xs text-content-tertiary truncate mt-0.5">
                    {t.description || 'no description'}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      }
      right={
        <div className="h-full overflow-y-auto bg-surface-0">
          {!selectedTool ? (
            <div className="h-full flex items-center justify-center text-sm text-content-tertiary">
              Select a tool to inspect its contract and report.
            </div>
          ) : (
            <div className="p-5 space-y-4 max-w-content">
              <Panel className="p-4">
                <div className="flex items-center gap-2 mb-1.5">
                  <h2 className="font-mono text-lg text-content-primary">{selectedTool.name}</h2>
                  <Badge tone="info">{selectedTool.source}</Badge>
                  {selectedTool.annotations?.readOnlyHint && <Badge tone="ok">read-only</Badge>}
                </div>
                <p className="text-sm text-content-secondary">
                  {selectedTool.description || <span className="italic text-content-tertiary">No description.</span>}
                </p>
              </Panel>

              <TitledPanel
                title={
                  <ConceptTooltip term="inputSchema" explain="A JSON Schema describing the tool's input. Agents validate calls against it before invoking.">
                    inputSchema
                  </ConceptTooltip>
                }
                subtitle={`${Object.keys((selectedTool.inputSchema?.properties as object) ?? {}).length} parameters`}
              >
                <div className="h-56">
                  <SchemaViewer value={selectedTool.inputSchema ?? {}} />
                </div>
              </TitledPanel>

              {selectedReport ? (
                <ReportDetail report={selectedReport} />
              ) : (
                <Panel className="p-4 text-sm text-content-tertiary">
                  No report yet. Click <span className="text-accent">Run validation</span> to test this tool
                  across all five categories.
                  <div className="mt-2 text-xs text-content-muted font-mono">
                    example valid input: {JSON.stringify(minimalValidInput(selectedTool.inputSchema))}
                  </div>
                </Panel>
              )}
            </div>
          )}
        </div>
      }
    />
  );
}

function ReportDetail({ report }: { report: ToolReport }) {
  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2">
        <h3 className="text-xs uppercase tracking-wider text-content-tertiary font-semibold">Report</h3>
        <Badge tone={toneFor(report.status)}>{report.status}</Badge>
        <span className="text-xs text-content-muted ml-auto">{report.durationMs}ms</span>
      </div>
      {report.categories.map((cat) => (
        <Panel key={cat.id} className="overflow-hidden">
          <div className="flex items-center gap-2 px-3.5 py-2.5 border-b border-border-subtle bg-surface-2">
            <Badge tone={toneFor(cat.status)}>{cat.status}</Badge>
            <span className="text-sm font-medium text-content-primary">{cat.label}</span>
            <span className="text-[0.7rem] text-content-muted ml-auto">{cat.durationMs}ms</span>
          </div>
          <ul className="divide-y divide-border-subtle">
            {cat.checks.map((c) => (
              <li key={c.id} className="px-3.5 py-2.5 text-sm">
                <div className="flex items-start gap-2">
                  <span className={`mt-0.5 text-xs ${c.status === 'pass' ? 'text-ok' : c.status === 'warn' ? 'text-warn' : 'text-bad'}`}>
                    {c.status === 'pass' ? '✓' : c.status === 'warn' ? '⚠' : '✕'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-content-primary">{c.label}</div>
                    {c.message && <div className="text-xs text-content-tertiary mt-0.5">{c.message}</div>}
                    {c.fix && (
                      <div className="text-xs text-warn mt-1 flex items-start gap-1.5 bg-warn-soft -mx-1 px-2 py-1 rounded">
                        <span className="opacity-70">→ fix</span>
                        <span className="flex-1">{c.fix}</span>
                      </div>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      ))}
    </div>
  );
}

function download(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
