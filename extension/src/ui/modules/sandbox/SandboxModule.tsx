import { useEffect, useMemo, useState } from 'react';
import {
  PERSONAS,
  runSimulation,
  type Json,
  type JsonObject,
  type PersonaId,
  type SimulationResult,
  type TestingTool,
} from '@kitkat/core';
import { ResizablePanels } from '../../components/ResizablePanels.js';
import { StatusBadge } from '../../components/StatusBadge.js';
import { SchemaViewer } from '../../components/SchemaViewer.js';
import { ScenarioStore, type Scenario } from './scenarios.js';
import { PRESET_SCENARIOS } from './presets.js';

/**
 * Sandbox module — simulate agent interactions without deploying or needing a
 * real agent. Pick a scenario (or write your own), choose a persona + goal, and
 * watch the rule-based agent engine drive the 5-step workflow against the
 * polyfilled tool surface. Skeleton scope: scenario list/editor + runner; the
 * drag-and-drop flow builder is a flagged enhancement.
 */
export function SandboxModule() {
  const store = useMemo(() => new ScenarioStore(), []);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [persona, setPersona] = useState<PersonaId>('shopper');
  const [goal, setGoal] = useState('find a red dress and add it to cart');
  const [safeMode, setSafeMode] = useState(true);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    const all = [...PRESET_SCENARIOS, ...store.list()];
    setScenarios(all);
    if (all[0]) {
      setSelectedId(all[0].id);
      setGoal(all[0].goal);
      setPersona(all[0].persona);
    }
  }, [store]);

  const selected = scenarios.find((s) => s.id === selectedId) ?? null;

  const run = async () => {
    if (!selected) return;
    setRunning(true);
    setResult(null);
    // The runner iframe owns the polyfilled modelContext; we send it the tools
    // and goal, then collect the simulation trace. For the skeleton we run the
    // engine directly in-page with a safe-mode invoker.
    const invoke = makeSafeInvoker(selected.tools, safeMode);
    const res = await runSimulation({
      persona,
      goal,
      tools: selected.tools,
      invoke,
      params: selected.params,
    });
    setResult(res);
    setRunning(false);
  };

  return (
    <ResizablePanels
      left={
        <div className="h-full flex flex-col bg-base-900">
          <div className="p-2 border-b border-base-700 text-2xs uppercase tracking-wider text-zinc-500">
            Scenarios
          </div>
          <div className="flex-1 overflow-y-auto">
            {scenarios.map((s) => (
              <button
                key={s.id}
                onClick={() => {
                  setSelectedId(s.id);
                  setGoal(s.goal);
                  setPersona(s.persona);
                }}
                className={`w-full text-left px-3 py-2 border-b border-base-850 hover:bg-base-850 ${
                  selectedId === s.id ? 'bg-accent/10 border-l-2 border-l-accent' : ''
                }`}
              >
                <div className="text-sm text-zinc-100">{s.name}</div>
                <div className="text-2xs text-base-500 mt-0.5">{s.tools.length} tools · {s.persona}</div>
              </button>
            ))}
          </div>
          <button
            className="btn m-2"
            onClick={() => {
              const s = store.create('Untitled scenario');
              setScenarios((p) => [...p, s]);
              setSelectedId(s.id);
            }}
          >
            + New scenario
          </button>
        </div>
      }
      right={
        <div className="h-full overflow-y-auto p-4 bg-base-950 space-y-4">
          {selected && (
            <>
              <section className="panel p-3 space-y-2">
                <input
                  className="input w-full"
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  placeholder="Agent goal, e.g. 'find a red dress and add it to cart'"
                />
                <div className="flex items-center gap-2 flex-wrap">
                  <select className="input" value={persona} onChange={(e) => setPersona(e.target.value as PersonaId)}>
                    {Object.values(PERSONAS).map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                  <label className="text-xs text-zinc-400 flex items-center gap-1">
                    <input type="checkbox" checked={safeMode} onChange={(e) => setSafeMode(e.target.checked)} />
                    Safe mode (mock returns)
                  </label>
                  <div className="flex-1" />
                  <button className="btn btn-primary" onClick={run} disabled={running}>
                    {running ? 'Simulating…' : '▶ Simulate agent'}
                  </button>
                </div>
              </section>

              <section>
                <h3 className="text-xs uppercase tracking-wider text-zinc-400 mb-2">Mock page tools ({selected.tools.length})</h3>
                <div className="panel h-48">
                  <SchemaViewer value={selected.tools} />
                </div>
              </section>

              {result && <SimulationTrace result={result} />}
            </>
          )}
        </div>
      }
    />
  );
}

/** Render the agent's 5-step reasoning trace. */
function SimulationTrace({ result }: { result: SimulationResult }) {
  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2">
        <h3 className="text-xs uppercase tracking-wider text-zinc-400">Agent trace</h3>
        <StatusBadge
          status={result.outcome === 'success' ? 'pass' : result.outcome === 'partial' ? 'warn' : 'fail'}
          label={result.outcome}
        />
        <span className="text-2xs text-base-500">{result.steps.length} steps · invoked {result.invoked.join(', ') || '—'}</span>
      </div>
      <div className="space-y-1">
        {result.steps.map((s, i) => (
          <div key={i} className="panel px-3 py-2 flex items-start gap-2 animate-fade-in">
            <StatusBadge status={s.phase === 'invoke' && s.result?.status === 'error' ? 'fail' : 'info'} label={s.phase} />
            <span className="text-xs text-zinc-300 flex-1">{s.narration}</span>
            {s.decision && <StatusBadge status="warn" label={s.decision} />}
          </div>
        ))}
      </div>
    </section>
  );
}

/** Build a safe-mode invoker that returns deterministic mocks based on schema. */
function makeSafeInvoker(tools: TestingTool[], _safeMode: boolean): (name: string, input: import('@kitkat/core').JsonObject) => Promise<import('@kitkat/core').Json> {
  return async (name, input): Promise<Json> => {
    const tool = tools.find((t) => t.name === name);
    if (!tool) throw new Error(`Unknown tool ${name}`);
    // Pretend a search returns results, a mutation returns ok.
    if (tool.annotations?.readOnlyHint) {
      const out: JsonObject = { results: [{ id: 'p1', name: 'Mock result', echo: input }] };
      return out;
    }
    const out: JsonObject = { ok: true, echo: input };
    return out;
  };
}
