import { useState } from 'react';
import { Badge, Button, Field, Input, Panel, Select } from '@kitkat/ui';
import { SchemaViewer } from '../components/SchemaViewer.js';
import { STARTER_TOOL, type InlineTool } from '../backend/in-memory.js';

/** The starter tool so the editor has something to show on first load. */
export { STARTER_TOOL };

/**
 * Inline tool editor — define WebMCP tools and register them into the in-memory
 * backend instantly. The signature feature of the web app: Postman-for-WebMCP,
 * fully offline. Edits compile on Apply and immediately appear in the
 * Validator/Debugger.
 */
export function ToolEditor({
  tools,
  onApply,
  onRemove,
  onLoadStarter,
}: {
  tools: InlineTool[];
  onApply: (tool: InlineTool) => void;
  onRemove: (name: string) => void;
  onLoadStarter: () => void;
}) {
  const [draft, setDraft] = useState<InlineTool>(tools[0] ?? STARTER_TOOL);
  const [schemaText, setSchemaText] = useState(JSON.stringify(draft.inputSchema ?? {}, null, 2));
  const [error, setError] = useState<string | null>(null);

  const apply = () => {
    setError(null);
    let parsedSchema: Record<string, unknown> | undefined;
    try {
      parsedSchema = schemaText.trim() ? JSON.parse(schemaText) : undefined;
    } catch (e) {
      setError(`Invalid JSON schema: ${e instanceof Error ? e.message : String(e)}`);
      return;
    }
    try {
      // Compile-check the handler.
      // eslint-disable-next-line no-new-func
      new Function('input', 'client', `"use strict";\n${draft.handlerSource}`);
    } catch (e) {
      setError(`Handler syntax error: ${e instanceof Error ? e.message : String(e)}`);
      return;
    }
    onApply({ ...draft, inputSchema: parsedSchema });
  };

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4 bg-surface-0">
      <Panel className="p-3.5">
        <div className="flex items-center gap-2 mb-3">
          <h3 className="text-sm font-semibold text-content-primary">Define a tool</h3>
          <Badge tone="accent">inline</Badge>
          <div className="flex-1" />
          <Button size="sm" variant="ghost" onClick={onLoadStarter}>
            Reset to starter
          </Button>
        </div>

        <div className="grid md:grid-cols-2 gap-3">
          <div className="space-y-3">
            <Field label="Tool name (dotted identifier)">
              <Input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="shop.search"
                className="font-mono"
              />
            </Field>
            <Field label="Description (what tells an agent WHEN to call)">
              <Input
                value={draft.description}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                placeholder="Search products by query."
              />
            </Field>
            <Field label="Annotations">
              <Select
                value={draft.readOnlyHint ? 'ro' : 'mut'}
                onChange={(e) => setDraft({ ...draft, readOnlyHint: e.target.value === 'ro' })}
                className="w-auto"
              >
                <option value="ro">readOnlyHint: true (no side effects)</option>
                <option value="mut">mutating (requests consent)</option>
              </Select>
            </Field>
          </div>

          <div className="space-y-2">
            <Field label="inputSchema (JSON)">
              <div className="h-40 rounded overflow-hidden border border-border-default">
                <SchemaViewer value={schemaText} editable onChange={setSchemaText} height="100%" />
              </div>
            </Field>
          </div>
        </div>

        <Field label="execute handler (JavaScript)" className="mt-3">
          <div className="h-48 rounded overflow-hidden border border-border-default">
            <HandlerEditor value={draft.handlerSource} onChange={(v) => setDraft({ ...draft, handlerSource: v })} />
          </div>
        </Field>

        {error && (
          <div className="mt-2 px-3 py-2 rounded bg-bad-soft text-bad text-xs font-mono">{error}</div>
        )}

        <div className="flex items-center gap-2 mt-3">
          <Button variant="primary" onClick={apply}>
            Apply — register tool
          </Button>
          <span className="text-xs text-content-muted">
            Applied tools appear instantly in the Validator and Debugger.
          </span>
        </div>
      </Panel>

      <Panel className="overflow-hidden">
        <div className="px-3.5 py-2 border-b border-border-subtle bg-surface-2 flex items-center gap-2">
          <h3 className="text-xs uppercase tracking-wider text-content-tertiary font-semibold">
            Registered inline tools ({tools.length})
          </h3>
        </div>
        <div className="divide-y divide-border-subtle">
          {tools.length === 0 && (
            <div className="px-3.5 py-4 text-sm text-content-muted">No tools yet — define one above.</div>
          )}
          {tools.map((t) => (
            <div key={t.name} className="px-3.5 py-2.5 flex items-center gap-2">
              <Badge tone={t.readOnlyHint ? 'ok' : 'warn'}>{t.readOnlyHint ? 'read' : 'write'}</Badge>
              <span className="font-mono text-sm text-content-primary">{t.name}</span>
              <span className="text-xs text-content-tertiary truncate flex-1">{t.description}</span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setDraft(t);
                  setSchemaText(JSON.stringify(t.inputSchema ?? {}, null, 2));
                }}
              >
                edit
              </Button>
              <Button size="sm" variant="ghost" onClick={() => onRemove(t.name)}>
                remove
              </Button>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

/** Monaco-backed JS editor for the handler. */
function HandlerEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return <SchemaViewer value={value} editable onChange={onChange} height="100%" language="javascript" />;
}
