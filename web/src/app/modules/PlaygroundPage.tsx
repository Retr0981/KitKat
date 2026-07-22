import { useEffect, useMemo, useState } from 'react';
import type { JsonObject, JsonSchema } from '@kitkat/core';
import { Badge, Button, EmptyState, Field, Input, Panel, Select, SplitPane, TitledPanel, toneFor } from '@kitkat/ui';
import { useBackend } from '../backend/context.js';
import { useWebSession } from '../store.js';
import { SchemaViewer } from '../components/SchemaViewer.js';

/**
 * Playground — the Postman-for-WebMCP experience.
 *
 * Pick a tool → KitKat builds an input form straight from the tool's JSON Schema
 * → hit Send → the tool runs and the response appears. Exactly the Postman loop
 * (compose → send → inspect), but the "request" is a WebMCP tool invocation and
 * the "endpoint list" is the page's registered tools.
 *
 * Why this is the signature feature: it's the fastest way to manually exercise a
 * tool. The Validator batch-tests; the Sandbox simulates an agent; the
 * Playground is *you* driving, one call at a time.
 */
export function PlaygroundPage() {
  const backend = useBackend();
  const tools = useWebSession((s) => s.tools);
  const toast = useWebSession((s) => s.toast);
  const [selectedName, setSelectedName] = useState<string | null>(tools[0]?.name ?? null);
  const [input, setInput] = useState<Record<string, unknown>>({});
  const [response, setResponse] = useState<ResponseState | null>(null);
  const [sending, setSending] = useState(false);
  const [rawMode, setRawMode] = useState(false);
  const [rawText, setRawText] = useState('{}');
  const [showSchema, setShowSchema] = useState(false);

  const selectedTool = useMemo(
    () => tools.find((t) => t.name === selectedName) ?? null,
    [tools, selectedName],
  );

  // When the selected tool changes, reset the input to schema defaults + clear the response.
  useEffect(() => {
    setResponse(null);
    if (selectedTool?.inputSchema) {
      setInput(defaultsFromSchema(selectedTool.inputSchema));
      setRawText(JSON.stringify(defaultsFromSchema(selectedTool.inputSchema), null, 2));
    } else {
      setInput({});
      setRawText('{}');
    }
  }, [selectedName, selectedTool?.inputSchema]);

  const send = async () => {
    if (!selectedTool) {
      toast('warn', 'Pick a tool first.');
      return;
    }
    // Resolve the payload: raw mode uses the editor text, form mode uses the state.
    let payload: Record<string, unknown>;
    if (rawMode) {
      try {
        payload = JSON.parse(rawText);
      } catch (e) {
        setResponse({ status: 'error', errorMessage: `Invalid JSON: ${e instanceof Error ? e.message : String(e)}`, at: Date.now() });
        return;
      }
    } else {
      payload = input;
    }

    setSending(true);
    setResponse(null);
    const startedAt = performance.now();
    try {
      const output = await backend.invoke(selectedTool.name, payload as JsonObject);
      const durationMs = Math.round(performance.now() - startedAt);
      setResponse({ status: 'success', output, durationMs, at: Date.now() });
      toast('ok', `${selectedTool.name} returned in ${durationMs}ms`);
    } catch (e) {
      const durationMs = Math.round(performance.now() - startedAt);
      const errorMessage = e instanceof Error ? e.message : String(e);
      setResponse({ status: 'error', errorMessage, durationMs, at: Date.now() });
      toast('bad', `${selectedTool.name} failed: ${errorMessage}`);
    } finally {
      setSending(false);
    }
  };

  if (!tools.length) {
    return (
      <EmptyState icon="⚡" title="No tools to play with yet">
        Define a tool in the Editor, load a demo, or point KitKat at a WebMCP URL. Then come back here to invoke it
        manually — Postman-style.
      </EmptyState>
    );
  }

  return (
    <SplitPane
      left={
        <div className="h-full flex flex-col bg-surface-1">
          <div className="px-3 py-2.5 border-b border-border-subtle">
            <div className="text-2xs uppercase tracking-wider text-content-muted font-semibold mb-1">Collection</div>
            <div className="text-xs text-content-tertiary">Pick a tool to invoke</div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {tools.map((t) => {
              const on = t.name === selectedName;
              return (
                <button
                  key={t.name}
                  onClick={() => setSelectedName(t.name)}
                  className={`w-full text-left px-3 py-2.5 border-b border-border-subtle transition-colors hover:bg-surface-2 ${on ? 'bg-accent-soft' : ''}`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs opacity-60">{t.annotations?.readOnlyHint ? '🔍' : '✏️'}</span>
                    <span className="font-mono text-sm text-content-primary flex-1 truncate">{t.name}</span>
                  </div>
                  <div className="text-2xs text-content-tertiary truncate mt-0.5 pl-5">{t.description || 'no description'}</div>
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
              Select a tool from the collection.
            </div>
          ) : (
            <div
              className="max-w-content mx-auto p-5 space-y-4"
              onKeyDown={(e) => {
                // Enter-to-send, but not while typing in a field (so Enter can
                // submit a form input naturally instead of firing the tool).
                const t = e.target as HTMLElement;
                const inField = t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA' || t.isContentEditable;
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey || !inField)) {
                  e.preventDefault();
                  void send();
                }
              }}
            >
              {/* Request header — tool identity + Send button (the Postman bar) */}
              <Panel className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Badge tone="info">POST</Badge>
                  <h2 className="font-mono text-lg text-content-primary">{selectedTool.name}</h2>
                  {selectedTool.annotations?.readOnlyHint && <Badge tone="ok">read-only</Badge>}
                </div>
                <p className="text-sm text-content-secondary">{selectedTool.description || 'No description.'}</p>
                <div className="flex items-center gap-2 mt-4">
                  <Button variant="primary" onClick={send} loading={sending}>
                    {!sending && '▶'} Send
                  </Button>
                  <span className="text-xs text-content-muted">⏎ to send</span>
                  <div className="flex-1" />
                  <ModeToggle rawMode={rawMode} setRawMode={(v) => {
                    setRawMode(v);
                    if (v) setRawText(JSON.stringify(input, null, 2));
                    else { try { setInput(JSON.parse(rawText)); } catch { /* keep */ } }
                  }} />
                </div>
              </Panel>

              {/* Request body — either auto-form or raw JSON */}
              <TitledPanel
                title="Input"
                subtitle={rawMode ? 'raw JSON' : 'generated from schema'}
                actions={
                  selectedTool.inputSchema ? (
                    <Button size="sm" variant="ghost" onClick={() => setShowSchema((s) => !s)}>
                      {showSchema ? 'Hide schema' : 'Schema'}
                    </Button>
                  ) : undefined
                }
              >
                {showSchema && selectedTool.inputSchema && (
                  <div className="mb-3 h-40 rounded border border-border-default overflow-hidden">
                    <SchemaViewer value={selectedTool.inputSchema} height="100%" />
                  </div>
                )}
                {rawMode ? (
                  <div className="h-56 rounded border border-border-default overflow-hidden">
                    <SchemaViewer value={rawText} editable onChange={setRawText} height="100%" />
                  </div>
                ) : selectedTool.inputSchema ? (
                  <AutoForm schema={selectedTool.inputSchema} values={input} onChange={setInput} />
                ) : (
                  <div className="text-sm text-content-muted italic">This tool declares no input schema.</div>
                )}
              </TitledPanel>

              {/* Response — the result panel */}
              <ResponsePanel response={response} sending={sending} />
            </div>
          )}
        </div>
      }
    />
  );
}

// ---------------------------------------------------------------------------
// Auto-generated input form from a JSON Schema (the "body" of the request)
// ---------------------------------------------------------------------------

function AutoForm({
  schema,
  values,
  onChange,
}: {
  schema: JsonSchema;
  values: Record<string, unknown>;
  onChange: (v: Record<string, unknown>) => void;
}) {
  const props = (schema.properties as Record<string, JsonSchema>) ?? {};
  const required = new Set((schema.required as string[] | undefined) ?? []);
  const entries = Object.entries(props);

  if (!entries.length) {
    return <div className="text-sm text-content-muted italic">No parameters.</div>;
  }

  const set = (key: string, val: unknown) => onChange({ ...values, [key]: val });

  return (
    <div className="grid sm:grid-cols-2 gap-3">
      {entries.map(([key, prop]) => (
        <Field
          key={key}
          label={
            <span className="flex items-center gap-1.5">
              <span className="font-mono text-content-primary">{key}</span>
              {required.has(key) && <span className="text-bad">*</span>}
              {typeof prop.description === 'string' && prop.description.length > 0 && (
                <span className="text-content-muted font-normal">— {prop.description}</span>
              )}
            </span>
          }
          hint={typeHint(prop)}
        >
          <SchemaControl prop={prop} value={values[key]} onChange={(v) => set(key, v)} />
        </Field>
      ))}
    </div>
  );
}

/** Render the right input control for a property's schema. */
function SchemaControl({
  prop,
  value,
  onChange,
}: {
  prop: JsonSchema;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  // Enum → select
  if (Array.isArray(prop.enum) && prop.enum.length) {
    return (
      <Select value={String(value ?? '')} onChange={(e) => onChange(e.target.value)}>
        <option value="">— select —</option>
        {prop.enum.map((opt) => (
          <option key={String(opt)} value={String(opt)}>
            {String(opt)}
          </option>
        ))}
      </Select>
    );
  }
  // Boolean → checkbox-style select
  if (prop.type === 'boolean') {
    return (
      <Select value={value === undefined ? '' : String(value)} onChange={(e) => onChange(e.target.value === '' ? undefined : e.target.value === 'true')}>
        <option value="">— unset —</option>
        <option value="true">true</option>
        <option value="false">false</option>
      </Select>
    );
  }
  // Number / integer
  if (prop.type === 'number' || prop.type === 'integer') {
    const num = typeof value === 'number' ? value : value === undefined ? '' : String(value);
    return (
      <Input
        type="number"
        value={num}
        min={typeof prop.minimum === 'number' ? prop.minimum : undefined}
        max={typeof prop.maximum === 'number' ? prop.maximum : undefined}
        step={prop.type === 'integer' ? 1 : 'any'}
        onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
      />
    );
  }
  // Default → text
  return (
    <Input
      type={prop.format === 'date' ? 'date' : prop.format === 'email' ? 'email' : prop.format === 'uri' ? 'url' : 'text'}
      value={value === undefined || value === null ? '' : String(value)}
      minLength={typeof prop.minLength === 'number' ? prop.minLength : undefined}
      maxLength={typeof prop.maxLength === 'number' ? prop.maxLength : undefined}
      placeholder={Array.isArray(prop.examples) ? String(prop.examples[0] ?? '') : undefined}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

/** A short, human label for a property's type (e.g. "string · enum · required"). */
function typeHint(prop: JsonSchema): string | undefined {
  const parts: string[] = [];
  if (prop.type) parts.push(prop.type as string);
  if (Array.isArray(prop.enum) && prop.enum.length) parts.push(`${prop.enum.length} options`);
  if (typeof prop.minimum === 'number') parts.push(`min ${prop.minimum}`);
  if (typeof prop.maximum === 'number') parts.push(`max ${prop.maximum}`);
  return parts.length ? parts.join(' · ') : undefined;
}

/** Best-effort default values from a schema, so the form isn't empty. */
function defaultsFromSchema(schema?: JsonSchema): Record<string, unknown> {
  if (!schema) return {};
  const props = (schema.properties as Record<string, JsonSchema>) ?? {};
  const required = (schema.required as string[] | undefined) ?? [];
  const out: Record<string, unknown> = {};
  for (const key of required) {
    const p = props[key];
    if (!p) continue;
    out[key] = defaultValue(p);
  }
  return out;
}

function defaultValue(prop: JsonSchema): unknown {
  if (Array.isArray(prop.enum) && prop.enum.length) return prop.enum[0];
  switch (prop.type) {
    case 'string':
      return prop.format === 'date' ? new Date().toISOString().slice(0, 10) : 'test';
    case 'number':
    case 'integer':
      return typeof prop.minimum === 'number' ? prop.minimum : 1;
    case 'boolean':
      return false;
    default:
      return '';
  }
}

// ---------------------------------------------------------------------------
// Response panel — the result of the invocation
// ---------------------------------------------------------------------------

interface ResponseState {
  status: 'success' | 'error';
  output?: unknown;
  errorMessage?: string;
  durationMs?: number;
  at: number;
}

function ResponsePanel({ response, sending }: { response: ResponseState | null; sending: boolean }) {
  let tone: 'ok' | 'bad' | 'neutral' = 'neutral';
  let statusText = '—';
  if (response) {
    tone = response.status === 'success' ? 'ok' : 'bad';
    statusText = response.status === 'success' ? '200 OK' : '500 Error';
  }

  return (
    <TitledPanel
      title="Response"
      subtitle={response ? `${response.durationMs ?? 0}ms` : undefined}
      actions={
        <div className="flex items-center gap-2">
          {response && <Badge tone={toneFor(tone === 'ok' ? 'pass' : 'fail')}>{statusText}</Badge>}
        </div>
      }
    >
      {sending ? (
        <div className="h-32 flex items-center justify-center text-sm text-content-tertiary">
          <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full" style={{ animation: 'kitkat-spin 0.6s linear infinite' }} />
          <span className="ml-2">Running tool…</span>
        </div>
      ) : !response ? (
        <div className="h-32 flex items-center justify-center text-sm text-content-muted">
          Hit <span className="text-accent mx-1">Send</span> to invoke the tool and see its response here.
        </div>
      ) : response.status === 'error' ? (
        <div className="p-3 rounded bg-bad-soft text-bad font-mono text-xs whitespace-pre-wrap">
          {response.errorMessage}
        </div>
      ) : (
        <div className="h-48 rounded border border-border-default overflow-hidden">
          <SchemaViewer value={response.output ?? null} height="100%" />
        </div>
      )}
    </TitledPanel>
  );
}

/** Toggle between the auto-generated form and raw JSON input. */
function ModeToggle({ rawMode, setRawMode }: { rawMode: boolean; setRawMode: (v: boolean) => void }) {
  return (
    <div className="flex items-center bg-surface-2 rounded p-0.5 text-xs">
      <button
        onClick={() => setRawMode(false)}
        className={`px-2 py-1 rounded transition-colors ${!rawMode ? 'bg-accent text-white' : 'text-content-tertiary'}`}
      >
        Form
      </button>
      <button
        onClick={() => setRawMode(true)}
        className={`px-2 py-1 rounded transition-colors ${rawMode ? 'bg-accent text-white' : 'text-content-tertiary'}`}
      >
        Raw JSON
      </button>
    </div>
  );
}
