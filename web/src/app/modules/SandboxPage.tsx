import { useMemo, useState } from 'react';
import {
  PERSONAS,
  runSimulation,
  type PersonaId,
  type SimulationResult,
  type TestingTool,
  type Json,
  type JsonObject,
} from '@kitkat/core';
import { Badge, Button, EmptyState, Input, Panel, Select, SplitPane, toneFor } from '@kitkat/ui';
import { useWebSession } from '../store.js';
import { PRESET_SCENARIOS } from './scenarios.js';

/**
 * Redesigned Sandbox — pick a preset scenario + persona + goal, run the
 * rule-based agent engine, and watch the 5-step workflow unfold. No AI, fully
 * offline. Uses the in-memory safe-mode invoker.
 */
export function SandboxPage() {
  const toast = useWebSession((s) => s.toast);
  const [scenarioId, setScenarioId] = useState(PRESET_SCENARIOS[0]!.id);
  const [persona, setPersona] = useState<PersonaId>('shopper');
  const [goal, setGoal] = useState(PRESET_SCENARIOS[0]!.goal);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [running, setRunning] = useState(false);

  const scenario = useMemo(() => PRESET_SCENARIOS.find((s) => s.id === scenarioId)!, [scenarioId]);

  const run = async () => {
    setRunning(true);
    setResult(null);
    try {
      const res = await runSimulation({
        persona,
        goal,
        tools: scenario.tools,
        invoke: makeSafeInvoker(scenario.tools),
        params: scenario.params,
      });
      setResult(res);
      toast(res.outcome === 'success' ? 'ok' : res.outcome === 'partial' ? 'warn' : 'bad', `Simulation ${res.outcome}`);
    } catch (err) {
      toast('bad', `Simulation failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setRunning(false);
    }
  };

  return (
    <SplitPane
      left={
        <div className="h-full flex flex-col bg-surface-1">
          <div className="px-3 py-2 border-b border-border-subtle text-2xs uppercase tracking-wider text-content-muted font-semibold">
            Scenarios
          </div>
          <div className="flex-1 overflow-y-auto">
            {PRESET_SCENARIOS.map((s) => {
              const on = s.id === scenarioId;
              return (
                <button
                  key={s.id}
                  onClick={() => {
                    setScenarioId(s.id);
                    setGoal(s.goal);
                    setPersona(s.persona);
                    setResult(null);
                  }}
                  className={`w-full text-left px-3 py-2.5 border-b border-border-subtle transition-colors hover:bg-surface-2 ${on ? 'bg-accent-soft' : ''}`}
                >
                  <div className="text-sm text-content-primary">{s.name}</div>
                  <div className="text-2xs text-content-muted mt-0.5">
                    {s.tools.length} tools · {s.persona}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      }
      right={
        <div className="h-full overflow-y-auto p-4 bg-surface-0 space-y-4">
          <Panel className="p-3.5 space-y-2.5">
            <Input value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="Agent goal…" />
            <div className="flex items-center gap-2 flex-wrap">
              <Select value={persona} onChange={(e) => setPersona(e.target.value as PersonaId)} className="w-auto">
                {Object.values(PERSONAS).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </Select>
              <div className="flex-1" />
              <Button variant="primary" onClick={run} loading={running}>
                {!running && '▶'} Simulate agent
              </Button>
            </div>
          </Panel>

          <Panel className="overflow-hidden">
            <div className="px-3.5 py-2 border-b border-border-subtle bg-surface-2 text-xs uppercase tracking-wider text-content-tertiary font-semibold">
              Mock page tools ({scenario.tools.length})
            </div>
            <div className="p-2 space-y-1 font-mono text-xs">
              {scenario.tools.map((t) => (
                <div key={t.name} className="flex items-center gap-2 px-2 py-1">
                  <Badge tone={t.annotations?.readOnlyHint ? 'ok' : 'neutral'}>
                    {t.annotations?.readOnlyHint ? 'read' : 'write'}
                  </Badge>
                  <span className="text-content-primary">{t.name}</span>
                  <span className="text-content-muted truncate">{t.description}</span>
                </div>
              ))}
            </div>
          </Panel>

          {result ? <Trace result={result} /> : !running && (
            <EmptyState icon="⬡" title="Run a simulation">
              Pick a persona and goal, then simulate an agent driving these tools through the 5-step workflow — no AI
              required.
            </EmptyState>
          )}
        </div>
      }
    />
  );
}

function Trace({ result }: { result: SimulationResult }) {
  return (
    <Panel className="p-3.5 space-y-2">
      <div className="flex items-center gap-2">
        <h3 className="text-xs uppercase tracking-wider text-content-tertiary font-semibold">Agent trace</h3>
        <Badge tone={toneFor(result.outcome === 'success' ? 'pass' : result.outcome === 'partial' ? 'warn' : 'fail')}>
          {result.outcome}
        </Badge>
        <span className="text-2xs text-content-muted ml-auto">
          {result.steps.length} steps · {result.invoked.join(' → ') || 'nothing invoked'}
        </span>
      </div>
      <div className="space-y-1.5">
        {result.steps.map((s, i) => (
          <div key={i} className="flex items-start gap-2.5 px-2.5 py-2 rounded bg-surface-2 animate-fade-in">
            <Badge tone={s.phase === 'invoke' && s.result?.status === 'error' ? 'bad' : 'info'}>
              {i + 1}. {s.phase}
            </Badge>
            <span className="text-xs text-content-secondary flex-1 mt-0.5">{s.narration}</span>
            {s.decision && <Badge tone="warn">{s.decision}</Badge>}
          </div>
        ))}
      </div>
    </Panel>
  );
}

function makeSafeInvoker(tools: TestingTool[]) {
  return async (name: string, input: JsonObject): Promise<Json> => {
    const tool = tools.find((t) => t.name === name);
    if (!tool) throw new Error(`Unknown tool ${name}`);
    const out: JsonObject = tool.annotations?.readOnlyHint
      ? { results: [{ id: 'mock-1', name: 'Mock result', echo: input }] }
      : { ok: true, echo: input };
    return out;
  };
}
